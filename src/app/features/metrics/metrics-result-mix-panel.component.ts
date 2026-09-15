import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  input,
} from '@angular/core';
import {
  ArcElement,
  Chart,
  DoughnutController,
  Legend,
  Tooltip,
  type ChartConfiguration,
} from 'chart.js';
import type { PagedTestRunHistory } from '../../generated/hateoas';
import { ChartThemePaletteService, type ChartThemePalette } from './chart-theme-palette.service';

Chart.register(ArcElement, DoughnutController, Legend, Tooltip);

@Component({
  selector: 'app-metrics-result-mix-panel',
  template: `
    <section class="distribution-panel" aria-labelledby="distribution-title">
      <h2 id="distribution-title">Result mix</h2>
      @if ((history()?.totalRuns ?? 0) > 0) {
        <div class="mix-chart-frame">
          <canvas #mixCanvas role="img" aria-label="Distribution of test plan run results"></canvas>
        </div>
        <dl class="mix-list">
          <div>
            <dt>Successful</dt>
            <dd>{{ history()?.successfulRuns ?? 0 }}</dd>
          </div>
          <div>
            <dt>Partial</dt>
            <dd>{{ history()?.partialSuccessRuns ?? 0 }}</dd>
          </div>
          <div>
            <dt>Failed</dt>
            <dd>{{ history()?.failedRuns ?? 0 }}</dd>
          </div>
        </dl>
      } @else {
        <div class="empty-state compact">No result distribution available.</div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricsResultMixPanelComponent implements OnDestroy {
  readonly history = input<PagedTestRunHistory | null>(null);

  private mixCanvasRef: ElementRef<HTMLCanvasElement> | null = null;
  private mixChart: Chart<'doughnut', number[], string> | null = null;
  private readonly chartPalette = inject(ChartThemePaletteService);

  @ViewChild('mixCanvas')
  set mixCanvas(value: ElementRef<HTMLCanvasElement> | undefined) {
    this.mixCanvasRef = value ?? null;
    this.syncMixChart();
  }

  constructor() {
    effect(() => {
      const history = this.history();
      history?.totalRuns;
      history?.successfulRuns;
      history?.partialSuccessRuns;
      history?.failedRuns;
      this.chartPalette.palette();
      queueMicrotask(() => this.syncMixChart());
    });
  }

  ngOnDestroy(): void {
    this.destroyMixChart();
  }

  private syncMixChart(): void {
    const metrics = this.history();
    const totalRuns = metrics?.totalRuns ?? 0;

    const palette = this.chartPalette.palette();

    if (!this.mixCanvasRef || !metrics || totalRuns === 0 || !palette) {
      this.destroyMixChart();
      return;
    }

    this.destroyMixChart();
    this.mixChart = this.createMixChart(
      this.mixCanvasRef.nativeElement,
      this.mixConfig(metrics, palette),
    );
  }

  private createMixChart(
    canvas: HTMLCanvasElement,
    configuration: ChartConfiguration<'doughnut', number[], string>,
  ): Chart<'doughnut', number[], string> {
    return new Chart(canvas, configuration);
  }

  private mixConfig(
    metrics: PagedTestRunHistory,
    palette: ChartThemePalette,
  ): ChartConfiguration<'doughnut', number[], string> {
    return {
      type: 'doughnut',
      data: {
        labels: ['Successful', 'Partial', 'Failed'],
        datasets: [
          {
            data: [
              metrics.successfulRuns ?? 0,
              metrics.partialSuccessRuns ?? 0,
              metrics.failedRuns ?? 0,
            ],
            backgroundColor: [palette.success, palette.warning, palette.danger],
            borderColor: palette.contrast,
            borderWidth: 2,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        animation: false,
        cutout: '68%',
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => `${item.label}: ${item.formattedValue}`,
            },
          },
        },
      },
    };
  }

  private destroyMixChart(): void {
    this.mixChart?.destroy();
    this.mixChart = null;
  }
}
