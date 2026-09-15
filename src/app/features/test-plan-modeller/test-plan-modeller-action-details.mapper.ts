import type {
  ActionDetails,
  ActionDetailsType,
  ElementValueCheckSource,
  ValueComputationInstruction,
  ValueComputationType,
  ViewportMove,
  ViewportMoveDirection,
  ViewportMoveUnit,
} from '../../generated/hateoas/types.gen';
import {
  actionTypeSet,
  createDefaultActionFormState,
  elementValueSources,
  valueComputationTypeSet,
  viewportDirections,
  viewportMovements,
  viewportUnits,
  type ActionFormState,
  type ElementFlowNode,
} from './test-plan-modeller-graph.models';

export function normalizeActionDetails(details: ActionDetails): ActionDetails {
  const detailsType = getActionDetailsType(details);

  return {
    ...details,
    detailsType,
  } as ActionDetails;
}

export function getActionDetailsType(details: unknown): ActionDetailsType {
  const value = getStringProperty(details, 'detailsType', 'actionDetailsType', 'type');

  if (actionTypeSet.has(value as ActionDetailsType)) {
    return value as ActionDetailsType;
  }

  throw new Error('Loaded action is missing a supported action details type.');
}

export function getDetailsElementId(details: ActionDetails): number | null {
  switch (getActionDetailsType(details)) {
    case 'CHECK_EXISTENCE':
    case 'CLICK':
    case 'TYPING':
    case 'SELECTION':
    case 'TEXT_CHECK':
    case 'ELEMENT_VALUE_CHECK':
      return getNumberProperty(details, 'elementID', 'elementId');
    case 'SWITCH_WEBSITE':
    case 'LOCAL_STORAGE_SEARCH':
    case 'SESSION_STORAGE_SEARCH':
    case 'COOKIE_SEARCH':
    case 'EXPLICIT_WAIT':
    case 'DOWNLOADED_FILE_CHECK':
    case 'DOWNLOADED_DOCUMENT_TEXT_CHECK':
    case 'VIEWPORT_MOVE':
    case 'COORDINATE_CLICK':
    case 'RESIZE_VIEWPORT':
      return null;
  }
}

export function toActionFormState(details: ActionDetails): ActionFormState {
  const detailsType = getActionDetailsType(details);
  const action = {
    ...createDefaultActionFormState(),
    detailsType,
  };

  switch (detailsType) {
    case 'TYPING':
      return applyValueComputation(
        {
          ...action,
          clearBeforeTyping: getBooleanProperty(details, 'clearBeforeTyping') ?? false,
          delayAfterClearMillis: getNumberProperty(details, 'delayAfterClearMillis') ?? 0,
        },
        getObjectProperty<ValueComputationInstruction>(details, 'valueComputation'),
      );
    case 'SWITCH_WEBSITE':
    case 'SELECTION':
    case 'TEXT_CHECK':
      return applyValueComputation(
        action,
        getObjectProperty<ValueComputationInstruction>(details, 'valueComputation'),
      );
    case 'ELEMENT_VALUE_CHECK':
      return applyValueComputation(
        {
          ...action,
          elementValueSource: getElementValueSource(details) ?? 'ATTRIBUTE',
          elementValueName: getStringProperty(details, 'valueName') ?? '',
        },
        getObjectProperty<ValueComputationInstruction>(details, 'valueComputation'),
      );
    case 'LOCAL_STORAGE_SEARCH':
    case 'SESSION_STORAGE_SEARCH':
      return applyValueComputation(
        {
          ...action,
          storageKey: getStringProperty(details, 'storageKey') ?? '',
        },
        getObjectProperty<ValueComputationInstruction>(details, 'valueComputation'),
      );
    case 'COOKIE_SEARCH':
      return applyValueComputation(
        {
          ...action,
          cookieName: getStringProperty(details, 'cookieName') ?? '',
        },
        getObjectProperty<ValueComputationInstruction>(details, 'valueComputation'),
      );
    case 'EXPLICIT_WAIT':
      return {
        ...action,
        delayMillis: getNumberProperty(details, 'delayMillis') ?? 0,
      };
    case 'COORDINATE_CLICK':
      return {
        ...action,
        xCoordinate: getRawProperty(details, 'xCoordinate'),
        yCoordinate: getRawProperty(details, 'yCoordinate'),
      };
    case 'RESIZE_VIEWPORT':
      return {
        ...action,
        viewportWidth: getRawProperty(details, 'viewportWidth'),
        viewportHeight: getRawProperty(details, 'viewportHeight'),
      };
    case 'DOWNLOADED_FILE_CHECK':
      return {
        ...action,
        downloadedFileName: getStringProperty(details, 'fileName') ?? '',
      };
    case 'DOWNLOADED_DOCUMENT_TEXT_CHECK':
      return {
        ...action,
        downloadedDocumentFileName: getStringProperty(details, 'fileName') ?? '',
        downloadedDocumentExpectedText: getStringProperty(details, 'expectedText') ?? '',
        downloadedDocumentCaseSensitive: getBooleanProperty(details, 'caseSensitive') ?? false,
      };
    case 'VIEWPORT_MOVE':
      return {
        ...action,
        viewportMovement: getViewportMove(details) ?? 'SCROLL_BY',
        viewportDirection: getViewportMoveDirection(details) ?? 'DOWN',
        viewportAmount: getNumberProperty(details, 'amount') ?? 1,
        viewportUnit: getViewportMoveUnit(details) ?? 'VIEWPORTS',
        viewportDelayAfterMoveMillis: getNumberProperty(details, 'delayAfterMoveMillis') ?? 0,
      };
    case 'CHECK_EXISTENCE':
    case 'CLICK':
      return action;
  }
}

