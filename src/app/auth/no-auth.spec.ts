import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HATEOAS_API_BASE_URL,
  KEYCLOAK_TOKEN_URL,
  TRAILS_FRONTEND_CONFIG,
} from '../core/api-config';
import { CapabilitiesService } from '../core/capabilities.service';
import { WorkspaceContextService } from '../context/workspace-context.service';
import { TestExecutionEventsService } from '../test-execution/test-execution-events.service';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CurrentUserProfileService } from './current-user-profile.service';

function configure() {
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: HATEOAS_API_BASE_URL, useValue: 'http://trails.test' },
      {
        provide: TRAILS_FRONTEND_CONFIG,
        useValue: { trailsApiBaseUrl: 'http://trails.test', keycloakTokenUrl: '' },
      },
    ],
  });
  return TestBed.inject(HttpTestingController);
}

function loadAccessMode(http: HttpTestingController, required: boolean) {
  TestBed.inject(CapabilitiesService).initialize().subscribe();
  const request = http.expectOne('http://trails.test/api/capabilities');
  expect(request.request.headers.has('Authorization')).toBe(false);
  request.flush([
    { name: 'AUTHENTICATION_REQUIRED', value: String(required) },
    { name: 'USER_FEATURES_ACTIVE', value: 'true' },
  ]);
}

describe('credential-free Trails access', () => {
  it('retains provider login and bearer headers when authentication is required', () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: HATEOAS_API_BASE_URL, useValue: 'http://trails.test' },
        { provide: KEYCLOAK_TOKEN_URL, useValue: 'http://provider.test/token' },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    loadAccessMode(http, true);
    const auth = TestBed.inject(AuthService);
    auth.login({ username: 'user', password: 'password', clientId: 'client' }).subscribe();
    const login = http.expectOne('http://provider.test/token');
    expect(login.request.body).toContain('grant_type=password');
    login.flush({ access_token: 'provider-token', expires_in: 60, token_type: 'Bearer' });
    TestBed.inject(WorkspaceContextService).fetchResource('/api/applications').subscribe();
    const request = http.expectOne('http://trails.test/api/applications');
    expect(request.request.headers.get('Authorization')).toBe('Bearer provider-token');
    request.flush({});
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('allows navigation and all role checks without manufacturing a token', () => {
    const http = configure();
    loadAccessMode(http, false);
    const auth = TestBed.inject(AuthService);
    expect(auth.authenticated()).toBe(true);
    expect(auth.hasRole('any-role')).toBe(true);
    expect(auth.accessToken()).toBeNull();
    expect(TestBed.runInInjectionContext(() => authGuard({} as never, {} as never))).toBe(true);
  });

  it('does not grant access when metadata is unavailable', () => {
    const http = configure();
    TestBed.inject(CapabilitiesService).initialize().subscribe();
    http.expectOne('http://trails.test/api/capabilities').flush('offline', {
      status: 503,
      statusText: 'Unavailable',
    });
    expect(TestBed.inject(AuthService).authenticated()).toBe(false);
    expect(TestBed.inject(CapabilitiesService).error()).toBeTruthy();
  });

  it('does not interpret missing authentication metadata as unrestricted', () => {
    const http = configure();
    TestBed.inject(CapabilitiesService).initialize().subscribe();
    http.expectOne('http://trails.test/api/capabilities').flush([]);
    expect(TestBed.inject(AuthService).unrestricted()).toBe(false);
  });

  it('continues redirecting credential-free users to login for role-based access', async () => {
    const http = configure();
    loadAccessMode(http, true);
    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    const redirect = await firstValueFrom(result as import('rxjs').Observable<unknown>);
    expect(redirect).toEqual(TestBed.inject(Router).createUrlTree(['/login']));
  });

  it('loads and updates the shared profile without Authorization headers', () => {
    const http = configure();
    loadAccessMode(http, false);
    const profiles = TestBed.inject(CurrentUserProfileService);
    profiles.ensureProfile();
    const read = http.expectOne('http://trails.test/user/profile');
    expect(read.request.headers.has('Authorization')).toBe(false);
    read.flush({ userId: '803e31d2-04dd-4c20-9ab7-9861a753f497' });
    profiles.updateProfile({ firstName: 'Shared' }).subscribe();
    const update = http.expectOne('http://trails.test/user/profile');
    expect(update.request.method).toBe('PUT');
    expect(update.request.headers.has('Authorization')).toBe(false);
    update.flush({ userId: '803e31d2-04dd-4c20-9ab7-9861a753f497', firstName: 'Shared' });
    expect(profiles.profile()?.firstName).toBe('Shared');
  });

  it('loads resources, submits mutations, and downloads files without credentials', () => {
    const http = configure();
    loadAccessMode(http, false);
    const context = TestBed.inject(WorkspaceContextService);
    context.fetchResource('/api/applications').subscribe();
    context.putResource('/api/applications', { label: 'Shared' }).subscribe();
    context.fetchBlob('/api/report.pdf').subscribe();
    const requests = http.match(() => true);
    expect(requests).toHaveLength(3);
    for (const request of requests) {
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush(request.request.responseType === 'blob' ? new Blob(['pdf']) : {});
    }
  });

  it('streams execution events without a bearer token', async () => {
    const http = configure();
    loadAccessMode(http, false);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('data: {"status":"COMPLETED","testRunId":42}\n\n', {
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const result = await firstValueFrom(TestBed.inject(TestExecutionEventsService).listen('run'));
    expect(result.testRunId).toBe(42);
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ Accept: 'text/event-stream' });
  });

  it('ignores stored provider credentials and schedules no token refresh', () => {
    const http = configure();
    localStorage.setItem(
      'trails.auth.token',
      JSON.stringify({
        access_token: 'old-provider-token',
        refresh_token: 'old-refresh',
        expiresAt: Date.now() + 60_000,
        clientId: 'old-client',
      }),
    );
    loadAccessMode(http, false);
    const auth = TestBed.inject(AuthService);
    TestBed.tick();
    expect(auth.accessToken()).toBeNull();
    auth
      .refreshAccessToken()
      .subscribe({ error: (error) => expect(error.message).toContain('not used') });
    http.expectNone((request) => request.url.includes('/token'));
  });
});
