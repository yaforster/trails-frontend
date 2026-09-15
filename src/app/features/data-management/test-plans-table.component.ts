import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LucidePlay, LucideRefreshCw } from '@lucide/angular';
import { TuiButton, TuiLoader } from '@taiga-ui/core';
import { TuiMessage, TuiPagination, TuiSegmented } from '@taiga-ui/kit';
import { hasResourceLink } from '../../core/hateoas-links';
import type { TestPlan } from '../../generated/hateoas/types.gen';
import type { ResourceTab } from './data-management.models';

const rowsPerPage = 10;

@Component({
  selector: 'app-test-plans-table',
  imports: [
    LucidePlay,
    LucideRefreshCw,
    MatIconModule,
    TuiButton,
    TuiLoader,
    TuiMessage,
    TuiPagination,
    TuiSegmented,
  ],
  templateUrl: './test-plans-table.component.html',
  styleUrl: './data-management-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class TestPlansTableComponent {
  readonly testPlans = input.required<TestPlan[]>();
  readonly selectedTab = input.required<ResourceTab>();
  readonly loading = input.required<boolean>();
  readonly error = input.required<string | null>();
  readonly openingTestPlanId = input.required<number | null>();
  readonly deletingTestPlanId = input.required<number | null>();
  readonly runningTestPlanId = input.required<number | null>();
  readonly canShowRetiredTab = input.required<boolean>();
  readonly hasSelectedContext = input.required<boolean>();

  readonly selectedTabChange = output<ResourceTab>();
  readonly reload = output<void>();
  readonly runTestPlan = output<TestPlan>();
  readonly promoteTestPlan = output<TestPlan>();
  readonly openMetrics = output<TestPlan>();
  readonly openTestPlan = output<TestPlan>();
  readonly restoreTestPlan = output<TestPlan>();
  readonly deleteTestPlan = output<TestPlan>();

  protected readonly pageIndex = signal(0);
  protected readonly rowsPerPage = rowsPerPage;
  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.testPlans().length / rowsPerPage)),
  );
  protected readonly visibleTestPlans = computed(() => {
    const pageIndex = Math.min(this.pageIndex(), this.pageCount() - 1);
    const start = pageIndex * rowsPerPage;

    return this.testPlans().slice(start, start + rowsPerPage);
  });

  protected readonly activeTabIndex = computed(() => (this.selectedTab() === 'retired' ? 1 : 0));

  protected canOpenRunDialog(testPlan: TestPlan): boolean {
    return (
      testPlan.id !== undefined &&
      this.runningTestPlanId() === null &&
      hasResourceLink(testPlan, 'execute')
    );
  }

  protected canOpenTestPlanMetrics(testPlan: TestPlan): boolean {
    return (
      testPlan.id !== undefined && this.hasSelectedContext() && hasResourceLink(testPlan, 'history')
    );
  }

  protected canOpenTestPlan(testPlan: TestPlan): boolean {
    return (
      testPlan.id !== undefined &&
      this.openingTestPlanId() === null &&
      hasResourceLink(testPlan, 'steps')
    );
  }

  protected openTestPlanTooltip(testPlan: TestPlan): string {
    if (testPlan.id === undefined) {
      return 'This test plan cannot be opened because the API response did not include a test plan ID. Contact an administrator if this is unexpected.';
    }

    if (this.openingTestPlanId() !== null) {
      return 'Another test plan is currently being opened.';
    }

    if (!hasResourceLink(testPlan, 'steps')) {
      return 'This test plan cannot be opened because the API response did not include a steps link. This usually means the test plan has no test steps; contact an administrator if this is unexpected.';
    }

    return 'Open test plan in the modeller.';
  }

  protected setTab(index: number): void {
    this.pageIndex.set(0);
    this.selectedTabChange.emit(index === 1 ? 'retired' : 'active');
  }
}
