import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideRefreshCw } from '@lucide/angular';
import { TuiButton, TuiLoader } from '@taiga-ui/core';
import {
  EMPTY,
  catchError,
  expand,
  forkJoin,
  map,
  of,
  switchMap,
  toArray,
  type Observable,
} from 'rxjs';
import { WorkspaceContextService } from '../../context/workspace-context.service';
import { resourceLinkHref } from '../../core/hateoas-links';
import type { PagedTestRunHistory, TestPlan, TestRunHistoryPoint } from '../../generated/hateoas';
import type { Deployment, PagedDeployment } from '../../core/deployment-types';
import { MetricsCalendarPanelComponent } from './metrics-calendar-panel.component';
import { MetricsRecentRunsPanelComponent } from './metrics-recent-runs-panel.component';
import { MetricsResultMixPanelComponent } from './metrics-result-mix-panel.component';
import { MetricsSummaryPanelComponent } from './metrics-summary-panel.component';
import { MetricsTimelinePanelComponent } from './metrics-timeline-panel.component';
import { metricsSelectionFromParams, type MetricsSelection } from './metrics-selection';
import { toDate } from './metrics-utils';

type HistoryPageResult = {
  requestedPage: number;
  history: PagedTestRunHistory;
};

const HISTORY_PAGE_SIZE = 50;

