import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import type { Capability, CapabilityName } from '../generated/hateoas/types.gen';
import { HATEOAS_API_BASE_URL } from './api-config';

@Injectable({
  providedIn: 'root',
})
export class CapabilitiesService {
  private readonly apiBaseUrl = inject(HATEOAS_API_BASE_URL);
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly capabilitiesSignal = signal<readonly Capability[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly loadedSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly capabilities: Signal<readonly Capability[]> = this.capabilitiesSignal.asReadonly();
  readonly loading: Signal<boolean> = this.loadingSignal.asReadonly();
  readonly loaded: Signal<boolean> = this.loadedSignal.asReadonly();
  readonly error: Signal<string | null> = this.errorSignal.asReadonly();
  readonly capabilitiesByName = computed<ReadonlyMap<CapabilityName, Capability>>(() => {
    const capabilitiesByName = new Map<CapabilityName, Capability>();

    for (const capability of this.capabilitiesSignal()) {
      capabilitiesByName.set(capability.name, capability);
    }

    return capabilitiesByName;
  });

  ensureCapabilities(): void {
    if (this.loadedSignal() || this.loadingSignal()) {
      return;
    }

    this.loadCapabilities();
  }

  refreshCapabilities(): void {
    if (this.loadingSignal()) {
      return;
    }

    this.loadedSignal.set(false);
    this.loadCapabilities();
  }

  capability(name: CapabilityName): Capability | null {
    return this.capabilitiesByName().get(name) ?? null;
  }

  value(name: CapabilityName): string | null {
    return this.capability(name)?.value ?? null;
  }

  numberValue(name: CapabilityName): number | null {
    const value = this.value(name);

    if (value === null) {
      return null;
    }

    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  booleanValue(name: CapabilityName): boolean | null {
    const value = this.value(name)?.toLowerCase();

    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    return null;
  }

  private loadCapabilities(): void {
    const token = this.auth.accessToken();

    if (!token) {
      this.errorSignal.set('A valid token is required to load service capabilities.');
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    this.http
      .get<Capability[]>(this.apiUrl('/api/capabilities'), {
        headers: new HttpHeaders({
          Authorization: `Bearer ${token}`,
        }),
      })
      .pipe(finalize(() => this.loadingSignal.set(false)))
      .subscribe({
        next: (capabilities) => {
          this.capabilitiesSignal.set(capabilities);
          this.loadedSignal.set(true);
        },
        error: (error: unknown) => {
          this.errorSignal.set(this.toCapabilitiesError(error).message);
        },
      });
  }

  private apiUrl(path: string): string {
    return `${this.apiBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }

  private toCapabilitiesError(error: unknown): Error {
    if (error instanceof HttpErrorResponse) {
      const message = this.getString(error.error, 'message');
      return new Error(message ?? 'Failed to load service capabilities.');
    }

    return new Error('Failed to load service capabilities.');
  }

  private getString(source: unknown, key: string): string | null {
    if (!this.isRecord(source)) {
      return null;
    }

    const value = source[key];
    return typeof value === 'string' ? value : null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
