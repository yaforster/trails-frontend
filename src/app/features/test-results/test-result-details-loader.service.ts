import { Injectable, inject } from '@angular/core';
import { catchError, forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { WorkspaceContextService } from '../../context/workspace-context.service';
import { resourceLinkHref } from '../../core/hateoas-links';
import type {
  ActionResult,
  ActionResultChain,
  Artifact,
  PagedArtifact,
  PagedTestPathResult,
  PagedTestSetResult,
  PersistedTestRunResult,
  TestPathResult,
  TestSetResult,
} from '../../generated/hateoas/types.gen';
import type {
  ActionResultView,
  DetailsRoute,
  TestPathResultView,
  TestRunDetailsView,
  TestSetResultView,
} from './test-result-details.models';

export type TestRunDetailsLoadResult = {
  details: TestRunDetailsView;
  screenshotUrls: string[];
};

@Injectable({ providedIn: 'root' })
export class TestResultDetailsLoaderService {
  private readonly context = inject(WorkspaceContextService);

  loadDetails(detailsRoute: DetailsRoute): Observable<TestRunDetailsLoadResult> {
    const screenshotUrls: string[] = [];

    return this.context
      .fetchResource<PersistedTestRunResult>(
        `/api/testruns/${detailsRoute.applicationId}/${detailsRoute.stageId}/${detailsRoute.testRunId}`,
      )
      .pipe(
        switchMap((testRun: PersistedTestRunResult) =>
          this.loadTestSets(detailsRoute, testRun, screenshotUrls).pipe(
            map((testSets: TestSetResultView[]) => ({
              details: {
                result: testRun,
                testSets,
              },
              screenshotUrls,
            })),
          ),
        ),
      );
  }

  private loadTestSets(
    detailsRoute: DetailsRoute,
    testRun: PersistedTestRunResult,
    screenshotUrls: string[],
  ): Observable<TestSetResultView[]> {
    const testSetsHref = resourceLinkHref(testRun, 'testSets');

    return this.context
      .fetchPaged<
        TestSetResult,
        PagedTestSetResult
      >(testSetsHref ?? `/api/testruns/${detailsRoute.applicationId}/${detailsRoute.stageId}/${detailsRoute.testRunId}/browsers`)
      .pipe(
        switchMap((testSets: TestSetResult[]) => {
          const requests = testSets.map((testSet: TestSetResult) =>
            this.loadTestSet(detailsRoute, testSet, screenshotUrls),
          );

          return requests.length > 0 ? forkJoin(requests) : of([]);
        }),
      );
  }

  private loadTestSet(
    detailsRoute: DetailsRoute,
    testSet: TestSetResult,
    screenshotUrls: string[],
  ): Observable<TestSetResultView> {
    if (testSet.id === undefined) {
      return of({
        result: testSet,
        paths: [],
      });
    }

    return this.context
      .fetchPaged<
        TestPathResult,
        PagedTestPathResult
      >(resourceLinkHref(testSet, 'paths') ?? `/api/testruns/${detailsRoute.applicationId}/${detailsRoute.stageId}/${detailsRoute.testRunId}/browsers/${testSet.id}/paths`)
      .pipe(
        switchMap((paths: TestPathResult[]) => {
          const requests = paths.map((path: TestPathResult) =>
            this.loadPath(detailsRoute, testSet.id as number, path, screenshotUrls),
          );

          return requests.length > 0 ? forkJoin(requests) : of([]);
        }),
        map((paths: TestPathResultView[]) => ({
          result: testSet,
          paths,
        })),
      );
  }

  private loadPath(
    detailsRoute: DetailsRoute,
    testSetId: number,
    path: TestPathResult,
    screenshotUrls: string[],
  ): Observable<TestPathResultView> {
    if (path.id === undefined) {
      return of({
        result: path,
        actions: [],
        artifacts: [],
      });
    }

    const actionResults = this.context
      .fetchResource<ActionResultChain>(
        resourceLinkHref(path, 'actionResults') ??
          `/api/testruns/${detailsRoute.applicationId}/${detailsRoute.stageId}/${detailsRoute.testRunId}/browsers/${testSetId}/paths/${path.id}/actions/chain`,
      )
      .pipe(
        switchMap((chain: ActionResultChain) => {
          const actions = chain.items ?? [];
          const requests = actions.map((action: ActionResult) =>
            this.loadAction(detailsRoute, testSetId, path.id as number, action, screenshotUrls),
          );

          return requests.length > 0 ? forkJoin(requests) : of([]);
        }),
      );
    const artifacts = this.context
      .fetchPaged<
        Artifact,
        PagedArtifact
      >(resourceLinkHref(path, 'downloadedFiles') ?? `/api/testruns/${detailsRoute.applicationId}/${detailsRoute.stageId}/${detailsRoute.testRunId}/browsers/${testSetId}/paths/${path.id}/artifacts`)
      .pipe(
        map((artifacts: Artifact[]) =>
          artifacts.map((artifact) => ({
            artifact,
            downloadUrl:
              resourceLinkHref(artifact, 'self') ??
              (artifact.id === undefined
                ? null
                : `/api/testruns/${detailsRoute.applicationId}/${detailsRoute.stageId}/${detailsRoute.testRunId}/browsers/${testSetId}/paths/${path.id}/artifacts/${artifact.id}`),
          })),
        ),
      );

    return forkJoin({
      actions: actionResults,
      artifacts,
    }).pipe(
      map(({ actions, artifacts }) => ({
        result: path,
        actions,
        artifacts,
      })),
    );
  }

  private loadAction(
    detailsRoute: DetailsRoute,
    testSetId: number,
    pathResultId: number,
    action: ActionResult,
    screenshotUrls: string[],
  ): Observable<ActionResultView> {
    if (action.id === undefined) {
      return of({
        result: action,
        screenshotBlob: null,
        screenshotUrl: null,
      });
    }

    return this.context
      .fetchBlob(
        resourceLinkHref(action, 'screenshot') ??
          `/api/testruns/${detailsRoute.applicationId}/${detailsRoute.stageId}/${detailsRoute.testRunId}/browsers/${testSetId}/paths/${pathResultId}/actions/chain/screenshots/${action.id}`,
      )
      .pipe(
        map((blob: Blob) => {
          if (blob.size === 0) {
            return {
              result: action,
              screenshotBlob: null,
              screenshotUrl: null,
            };
          }

          const screenshotUrl = URL.createObjectURL(blob);
          screenshotUrls.push(screenshotUrl);

          return {
            result: action,
            screenshotBlob: blob,
            screenshotUrl,
          };
        }),
        catchError(() =>
          of({
            result: action,
            screenshotBlob: null,
            screenshotUrl: null,
          }),
        ),
      );
  }
}
