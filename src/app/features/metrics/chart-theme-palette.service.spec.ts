import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ThemeService } from '../../core/theme.service';
import { ChartThemePaletteService } from './chart-theme-palette.service';

describe('ChartThemePaletteService', () => {
  const settledRevision = signal(0);
  let document: Document;
  let service: ChartThemePaletteService;
  let originalStyle: string;
  let originalTheme: string | null;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ChartThemePaletteService,
        {
          provide: ThemeService,
          useValue: { settledRevision: settledRevision.asReadonly() },
        },
      ],
    });
    document = TestBed.inject(DOCUMENT);
    originalStyle = document.body.getAttribute('style') ?? '';
    originalTheme = document.body.getAttribute('tuiTheme');
    service = TestBed.inject(ChartThemePaletteService);
  });

  afterEach(() => {
    document.body.setAttribute('style', originalStyle);

    if (originalTheme === null) {
      document.body.removeAttribute('tuiTheme');
    } else {
      document.body.setAttribute('tuiTheme', originalTheme);
    }
  });

  it('reads light palette values from the body scope', async () => {
    setPalette('light-action');
    settledRevision.update((revision: number) => revision + 1);
    TestBed.flushEffects();

    expect(service.palette()?.action).toBe('light-action');
  });

  it('reads dark palette values from the Taiga body theme scope', async () => {
    document.body.setAttribute('tuiTheme', 'dark');
    setPalette('dark-action');
    settledRevision.update((revision: number) => revision + 1);
    TestBed.flushEffects();

    expect(service.palette()?.action).toBe('dark-action');
  });

  function setPalette(action: string): void {
    const values: Record<string, string> = {
      '--trails-chart-action': action,
      '--trails-chart-success': 'success',
      '--trails-chart-warning': 'warning',
      '--trails-chart-danger': 'danger',
      '--trails-chart-contrast': 'contrast',
      '--trails-chart-grid': 'grid',
      '--trails-chart-text': 'text',
      '--trails-chart-line': 'line',
    };

    for (const [property, value] of Object.entries(values)) {
      document.body.style.setProperty(property, value);
    }
  }
});
