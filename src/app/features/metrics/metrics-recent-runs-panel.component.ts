import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideEye } from '@lucide/angular';
import type { TestRunHistoryPoint } from '../../generated/hateoas';
import { runLabel, statusClass, statusLabel } from './metrics-utils';

@Component({
  selector: 'app-metrics-recent-runs-panel',
  imports: [DatePipe, LucideEye],
  template: `
    <section class="recent-panel" aria-labelledby="recent-title">
      <h2 id="recent-title">Recent runs</h2>
      @if (recentRuns().length > 0) {
        <div class="recent-list">
          @for (run of recentRuns(); track run.id ?? run.timestamp) {
            <div class="recent-row">
              <span [attr.class]="'status-chip ' + statusClass(run.indicator)">{{
                statusLabel(run.indicator)
              }}</span>
              <span class="run-label">{{ runLabel(run) }}</span>
              <time>{{ run.timestamp | date: 'medium' }}</time>
              <button
                class="run-details-button"
                type="button"
                [disabled]="run.id === undefined"
                [attr.aria-label]="'Open details for ' + runLabel(run)"
                title="Open run details"
                (click)="openDetails.emit(run)"
              >
                <svg lucideEye size="16"></svg>
              </button>
            </div>
          }
        </div>
      } @else {
        <div class="empty-state compact">No recent runs.</div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricsRecentRunsPanelComponent {
  readonly runs = input<TestRunHistoryPoint[]>([]);
  readonly openDetails = output<TestRunHistoryPoint>();

  protected readonly runLabel = runLabel;
  protected readonly statusClass = statusClass;
  protected readonly statusLabel = statusLabel;
  protected readonly recentRuns = computed(() => [...this.runs()].reverse().slice(0, 10));
}
