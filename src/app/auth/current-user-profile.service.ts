import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, OnDestroy, Signal, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, switchMap, tap, throwError } from 'rxjs';
import type { UserProfile, UserProfileUpdate } from '../generated/hateoas/types.gen';
import { HATEOAS_API_BASE_URL } from '../core/api-config';
import { profileLinkHref } from '../core/hateoas-links';
import { AuthService } from './auth.service';

type ProfileLoadResult = {
  profile: UserProfile;
  avatarUrl: string | null;
};

@Injectable({
  providedIn: 'root',
})
export class CurrentUserProfileService implements OnDestroy {
  private readonly apiBaseUrl = inject(HATEOAS_API_BASE_URL);
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly profileSignal = signal<UserProfile | null>(null);
  private readonly avatarUrlSignal = signal<string | null>(null);
  private readonly loadingSignal = signal(false);
  private readonly loadedSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private activeAvatarUrl: string | null = null;
  private requestVersion = 0;

  readonly profile: Signal<UserProfile | null> = this.profileSignal.asReadonly();
  readonly avatarUrl: Signal<string | null> = this.avatarUrlSignal.asReadonly();
  readonly loading: Signal<boolean> = this.loadingSignal.asReadonly();
  readonly loaded: Signal<boolean> = this.loadedSignal.asReadonly();
  readonly error: Signal<string | null> = this.errorSignal.asReadonly();

  ensureProfile(): void {
    if (this.loadedSignal() || this.loadingSignal()) {
      return;
    }

    this.loadProfile();
  }

  refreshProfile(): void {
    if (this.loadingSignal()) {
      return;
    }

    this.loadedSignal.set(false);
    this.loadProfile();
  }

  updateProfile(update: UserProfileUpdate): Observable<UserProfile> {
    const token: string | null = this.auth.accessToken();

    if (!token) {
      return throwError(() => new Error('A valid token is required to update the user profile.'));
    }

    const updateHref = profileLinkHref(this.profileSignal()?.links, 'update') ?? '/user/profile';

    return this.http
      .put<UserProfile>(this.toAbsoluteUrl(updateHref), update, {
        headers: this.authHeaders(token).set('Content-Type', 'application/json'),
      })
      .pipe(
        tap((profile: UserProfile) => {
          this.profileSignal.set(profile);
          this.loadedSignal.set(true);
          this.errorSignal.set(null);
        }),
        catchError((error: unknown) => throwError(() => this.toProfileError(error))),
      );
  }

  updateProfilePicture(file: File): Observable<UserProfile> {
    const token: string | null = this.auth.accessToken();

    if (!token) {
      return throwError(
        () => new Error('A valid token is required to update the profile picture.'),
      );
    }

    const uploadHref =
      profileLinkHref(this.profileSignal()?.links, 'uploadProfilePicture') ??
      '/user/profile/avatar';
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .put(this.toAbsoluteUrl(uploadHref), formData, {
        headers: this.authHeaders(token),
      })
      .pipe(
        switchMap(() => this.reloadProfileAfterAvatarChange(token)),
        catchError((error: unknown) => throwError(() => this.toProfileError(error))),
      );
  }

  deleteProfilePicture(): Observable<UserProfile> {
    const token: string | null = this.auth.accessToken();

    if (!token) {
      return throwError(
        () => new Error('A valid token is required to delete the profile picture.'),
      );
    }

    const deleteHref = profileLinkHref(this.profileSignal()?.links, 'deleteProfilePicture');

    if (!deleteHref) {
      return throwError(
        () => new Error('The API did not advertise permission to delete the profile picture.'),
      );
    }

    return this.http
      .delete<void>(this.toAbsoluteUrl(deleteHref), {
        headers: this.authHeaders(token),
      })
      .pipe(
        switchMap(() => this.reloadProfileAfterAvatarChange(token)),
        catchError((error: unknown) => throwError(() => this.toProfileError(error))),
      );
  }

  clear(): void {
    this.requestVersion += 1;
    this.profileSignal.set(null);
    this.loadingSignal.set(false);
    this.loadedSignal.set(false);
    this.errorSignal.set(null);
    this.replaceAvatarUrl(null);
  }

