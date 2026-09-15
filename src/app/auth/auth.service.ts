import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, shareReplay, tap, throwError } from 'rxjs';
import { KEYCLOAK_TOKEN_URL } from '../core/api-config';

const storageKey = 'trails.auth.token';
const refreshDelayRatio = 0.8;
const minimumRefreshDelayMs = 5_000;
const minimumExpiryBufferMs = 1_000;

export type LoginRequest = {
  username: string;
  password: string;
  clientId: string;
  clientSecret?: string;
};

type KeycloakTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_expires_in?: number;
  refresh_token?: string;
  token_type?: string;
  id_token?: string;
  scope?: string;
};

type StoredToken = KeycloakTokenResponse & {
  issuedAt?: number;
  expiresAt: number;
  refreshAt?: number;
  refreshExpiresAt?: number;
  clientId?: string;
  clientSecret?: string;
};

type JwtPayload = {
  realm_access?: {
    roles?: unknown;
  };
  resource_access?: Record<
    string,
    {
      roles?: unknown;
    }
  >;
  roles?: unknown;
  authorities?: unknown;
};

@Injectable({
  providedIn: 'root',
})
export class AuthService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly keycloakTokenUrl = inject(KEYCLOAK_TOKEN_URL);
  private readonly token = signal<StoredToken | null>(this.readStoredToken());
  private refreshTimeout: ReturnType<typeof setTimeout> | null = null;
  private refreshRequest: Observable<StoredToken> | null = null;
  readonly authenticated = computed(() => this.isValidToken(this.token()));
  readonly roles = computed(() => this.extractRoles(this.token()?.access_token));

  constructor() {
    const token = this.token();

    if (token) {
      this.scheduleRefresh(token);
    }
  }

  login(request: LoginRequest): Observable<StoredToken> {
    const body: URLSearchParams = this.buildAuthRequestBody(request);

    return this.http
      .post<KeycloakTokenResponse>(this.keycloakTokenUrl, body.toString(), {
        headers: new HttpHeaders({
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
      })
      .pipe(
        map((response) => this.toStoredToken(response, request)),
        tap((token) => this.storeToken(token)),
        catchError((error: unknown) => throwError(() => this.toLoginError(error))),
      );
  }

  private buildAuthRequestBody(request: LoginRequest): URLSearchParams {
    const body = new URLSearchParams({
      grant_type: 'password',
      username: request.username,
      password: request.password,
      client_id: request.clientId,
    });

    if (request.clientSecret) {
      body.set('client_secret', request.clientSecret);
    }
    return body;
  }

  refreshAccessToken(): Observable<StoredToken> {
    const currentToken = this.token();

    if (!this.canRefreshToken(currentToken)) {
      this.logout();
      return throwError(
        () => new Error('A valid refresh token is required to refresh the session.'),
      );
    }

    if (this.refreshRequest) {
      return this.refreshRequest;
    }

    const body = this.buildRefreshRequestBody(currentToken);

    this.refreshRequest = this.http
      .post<KeycloakTokenResponse>(this.keycloakTokenUrl, body.toString(), {
        headers: new HttpHeaders({
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
      })
      .pipe(
        map((response) => this.toStoredToken(response, currentToken)),
        tap((token) => this.storeToken(token)),
        catchError((error: unknown) => {
          this.logout();
          return throwError(() => this.toRefreshError(error));
        }),
        finalize(() => {
          this.refreshRequest = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    return this.refreshRequest;
  }

  private buildRefreshRequestBody(
    token: StoredToken & { clientId: string; refresh_token: string },
  ): URLSearchParams {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token.refresh_token ?? '',
      client_id: token.clientId,
    });

    if (token.clientSecret) {
      body.set('client_secret', token.clientSecret);
    }

    return body;
  }

  logout(): void {
    this.clearRefreshTimer();
    localStorage.removeItem(storageKey);
    this.token.set(null);
  }

  accessToken(): string | null {
    return this.hasValidToken() ? (this.token()?.access_token ?? null) : null;
  }

  hasRole(role: string): boolean {
    if (!this.authenticated()) {
      return false;
    }

    const roles = this.roles();
    return roles.has(role) || roles.has(`ROLE_${role}`);
  }

  hasValidToken(): boolean {
    const token: StoredToken | null = this.token();

    if (!this.isValidToken(token)) {
      if (token && !this.canRefreshToken(token)) {
        this.logout();
      }
      return false;
    }

    return true;
  }

  private isValidToken(token: StoredToken | null): boolean {
    return !!token?.access_token && token.expiresAt > Date.now();
  }

  private canRefreshToken(
    token: StoredToken | null,
  ): token is StoredToken & { clientId: string; refresh_token: string } {
    return (
      !!token?.refresh_token &&
      !!token.clientId &&
      (!token.refreshExpiresAt || token.refreshExpiresAt > Date.now())
    );
  }

  private toStoredToken(
    response: KeycloakTokenResponse,
    context: StoredToken | LoginRequest,
  ): StoredToken {
    const now = Date.now();
    const accessLifetimeMs = response.expires_in * 1000;
    const refreshDelayMs = Math.max(
      minimumRefreshDelayMs,
      Math.floor(accessLifetimeMs * refreshDelayRatio),
    );
    const latestRefreshDelayMs = Math.max(0, accessLifetimeMs - minimumExpiryBufferMs);
    const previousRefreshExpiresAt =
      'refreshExpiresAt' in context ? context.refreshExpiresAt : undefined;
    const refreshExpiresAt = response.refresh_expires_in
      ? now + response.refresh_expires_in * 1000
      : previousRefreshExpiresAt;

    return {
      ...response,
      refresh_token:
        response.refresh_token ?? ('refresh_token' in context ? context.refresh_token : undefined),
      issuedAt: now,
      expiresAt: now + accessLifetimeMs,
      refreshAt:
        now + Math.max(minimumRefreshDelayMs, Math.min(refreshDelayMs, latestRefreshDelayMs)),
      refreshExpiresAt,
      clientId: context.clientId,
      clientSecret: context.clientSecret,
    };
  }

  private storeToken(token: StoredToken): void {
    localStorage.setItem(storageKey, JSON.stringify(token));
    this.token.set(token);
    this.scheduleRefresh(token);
  }

  private scheduleRefresh(token: StoredToken): void {
    this.clearRefreshTimer();

    if (!this.canRefreshToken(token)) {
      return;
    }

    if (!this.isValidToken(token)) {
      return;
    }

    const delay = Math.max(minimumRefreshDelayMs, this.getRefreshAt(token) - Date.now());
    this.refreshTimeout = setTimeout(() => {
      this.refreshAccessToken().subscribe({
        error: () => undefined,
      });
    }, delay);
  }

  private getRefreshAt(token: StoredToken): number {
    if (token.refreshAt !== undefined) {
      return token.refreshAt;
    }

    if (token.issuedAt !== undefined) {
      return token.issuedAt + Math.floor((token.expiresAt - token.issuedAt) * refreshDelayRatio);
    }

    const remainingLifetimeMs = token.expiresAt - Date.now();
    return Date.now() + Math.max(0, Math.floor(remainingLifetimeMs * refreshDelayRatio));
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
  }

  private extractRoles(accessToken: string | undefined): Set<string> {
    const payload = this.decodeJwtPayload(accessToken);
    const roles = new Set<string>();

    if (!payload) {
      return roles;
    }

    this.addRoles(roles, payload.realm_access?.roles);
    this.addRoles(roles, payload.roles);
    this.addRoles(roles, payload.authorities);

    for (const access of Object.values(payload.resource_access ?? {})) {
      this.addRoles(roles, access.roles);
    }

    return roles;
  }

  private addRoles(target: Set<string>, value: unknown): void {
    if (Array.isArray(value)) {
      value.forEach((entry) => this.addRoles(target, entry));
      return;
    }

    if (typeof value === 'string') {
      value
        .split(' ')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .forEach((role) => target.add(role));
    }
  }

  private decodeJwtPayload(accessToken: string | undefined): JwtPayload | null {
    const payloadSegment = accessToken?.split('.')[1];

    if (!payloadSegment) {
      return null;
    }

    try {
      const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
      return JSON.parse(atob(padded)) as JwtPayload;
    } catch {
      return null;
    }
  }

  private readStoredToken(): StoredToken | null {
    const value: string | null = localStorage.getItem(storageKey);

    if (!value) {
      return null;
    }

    try {
      const token = JSON.parse(value) as StoredToken;
      if (!token.access_token) {
        localStorage.removeItem(storageKey);
        return null;
      }

      if (this.isValidToken(token) || this.canRefreshToken(token)) {
        return token;
      }

      localStorage.removeItem(storageKey);
      return null;
    } catch {
      localStorage.removeItem(storageKey);
      return null;
    }
  }

  private toLoginError(error: unknown): Error {
    if (error instanceof HttpErrorResponse) {
      const description =
        typeof error.error?.error_description === 'string'
          ? error.error.error_description
          : undefined;
      return new Error(
        description ?? 'Login failed. Check the credentials and client configuration.',
      );
    }

    return new Error('Login failed. Check whether the Keycloak server is reachable.');
  }

  private toRefreshError(error: unknown): Error {
    if (error instanceof HttpErrorResponse) {
      const description =
        typeof error.error?.error_description === 'string'
          ? error.error.error_description
          : undefined;
      return new Error(description ?? 'Session refresh failed. Sign in again.');
    }

    return new Error('Session refresh failed. Check whether the Keycloak server is reachable.');
  }

  ngOnDestroy(): void {
    this.clearRefreshTimer();
  }
}
