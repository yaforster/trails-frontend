import type {
  ActionDetailsType,
  Browser,
  ElementType,
  LocatorType,
  ValueComputationType,
} from '../../generated/hateoas/types.gen';

export type BrowserOption = {
  browser: Browser;
  label: string;
  iconSrc: string;
};

export type PromoteTarget = {
  kind: 'element' | 'test-plan';
  label: string;
  href: string;
};

export type ElementDialogMode = 'create' | 'edit';

export type TestDataDialogMode = 'create' | 'edit';

export type ResourceTab = 'active' | 'retired';

export type RestoreTarget = {
  kind: 'element' | 'test-plan' | 'test-data';
  label: string;
  href: string;
};

export type TestDataDraftEntry = {
  draftId: number;
  key: string;
  value: string;
};

export const elementTypes: readonly ElementType[] = [
  'SELECT',
  'RADIO',
  'BUTTON',
  'TEXT',
  'INPUT',
  'CHECKBOX',
  'COLORPICKER',
  'DATEPICKER',
  'DATETIMEPICKER',
  'FILEUPLOAD',
  'RANGE',
  'TIME',
  'WEEK',
];

export const locatorTypes: readonly LocatorType[] = ['CSS', 'XPATH'];

export const actionDetailsTypes: readonly ActionDetailsType[] = [
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

export const valueComputationTypes: readonly ValueComputationType[] = [
  'FIXED',
  'RELATIVE_DATE',
  'RANDOM',
  'TIMESTAMP_NOW',
  'SYSTEM_VAR',
  'TEST_DATA',
];
