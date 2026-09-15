import type { IPoint } from '@foblex/2d';
import type {
  ActionDetailsType,
  ElementValueCheckSource,
  ValueComputationType,
  ViewportMove,
  ViewportMoveDirection,
  ViewportMoveUnit,
} from '../../generated/hateoas/types.gen';

export interface ElementPaletteItem {
  elementId: number | null;
  label: string;
  locatorString: string;
  locatorType: string;
  type: string;
  defaultActionType?: ActionDetailsType;
}

export interface ActionFormState {
  detailsType: ActionDetailsType | null;
  valueComputationType: ValueComputationType;
  value: string;
  offsetDays: number;
  formatPattern: string;
  prefix: string;
  charPool: string;
  randomStringLength: number;
  suffix: string;
  variableName: string;
  defaultValue: string;
  testDataId: number | null;
  key: string;
  clearBeforeTyping: boolean;
  delayAfterClearMillis: number;
  delayMillis: number;
  storageKey: string;
  cookieName: string;
  elementValueSource: ElementValueCheckSource;
  elementValueName: string;
  downloadedFileName: string;
  downloadedDocumentFileName: string;
  downloadedDocumentExpectedText: string;
  downloadedDocumentCaseSensitive: boolean;
  viewportMovement: ViewportMove;
  viewportDirection: ViewportMoveDirection;
  viewportAmount: number;
  viewportUnit: ViewportMoveUnit;
  viewportDelayAfterMoveMillis: number;
  xCoordinate: unknown;
  yCoordinate: unknown;
  viewportWidth: unknown;
  viewportHeight: unknown;
}

export interface ElementFlowNode extends ElementPaletteItem {
  id: string;
  referenceId: number;
  elementLabel: string;
  position: IPoint;
  parentGroupId: string | null;
  action: ActionFormState;
}

export interface ElementFlowConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceConnectorId: string;
  targetConnectorId: string;
}

export interface ElementFlowGroup {
  id: string;
  label: string;
  position: IPoint;
  size: { width: number; height: number };
}

export const actionTypes: readonly ActionDetailsType[] = [
  'CHECK_EXISTENCE',
  'CLICK',
  'TYPING',
  'SWITCH_WEBSITE',
  'SELECTION',
  'TEXT_CHECK',
  'LOCAL_STORAGE_SEARCH',
  'SESSION_STORAGE_SEARCH',
  'COOKIE_SEARCH',
  'EXPLICIT_WAIT',
  'ELEMENT_VALUE_CHECK',
  'DOWNLOADED_FILE_CHECK',
  'DOWNLOADED_DOCUMENT_TEXT_CHECK',
  'VIEWPORT_MOVE',
  'COORDINATE_CLICK',
  'RESIZE_VIEWPORT',
];

export const elementValueSources: readonly ElementValueCheckSource[] = [
  'ATTRIBUTE',
  'CSS_VALUE',
  'PROPERTY',
];

export const viewportMovements: readonly ViewportMove[] = [
  'SCROLL_BY',
  'PAGE_FLIP',
  'SCROLL_TO_TOP',
  'SCROLL_TO_BOTTOM',
];

export const viewportDirections: readonly ViewportMoveDirection[] = ['UP', 'DOWN'];

export const viewportUnits: readonly ViewportMoveUnit[] = ['PIXELS', 'VIEWPORTS'];

export const valueComputationTypes: readonly ValueComputationType[] = [
  'FIXED',
  'RELATIVE_DATE',
  'RANDOM',
  'TIMESTAMP_NOW',
  'SYSTEM_VAR',
  'TEST_DATA',
];

export const actionTypeSet = new Set<ActionDetailsType>(actionTypes);

export const valueComputationTypeSet = new Set<ValueComputationType>(valueComputationTypes);

export function createDefaultActionFormState(): ActionFormState {
  return {
    detailsType: null,
    valueComputationType: 'FIXED',
    value: '',
    offsetDays: 0,
    formatPattern: 'yyyy-MM-dd',
    prefix: '',
    charPool: 'abcdefghijklmnopqrstuvwxyz0123456789',
    randomStringLength: 8,
    suffix: '',
    variableName: '',
    defaultValue: '',
    testDataId: null,
    key: '',
    clearBeforeTyping: false,
    delayAfterClearMillis: 0,
    delayMillis: 0,
    storageKey: '',
    cookieName: '',
    elementValueSource: 'ATTRIBUTE',
    elementValueName: '',
    downloadedFileName: '',
    downloadedDocumentFileName: '',
    downloadedDocumentExpectedText: '',
    downloadedDocumentCaseSensitive: false,
    viewportMovement: 'SCROLL_BY',
    viewportDirection: 'DOWN',
    viewportAmount: 1,
    viewportUnit: 'VIEWPORTS',
    viewportDelayAfterMoveMillis: 0,
    xCoordinate: 0,
    yCoordinate: 0,
    viewportWidth: undefined,
    viewportHeight: undefined,
  };
}
