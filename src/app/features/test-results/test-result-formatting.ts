import type { ResultIndicator, TestSetResult } from '../../generated/hateoas/types.gen';
import type { ActionResultType } from './test-result-details.models';

export function resultIndicatorLabel(indicator: ResultIndicator | undefined): string {
  return indicator ? indicator.replace(/_/g, ' ') : '-';
}

export function actionResultLabel(resultType: ActionResultType | undefined): string {
  return resultType ? resultType.replace(/_/g, ' ') : '-';
}

export function testSetBrowser(testSet: TestSetResult): string {
  return testSet.browserToRunIn ?? testSet.testCaseResult?.testedInBrowser ?? '-';
}

export function runtimeLabel(totalRunTime: number | undefined): string {
  if (totalRunTime === undefined) {
    return '-';
  }

  if (totalRunTime < 1000) {
    return `${totalRunTime} ms`;
  }

  return `${(totalRunTime / 1000).toFixed(2)} s`;
}
