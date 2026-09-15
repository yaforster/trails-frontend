import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FFlowModule } from '@foblex/flow';
import type { TestDataSet } from '../../generated/hateoas/types.gen';
import { nodeSummaryIcon } from './test-plan-modeller-action-icons';
import {
  TestPlanModellerGraphService,
  type ElementFlowNode,
} from './test-plan-modeller-graph.service';
import { TestPlanActionEditorComponent } from './test-plan-action-editor.component';

@Component({
  selector: 'app-test-plan-action-node',
  imports: [FFlowModule, MatIconModule, TestPlanActionEditorComponent],
  templateUrl: './test-plan-action-node.component.html',
  styleUrl: './test-plan-modeller-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestPlanActionNodeComponent {
  private readonly graph = inject(TestPlanModellerGraphService);
  protected readonly nodeSummaryIcon = nodeSummaryIcon;

  readonly node = input.required<ElementFlowNode>();
  readonly testDataSets = input.required<TestDataSet[]>();
  readonly testDataLoading = input.required<boolean>();
  readonly testDataError = input.required<string | null>();
  readonly deleteNode = output<string>();

  protected onNodeLabelChange(event: Event): void {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    this.graph.updateNodeLabel(this.node().id, input?.value ?? '');
  }

  protected removeFromGroup(): void {
    this.graph.ungroupNode(this.node().id);
  }
}