export function toActionDetails(node: ElementFlowNode): ActionDetails {
  const detailsType = node.action.detailsType;

  if (detailsType === null) {
    throw new Error('Cannot generate action details before an action type has been selected.');
  }

  const valueComputation = toValueComputation(node.action);

  switch (detailsType) {
    case 'CHECK_EXISTENCE':
    case 'CLICK':
      return {
        detailsType,
        elementID: requireElementId(node),
      } as ActionDetails;
    case 'COORDINATE_CLICK':
      return {
        detailsType,
        xCoordinate: node.action.xCoordinate,
        yCoordinate: node.action.yCoordinate,
      } as ActionDetails;
    case 'RESIZE_VIEWPORT':
      return {
        detailsType,
        viewportWidth: node.action.viewportWidth,
        viewportHeight: node.action.viewportHeight,
      } as ActionDetails;
    case 'TYPING':
      return {
        detailsType,
        elementID: requireElementId(node),
        clearBeforeTyping: node.action.clearBeforeTyping,
        delayAfterClearMillis: Math.max(0, node.action.delayAfterClearMillis),
        valueComputation,
      } as ActionDetails;
    case 'SELECTION':
    case 'TEXT_CHECK':
      return {
        detailsType,
        elementID: requireElementId(node),
        valueComputation,
      } as ActionDetails;
    case 'ELEMENT_VALUE_CHECK':
      return {
        detailsType,
        elementID: requireElementId(node),
        valueSource: node.action.elementValueSource,
        valueName: node.action.elementValueName,
        valueComputation,
      } as ActionDetails;
    case 'SWITCH_WEBSITE':
      return {
        detailsType,
        valueComputation,
      } as ActionDetails;
    case 'LOCAL_STORAGE_SEARCH':
    case 'SESSION_STORAGE_SEARCH':
      return {
        detailsType,
        storageKey: node.action.storageKey,
        valueComputation,
      } as ActionDetails;
    case 'COOKIE_SEARCH':
      return {
        detailsType,
        cookieName: node.action.cookieName,
        valueComputation,
      } as ActionDetails;
    case 'EXPLICIT_WAIT':
      return {
        detailsType,
        delayMillis: Math.max(0, node.action.delayMillis),
      } as ActionDetails;
    case 'DOWNLOADED_FILE_CHECK':
      return {
        detailsType,
        fileName: node.action.downloadedFileName.trim(),
      } as ActionDetails;
    case 'DOWNLOADED_DOCUMENT_TEXT_CHECK':
      return {
        detailsType,
        fileName: node.action.downloadedDocumentFileName.trim(),
        expectedText: node.action.downloadedDocumentExpectedText,
        caseSensitive: node.action.downloadedDocumentCaseSensitive,
      } as ActionDetails;
    case 'VIEWPORT_MOVE':
      return {
        detailsType,
        movement: node.action.viewportMovement,
        direction: node.action.viewportDirection,
        amount: Math.max(0, node.action.viewportAmount),
        unit: node.action.viewportUnit,
        delayAfterMoveMillis: Math.max(0, node.action.viewportDelayAfterMoveMillis),
      } as ActionDetails;
  }
}

