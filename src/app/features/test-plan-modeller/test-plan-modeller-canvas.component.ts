import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { IPoint } from '@foblex/2d';
import {
  FCreateConnectionEvent,
  FCreateNodeEvent,
  FCanvasComponent,
  FFlowComponent,
  FFlowModule,
  FDropToGroupEvent,
  FZoomDirective,
} from '@foblex/flow';
import { TuiLoader } from '@taiga-ui/core';
import type { TestDataSet } from '../../generated/hateoas/types.gen';
import {
  TestPlanModellerGraphService,
  type ElementPaletteItem,
} from './test-plan-modeller-graph.service';
import { TestPlanActionNodeComponent } from './test-plan-action-node.component';

@Component({
  selector: 'app-test-plan-modeller-canvas',
  imports: [FFlowModule, MatIconModule, TestPlanActionNodeComponent, TuiLoader],
  templateUrl: './test-plan-modeller-canvas.component.html',
  styleUrl: './test-plan-modeller-page.component.css',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestPlanModellerCanvasComponent {
  protected readonly graph = inject(TestPlanModellerGraphService);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly flow = viewChild.required(FFlowComponent);
  private readonly canvas = viewChild.required(FCanvasComponent);
  private readonly zoom = viewChild.required(FZoomDirective);
  private groupSelectionDrag = false;
  private memberDragStart: {
    nodeId: string;
    groupId: string;
    groupRect: { left: number; top: number; right: number; bottom: number };
  } | null = null;

  readonly testDataSets = input.required<TestDataSet[]>();
  readonly testDataLoading = input.required<boolean>();
  readonly testDataError = input.required<string | null>();
  readonly createLoading = input.required<boolean>();
  readonly canCreate = input.required<boolean>();
  readonly validationWarning = input.required<string | null>();
  readonly message = input.required<string | null>();
  readonly error = input.required<string | null>();
  readonly modellerDark = input.required<boolean>();
  readonly fullscreen = input.required<boolean>();
  readonly createPlan = output<MouseEvent>();
  readonly previewDefinition = output<void>();
  readonly toggleModellerTheme = output<void>();
  readonly toggleFullscreen = output<void>();

  protected onCreateNode(event: FCreateNodeEvent<ElementPaletteItem>): void {
    if (!event.data) {
      return;
    }

    this.graph.addNode(event.data, this.nodePositionFromDropEvent(event));
  }

  protected onCreateConnection(event: FCreateConnectionEvent): void {
    if (!event.targetId) {
      return;
    }

    this.graph.connect(event.sourceId, event.targetId);
  }

  protected onMoveNode(event: { nodeId: string; position: { x: number; y: number } }): void {
    this.graph.moveNode(event.nodeId, event.position);
  }

  protected zoomIn(): void {
    this.zoom().zoomIn();
  }

  protected zoomOut(): void {
    this.zoom().zoomOut();
  }

  protected resetView(): void {
    this.canvas().resetScaleAndCenter(true);
  }

  protected fitToScreen(): void {
    this.canvas().fitToScreen(undefined, true);
  }

  protected stopViewportControlDrag(event: PointerEvent): void {
    event.stopPropagation();
  }

  protected deleteNode(nodeId: string): void {
    this.graph.deleteNode(nodeId);
  }

  protected deleteConnection(connectionId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.graph.deleteConnection(connectionId);
  }

  protected onPointerDown(event: PointerEvent): void {
    this.groupSelectionDrag = event.shiftKey;
    this.memberDragStart = null;
    if (event.shiftKey) {
      return;
    }
    const nodeElement = (event.target as HTMLElement).closest<HTMLElement>('[data-node-id]');
    const node = this.graph
      .nodes()
      .find((candidate) => candidate.id === nodeElement?.dataset['nodeId']);
    const group = this.graph.groups().find((candidate) => candidate.id === node?.parentGroupId);
    if (node && group) {
      this.memberDragStart = {
        nodeId: node.id,
        groupId: group.id,
        groupRect: {
          left: group.position.x,
          top: group.position.y,
          right: group.position.x + group.size.width,
          bottom: group.position.y + group.size.height,
        },
      };
    }
  }

  protected onDragEnded(): void {
    if (!this.groupSelectionDrag) {
      this.ungroupMemberDraggedOutside();
      return;
    }
    this.groupSelectionDrag = false;
    this.createGroupFromNodes(this.flow().getSelection().fNodeIds);
  }

  private ungroupMemberDraggedOutside(): void {
    const dragStart = this.memberDragStart;
    this.memberDragStart = null;
    if (!dragStart) {
      return;
    }
    const node = this.graph.nodes().find((candidate) => candidate.id === dragStart.nodeId);
    const group = this.graph.groups().find((candidate) => candidate.id === node?.parentGroupId);
    if (!node || !group || group.id !== dragStart.groupId) {
      return;
    }
    const nodeElement = this.elementRef.nativeElement.querySelector<HTMLElement>(
      `[data-node-id="${node.id}"]`,
    );
    if (!nodeElement) {
      return;
    }
    const center = {
      x: group.position.x + node.position.x + nodeElement.offsetWidth / 2,
      y: group.position.y + node.position.y + nodeElement.offsetHeight / 2,
    };
    const bounds = dragStart.groupRect;
    if (
      center.x < bounds.left ||
      center.x > bounds.right ||
      center.y < bounds.top ||
      center.y > bounds.bottom
    ) {
      this.graph.ungroupNode(node.id);
    }
  }

  protected onDropToGroup(event: FDropToGroupEvent): void {
    this.graph.addNodesToGroup(event.targetGroupId, event.nodeIds);
  }

  protected onGroupLabelInput(groupId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.graph.updateGroupLabel(groupId, input.value);
  }

  private createGroupFromNodes(nodeIds: string[]): void {
    if (nodeIds.length === 0) {
      return;
    }

    const selectedNodes = this.graph.nodes().filter((node) => nodeIds.includes(node.id));
    const horizontalPadding = 32;
    const bottomPadding = 32;
    const headerPadding = 56;
    const bounds = selectedNodes.flatMap((node) => {
      const element = this.elementRef.nativeElement.querySelector<HTMLElement>(
        `[data-node-id="${node.id}"]`,
      );
      const position = this.graph.nodeCanvasPosition(node.id);
      if (!element || !position) {
        return [];
      }
      return {
        left: position.x,
        top: position.y,
        right: position.x + element.offsetWidth,
        bottom: position.y + element.offsetHeight,
      };
    });
    if (bounds.length === 0) {
      return;
    }
    const left = Math.min(...bounds.map((bound) => bound.left)) - horizontalPadding;
    const top = Math.min(...bounds.map((bound) => bound.top)) - headerPadding;
    const right = Math.max(...bounds.map((bound) => bound.right)) + horizontalPadding;
    const bottom = Math.max(...bounds.map((bound) => bound.bottom)) + bottomPadding;

    this.graph.addGroup(
      { x: left, y: top },
      { width: right - left, height: bottom - top },
      nodeIds,
    );
  }

  protected onResizeGroup(
    groupId: string,
    rect: { x: number; y: number; width: number; height: number },
  ): void {
    this.graph.updateGroupRect(groupId, rect);
  }

  private nodePositionFromDropEvent(event: FCreateNodeEvent<ElementPaletteItem>): IPoint {
    const position = event.dropPosition ?? event.externalItemRect;
    const x = Number.isFinite(position.x) ? position.x : 120;
    const y = Number.isFinite(position.y) ? position.y : 120;

    return { x, y };
  }
}
