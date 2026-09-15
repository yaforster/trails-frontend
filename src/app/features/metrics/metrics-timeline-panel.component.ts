import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  Chart,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartConfiguration,
  type Plugin,
} from 'chart.js';
import type { ResultIndicator, TestRunHistoryPoint } from '../../generated/hateoas';
import type { Deployment } from '../../core/deployment-types';
import { ChartThemePaletteService, type ChartThemePalette } from './chart-theme-palette.service';
import { runLabel, statusLabel, toDate } from './metrics-utils';

Chart.register(Legend, LineController, LineElement, LinearScale, PointElement, Tooltip);

type TimelineDatum = {
  x: number;
  y: number;
  kind: 'run' | 'deployment';
  run?: TestRunHistoryPoint;
  deployment?: Deployment;
};

@Component({
  selector: 'app-metrics-timeline-panel',
  template: `
    <section class="chart-panel" aria-labelledby="timeline-title">
      <div class="chart-header">
        <div>
          <h2 id="timeline-title">Run timeline</h2>
          <p>{{ rangeLabel() }}</p>
        </div>
        <div class="legend" aria-label="Result legend">
          <span class="legend-item status-success">Success</span>
          <span class="legend-item status-partial">Partial</span>
          <span class="legend-item status-failure">Failure</span>
          <span class="legend-item status-deployment">Deployment</span>
        </div>
      </div>

      @if (hasTimelineEvents()) {
        <div class="timeline-controls">
          <label class="timeline-axis-control" for="timeline-axis-range">
            <span>X-axis range</span>
            <input
              id="timeline-axis-range"
              type="range"
              min="50"
              max="300"
              step="10"
              [value]="timelineAxisRangePercent()"
              (input)="updateTimelineAxisRangeFromInput($event)"
            />
            <strong>{{ timelineAxisRangePercent() }}%</strong>
          </label>

          <label class="timeline-axis-control" for="timeline-scroll">
            <span>Timeline position</span>
            <input
              id="timeline-scroll"
              type="range"
              min="0"
              max="100"
              step="1"
              [disabled]="!timelineCanScroll()"
              [value]="timelineScrollPercent()"
              (input)="updateTimelineScrollFromInput($event)"
            />
            <strong>{{ timelineScrollPercent() }}%</strong>
          </label>
        </div>

        <div class="chart-frame">
          <canvas #timelineCanvas role="img" [attr.aria-label]="chartAriaLabel()"></canvas>
        </div>
      } @else {
        <div class="empty-state">
          No runs or deployments have been recorded for this test plan's stage yet.
        </div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricsTimelinePanelComponent implements OnDestroy {
  readonly runs = input<TestRunHistoryPoint[]>([]);
  readonly deployments = input<Deployment[]>([]);
  readonly testPlanId = input<number | null>(null);

  private readonly dateFormat = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  private timelineCanvasRef: ElementRef<HTMLCanvasElement> | null = null;
  private timelineChart: Chart<'line', TimelineDatum[], number> | null = null;
  private readonly chartPalette = inject(ChartThemePaletteService);

  protected readonly timelineAxisRangePercent = signal(100);
  protected readonly timelineScrollPercent = signal(50);
  protected readonly timelineCanScroll = computed(
    () => this.timelineRange(this.timelineData(this.runs(), this.deployments())).canScroll,
  );
  protected readonly hasTimelineEvents = computed(
    () => this.runs().length > 0 || this.deployments().length > 0,
  );
  protected readonly rangeLabel = computed(() => {
    const data = this.timelineData(this.runs(), this.deployments());

    if (data.length === 0) {
      return 'No timeline events yet';
    }

    const first = new Date(data[0].x);
    const last = new Date(data[data.length - 1].x);

    if (!first || !last) {
      return `${data.length} timeline events`;
    }

    if (data.length === 1) {
      return this.dateFormat.format(first);
    }

    return `${this.dateFormat.format(first)} to ${this.dateFormat.format(last)}`;
  });
  protected readonly chartAriaLabel = computed(() => {
    const testPlanId = this.testPlanId();
    const count = this.runs().length;
    const deploymentCount = this.deployments().length;
    return testPlanId
      ? `Timeline of ${count} runs and ${deploymentCount} deployments for test plan ${testPlanId}`
      : 'Test run and deployment timeline';
  });

  @ViewChild('timelineCanvas')
  set timelineCanvas(value: ElementRef<HTMLCanvasElement> | undefined) {
    this.timelineCanvasRef = value ?? null;
    this.syncTimelineChart();
  }

  constructor() {
    effect(() => {
      this.runs().length;
      this.deployments().length;
      this.chartPalette.palette();
      queueMicrotask(() => this.syncTimelineChart());
    });
    effect(() => {
      this.timelineAxisRangePercent();
      this.timelineScrollPercent();
      queueMicrotask(() => this.updateTimelineAxisRange());
    });
  }

  ngOnDestroy(): void {
    this.destroyTimelineChart();
  }

  protected updateTimelineAxisRangeFromInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const value = Number(input?.value);

    if (Number.isFinite(value)) {
      this.timelineAxisRangePercent.set(value);
    }
  }

  protected updateTimelineScrollFromInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const value = Number(input?.value);

    if (Number.isFinite(value)) {
      this.timelineScrollPercent.set(value);
    }
  }

  private syncTimelineChart(): void {
    const runs = this.runs();
    const deployments = this.deployments();

    const palette = this.chartPalette.palette();

    if (!this.timelineCanvasRef || !palette || (runs.length === 0 && deployments.length === 0)) {
      this.destroyTimelineChart();
      return;
    }

    this.destroyTimelineChart();
    this.timelineChart = new Chart(
      this.timelineCanvasRef.nativeElement,
      this.timelineConfig(runs, deployments, palette),
    );
  }

  private timelineConfig(
    runs: TestRunHistoryPoint[],
    deployments: Deployment[],
    palette: ChartThemePalette,
  ): ChartConfiguration<'line', TimelineDatum[], number> {
    const runData = this.runTimelineData(runs);
    const deploymentData = this.deploymentTimelineData(deployments);
    const data = this.sortedTimelineData(runData.concat(deploymentData));
    const range = this.timelineRange(data);

    return {
      type: 'line',
      data: {
        datasets: [
          {
            data: runData,
            borderColor: palette.line,
            borderDash: [5, 5],
            borderWidth: 2,
            pointBackgroundColor: runData.map((item) =>
              this.colorForIndicator(item.run?.indicator, palette),
            ),
            pointBorderColor: palette.contrast,
            pointBorderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8,
            showLine: runData.length > 1,
          },
          {
            data: deploymentData,
            borderColor: palette.action,
            pointBackgroundColor: palette.action,
            pointBorderColor: palette.contrast,
            pointBorderWidth: 2,
            pointRadius: 7,
            pointHoverRadius: 9,
            pointStyle: 'rectRot',
            showLine: false,
          },
        ],
      },
      plugins: [this.deploymentMarkerPlugin(deploymentData, palette)],
      options: {
        animation: false,
        maintainAspectRatio: false,
        parsing: false,
        responsive: true,
        scales: {
          x: {
            type: 'linear',
            min: range.min,
            max: range.max,
            grid: { color: palette.grid },
            ticks: {
              color: palette.text,
              maxTicksLimit: 6,
              callback: (value) => this.formatAxisValue(Number(value)),
            },
          },
          y: {
            type: 'linear',
            min: -1.25,
            max: 2.25,
            grid: { color: palette.grid },
            ticks: {
              color: palette.text,
              stepSize: 1,
              callback: (value) => this.axisStatusLabel(Number(value)),
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) =>
                this.formatTimelineDatumTimestamp(items[0]?.raw as TimelineDatum | undefined),
              label: (item) => {
                const datum = item.raw as TimelineDatum | undefined;
                if (datum?.kind === 'deployment') {
                  return `Deployment: ${datum.deployment?.version ?? 'unknown version'}`;
                }
                const run = datum?.run;
                return run ? `${runLabel(run)}: ${statusLabel(run.indicator)}` : '';
              },
            },
          },
        },
      },
    };
  }

  private timelineData(runs: TestRunHistoryPoint[], deployments: Deployment[]): TimelineDatum[] {
    return this.sortedTimelineData(
      this.runTimelineData(runs).concat(this.deploymentTimelineData(deployments)),
    );
  }

  private runTimelineData(runs: TestRunHistoryPoint[]): TimelineDatum[] {
    return runs.map((run, index) => ({
      x: toDate(run.timestamp)?.getTime() ?? index,
      y: this.chartValueForIndicator(run.indicator),
      kind: 'run',
      run,
    }));
  }

  private deploymentTimelineData(deployments: Deployment[]): TimelineDatum[] {
    return deployments.map((deployment, index) => ({
      x: toDate(deployment.deployedAt)?.getTime() ?? index,
      y: -1,
      kind: 'deployment',
      deployment,
    }));
  }

  private sortedTimelineData(data: TimelineDatum[]): TimelineDatum[] {
    return data.filter((item) => Number.isFinite(item.x)).sort((left, right) => left.x - right.x);
  }

  private timelineRange(data: TimelineDatum[]): { min: number; max: number; canScroll: boolean } {
    if (data.length === 0) {
      return { min: 0, max: 1, canScroll: false };
    }

    const values = data.map((item) => item.x);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const singlePointSpan = values.some((value) => value > 100000000000) ? 24 * 60 * 60 * 1000 : 1;
    const baseSpan = min === max ? singlePointSpan : max - min;
    const fullSpan = baseSpan * 1.1;
    const span = fullSpan * (this.timelineAxisRangePercent() / 100);
    const center = min + (max - min) / 2;
    const fullMin = center - fullSpan / 2;
    const canScroll = span < fullSpan;

    if (!canScroll) {
      return {
        min: center - span / 2,
        max: center + span / 2,
        canScroll,
      };
    }

    const scrollableSpan = fullSpan - span;
    const visibleMin = fullMin + scrollableSpan * (this.timelineScrollPercent() / 100);

    return { min: visibleMin, max: visibleMin + span, canScroll };
  }

  private chartValueForIndicator(indicator: ResultIndicator | undefined): number {
    return indicator === 'SUCCESS' ? 2 : indicator === 'PARTIAL_SUCCESS' ? 1 : 0;
  }

  private axisStatusLabel(value: number): string {
    return value === 2
      ? 'Success'
      : value === 1
        ? 'Partial'
        : value === 0
          ? 'Failure'
          : value === -1
            ? 'Deploy'
            : '';
  }

  private colorForIndicator(
    indicator: ResultIndicator | undefined,
    palette: ChartThemePalette,
  ): string {
    return indicator === 'SUCCESS'
      ? palette.success
      : indicator === 'PARTIAL_SUCCESS'
        ? palette.warning
        : palette.danger;
  }

  private formatAxisValue(value: number): string {
    return value > 100000000000 ? this.dateFormat.format(new Date(value)) : String(value);
  }

  private updateTimelineAxisRange(): void {
    if (!this.timelineChart) {
      return;
    }

    const data = this.timelineData(this.runs(), this.deployments());

    if (data.length === 0) {
      return;
    }

    const range = this.timelineRange(data);
    const xScale = this.timelineChart.options.scales?.['x'];

    if (xScale) {
      xScale.min = range.min;
      xScale.max = range.max;
      this.timelineChart.update('none');
    }
  }

  private destroyTimelineChart(): void {
    this.timelineChart?.destroy();
    this.timelineChart = null;
  }

  private formatTimestamp(timestamp: string | undefined): string {
    const date = toDate(timestamp);
    return date ? this.dateFormat.format(date) : 'unknown time';
  }

  private formatTimelineDatumTimestamp(datum: TimelineDatum | undefined): string {
    if (datum?.kind === 'deployment') {
      return this.formatTimestamp(datum.deployment?.deployedAt);
    }
    return this.formatTimestamp(datum?.run?.timestamp);
  }

  private deploymentMarkerPlugin(
    deployments: TimelineDatum[],
    palette: ChartThemePalette,
  ): Plugin<'line'> {
    return {
      id: 'deploymentMarkers',
      afterDatasetsDraw: (chart) => {
        if (deployments.length === 0) {
          return;
        }

        const xScale = chart.scales['x'];
        const { ctx, chartArea } = chart;

        if (!xScale) {
          return;
        }

        ctx.save();
        ctx.strokeStyle = palette.action;
        ctx.fillStyle = palette.action;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.font = '600 11px "Segoe UI", Arial, sans-serif';

        for (const item of deployments) {
          if (item.x < Number(xScale.min) || item.x > Number(xScale.max)) {
            continue;
          }

          const x = xScale.getPixelForValue(item.x);
          ctx.beginPath();
          ctx.moveTo(x, chartArea.top);
          ctx.lineTo(x, chartArea.bottom);
          ctx.stroke();

          const label = this.deploymentLabel(item.deployment);
          ctx.setLineDash([]);
          ctx.fillText(label, Math.min(x + 4, chartArea.right - 80), chartArea.top + 12);
          ctx.setLineDash([4, 4]);
        }

        ctx.restore();
      },
    };
  }

  private deploymentLabel(deployment: Deployment | undefined): string {
    const version = deployment?.version?.trim();
    return version ? `deploy ${version}` : 'deploy';
  }
}
