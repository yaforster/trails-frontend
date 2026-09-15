import type { ActionDetailsType } from '../../generated/hateoas/types.gen';
import type { ElementPaletteItem } from './test-plan-modeller-graph.service';

export function actionTypeIcon(actionType: ActionDetailsType | null): string {
  switch (actionType) {
    case 'CHECK_EXISTENCE':
      return 'fact_check';
    case 'CLICK':
      return 'ads_click';
    case 'TYPING':
      return 'keyboard';
    case 'SWITCH_WEBSITE':
      return 'open_in_browser';
    case 'SELECTION':
      return 'checklist';
    case 'TEXT_CHECK':
      return 'text_fields';
    case 'ELEMENT_VALUE_CHECK':
      return 'rule_settings';
    case 'LOCAL_STORAGE_SEARCH':
      return 'storage';
    case 'SESSION_STORAGE_SEARCH':
      return 'inventory_2';
    case 'COOKIE_SEARCH':
      return 'cookie';
    case 'EXPLICIT_WAIT':
      return 'timer_pause';
    case 'DOWNLOADED_FILE_CHECK':
      return 'download_done';
    case 'DOWNLOADED_DOCUMENT_TEXT_CHECK':
      return 'plagiarism';
    case 'VIEWPORT_MOVE':
      return 'swap_vert';
    case 'COORDINATE_CLICK':
      return 'ads_click';
    case 'RESIZE_VIEWPORT':
      return 'aspect_ratio';
    default:
      return '';
  }
}

export function locatorIcon(locatorType: string): string {
  if (locatorType === '-') {
    return 'deployed_code';
  }

  return locatorType === 'XPATH' ? 'code' : 'css';
}

export function nodeSummaryIcon(
  node: ElementPaletteItem & { action: { detailsType: ActionDetailsType | null } },
): string {
  return node.locatorType === '-'
    ? actionTypeIcon(node.action.detailsType)
    : locatorIcon(node.locatorType);
}
