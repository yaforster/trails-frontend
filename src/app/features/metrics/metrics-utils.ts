import type { ResultIndicator, TestRunHistoryPoint } from '../../generated/hateoas';

export function statusLabel(indicator: ResultIndicator | undefined): string {
  switch (indicator) {
    case 'SUCCESS':
      return 'Successful';
    case 'PARTIAL_SUCCESS':
      return 'Partial';
    case 'FAILURE':
      return 'Failed';
    default:
      return 'Unknown';
  }
}

export function statusClass(indicator: ResultIndicator | undefined): string {
  switch (indicator) {
    case 'SUCCESS':
      return 'status-success';
    case 'PARTIAL_SUCCESS':
      return 'status-partial';
    case 'FAILURE':
      return 'status-failure';
    default:
      return 'status-unknown';
  }
}

export function runLabel(run: TestRunHistoryPoint): string {
  return run.label ?? `Run ${run.id ?? ''}`.trim();
}

export function toDate(timestamp: string | undefined): Date | null {
  if (!timestamp) {
    return null;
  }

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}
