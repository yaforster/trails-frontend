import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { TUI_DARK_MODE } from '@taiga-ui/core';

export type ThemeMode = 'light' | 'dark';

const darkThemeClass: string = 'app-dark';
const themeStorageKey: string = 'trails-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly taigaDarkMode = inject(TUI_DARK_MODE);
  private readonly browser = isPlatformBrowser(this.platformId);
  private readonly themeMode = signal<ThemeMode>(this.initialThemeMode());
  private readonly settled = signal(0);

  readonly mode = this.themeMode.asReadonly();
  readonly darkMode = computed(() => this.themeMode() === 'dark');
  readonly settledRevision = this.settled.asReadonly();

  constructor() {
    this.apply(this.themeMode());
  }

  toggle(): void {
    this.setMode(this.darkMode() ? 'light' : 'dark');
  }

  setMode(mode: ThemeMode): void {
    this.themeMode.set(mode);
    this.apply(mode);
  }

  private initialThemeMode(): ThemeMode {
    if (!this.browser) {
      return 'light';
    }

    try {
      const stored: string | null = window.localStorage.getItem(themeStorageKey);

      if (stored === 'dark' || stored === 'light') {
        return stored;
      }
    } catch {
      // Storage can be unavailable in privacy-restricted browsers.
    }

    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private apply(mode: ThemeMode): void {
    this.document.documentElement.classList.toggle(darkThemeClass, mode === 'dark');
    this.document.documentElement.style.colorScheme = mode;
    this.taigaDarkMode.set(mode === 'dark');

    if (!this.browser) {
      this.settled.update((revision: number) => revision + 1);
      return;
    }

    try {
      window.localStorage.setItem(themeStorageKey, mode);
    } catch {
      // Theme remains usable when persistent storage is unavailable.
    }

    let attempts: number = 0;
    const settle = (): void => {
      attempts += 1;
      const markerSettled: boolean =
        mode === 'dark'
          ? this.document.body.getAttribute('tuiTheme') === 'dark'
          : this.document.body.getAttribute('tuiTheme') !== 'dark';

      if (markerSettled || attempts === 2) {
        this.settled.update((revision: number) => revision + 1);
        return;
      }

      window.requestAnimationFrame(settle);
    };

    window.requestAnimationFrame(settle);
  }
}