export function isCompleteAction(node: ElementFlowNode): boolean {
  return (
    node.label.trim().length > 0 &&
    node.action.detailsType !== null &&
    hasCompleteValueComputation(node.action)
  );
}

export function getReferenceList(value: unknown): number[] {
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

function applyValueComputation(
  action: ActionFormState,
  valueComputation: ValueComputationInstruction | undefined,
): ActionFormState {
  const computation = normalizeValueComputation(valueComputation);

  if (!computation) {
    return action;
  }

  switch (computation.computation) {
    case 'FIXED':
      return {
        ...action,
        valueComputationType: 'FIXED',
        value: computation.value,
      };
    case 'RELATIVE_DATE':
      return {
        ...action,
        valueComputationType: 'RELATIVE_DATE',
        offsetDays: computation.offsetDays,
        formatPattern: computation.formatPattern,
      };
    case 'RANDOM':
      return {
        ...action,
        valueComputationType: 'RANDOM',
        prefix: computation.prefix,
        charPool: computation.charPool,
        randomStringLength: computation.randomStringLength,
        suffix: computation.suffix,
      };
    case 'TIMESTAMP_NOW':
      return {
        ...action,
        valueComputationType: 'TIMESTAMP_NOW',
        formatPattern: computation.formatPattern,
      };
    case 'SYSTEM_VAR':
      return {
        ...action,
        valueComputationType: 'SYSTEM_VAR',
        variableName: computation.variableName,
        defaultValue: computation.defaultValue,
      };
    case 'TEST_DATA':
      return {
        ...action,
        valueComputationType: 'TEST_DATA',
        testDataId: computation.testDataId,
        key: computation.key,
      };
  }
}

function hasCompleteValueComputation(action: ActionFormState): boolean {
  if (action.detailsType === 'ELEMENT_VALUE_CHECK' && action.elementValueName.trim().length === 0) {
    return false;
  }

  if (action.detailsType === 'COORDINATE_CLICK' && !hasValidViewportCoordinates(action)) {
    return false;
  }

  if (action.detailsType === 'RESIZE_VIEWPORT' && !hasValidViewportDimensions(action)) {
    return false;
  }

  if (
    action.detailsType === 'DOWNLOADED_FILE_CHECK' &&
    action.downloadedFileName.trim().length === 0
  ) {
    return false;
  }

  if (
    action.detailsType === 'DOWNLOADED_DOCUMENT_TEXT_CHECK' &&
    (action.downloadedDocumentFileName.trim().length === 0 ||
      action.downloadedDocumentExpectedText.trim().length === 0)
  ) {
    return false;
  }

  if (action.valueComputationType !== 'TEST_DATA') {
    return true;
  }

  return action.testDataId !== null && action.key.trim().length > 0;
}

export function hasValidViewportCoordinates(action: ActionFormState): boolean {
  return (
    isValidViewportCoordinate(action.xCoordinate) && isValidViewportCoordinate(action.yCoordinate)
  );
}

export function hasValidViewportDimensions(action: ActionFormState): boolean {
  return (
    isValidViewportDimension(action.viewportWidth) &&
    isValidViewportDimension(action.viewportHeight)
  );
}

function isValidViewportCoordinate(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 2147483647
  );
}

