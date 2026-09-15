import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PagedTestRunHistory } from '../../generated/hateoas';
import { statusClass, statusLabel } from './metrics-utils';

@Component({
  selector: 'app-metrics-summary-panel',
  imports: [DecimalPipe],
  template: `
    <div class="summary-grid">
      <article class="metric-card">
        <span>Total runs</span>
        <strong>{{ history()?.totalRuns ?? 0 }}</strong>
      </article>
      <article class="metric-card">
        <span>Success rate</span>
        <strong>{{ successRate() | number: '1.0-0' }}%</strong>
      </article>
      <article class="metric-card">
        <span>Last run</span>
        <strong [attr.class]="'status-value ' + statusClass(lastRun()?.indicator)">
          {{ lastRun() ? statusLabel(lastRun()?.indicator) : 'None' }}
        </strong>
      </article>
      <article class="metric-card">
        <span>Current streak</span>
        <strong>
          @if (currentStreak(); as streak) {
            {{ streak.count }} {{ statusLabel(streak.indicator).toLowerCase() }}
          } @else {
            None
          }
        </strong>
      </article>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricsSummaryPanelComponent {
  readonly history = input<PagedTestRunHistory | null>(null);

  protected readonly statusClass = statusClass;
  protected readonly statusLabel = statusLabel;
  protected readonly totalRuns = computed(() => this.history()?.totalRuns ?? 0);
  protected readonly successRate = computed(() => {
    const totalRuns = this.totalRuns();
    return totalRuns === 0 ? 0 : ((this.history()?.successfulRuns ?? 0) / totalRuns) * 100;
  });
  protected readonly lastRun = computed(() => {
    const runs = this.history()?.items ?? [];
    return runs.length > 0 ? runs[runs.length - 1] : null;
  });
  protected readonly currentStreak = computed(() => {
    const runs = this.history()?.items ?? [];
    const lastIndicator = runs[runs.length - 1]?.indicator;

    if (!lastIndicator) {
      return null;
    }

    let count = 0;
    for (
      let index = runs.length - 1;
      index >= 0 && runs[index].indicator === lastIndicator;
      index--
    ) {
      count++;
    }

    return {
      count,
      indicator: lastIndicator,
    };
  });
}
