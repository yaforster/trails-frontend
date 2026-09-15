import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import type { PagedTestRunHistory } from '../../generated/hateoas';
import { ChartThemePaletteService, type ChartThemePalette } from './chart-theme-palette.service';
import { MetricsResultMixPanelComponent } from './metrics-result-mix-panel.component';

describe('MetricsResultMixPanelComponent', () => {
  it('recreates the chart with changed palette colors', async () => {
    const palette = signal<ChartThemePalette | null>(null);
    await TestBed.configureTestingModule({
      imports: [MetricsResultMixPanelComponent],
      providers: [
        { provide: ChartThemePaletteService, useValue: { palette: palette.asReadonly() } },
      ],
    }).compileComponents();

    const fixture: ComponentFixture<MetricsResultMixPanelComponent> = TestBed.createComponent(
      MetricsResultMixPanelComponent,
    );
    fixture.componentRef.setInput('history', history());
    fixture.detectChanges();

    const internals = fixture.componentInstance as unknown as {
      createMixChart: (canvas: HTMLCanvasElement, configuration: unknown) => unknown;
      destroyMixChart: () => void;
    };
    const configurations: unknown[] = [];
    let destroyed: number = 0;
    internals.createMixChart = (_canvas: HTMLCanvasElement, configuration: unknown): unknown => {
      configurations.push(configuration);
      return { destroy: (): void => undefined };
    };
    internals.destroyMixChart = (): void => {
      destroyed += 1;
    };

    palette.set(testPalette('light-success'));
    TestBed.flushEffects();
    await Promise.resolve();
    const firstConfigurationCount: number = configurations.length;
    palette.set(testPalette('dark-success'));
    TestBed.flushEffects();
    await Promise.resolve();

    expect(configurations).toHaveLength(firstConfigurationCount + 1);
    expect(chartColors(configurations[firstConfigurationCount - 1])).toEqual([
      'light-success',
      'warning',
      'danger',
    ]);
    expect(chartColors(configurations[firstConfigurationCount])).toEqual([
      'dark-success',
      'warning',
      'danger',
    ]);
    expect(destroyed).toBeGreaterThanOrEqual(2);
  });
});

function history(): PagedTestRunHistory {
  return { totalRuns: 1, successfulRuns: 1, partialSuccessRuns: 0, failedRuns: 0 };
}

function testPalette(success: string): ChartThemePalette {
  return {
    action: 'action',
    success,
    warning: 'warning',
    danger: 'danger',
    contrast: 'contrast',
    grid: 'grid',
    text: 'text',
    line: 'line',
  };
}

function chartColors(configuration: unknown): unknown {
  const chart = configuration as {
    data: { datasets: Array<{ backgroundColor: unknown }> };
  };
  return chart.data.datasets[0].backgroundColor;
}
