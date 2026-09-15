import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FFlowModule } from '@foblex/flow';
import type {
  ActionDetailsType,
  ElementValueCheckSource,
  TestDataEntry,
  TestDataSet,
  ValueComputationType,
  ViewportMove,
  ViewportMoveDirection,
  ViewportMoveUnit,
} from '../../generated/hateoas/types.gen';
import { actionTypeIcon } from './test-plan-modeller-action-icons';
import {
  TestPlanModellerGraphService,
  type ElementFlowNode,
  type ElementPaletteItem,
} from './test-plan-modeller-graph.service';

@Component({
  selector: 'app-test-plan-action-editor',
  imports: [FFlowModule, MatIconModule],
  templateUrl: './test-plan-action-editor.component.html',
  styleUrl: './test-plan-modeller-page.component.css',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestPlanActionEditorComponent {
  protected readonly graph = inject(TestPlanModellerGraphService);
  protected readonly actionTypeIcon = actionTypeIcon;
  protected readonly openActionMenu = signal(false);

  readonly node = input.required<ElementFlowNode>();
  readonly testDataSets = input.required<TestDataSet[]>();
  readonly testDataLoading = input.required<boolean>();
  readonly testDataError = input.required<string | null>();

  protected selectableActionTypes(
    node: ElementPaletteItem & { action: { detailsType: ActionDetailsType | null } },
  ): readonly ActionDetailsType[] {
    if (node.defaultActionType) {
      return [node.defaultActionType];
    }

    return this.graph.actionTypes.filter(
      (actionType) =>
        actionType !== 'LOCAL_STORAGE_SEARCH' &&
        actionType !== 'SESSION_STORAGE_SEARCH' &&
        actionType !== 'COOKIE_SEARCH' &&
        actionType !== 'EXPLICIT_WAIT' &&
        actionType !== 'DOWNLOADED_FILE_CHECK' &&
        actionType !== 'DOWNLOADED_DOCUMENT_TEXT_CHECK' &&
        actionType !== 'VIEWPORT_MOVE' &&
        actionType !== 'COORDINATE_CLICK' &&
        actionType !== 'RESIZE_VIEWPORT',
    );
  }

  protected selectActionType(actionType: ActionDetailsType | null): void {
    this.graph.updateActionType(this.node().id, actionType);
    this.openActionMenu.set(false);
  }

  protected toggleActionMenu(): void {
    this.openActionMenu.update((open: boolean) => !open);
  }

  protected onValueComputationTypeChange(event: Event): void {
    this.graph.updateActionField(
      this.node().id,
      'valueComputationType',
      this.getSelectValue(event) as ValueComputationType,
    );
  }

  protected onTextFieldChange(
    event: Event,
    field:
      | 'value'
      | 'formatPattern'
      | 'prefix'
      | 'charPool'
      | 'suffix'
      | 'variableName'
      | 'defaultValue'
      | 'key'
      | 'storageKey'
      | 'cookieName'
      | 'elementValueName'
      | 'downloadedFileName'
      | 'downloadedDocumentFileName'
      | 'downloadedDocumentExpectedText',
  ): void {
    this.graph.updateActionField(this.node().id, field, this.getInputValue(event));
  }

  protected onElementValueSourceChange(event: Event): void {
    this.graph.updateActionField(
      this.node().id,
      'elementValueSource',
      this.getSelectValue(event) as ElementValueCheckSource,
    );
  }

  protected onNumberFieldChange(
    event: Event,
    field:
      | 'offsetDays'
      | 'randomStringLength'
      | 'delayAfterClearMillis'
      | 'delayMillis'
      | 'viewportAmount'
      | 'viewportDelayAfterMoveMillis',
  ): void {
    this.graph.updateActionField(
      this.node().id,
      field,
      Math.max(0, Number(this.getInputValue(event)) || 0),
    );
  }

  protected onCoordinateChange(event: Event, field: 'xCoordinate' | 'yCoordinate'): void {
    const value = this.getInputValue(event);
    const coordinate = value.trim() === '' ? value : Number(value);
    this.graph.updateActionField(this.node().id, field, coordinate);
  }

  protected onViewportDimensionChange(
    event: Event,
    field: 'viewportWidth' | 'viewportHeight',
  ): void {
    const value = this.getInputValue(event);
    const dimension = value.trim() === '' ? value : Number(value);
    this.graph.updateActionField(this.node().id, field, dimension);
  }

  protected coordinateInputValue(value: unknown): string | number {
    return typeof value === 'number' || typeof value === 'string' ? value : '';
  }

  protected viewportDimensionInputValue(value: unknown): string | number {
    return typeof value === 'number' || typeof value === 'string' ? value : '';
  }

  protected onViewportMovementChange(event: Event): void {
    this.graph.updateActionField(
      this.node().id,
      'viewportMovement',
      this.getSelectValue(event) as ViewportMove,
    );
  }

  protected onViewportDirectionChange(event: Event): void {
    this.graph.updateActionField(
      this.node().id,
      'viewportDirection',
      this.getSelectValue(event) as ViewportMoveDirection,
    );
  }

  protected onViewportUnitChange(event: Event): void {
    this.graph.updateActionField(
      this.node().id,
      'viewportUnit',
      this.getSelectValue(event) as ViewportMoveUnit,
    );
  }

  protected onClearBeforeTypingChange(event: Event): void {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const clearBeforeTyping = input?.checked ?? false;
    this.graph.updateActionFields(this.node().id, {
      clearBeforeTyping,
      delayAfterClearMillis: clearBeforeTyping
        ? (this.graph.nodeAction(this.node().id)?.delayAfterClearMillis ?? 0)
        : 0,
    });
  }

  protected onDownloadedDocumentCaseSensitiveChange(event: Event): void {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    this.graph.updateActionField(
      this.node().id,
      'downloadedDocumentCaseSensitive',
      input?.checked ?? false,
    );
  }

  protected onTestDataProfileChange(event: Event): void {
    const value = this.getSelectValue(event);
    const testDataId = value === '' ? null : Number(value);
    const entries = this.testDataEntriesForProfile(testDataId);

    this.graph.updateActionFields(this.node().id, {
      testDataId,
      key: entries.some((entry) => entry.key === this.graph.nodeAction(this.node().id)?.key)
        ? (this.graph.nodeAction(this.node().id)?.key ?? '')
        : '',
    });
  }

  protected onTestDataKeyChange(event: Event): void {
    this.graph.updateActionField(this.node().id, 'key', this.getSelectValue(event));
  }

  protected testDataEntriesForNode(): TestDataEntry[] {
    return this.testDataEntriesForProfile(
      this.graph.nodeAction(this.node().id)?.testDataId ?? null,
    );
  }

  protected testDataProfileLabel(testDataSet: TestDataSet): string {
    const valueCount = testDataSet.values?.length ?? 0;
    return `${testDataSet.label ?? 'Unnamed profile'} (${valueCount})`;
  }

  protected testDataEntryLabel(entry: TestDataEntry): string {
    return `${entry.key} - ${entry.value}`;
  }

  private getInputValue(event: Event): string {
    return event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
      ? event.target.value
      : '';
  }

  private getSelectValue(event: Event): string {
    return event.target instanceof HTMLSelectElement ? event.target.value : '';
  }

  private testDataEntriesForProfile(testDataId: number | null): TestDataEntry[] {
    if (testDataId === null) {
      return [];
    }

    return this.testDataSets().find((testDataSet) => testDataSet.id === testDataId)?.values ?? [];
  }
}
