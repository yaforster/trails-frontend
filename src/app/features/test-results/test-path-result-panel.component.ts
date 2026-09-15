import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { TestPathResultView } from './test-result-details.models';
import { ActionResultCardComponent } from './action-result-card.component';

@Component({
  selector: 'app-test-path-result-panel',
  imports: [ActionResultCardComponent],
  templateUrl: './test-path-result-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestPathResultPanelComponent {
  readonly path = input.required<TestPathResultView>();
  readonly testSetId = input<number | undefined>();
}
