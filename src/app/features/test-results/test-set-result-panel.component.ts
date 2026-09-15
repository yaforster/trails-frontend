import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { TestSetResultView } from './test-result-details.models';
import { runtimeLabel, testSetBrowser } from './test-result-formatting';
import { TestPathResultPanelComponent } from './test-path-result-panel.component';

@Component({
  selector: 'app-test-set-result-panel',
  imports: [DatePipe, TestPathResultPanelComponent],
  templateUrl: './test-set-result-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestSetResultPanelComponent {
  readonly testSet = input.required<TestSetResultView>();
  readonly fallbackTestPlanLabel = input<string | undefined | null>();

  protected readonly runtimeLabel = runtimeLabel;
  protected readonly testSetBrowser = testSetBrowser;
}
