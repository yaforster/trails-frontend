import type {
  Action,
  ActionDefinition,
  ActionDetails,
  ActionDetailsType,
  Position,
  TestPlan,
  TestPlanDefinition,
  ValueComputationType,
} from '../../generated/hateoas/types.gen';
import { actionDetailsTypes, valueComputationTypes } from './data-management.models';

export function toTestPlanDefinition(testPlan: TestPlan, actions: Action[]): TestPlanDefinition {
  const actionIdToReferenceId = new Map<number, number>();
  const definitions = actions
    .map((action) => toActionDefinition(action))
    .filter((definition): definition is ActionDefinition => definition !== null);

  for (const action of actions) {
    const actionId = getNumberProperty(action, 'actionID', 'actionId', 'id');
    const referenceID = getNumberProperty(action, 'referenceID', 'referenceId');

    if (actionId !== null && referenceID !== null) {
      actionIdToReferenceId.set(actionId, referenceID);
    }
  }

  return {
    label: testPlan.label ?? 'Opened test plan',
    groups: testPlan.groups ?? [],
    testSteps: definitions.map((definition, index) => ({
      ...definition,
      nextActions: toReferenceIds(actions[index], actionIdToReferenceId),
    })),
  };
}

function toActionDefinition(action: Action): ActionDefinition | null {
  const referenceID = getNumberProperty(action, 'referenceID', 'referenceId');
  const details = getActionDetails(action);

  if (referenceID === null || details === null) {
    return null;
  }

  return {
    label: action.label,
    referenceID,
    nextActions: [],
    position: getObjectProperty<Position>(action, 'position') ?? undefined,
    details,
  };
}

function getActionDetails(action: Action): ActionDetails | null {
  const details = getObjectProperty<Record<string, unknown>>(
    action,
    'details',
    'actionDetails',
    'actionDetail',
  );

  if (!details) {
    return null;
  }

  const detailsType = getActionDetailsType(details);

  if (!detailsType) {
    return null;
  }

  return {
    ...details,
    detailsType,
    valueComputation: getValueComputation(details),
  } as ActionDetails;
}

function getActionDetailsType(details: Record<string, unknown>): ActionDetailsType | null {
  const value = getStringProperty(details, 'detailsType', 'actionDetailsType', 'type');
  return actionDetailsTypes.includes(value as ActionDetailsType)
    ? (value as ActionDetailsType)
    : null;
}

function getValueComputation(
  details: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const valueComputation = getObjectProperty<Record<string, unknown>>(
    details,
    'valueComputation',
    'valueComputationInstruction',
    'computation',
  );

  if (!valueComputation) {
    return undefined;
  }

  const computation = getStringProperty(valueComputation, 'computation', 'computationType', 'type');

  if (!valueComputationTypes.includes(computation as ValueComputationType)) {
    return valueComputation;
  }

  return {
    ...valueComputation,
    computation,
  };
}

function toReferenceIds(
  action: Action | undefined,
  actionIdToReferenceId: Map<number, number>,
): number[] {
  if (!action) {
    return [];
  }

  return getActionReferences(action, 'nextActions', 'nextActionIds', 'nextActionReferences')
    .map((actionId) => actionIdToReferenceId.get(actionId) ?? actionId)
    .filter((referenceId, index, all) => all.indexOf(referenceId) === index);
}

function getActionReferences(source: unknown, ...keys: string[]): number[] {
  if (!isRecord(source)) {
    return [];
  }

  for (const key of keys) {
    const value = source[key];
    const references = toNumberReferences(value);

    if (references.length > 0) {
      return references;
    }
  }

  return [];
}

function toNumberReferences(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === 'number') {
        return item;
      }

      if (typeof item === 'string') {
        const parsed = Number(item);
        return Number.isFinite(parsed) ? parsed : null;
      }

      return getNumberProperty(item, 'referenceID', 'referenceId', 'id', 'actionID', 'actionId');
    })
    .filter((item): item is number => item !== null);
}

function getNumberProperty(source: unknown, ...keys: string[]): number | null {
  if (!isRecord(source)) {
    return null;
  }

  for (const key of keys) {
    const value = source[key];

    if (typeof value === 'number') {
      return value;
    }
  }

  return null;
}

function getStringProperty(source: unknown, ...keys: string[]): string | null {
  if (!isRecord(source)) {
    return null;
  }

  for (const key of keys) {
    const value = source[key];

    if (typeof value === 'string') {
      return value;
    }
  }

  return null;
}

function getObjectProperty<TValue extends object>(
  source: unknown,
  ...keys: string[]
): TValue | null {
  if (!isRecord(source)) {
    return null;
  }

  for (const key of keys) {
    const value = source[key];

    if (isRecord(value)) {
      return value as TValue;
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
