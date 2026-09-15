import { Injectable, inject } from '@angular/core';
import { catchError, forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { WorkspaceContextService } from '../../context/workspace-context.service';
import { expandQueryTemplate, resourceLinkHref } from '../../core/hateoas-links';
import type {
  Action,
  DatabaseDeletionResult,
  PagedAction,
  PagedTestPlans,
  PersistedTestPlan,
  TestExecutionAccepted,
  TestPlan,
  TestPlanRunDefinition,
} from '../../generated/hateoas/types.gen';
import { includeRetired } from './data-management-links';

@Injectable({ providedIn: 'root' })
export class TestPlansSectionDataService {
  private readonly context = inject(WorkspaceContextService);

  loadTestPlans(applicationId: number, stageId: number): Observable<TestPlan[]> {
    const testPlansHref = resourceLinkHref(this.context.selectedStage(), 'testPlans');

    return this.context
      .fetchPaged<
        TestPlan,
        PagedTestPlans
      >(includeRetired(testPlansHref ?? `/api/applications/${applicationId}/stages/${stageId}/testPlans`))
      .pipe(
        switchMap((testPlans) => {
          const requests = testPlans.map((testPlan) => this.loadHydratedTestPlan(testPlan));
          return requests.length > 0 ? forkJoin(requests) : of([]);
        }),
      );
  }

  loadTestPlanActions(
    testPlan: TestPlan | undefined,
    applicationId: number,
    stageId: number,
    testPlanId: number,
  ): Observable<Action[]> {
    const stepsHref = resourceLinkHref(testPlan, 'steps');

    return this.context.fetchPaged<Action, PagedAction>(
      stepsHref ??
        `/api/applications/${applicationId}/stages/${stageId}/testPlans/${testPlanId}/actions`,
    );
  }

  startTestRun(
    executeHref: string,
    definition: TestPlanRunDefinition,
  ): Observable<TestExecutionAccepted> {
    return this.context.postResource<TestPlanRunDefinition, TestExecutionAccepted>(
      executeHref,
      definition,
    );
  }

  promoteTestPlan(promoteHref: string, targetStageId: number): Observable<PersistedTestPlan> {
    return this.context.postResource<null, PersistedTestPlan>(
      expandQueryTemplate(promoteHref, { targetStageId }),
      null,
    );
  }

  deleteTestPlan(deleteHref: string): Observable<DatabaseDeletionResult> {
    return this.context.deleteResource<DatabaseDeletionResult>(deleteHref);
  }

  restoreTestPlan(restoreHref: string): Observable<DatabaseDeletionResult> {
    return this.context.postResource<null, DatabaseDeletionResult>(restoreHref, null);
  }

  private loadHydratedTestPlan(testPlan: TestPlan): Observable<TestPlan> {
    const selfHref = resourceLinkHref(testPlan, 'self');

    if (!selfHref || testPlan.retired === true) {
      return of(testPlan);
    }

    return this.context.fetchResource<TestPlan>(includeRetired(selfHref)).pipe(
      map((details) => ({
        ...testPlan,
        ...details,
      })),
      catchError(() => of(testPlan)),
    );
  }
}