  private loadProfile(): void {
    const token: string | null = this.auth.accessToken();

    if (!token) {
      this.clear();
      this.errorSignal.set('A valid token is required to load the user profile.');
      return;
    }

    const requestId: number = this.requestVersion + 1;
    this.requestVersion = requestId;
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    this.fetchProfile(token)
      .pipe(
        tap((profile: UserProfile) => this.profileSignal.set(profile)),
        switchMap((profile: UserProfile) => this.fetchAvatar(profile, token)),
        finalize(() => {
          if (requestId === this.requestVersion) {
            this.loadingSignal.set(false);
          }
        }),
      )
      .subscribe({
        next: (result: ProfileLoadResult) => {
          if (requestId !== this.requestVersion) {
            this.revokeUrl(result.avatarUrl);
            return;
          }

          this.profileSignal.set(result.profile);
          this.replaceAvatarUrl(result.avatarUrl);
          this.loadedSignal.set(true);
        },
        error: (error: unknown) => {
          if (requestId !== this.requestVersion) {
            return;
          }

          this.profileSignal.set(null);
          this.replaceAvatarUrl(null);
          this.loadedSignal.set(false);
          this.errorSignal.set(this.toProfileError(error).message);
        },
      });
  }

  private fetchProfile(token: string): Observable<UserProfile> {
    return this.http.get<UserProfile>(this.toAbsoluteUrl('/user/profile'), {
      headers: this.authHeaders(token),
    });
  }

  private fetchAvatar(profile: UserProfile, token: string): Observable<ProfileLoadResult> {
    const avatarHref = profileLinkHref(profile.links, 'getProfilePicture');

    if (!avatarHref) {
      return of({
        profile,
        avatarUrl: null,
      });
    }

    return this.http
      .get(this.toAbsoluteUrl(avatarHref), {
        headers: this.authHeaders(token),
        responseType: 'blob',
      })
      .pipe(
        map((blob: Blob) => ({
          profile,
          avatarUrl: blob.size > 0 ? URL.createObjectURL(blob) : null,
        })),
        catchError(() =>
          of({
            profile,
            avatarUrl: null,
          }),
        ),
      );
  }

  private reloadProfileAfterAvatarChange(token: string): Observable<UserProfile> {
    return this.fetchProfile(token).pipe(
      switchMap((profile: UserProfile) => this.fetchAvatar(profile, token)),
      map((result: ProfileLoadResult) => {
        this.profileSignal.set(result.profile);
        this.replaceAvatarUrl(result.avatarUrl);
        this.loadedSignal.set(true);
        this.errorSignal.set(null);
        return result.profile;
      }),
    );
  }

  private authHeaders(token: string): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  private toAbsoluteUrl(pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) {
      return pathOrUrl;
    }

    return `${this.apiBaseUrl.replace(/\/$/, '')}/${pathOrUrl.replace(/^\//, '')}`;
  }

  private replaceAvatarUrl(avatarUrl: string | null): void {
    this.revokeUrl(this.activeAvatarUrl);
    this.activeAvatarUrl = avatarUrl;
    this.avatarUrlSignal.set(avatarUrl);
  }

  private revokeUrl(url: string | null): void {
    if (!url) {
      return;
    }

    URL.revokeObjectURL(url);
  }

  private toProfileError(error: unknown): Error {
    if (error instanceof HttpErrorResponse) {
      const message: string | null = this.getString(error.error, 'message');

      if (message) {
        return new Error(message);
      }

      const validationMessage: string | null = this.getValidationMessage(error.error);

      if (validationMessage) {
        return new Error(validationMessage);
      }

      if (error.status === 404) {
        return new Error('User profile data is not available.');
      }
    }

    return new Error('Failed to load or update the user profile.');
  }

  private getValidationMessage(source: unknown): string | null {
    if (!Array.isArray(source)) {
      return null;
    }

    const messages: string[] = source
      .map((item: unknown) => this.getString(item, 'message'))
      .filter((message: string | null): message is string => message !== null);

    return messages.length > 0 ? messages.join(' ') : null;
  }

  private getString(source: unknown, key: string): string | null {
    if (!this.isRecord(source)) {
      return null;
    }

    const value: unknown = source[key];
    return typeof value === 'string' ? value : null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  ngOnDestroy(): void {
    this.clear();
  }
}
