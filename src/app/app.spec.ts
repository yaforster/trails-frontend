import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core';
import { App } from './app';
import { TRAILS_FRONTEND_CONFIG } from './core/api-config';
import { AppNotificationService } from './core/app-notification.service';
import { ShellComponent } from './layout/shell.component';

describe('App', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string): MediaQueryList =>
        ({
          matches: false,
          media: query,
          onchange: null,
          addEventListener: (): void => undefined,
          removeEventListener: (): void => undefined,
          dispatchEvent: (): boolean => false,
          addListener: (): void => undefined,
          removeListener: (): void => undefined,
        }) as MediaQueryList,
    });
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideTaiga()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the routed application shell', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('should toggle the primary navigation', async () => {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [ShellComponent],
        providers: [
          provideHttpClient(),
          provideRouter([]),
          provideTaiga(),
          {
            provide: TRAILS_FRONTEND_CONFIG,
            useValue: {
              trailsApiBaseUrl: 'http://localhost:8080',
              keycloakTokenUrl: 'http://localhost:8081/token',
            },
          },
        ],
      })
      .compileComponents();

    const fixture = TestBed.createComponent(ShellComponent);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const navigationToggle: HTMLButtonElement | null = compiled.querySelector(
      'button[aria-label="Collapse navigation"]',
    );
    const navigation: HTMLElement | null = compiled.querySelector('aside[tuiNavigationAside]');

    expect(navigation?.classList.contains('navigation-expanded')).toBe(true);
    navigationToggle?.click();
    fixture.detectChanges();

    expect(navigationToggle?.getAttribute('aria-label')).toBe('Expand navigation');
    expect(navigation?.classList.contains('navigation-collapsed')).toBe(true);
  });

  it('keeps only required primary navigation routes', async () => {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [ShellComponent],
        providers: [
          provideHttpClient(),
          provideRouter([]),
          provideTaiga(),
          {
            provide: TRAILS_FRONTEND_CONFIG,
            useValue: {
              trailsApiBaseUrl: 'http://localhost:8080',
              keycloakTokenUrl: 'http://localhost:8081/token',
            },
          },
        ],
      })
      .compileComponents();

    const fixture = TestBed.createComponent(ShellComponent);
    await fixture.whenStable();
    fixture.detectChanges();

    const links: NodeListOf<HTMLAnchorElement> =
      fixture.nativeElement.querySelectorAll('aside a[aria-label]');
    const labels: string[] = Array.from(links).map(
      (link: HTMLAnchorElement) => link.getAttribute('aria-label') ?? '',
    );

    expect(labels).toEqual(['Login', 'Data management', 'Test plan modeller', 'Test results']);
    expect(labels).not.toContain('Metrics');
    expect(
      fixture.nativeElement
        .querySelector('a[routerLink="/test-plan-modeller"]')
        ?.getAttribute('tuiAsideItem'),
    ).toBe('Test plan modeller');
  });

  it('renders accessible opaque result notifications with working actions', async () => {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [ShellComponent],
        providers: [
          provideHttpClient(),
          provideRouter([]),
          provideTaiga(),
          {
            provide: TRAILS_FRONTEND_CONFIG,
            useValue: {
              trailsApiBaseUrl: 'http://localhost:8080',
              keycloakTokenUrl: 'http://localhost:8081/token',
            },
          },
        ],
      })
      .compileComponents();

    const fixture = TestBed.createComponent(ShellComponent);
    const notificationService = TestBed.inject(AppNotificationService);
    let callbackCalled = false;
    let notificationVisibleDuringCallback = false;
    notificationService.show({
      severity: 'success',
      summary: 'Test completed',
      detail: 'Test completed.',
      action: {
        label: 'View',
        run: () => {
          callbackCalled = true;
          notificationVisibleDuringCallback =
            notificationService.notifications().length === 1;
        },
      },
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const toast = compiled.querySelector('.notification-surface');
    const liveRegion = compiled.querySelector('[aria-live="polite"]');
    const buttons = Array.from(compiled.querySelectorAll('button'));
    const view = buttons.find((button) => button.textContent?.trim() === 'View');
    const dismiss = buttons.find((button) => button.textContent?.trim() === 'Dismiss');

    expect(toast?.classList.contains('app-notification')).toBe(true);
    expect(toast?.classList.contains('notification-success')).toBe(true);
    expect(toast?.hasAttribute('tuiNotification')).toBe(true);
    expect(toast?.textContent).toContain('Test completed');
    expect(toast?.textContent).toContain('Test completed.');
    expect(liveRegion).toBeTruthy();
    expect(view?.disabled).toBe(false);
    expect(dismiss?.disabled).toBe(false);
    expect(view?.tabIndex).toBeGreaterThanOrEqual(0);
    expect(dismiss?.tabIndex).toBeGreaterThanOrEqual(0);

    view?.click();
    expect(callbackCalled).toBe(true);
    expect(notificationVisibleDuringCallback).toBe(true);
    expect(notificationService.notifications()).toHaveLength(0);

    notificationService.show({ severity: 'error', summary: 'Test failed', detail: 'Failed.' });
    fixture.detectChanges();
    const dismissButton = Array.from(compiled.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Dismiss',
    );
    dismissButton?.click();
    expect(notificationService.notifications()).toHaveLength(0);
  });
});
