import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { DetailsRoute, TestRunDetailsView } from './test-result-details.models';
import { resultIndicatorLabel } from './test-result-formatting';

@Component({
  selector: 'app-test-run-summary-panel',
  imports: [DatePipe],
  templateUrl: './test-run-summary-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestRunSummaryPanelComponent {
  readonly details = input.required<TestRunDetailsView>();
  readonly detailsRoute = input<DetailsRoute | null>(null);
  readonly savedFileCount = input.required<number>();

  protected readonly resultIndicatorLabel = resultIndicatorLabel;
}
