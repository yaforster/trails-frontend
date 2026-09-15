import { Injectable, computed, inject, signal } from '@angular/core';
import type { IPoint } from '@foblex/2d';
import type {
  ActionDefinition,
  ActionDetailsType,
  Element,
  TestPlanDefinition,
} from '../../generated/hateoas/types.gen';
import {
  actionTypes,
  createDefaultActionFormState,
  elementValueSources,
  valueComputationTypes,
  viewportDirections,
  viewportMovements,
  viewportUnits,
  type ActionFormState,
  type ElementFlowConnection,
  type ElementFlowGroup,
  type ElementFlowNode,
  type ElementPaletteItem,
} from './test-plan-modeller-graph.models';
import {
  getActionDetailsType,
  getDetailsElementId,
  getReferenceList,
  isCompleteAction,
  normalizeActionDetails,
  toActionDetails,
  toActionFormState,
} from './test-plan-modeller-action-details.mapper';
import { validateTestPlanActionGraph } from './test-plan-action-graph-validator';
import { TestPlanModellerQueuedDefinitionStore } from './test-plan-modeller-queued-definition.store';

export type {
  ActionFormState,
  ElementFlowConnection,
  ElementFlowGroup,
  ElementFlowNode,
  ElementPaletteItem,
} from './test-plan-modeller-graph.models';

@Injectable({
  providedIn: 'root',
})
export class TestPlanModellerGraphService {
  private readonly queuedDefinitions = inject(TestPlanModellerQueuedDefinitionStore);

  readonly actionTypes = actionTypes;
  readonly valueComputationTypes = valueComputationTypes;
  readonly elementValueSources = elementValueSources;
  readonly viewportMovements = viewportMovements;
  readonly viewportDirections = viewportDirections;
  readonly viewportUnits = viewportUnits;

  readonly nodes = signal<ElementFlowNode[]>([]);
  readonly connections = signal<ElementFlowConnection[]>([]);
  readonly groups = signal<ElementFlowGroup[]>([]);
  private readonly planLabel = signal('Modelled test plan');

  private nextNodeReferenceId = 1;
  private nextConnectionId = 1;
  private nextGroupId = 1;

  readonly currentPlanLabel = computed(() => this.planLabel());
  readonly testPlanDefinition = computed<TestPlanDefinition>(() => ({
    label: this.planLabel(),
    testSteps: this.nodes()
      .filter((node) => isCompleteAction(node))
      .map((node) => this.toActionDefinition(node)),
    groups: this.groups().map((group) => ({
      label: group.label.trim(),
      xCoordinate: group.position.x,
      yCoordinate: group.position.y,
      widthPixels: group.size.width,
      heightPixels: group.size.height,
      actionReferenceIds: this.nodes()
        .filter((node) => node.parentGroupId === group.id)
        .map((node) => node.referenceId),
    })),
  }));
  readonly testPlanDefinitionValidationError = computed(() => {
    const nodes = this.nodes();
    if (nodes.length === 0) {
      return 'Add at least one action before creating a test plan.';
    }

    if (!nodes.every((node) => isCompleteAction(node))) {
      return 'Every action needs a label and action type before creating a test plan.';
    }

    return validateTestPlanActionGraph(this.testPlanDefinition().testSteps ?? []).message;
  });
  readonly canSaveTestPlanDefinition = computed(
    () => this.testPlanDefinitionValidationError() === null,
  );

  reset(): void {
    this.nodes.set([]);
    this.connections.set([]);
    this.groups.set([]);
    this.planLabel.set('Modelled test plan');
    this.nextNodeReferenceId = 1;
    this.nextConnectionId = 1;
    this.nextGroupId = 1;
  }

  queueDefinition(definition: TestPlanDefinition): void {
    this.queuedDefinitions.queue(definition);
  }

  importQueuedDefinition(elements: Element[]): boolean {
    const definition = this.queuedDefinitions.take();

    if (!definition) {
      return false;
    }

    this.importDefinition(definition, elements);
    return true;
  }

