import { Injectable, inject } from '@angular/core';
import { CapabilitiesService } from '../../core/capabilities.service';
import {
  validateTestPlanActionGraph,
  type TestPlanActionGraphNode,
} from './test-plan-action-graph-validator';

/** Uses startup metadata; execution limits are never duplicated as frontend defaults. */
@Injectable({ providedIn: 'root' })
export class TestPlanGraphValidationService {
  private readonly capabilities = inject(CapabilitiesService);

  validationError(actions: readonly TestPlanActionGraphNode[]): string | null {
    const maximumActions = this.capabilities.numberValue('TEST_PLAN_MAXIMUM_ACTIONS');
    const maximumPaths = this.capabilities.numberValue('TEST_PLAN_MAXIMUM_PATHS');
    const maximumActionOccurrences = this.capabilities.numberValue(
      'TEST_PLAN_MAXIMUM_ACTION_OCCURRENCES',
    );
    if (
      !this.isPositiveLimit(maximumActions) ||
      !this.isPositiveLimit(maximumPaths) ||
      !this.isPositiveLimit(maximumActionOccurrences)
    ) {
      return 'Server execution graph limits are unavailable. Reload service metadata before saving.';
    }
    return validateTestPlanActionGraph(actions, {
      maximumActions,
      maximumPaths,
      maximumActionOccurrences,
    }).message;
  }

  private isPositiveLimit(value: number | null): value is number {
    return value !== null && Number.isSafeInteger(value) && value > 0;
  }
}
