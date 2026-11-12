export interface TestPlanActionGraphNode {
  readonly referenceID: number;
  readonly nextActions?: readonly number[];
}

export interface TestPlanActionGraphValidation {
  readonly isValid: boolean;
  readonly message: string | null;
}

export interface TestPlanGraphLimits {
  readonly maximumActions: number;
  readonly maximumPaths: number;
  readonly maximumActionOccurrences: number;
}

export function validateTestPlanActionGraph(
  actions: readonly TestPlanActionGraphNode[],
  limits?: TestPlanGraphLimits,
): TestPlanActionGraphValidation {
  if (actions.length === 0) {
    return invalid('Add at least one action before creating a test plan.');
  }
  if (limits && actions.length > limits.maximumActions) {
    return invalid(`The test plan exceeds the server limit of ${limits.maximumActions} actions.`);
  }

  const actionIds = new Set<number>();
  const actionsById = new Map<number, TestPlanActionGraphNode>();
  for (const action of actions) {
    if (!Number.isInteger(action.referenceID)) {
      return invalid('Every action must have an integer reference ID.');
    }

    if (actionIds.has(action.referenceID)) {
      return invalid('Every action reference ID must be unique.');
    }

    actionIds.add(action.referenceID);
    actionsById.set(action.referenceID, action);
  }

  const incomingEdgeCounts = new Map<number, number>(
    actions.map((action) => [action.referenceID, 0]),
  );
  for (const action of actions) {
    const successors = action.nextActions ?? [];
    if (new Set(successors).size !== successors.length) {
      return invalid(`Action ${action.referenceID} has duplicate next actions.`);
    }
    for (const nextActionId of action.nextActions ?? []) {
      if (!actionIds.has(nextActionId)) {
        return invalid(`Action ${action.referenceID} references a missing next action.`);
      }

      incomingEdgeCounts.set(nextActionId, (incomingEdgeCounts.get(nextActionId) ?? 0) + 1);
    }
  }

  const actionIdsWithoutIncomingEdges = [...incomingEdgeCounts]
    .filter(([, incomingEdgeCount]) => incomingEdgeCount === 0)
    .map(([actionId]) => actionId);
  const startingActionCount = actionIdsWithoutIncomingEdges.length;
  let processedActionCount = 0;
  let nextActionIdIndex = 0;

  while (nextActionIdIndex < actionIdsWithoutIncomingEdges.length) {
    const actionId = actionIdsWithoutIncomingEdges[nextActionIdIndex++];
    processedActionCount++;
    const action = actionsById.get(actionId);

    for (const nextActionId of action?.nextActions ?? []) {
      const remainingIncomingEdgeCount = (incomingEdgeCounts.get(nextActionId) ?? 0) - 1;
      incomingEdgeCounts.set(nextActionId, remainingIncomingEdgeCount);

      if (remainingIncomingEdgeCount === 0) {
        actionIdsWithoutIncomingEdges.push(nextActionId);
      }
    }
  }

  if (processedActionCount !== actions.length) {
    return invalid('The test-plan action graph must not contain cycles.');
  }

  if (startingActionCount !== 1) {
    return invalid(
      `The test-plan action graph must have exactly one starting action, but found ${startingActionCount}.`,
    );
  }

  if (limits) {
    return validateExpandedPaths(actionsById, actionIdsWithoutIncomingEdges, limits);
  }
  return { isValid: true, message: null };
}

function validateExpandedPaths(
  actions: ReadonlyMap<number, TestPlanActionGraphNode>,
  order: readonly number[],
  limits: TestPlanGraphLimits,
): TestPlanActionGraphValidation {
  const paths = new Map<number, number>();
  const occurrences = new Map<number, number>();
  for (let index = order.length - 1; index >= 0; index--) {
    const id = order[index];
    const successors = actions.get(id)?.nextActions ?? [];
    let pathCount = successors.length === 0 ? 1 : 0;
    let occurrenceCount = successors.length === 0 ? 1 : 0;
    for (const successor of successors) {
      const successorPaths = paths.get(successor)!;
      pathCount += successorPaths;
      occurrenceCount += occurrences.get(successor)! + successorPaths;
      if (pathCount > limits.maximumPaths) {
        return invalid(
          `The test plan exceeds the server limit of ${limits.maximumPaths} execution paths.`,
        );
      }
      if (occurrenceCount > limits.maximumActionOccurrences) {
        return invalid(
          `The test plan exceeds the server limit of ${limits.maximumActionOccurrences} total action occurrences across execution paths.`,
        );
      }
    }
    paths.set(id, pathCount);
    occurrences.set(id, occurrenceCount);
  }
  return { isValid: true, message: null };
}

function invalid(message: string): TestPlanActionGraphValidation {
  return { isValid: false, message };
}