  importDefinition(definition: TestPlanDefinition, elements: Element[]): void {
    const steps = definition.testSteps ?? [];
    const elementsById = new Map(
      elements
        .filter((element) => element.id !== undefined)
        .map((element) => [element.id as number, element]),
    );
    const referenceIdFallback = new Map<ActionDefinition, number>();
    let fallbackReferenceId = 1;

    for (const step of steps) {
      referenceIdFallback.set(step, step.referenceID ?? fallbackReferenceId++);
    }

    let nodes = steps.map((step, index) =>
      this.toFlowNode(step, referenceIdFallback.get(step) ?? index + 1, index, elementsById),
    );
    const referenceToNodeId = new Map(nodes.map((node) => [node.referenceId, node.id]));
    const connections: ElementFlowConnection[] = [];

    for (const step of steps) {
      const sourceReferenceId = referenceIdFallback.get(step);
      const sourceNodeId =
        sourceReferenceId === undefined ? undefined : referenceToNodeId.get(sourceReferenceId);

      if (!sourceNodeId) {
        continue;
      }

      for (const targetReferenceId of getReferenceList(step.nextActions)) {
        const targetNodeId = referenceToNodeId.get(targetReferenceId);

        if (!targetNodeId || sourceNodeId === targetNodeId) {
          continue;
        }

        connections.push({
          id: `connection-${connections.length + 1}`,
          sourceNodeId,
          targetNodeId,
          sourceConnectorId: `${sourceNodeId}:right:out`,
          targetConnectorId: `${targetNodeId}:left:in`,
        });
      }
    }

    const groups: ElementFlowGroup[] = (definition.groups ?? []).map((group, index) => ({
      id: `group-${index + 1}`,
      label: group.label ?? 'Action group',
      position: { x: group.xCoordinate, y: group.yCoordinate },
      size: { width: group.widthPixels, height: group.heightPixels },
    }));
    const groupIdByReferenceId = new Map<number, string>();
    const nodeReferenceIds = new Set(nodes.map((node) => node.referenceId));
    for (const [index, group] of groups.entries()) {
      for (const referenceId of definition.groups?.[index]?.actionReferenceIds ?? []) {
        if (nodeReferenceIds.has(referenceId)) {
          groupIdByReferenceId.set(referenceId, group.id);
        }
      }
    }
    nodes = nodes.map((node) => ({
      ...node,
      parentGroupId: groupIdByReferenceId.get(node.referenceId) ?? null,
    }));

    this.planLabel.set(definition.label ?? 'Modelled test plan');
    this.nodes.set(nodes);
    this.connections.set(connections);
    this.groups.set(groups);
    this.nextNodeReferenceId = Math.max(0, ...nodes.map((node) => node.referenceId)) + 1;
    this.nextConnectionId = connections.length + 1;
    this.nextGroupId = (definition.groups?.length ?? 0) + 1;
  }

  addGroup(position: IPoint, size: { width: number; height: number }, nodeIds: string[]): void {
    const selectedNodeIds = new Set(nodeIds);
    const groups = this.groups();
    const selectedNodes = this.nodes().filter((node) => selectedNodeIds.has(node.id));

    if (selectedNodes.length === 0) {
      return;
    }

    const id = `group-${this.nextGroupId++}`;
    this.groups.update((groups) => [
      ...groups,
      {
        id,
        label: 'Action group',
        position,
        size,
      },
    ]);
    this.nodes.update((nodes) =>
      nodes.map((node) =>
        selectedNodeIds.has(node.id) ? this.nodeInGroup(node, id, position, groups) : node,
      ),
    );
  }

  addNodesToGroup(groupId: string, nodeIds: string[]): void {
    const group = this.groups().find((candidate) => candidate.id === groupId);
    if (!group) {
      return;
    }
    const joiningNodeIds = new Set(
      this.nodes()
        .filter((node) => nodeIds.includes(node.id) && node.parentGroupId !== groupId)
        .map((node) => node.id),
    );
    this.nodes.update((nodes) =>
      nodes.map((node) => {
        if (!joiningNodeIds.has(node.id)) {
          return node;
        }
        return this.nodeInGroup(node, groupId, group.position);
      }),
    );
  }

  moveGroup(groupId: string, position: IPoint): void {
    this.groups.update((groups) =>
      groups.map((group) => (group.id === groupId ? { ...group, position } : group)),
    );
  }

  updateGroupLabel(groupId: string, label: string): void {
    this.groups.update((groups) =>
      groups.map((group) => (group.id === groupId ? { ...group, label } : group)),
    );
  }

