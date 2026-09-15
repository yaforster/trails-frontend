import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { ThemeService } from '../../core/theme.service';

export type ChartThemePalette = {
  action: string;
  success: string;
  warning: string;
  danger: string;
  contrast: string;
  grid: string;
  text: string;
  line: string;
};

@Injectable({ providedIn: 'root' })
export class ChartThemePaletteService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly theme = inject(ThemeService);
  private readonly paletteState = signal<ChartThemePalette | null>(null);

  readonly palette = this.paletteState.asReadonly();

  constructor() {
    effect(() => {
      this.theme.settledRevision();

      if (!isPlatformBrowser(this.platformId)) {
        return;
      }

      const styles: CSSStyleDeclaration = getComputedStyle(
        this.document.body ?? this.document.documentElement,
      );
      this.paletteState.set({
        action: this.value(styles, '--trails-chart-action'),
        success: this.value(styles, '--trails-chart-success'),
        warning: this.value(styles, '--trails-chart-warning'),
        danger: this.value(styles, '--trails-chart-danger'),
        contrast: this.value(styles, '--trails-chart-contrast'),
        grid: this.value(styles, '--trails-chart-grid'),
        text: this.value(styles, '--trails-chart-text'),
        line: this.value(styles, '--trails-chart-line'),
      });
    });
  }

  private value(styles: CSSStyleDeclaration, property: string): string {
    return styles.getPropertyValue(property).trim();
  }
}