function isValidViewportDimension(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 2147483647
  );
}

function toValueComputation(action: ActionFormState): ValueComputationInstruction {
  switch (action.valueComputationType) {
    case 'FIXED':
      return {
        computation: 'FIXED',
        value: action.value,
      } as ValueComputationInstruction;
    case 'RELATIVE_DATE':
      return {
        computation: 'RELATIVE_DATE',
        offsetDays: action.offsetDays,
        formatPattern: action.formatPattern,
      } as ValueComputationInstruction;
    case 'RANDOM':
      return {
        computation: 'RANDOM',
        prefix: action.prefix,
        charPool: action.charPool,
        randomStringLength: action.randomStringLength,
        suffix: action.suffix,
      } as ValueComputationInstruction;
    case 'TIMESTAMP_NOW':
      return {
        computation: 'TIMESTAMP_NOW',
        formatPattern: action.formatPattern,
      } as ValueComputationInstruction;
    case 'SYSTEM_VAR':
      return {
        computation: 'SYSTEM_VAR',
        variableName: action.variableName,
        defaultValue: action.defaultValue,
      } as ValueComputationInstruction;
    case 'TEST_DATA':
      return {
        computation: 'TEST_DATA',
        testDataId: action.testDataId ?? 0,
        key: action.key,
      } as ValueComputationInstruction;
  }
}

function requireElementId(node: ElementFlowNode): number {
  return node.elementId ?? 0;
}

function normalizeValueComputation(
  valueComputation: ValueComputationInstruction | undefined,
): ValueComputationInstruction | undefined {
  if (!valueComputation) {
    return undefined;
  }

  const computation = getStringProperty(valueComputation, 'computation', 'computationType', 'type');

  if (!valueComputationTypeSet.has(computation as ValueComputationType)) {
    return valueComputation;
  }

  return {
    ...valueComputation,
    computation,
  } as ValueComputationInstruction;
}

function getNumberProperty(source: unknown, ...keys: string[]): number | null {
  if (typeof source !== 'object' || source === null) {
    return null;
  }

  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function getRawProperty(source: unknown, key: string): unknown {
  if (typeof source !== 'object' || source === null) {
    return undefined;
  }

  return (source as Record<string, unknown>)[key];
}

function getBooleanProperty(source: unknown, ...keys: string[]): boolean | null {
  if (typeof source !== 'object' || source === null) {
    return null;
  }

  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'boolean') {
      return value;
    }
  }

  return null;
}

function getElementValueSource(source: unknown): ElementValueCheckSource | null {
  const value = getStringProperty(source, 'valueSource');
  return elementValueSources.includes(value as ElementValueCheckSource)
    ? (value as ElementValueCheckSource)
    : null;
}

function getViewportMove(source: unknown): ViewportMove | null {
  const value = getStringProperty(source, 'movement');
  return viewportMovements.includes(value as ViewportMove) ? (value as ViewportMove) : null;
}

function getViewportMoveDirection(source: unknown): ViewportMoveDirection | null {
  const value = getStringProperty(source, 'direction');
  return viewportDirections.includes(value as ViewportMoveDirection)
    ? (value as ViewportMoveDirection)
    : null;
}

function getViewportMoveUnit(source: unknown): ViewportMoveUnit | null {
  const value = getStringProperty(source, 'unit');
  return viewportUnits.includes(value as ViewportMoveUnit) ? (value as ViewportMoveUnit) : null;
}

function getStringProperty(source: unknown, ...keys: string[]): string | null {
  if (typeof source !== 'object' || source === null) {
    return null;
  }

  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'string') {
      return value;
    }
  }

  return null;
}

function getObjectProperty<TValue extends object>(
  source: unknown,
  ...keys: string[]
): TValue | undefined {
  if (typeof source !== 'object' || source === null) {
    return undefined;
  }

  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'object' && value !== null) {
      return value as TValue;
    }
  }

  return undefined;
}