  updateGroupRect(
    groupId: string,
    rect: { x: number; y: number; width: number; height: number },
  ): void {
    this.groups.update((groups) =>
      groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              position: { x: rect.x, y: rect.y },
              size: { width: rect.width, height: rect.height },
            }
          : group,
      ),
    );
  }

  ungroupNode(nodeId: string): void {
    const node = this.nodes().find((candidate) => candidate.id === nodeId);
    const group = this.groups().find((candidate) => candidate.id === node?.parentGroupId);
    if (!node || !group) {
      return;
    }
    this.nodes.update((nodes) =>
      nodes.map((candidate) =>
        candidate.id === nodeId
          ? {
              ...candidate,
              parentGroupId: null,
              position: {
                x: candidate.position.x + group.position.x,
                y: candidate.position.y + group.position.y,
              },
            }
          : candidate,
      ),
    );
  }

  deleteGroup(groupId: string): void {
    const group = this.groups().find((candidate) => candidate.id === groupId);
    if (!group) {
      return;
    }
    this.nodes.update((nodes) =>
      nodes.map((node) =>
        node.parentGroupId === groupId
          ? {
              ...node,
              parentGroupId: null,
              position: {
                x: node.position.x + group.position.x,
                y: node.position.y + group.position.y,
              },
            }
          : node,
      ),
    );
    this.groups.update((groups) => groups.filter((group) => group.id !== groupId));
  }

  addNode(item: ElementPaletteItem, position: IPoint): void {
    const referenceId = this.nextNodeReferenceId++;

    this.nodes.update((nodes) => [
      ...nodes,
      {
        ...item,
        id: `action-${referenceId}`,
        label: '',
        elementLabel: item.label,
        referenceId,
        position,
        parentGroupId: null,
        action: {
          ...createDefaultActionFormState(),
          detailsType: item.defaultActionType ?? null,
        },
      },
    ]);
  }

  moveNode(nodeId: string, position: IPoint): void {
    this.nodes.update((nodes) =>
      nodes.map((node) => (node.id === nodeId ? { ...node, position } : node)),
    );
  }

  nodeCanvasPosition(nodeId: string): IPoint | null {
    const node = this.nodes().find((candidate) => candidate.id === nodeId);

    return node ? this.canvasPosition(node) : null;
  }

  updateNodeLabel(nodeId: string, label: string): void {
    this.nodes.update((nodes) =>
      nodes.map((node) => (node.id === nodeId ? { ...node, label } : node)),
    );
  }

  updatePlanLabel(label: string): void {
    this.planLabel.set(label);
  }

  deleteNode(nodeId: string): void {
    this.nodes.update((nodes) => nodes.filter((node) => node.id !== nodeId));
    this.connections.update((connections) =>
      connections.filter(
        (connection) => connection.sourceNodeId !== nodeId && connection.targetNodeId !== nodeId,
      ),
    );
  }

  deleteConnection(connectionId: string): void {
    this.connections.update((connections) =>
      connections.filter((connection) => connection.id !== connectionId),
    );
  }

  connect(sourceConnectorId: string, targetConnectorId: string): void {
    const sourceNodeId = this.getNodeIdFromConnector(sourceConnectorId);
    const targetNodeId = this.getNodeIdFromConnector(targetConnectorId);

    if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) {
      return;
    }

    const exists = this.connections().some(
      (connection) =>
        connection.sourceNodeId === sourceNodeId && connection.targetNodeId === targetNodeId,
    );

    if (exists) {
      return;
    }

    this.connections.update((connections) => [
      ...connections,
      {
        id: `connection-${this.nextConnectionId++}`,
        sourceNodeId,
        targetNodeId,
        sourceConnectorId,
        targetConnectorId,
      },
    ]);
  }

  updateActionType(nodeId: string, detailsType: ActionDetailsType | null): void {
    this.updateNodeAction(nodeId, {
      ...createDefaultActionFormState(),
      detailsType,
    });
  }

  updateActionField<K extends keyof ActionFormState>(
    nodeId: string,
    field: K,
    value: ActionFormState[K],
  ): void {
    const node = this.nodes().find((candidate) => candidate.id === nodeId);

    if (!node) {
      return;
    }

    this.updateNodeAction(nodeId, {
      ...node.action,
      [field]: value,
    });
  }

  updateActionFields(nodeId: string, fields: Partial<ActionFormState>): void {
    const node = this.nodes().find((candidate) => candidate.id === nodeId);

    if (!node) {
      return;
    }

    this.updateNodeAction(nodeId, {
      ...node.action,
      ...fields,
    });
  }

  nodeAction(nodeId: string): ActionFormState | null {
    return this.nodes().find((candidate) => candidate.id === nodeId)?.action ?? null;
  }

  needsValueComputation(detailsType: ActionDetailsType | null): boolean {
    return (
      detailsType === 'TYPING' ||
      detailsType === 'SWITCH_WEBSITE' ||
      detailsType === 'SELECTION' ||
      detailsType === 'TEXT_CHECK' ||
      detailsType === 'ELEMENT_VALUE_CHECK' ||
      detailsType === 'LOCAL_STORAGE_SEARCH' ||
      detailsType === 'SESSION_STORAGE_SEARCH' ||
      detailsType === 'COOKIE_SEARCH'
    );
  }

  needsElement(detailsType: ActionDetailsType | null): boolean {
    return (
      detailsType === 'CHECK_EXISTENCE' ||
      detailsType === 'CLICK' ||
      detailsType === 'TYPING' ||
      detailsType === 'SELECTION' ||
      detailsType === 'TEXT_CHECK' ||
      detailsType === 'ELEMENT_VALUE_CHECK'
    );
  }

  needsStorageKey(detailsType: ActionDetailsType | null): boolean {
    return detailsType === 'LOCAL_STORAGE_SEARCH' || detailsType === 'SESSION_STORAGE_SEARCH';
  }

  needsCookieName(detailsType: ActionDetailsType | null): boolean {
    return detailsType === 'COOKIE_SEARCH';
  }

  needsElementValueTarget(detailsType: ActionDetailsType | null): boolean {
    return detailsType === 'ELEMENT_VALUE_CHECK';
  }

  needsDownloadedFileName(detailsType: ActionDetailsType | null): boolean {
    return detailsType === 'DOWNLOADED_FILE_CHECK';
  }

  needsDownloadedDocumentText(detailsType: ActionDetailsType | null): boolean {
    return detailsType === 'DOWNLOADED_DOCUMENT_TEXT_CHECK';
  }

  needsViewportMove(detailsType: ActionDetailsType | null): boolean {
    return detailsType === 'VIEWPORT_MOVE';
  }

  needsCoordinateClick(detailsType: ActionDetailsType | null): boolean {
    return detailsType === 'COORDINATE_CLICK';
  }

  needsViewportResize(detailsType: ActionDetailsType | null): boolean {
    return detailsType === 'RESIZE_VIEWPORT';
  }

  private updateNodeAction(nodeId: string, action: ActionFormState): void {
    this.nodes.update((nodes) =>
      nodes.map((node) => (node.id === nodeId ? { ...node, action } : node)),
    );
  }

  private canvasPosition(
    node: ElementFlowNode,
    groups: readonly ElementFlowGroup[] = this.groups(),
  ): IPoint {
    const group = groups.find((candidate) => candidate.id === node.parentGroupId);

    return group
      ? { x: node.position.x + group.position.x, y: node.position.y + group.position.y }
      : node.position;
  }

  private nodeInGroup(
    node: ElementFlowNode,
    groupId: string,
    groupPosition: IPoint,
    groups: readonly ElementFlowGroup[] = this.groups(),
  ): ElementFlowNode {
    const canvasPosition = this.canvasPosition(node, groups);

    return {
      ...node,
      parentGroupId: groupId,
      position: {
        x: canvasPosition.x - groupPosition.x,
        y: canvasPosition.y - groupPosition.y,
      },
    };
  }

  private toFlowNode(
    step: ActionDefinition,
    referenceId: number,
    index: number,
    elementsById: Map<number, Element>,
  ): ElementFlowNode {
    const details = normalizeActionDetails(step.details);
    const elementId = getDetailsElementId(details);
    const element = elementId === null ? undefined : elementsById.get(elementId);
    const action = toActionFormState(details);

    return {
      elementId,
      id: `action-${referenceId}`,
      referenceId,
      label: step.label ?? '',
      elementLabel: element?.label ?? 'Unknown element',
      locatorString: element?.locatorString ?? '',
      locatorType: element?.locatorType ?? '-',
      type: element?.type ?? '-',
      position: {
        x: step.position?.xCoordinate ?? 120 + index * 340,
        y: step.position?.yCoordinate ?? 120,
      },
      parentGroupId: null,
      action:
        action.detailsType === null
          ? {
              ...action,
              detailsType: getActionDetailsType(details),
            }
          : action,
    };
  }

  private toActionDefinition(node: ElementFlowNode): ActionDefinition {
    const nextActions = this.connections()
      .filter((connection) => connection.sourceNodeId === node.id)
      .map(
        (connection) =>
          this.nodes().find((candidate) => candidate.id === connection.targetNodeId)?.referenceId,
      )
      .filter((referenceId): referenceId is number => referenceId !== undefined);

    return {
      label: node.label.trim(),
      referenceID: node.referenceId,
      nextActions,
      position: {
        xCoordinate: node.position.x,
        yCoordinate: node.position.y,
      },
      details: toActionDetails(node),
    };
  }

  private getNodeIdFromConnector(connectorId: string): string | null {
    const suffixIndex = connectorId.indexOf(':');
    return suffixIndex > 0 ? connectorId.slice(0, suffixIndex) : null;
  }
}