@Component({
  selector: 'app-metrics-page',
  imports: [
    LucideRefreshCw,
    MetricsCalendarPanelComponent,
    MetricsRecentRunsPanelComponent,
    MetricsResultMixPanelComponent,
    MetricsSummaryPanelComponent,
    MetricsTimelinePanelComponent,
    TuiButton,
    TuiLoader,
  ],
  templateUrl: './metrics-page.component.html',
  styleUrl: './metrics-page.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricsPageComponent {
  private readonly context = inject(WorkspaceContextService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private activeRequestKey: string | null = null;

  protected readonly selection = signal<MetricsSelection | null>(null);
  protected readonly history = signal<PagedTestRunHistory | null>(null);
  protected readonly deployments = signal<Deployment[]>([]);
  protected readonly testPlan = signal<TestPlan | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const selection = metricsSelectionFromParams(params);
      this.selection.set(selection);

      if (!selection) {
        this.activeRequestKey = null;
        this.history.set(null);
        this.deployments.set([]);
        this.testPlan.set(null);
        this.loading.set(false);
        this.error.set(null);
        return;
      }

      this.loadMetrics(selection);
    });
  }

  protected reload(): void {
    const selection = this.selection();

    if (selection) {
      this.loadMetrics(selection);
    }
  }

  protected openTestRunDetails(run: TestRunHistoryPoint): void {
    const selection = this.selection();
    const testRunId = run.id;

    if (!selection || testRunId === undefined) {
      return;
    }

    void this.router.navigate([
      '/test-results',
      selection.applicationId,
      selection.stageId,
      testRunId,
    ]);
  }

  private loadMetrics(selection: MetricsSelection): void {
    const requestKey = this.requestKey(selection);
    this.activeRequestKey = requestKey;
    this.loading.set(true);
    this.error.set(null);
    this.history.set(null);
    this.deployments.set([]);
    this.testPlan.set(null);

    this.fetchTestPlan(selection)
      .pipe(
        switchMap((testPlan) =>
          forkJoin({
            history: this.fetchCompleteHistory(selection, resourceLinkHref(testPlan, 'history')),
            deployments: this.fetchCompleteDeployments(selection),
            testPlan: of(testPlan),
          }),
        ),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ history, deployments, testPlan }) => {
          if (this.activeRequestKey !== requestKey) {
            return;
          }

          this.history.set(history);
          this.deployments.set(deployments);
          this.testPlan.set(testPlan);
          this.loading.set(false);
        },
        error: (error: Error) => {
          if (this.activeRequestKey !== requestKey) {
            return;
          }

          this.history.set(null);
          this.deployments.set([]);
          this.testPlan.set(null);
          this.loading.set(false);
          this.error.set(error.message);
        },
      });
  }

  private requestKey(selection: MetricsSelection): string {
    return `${selection.applicationId}:${selection.stageId}:${selection.testPlanId}`;
  }

  private fetchTestPlan(selection: MetricsSelection): Observable<TestPlan | null> {
    return this.context
      .fetchResource<TestPlan>(
        `/api/applications/${selection.applicationId}/stages/${selection.stageId}/testPlans/${selection.testPlanId}?includeRetired=true`,
      )
      .pipe(catchError(() => of(null)));
  }

  private fetchCompleteHistory(
    selection: MetricsSelection,
    historyHref: string | null,
  ): Observable<PagedTestRunHistory> {
    return this.fetchHistoryPageResult(selection, historyHref, 0).pipe(
      expand((result) => {
        const nextPage = result.requestedPage + 1;
        return this.hasNextHistoryPage(result.history, nextPage)
          ? this.fetchHistoryPageResult(selection, historyHref, nextPage)
          : EMPTY;
      }),
      toArray(),
      map((pages) =>
        this.combineHistoryPages(
          selection,
          pages.map((page) => page.history),
        ),
      ),
    );
  }

  private fetchHistoryPageResult(
    selection: MetricsSelection,
    historyHref: string | null,
    page: number,
  ): Observable<HistoryPageResult> {
    return this.fetchHistoryPage(selection, historyHref, page).pipe(
      map((history) => ({
        requestedPage: page,
        history,
      })),
    );
  }

  private fetchHistoryPage(
    selection: MetricsSelection,
    historyHref: string | null,
    page: number,
  ): Observable<PagedTestRunHistory> {
    const { applicationId, stageId, testPlanId } = selection;
    const baseHref =
      historyHref ??
      `/api/applications/${applicationId}/stages/${stageId}/testPlans/${testPlanId}/metrics/history`;
    return this.context.fetchResource<PagedTestRunHistory>(this.withPaging(baseHref, page));
  }

  private fetchCompleteDeployments(selection: MetricsSelection): Observable<Deployment[]> {
    return this.fetchDeploymentPage(selection, 0).pipe(
      expand((page) => {
        const nextPage = (page.page ?? 0) + 1;
        return this.hasNextDeploymentPage(page, nextPage)
          ? this.fetchDeploymentPage(selection, nextPage)
          : EMPTY;
      }),
      toArray(),
      map((pages) =>
        this.uniqueDeployments(pages.flatMap((page) => page.items ?? [])).sort((left, right) =>
          this.compareDeployments(left, right),
        ),
      ),
    );
  }

  private fetchDeploymentPage(
    selection: MetricsSelection,
    page: number,
  ): Observable<PagedDeployment> {
    return this.context
      .fetchResource<PagedDeployment>(
        `/api/applications/${selection.applicationId}/stages/${selection.stageId}/deployments?page=${page}&size=${HISTORY_PAGE_SIZE}`,
      )
      .pipe(catchError(() => of({ items: [], page: 0, totalPages: 0 })));
  }

  private withPaging(href: string, page: number): string {
    const unpagedHref = this.withoutPaging(href);
    const separator = unpagedHref.includes('?') ? '&' : '?';
    return `${unpagedHref}${separator}page=${page}&size=${HISTORY_PAGE_SIZE}`;
  }

  private withoutPaging(href: string): string {
    const [base, query = ''] = href.split('?', 2);

    if (!query) {
      return href;
    }

    const params = new URLSearchParams(query);
    params.delete('page');
    params.delete('size');

    const remaining = params.toString();
    return remaining ? `${base}?${remaining}` : base;
  }

  private hasNextHistoryPage(historyPage: PagedTestRunHistory, nextPage: number): boolean {
    const totalPages = historyPage.totalPages;

    if (totalPages !== undefined) {
      return nextPage < totalPages;
    }

    const pageSize = historyPage.size;
    const totalElements = historyPage.totalElements;

    if (pageSize !== undefined && totalElements !== undefined) {
      return nextPage * pageSize < totalElements;
    }

    return false;
  }

  private hasNextDeploymentPage(deploymentPage: PagedDeployment, nextPage: number): boolean {
    const totalPages = deploymentPage.totalPages;

    if (totalPages !== undefined) {
      return nextPage < totalPages;
    }

    const pageSize = deploymentPage.size;
    const totalElements = deploymentPage.totalElements;

    if (pageSize !== undefined && totalElements !== undefined) {
      return nextPage * pageSize < totalElements;
    }

    return false;
  }

  private combineHistoryPages(
    selection: MetricsSelection,
    pages: PagedTestRunHistory[],
  ): PagedTestRunHistory {
    const firstPage = pages[0];
    const items = this.uniqueHistoryPoints(pages.flatMap((page) => page.items ?? [])).sort(
      (left, right) => this.compareHistoryPoints(left, right),
    );
    const successfulRuns = this.countRunsByIndicator(items, 'SUCCESS');
    const partialSuccessRuns = this.countRunsByIndicator(items, 'PARTIAL_SUCCESS');
    const failedRuns = this.countRunsByIndicator(items, 'FAILURE');

    return {
      ...(firstPage ?? {}),
      applicationId: firstPage?.applicationId ?? selection.applicationId,
      stageId: firstPage?.stageId ?? selection.stageId,
      testPlanId: firstPage?.testPlanId ?? selection.testPlanId,
      totalRuns: items.length,
      successfulRuns,
      partialSuccessRuns,
      failedRuns,
      page: 0,
      size: HISTORY_PAGE_SIZE,
      totalElements: items.length,
      totalPages: pages.length,
      items,
    };
  }

  private uniqueHistoryPoints(items: TestRunHistoryPoint[]): TestRunHistoryPoint[] {
    const uniqueItems = new Map<string, TestRunHistoryPoint>();

    for (const item of items) {
      uniqueItems.set(this.historyPointKey(item), item);
    }

    return [...uniqueItems.values()];
  }

  private uniqueDeployments(items: Deployment[]): Deployment[] {
    const uniqueItems = new Map<string, Deployment>();

    for (const item of items) {
      uniqueItems.set(this.deploymentKey(item), item);
    }

    return [...uniqueItems.values()];
  }

  private deploymentKey(item: Deployment): string {
    if (item.id !== undefined) {
      return `id:${item.id}`;
    }

    return `deployedAt:${item.deployedAt ?? ''}:version:${item.version ?? ''}`;
  }

  private historyPointKey(item: TestRunHistoryPoint): string {
    if (item.id !== undefined) {
      return `id:${item.id}`;
    }

    return `timestamp:${item.timestamp ?? ''}:indicator:${item.indicator ?? ''}:label:${item.label ?? ''}`;
  }

  private countRunsByIndicator(
    items: TestRunHistoryPoint[],
    indicator: TestRunHistoryPoint['indicator'],
  ): number {
    return items.filter((item) => item.indicator === indicator).length;
  }

  private compareHistoryPoints(left: TestRunHistoryPoint, right: TestRunHistoryPoint): number {
    const leftTime = toDate(left.timestamp)?.getTime() ?? 0;
    const rightTime = toDate(right.timestamp)?.getTime() ?? 0;
    const timestampDifference = leftTime - rightTime;

    if (timestampDifference !== 0) {
      return timestampDifference;
    }

    return (left.id ?? 0) - (right.id ?? 0);
  }

  private compareDeployments(left: Deployment, right: Deployment): number {
    const leftTime = toDate(left.deployedAt)?.getTime() ?? 0;
    const rightTime = toDate(right.deployedAt)?.getTime() ?? 0;
    const timestampDifference = leftTime - rightTime;

    if (timestampDifference !== 0) {
      return timestampDifference;
    }

    return (left.id ?? 0) - (right.id ?? 0);
  }
}
