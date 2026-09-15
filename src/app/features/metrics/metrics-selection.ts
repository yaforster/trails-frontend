import type { ParamMap } from '@angular/router';

export type MetricsSelection = {
  applicationId: number;
  stageId: number;
  testPlanId: number;
};

const decimalInteger: RegExp = /^\d+$/;

export function metricsSelectionFromParams(params: ParamMap): MetricsSelection | null {
  const applicationId: number | null = selectionId(params, 'applicationId');
  const stageId: number | null = selectionId(params, 'stageId');
  const testPlanId: number | null = selectionId(params, 'testPlanId');

  if (applicationId === null || stageId === null || testPlanId === null) {
    return null;
  }

  return { applicationId, stageId, testPlanId };
}

function selectionId(params: ParamMap, key: string): number | null {
  const values: string[] = params.getAll(key);

  if (values.length !== 1) {
    return null;
  }

  const value: string = values[0].trim();

  if (!decimalInteger.test(value)) {
    return null;
  }

  const parsed: number = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
