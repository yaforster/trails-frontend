import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ActionResultView } from './test-result-details.models';
import { actionResultLabel } from './test-result-formatting';

@Component({
  selector: 'app-action-result-card',
  templateUrl: './action-result-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionResultCardComponent {
  readonly action = input.required<ActionResultView>();
  readonly pathResultId = input<number | undefined>();

  protected readonly actionResultLabel = actionResultLabel;
}
