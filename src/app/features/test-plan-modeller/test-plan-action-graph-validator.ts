export interface TestPlanActionGraphNode {
  readonly referenceID: number;
  readonly nextActions?: readonly number[];
}

export interface TestPlanActionGraphValidation {
  readonly isValid: boolean;
  readonly message: string | null;
}

export function validateTestPlanActionGraph(
  actions: readonly TestPlanActionGraphNode[],
): TestPlanActionGraphValidation {
  if (actions.length === 0) {
    return invalid('Add at least one action before creating a test plan.');
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

  return { isValid: true, message: null };
}

function invalid(message: string): TestPlanActionGraphValidation {
  return { isValid: false, message };
}
