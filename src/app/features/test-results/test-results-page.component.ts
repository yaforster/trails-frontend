import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { LucideEye, LucideRefreshCw } from '@lucide/angular';
import { TuiButton, TuiLoader } from '@taiga-ui/core';
import { TuiPagination } from '@taiga-ui/kit';
import { WorkspaceContextService } from '../../context/workspace-context.service';
import { resourceLinkHref } from '../../core/hateoas-links';
import type {
  PagedTestRun,
  PersistedTestRunResult,
  ResultIndicator,
} from '../../generated/hateoas/types.gen';

type TestRunSortField = 'id' | 'label' | 'indicator' | 'timestamp' | 'applicationId' | 'stageId';

type SortDirection = 'asc' | 'desc';

const rowsPerPage = 10;

@Component({
  selector: 'app-test-results-page',
  imports: [DatePipe, LucideEye, LucideRefreshCw, TuiButton, TuiLoader, TuiPagination],
  templateUrl: './test-results-page.component.html',
  styleUrl: './test-results-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestResultsPageComponent {
  protected readonly context = inject(WorkspaceContextService);
  private readonly router = inject(Router);
  protected readonly testRuns = signal<PersistedTestRunResult[]>([]);
  protected readonly testRunIdSearch = signal('');
  protected readonly testRunsLoading = signal(false);
  protected readonly testRunsError = signal<string | null>(null);
  protected readonly testRunsPageIndex = signal(0);
  protected readonly sortField = signal<TestRunSortField>('timestamp');
  protected readonly sortDirection = signal<SortDirection>('desc');
  protected readonly rowsPerPage = rowsPerPage;

  protected readonly filteredTestRuns = computed<PersistedTestRunResult[]>(() => {
    const search = this.testRunIdSearch().trim();
    const testRuns = this.testRuns();

    if (search.length === 0) {
      return testRuns;
    }

    return testRuns.filter((testRun: PersistedTestRunResult) =>
      testRun.id?.toString().includes(search),
    );
  });
  protected readonly sortedTestRuns = computed<PersistedTestRunResult[]>(() => {
    const field = this.sortField();
    const direction = this.sortDirection() === 'asc' ? 1 : -1;

    return [...this.filteredTestRuns()].sort(
      (left, right) => this.compareTestRuns(left, right, field) * direction,
    );
  });
  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.sortedTestRuns().length / rowsPerPage)),
  );
  protected readonly visibleTestRuns = computed<PersistedTestRunResult[]>(() => {
    const pageIndex = Math.min(this.testRunsPageIndex(), this.pageCount() - 1);
    const start = pageIndex * rowsPerPage;

    return this.sortedTestRuns().slice(start, start + rowsPerPage);
  });

  constructor() {
    effect(() => {
      const applicationId = this.context.selectedApplicationId();
      const stageId = this.context.selectedStageId();

      if (applicationId !== null && stageId !== null) {
        untracked(() => this.loadTestRuns(applicationId, stageId));
      } else {
        this.testRuns.set([]);
        this.testRunIdSearch.set('');
        this.testRunsPageIndex.set(0);
      }
    });
  }

  protected reloadTestRuns(): void {
    const applicationId = this.context.selectedApplicationId();
    const stageId = this.context.selectedStageId();

    if (applicationId === null || stageId === null) {
      return;
    }

    this.loadTestRuns(applicationId, stageId);
  }

  protected resultLabel(indicator: ResultIndicator): string {
    return indicator.replace('_', ' ');
  }

  protected updateTestRunIdSearch(event: Event): void {
    const target = event.target;

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    this.testRunIdSearch.set(target.value);
    this.testRunsPageIndex.set(0);
  }

  protected updateSort(field: TestRunSortField): void {
    if (this.sortField() === field) {
      this.sortDirection.update((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }

    this.testRunsPageIndex.set(0);
  }

  protected sortIndicator(field: TestRunSortField): string {
    if (this.sortField() !== field) {
      return '';
    }

    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  protected canInspect(testRun: PersistedTestRunResult): boolean {
    return (
      testRun.id !== undefined &&
      (testRun.applicationId !== undefined || this.context.selectedApplicationId() !== null) &&
      (testRun.stageId !== undefined || this.context.selectedStageId() !== null)
    );
  }

  protected inspectTestRun(testRun: PersistedTestRunResult): void {
    const applicationId = testRun.applicationId ?? this.context.selectedApplicationId();
    const stageId = testRun.stageId ?? this.context.selectedStageId();
    const testRunId = testRun.id;

    if (applicationId === null || stageId === null || testRunId === undefined) {
      return;
    }

    void this.router.navigate(['/test-results', applicationId, stageId, testRunId]);
  }

  private loadTestRuns(applicationId: number, stageId: number): void {
    if (this.testRunsLoading()) {
      return;
    }

    this.testRunsLoading.set(true);
    this.testRunsError.set(null);

    const testRunsHref = resourceLinkHref(this.context.selectedStage(), 'testRuns');

    this.context
      .fetchPaged<
        PersistedTestRunResult,
        PagedTestRun
      >(testRunsHref ?? `/api/applications/${applicationId}/stages/${stageId}/testruns`)
      .subscribe({
        next: (testRuns) => {
          this.testRuns.set(testRuns);
          this.testRunsPageIndex.set(0);
          this.testRunsLoading.set(false);
        },
        error: (error: Error) => {
          this.testRunsLoading.set(false);
          this.testRunsError.set(error.message);
        },
      });
  }

  private compareTestRuns(
    left: PersistedTestRunResult,
    right: PersistedTestRunResult,
    field: TestRunSortField,
  ): number {
    const leftValue = left[field];
    const rightValue = right[field];

    if (leftValue === rightValue) {
      return 0;
    }

    if (leftValue === undefined || leftValue === null) {
      return 1;
    }

    if (rightValue === undefined || rightValue === null) {
      return -1;
    }

    return String(leftValue).localeCompare(String(rightValue), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  }
}
