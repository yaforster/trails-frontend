import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { LucidePlay } from '@lucide/angular';
import { TuiButton, TuiDialog, TuiLoader } from '@taiga-ui/core';
import { finalize } from 'rxjs';
import { WorkspaceContextService } from '../../context/workspace-context.service';
import { hasResourceLink, resourceLinkHref } from '../../core/hateoas-links';
import type {
  Browser,
  Stage,
  TestPlan,
  TestPlanRunDefinition,
} from '../../generated/hateoas/types.gen';
import { TestPlanModellerGraphService } from '../test-plan-modeller/test-plan-modeller-graph.service';
import { browserOptions } from './browser-options';
import { type ResourceTab } from './data-management.models';
import { hasRestorableRetiredResource, normalizeResourceTab } from './resource-tabs';
import { TestPlanExecutionNotificationService } from './test-plan-execution-notification.service';
import { toTestPlanDefinition } from './test-plan-definition.mapper';
import { TestPlansSectionDataService } from './test-plans-section-data.service';
import { TestPlansTableComponent } from './test-plans-table.component';

type PromoteTarget = {
  label: string;
  href: string;
};

type RestoreTarget = {
  label: string;
  href: string;
};

@Component({
  selector: 'app-test-plans-section',
  imports: [
    FormsModule,
    LucidePlay,
    MatIconModule,
    NgOptimizedImage,
    TuiButton,
    TuiDialog,
    TuiLoader,
    TestPlansTableComponent,
  ],
  templateUrl: './test-plans-section.component.html',
  styleUrl: './data-management-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestPlansSectionComponent {
  protected readonly context = inject(WorkspaceContextService);
  private readonly data = inject(TestPlansSectionDataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly executionNotifications = inject(TestPlanExecutionNotificationService);
  private readonly graph = inject(TestPlanModellerGraphService);
  private readonly router = inject(Router);

  protected readonly testPlans = signal<TestPlan[]>([]);
  protected readonly testPlansLoading = signal(false);
  protected readonly testPlansError = signal<string | null>(null);
  protected readonly openingTestPlanId = signal<number | null>(null);
  protected readonly deletingTestPlanId = signal<number | null>(null);
  protected readonly testPlansTab = signal<ResourceTab>('active');

  protected readonly activeTestPlans = computed(() =>
    this.testPlans().filter((testPlan) => testPlan.retired !== true),
  );
  protected readonly retiredTestPlans = computed(() =>
    this.testPlans().filter((testPlan) => testPlan.retired === true),
  );
  protected readonly displayedTestPlans = computed(() =>
    this.testPlansTab() === 'retired' ? this.retiredTestPlans() : this.activeTestPlans(),
  );
  protected readonly canShowRetiredTestPlansTab = computed(() =>
    hasRestorableRetiredResource(this.retiredTestPlans()),
  );

  protected readonly runDialogOpen = signal(false);
  protected readonly runDialogTestPlan = signal<TestPlan | null>(null);
  protected readonly selectedBrowsers = signal<Browser[]>([]);
  protected readonly startingTestRun = signal(false);
  protected readonly runError = signal<string | null>(null);
  protected readonly runConfirmation = signal<string | null>(null);
  protected readonly runningTestPlanId = signal<number | null>(null);
  protected readonly browserOptions = browserOptions;

  protected readonly promoteDialogOpen = signal(false);
  protected readonly promoteTarget = signal<PromoteTarget | null>(null);
  protected readonly promoteTargetStageId = signal<number | null>(null);
  protected readonly promoteReadyToConfirm = signal(false);
  protected readonly promoteLoading = signal(false);
  protected readonly promoteError = signal<string | null>(null);
  protected readonly promoteTargetStage = computed(() => {
    const targetStageId = this.promoteTargetStageId();
    return targetStageId === null
      ? null
      : (this.context.stages().find((stage) => stage.id === targetStageId) ?? null);
  });
  protected readonly promoteTargetStages = computed(() => {
    const sourceStageId = this.context.selectedStageId();
    return this.context
      .stages()
      .filter((stage): stage is Stage & { id: number } => stage.id !== undefined)
      .filter((stage) => stage.id !== sourceStageId && stage.retired !== true);
  });

  protected readonly restoreDialogOpen = signal(false);
  protected readonly restoreTarget = signal<RestoreTarget | null>(null);
  protected readonly restoreLoading = signal(false);
  protected readonly restoreError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const applicationId = this.context.selectedApplicationId();
      const stageId = this.context.selectedStageId();

      if (applicationId !== null && stageId !== null) {
        untracked(() => {
          this.testPlansTab.set('active');
          this.loadTestPlans(applicationId, stageId);
        });
      } else {
        this.testPlans.set([]);
      }
    });
  }

  protected reloadTestPlans(): void {
    const applicationId = this.context.selectedApplicationId();
    const stageId = this.context.selectedStageId();

    if (applicationId === null || stageId === null) {
      return;
    }

    this.loadTestPlans(applicationId, stageId);
  }

  protected selectTestPlansTab(tab: string | number | undefined): void {
    const selectedTab = tab === 'retired' ? 'retired' : 'active';

    if (selectedTab === 'retired' && !this.canShowRetiredTestPlansTab()) {
      return;
    }

    this.testPlansTab.set(selectedTab);
  }

  protected openRunDialog(testPlan: TestPlan): void {
    if (!this.canOpenRunDialog(testPlan)) {
      return;
    }

    this.runDialogTestPlan.set(testPlan);
    this.selectedBrowsers.set([]);
    this.runError.set(null);
    this.runConfirmation.set(null);
    this.startingTestRun.set(false);
    this.runDialogOpen.set(true);
  }

  protected closeRunDialog(): void {
    if (this.startingTestRun()) {
      return;
    }

    this.runDialogOpen.set(false);
    this.runDialogTestPlan.set(null);
    this.runError.set(null);
    this.runConfirmation.set(null);
  }

  protected toggleBrowser(browser: Browser): void {
    if (this.startingTestRun() || this.runConfirmation()) {
      return;
    }

    const selected = this.selectedBrowsers();

    if (selected.includes(browser)) {
      this.selectedBrowsers.set(selected.filter((item) => item !== browser));
      return;
    }

    this.selectedBrowsers.set([...selected, browser]);
  }

  protected isBrowserSelected(browser: Browser): boolean {
    return this.selectedBrowsers().includes(browser);
  }

  protected startTestRun(): void {
    const testPlan = this.runDialogTestPlan();
    const testPlanId = testPlan?.id;
    const testPlanLabel = testPlan?.label ?? `Test plan ${testPlanId ?? ''}`.trim();
    const browsers = this.selectedBrowsers();
    const applicationId = this.context.selectedApplicationId();
    const stageId = this.context.selectedStageId();
    const executeHref = resourceLinkHref(testPlan, 'execute');

    if (
      testPlanId === undefined ||
      applicationId === null ||
      stageId === null ||
      !executeHref ||
      this.startingTestRun() ||
      browsers.length === 0
    ) {
      return;
    }

    const definition: TestPlanRunDefinition = {
      testPlanID: testPlanId,
      browsersToTest: browsers,
    };

    this.startingTestRun.set(true);
    this.runningTestPlanId.set(testPlanId);
    this.runError.set(null);
    this.runConfirmation.set('Waiting for backend confirmation...');

    this.data
      .startTestRun(executeHref, definition)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (accepted) => {
          if (!accepted.executionId) {
            this.startingTestRun.set(false);
            this.runningTestPlanId.set(null);
            this.runConfirmation.set(null);
            this.runError.set(
              'The backend accepted the request but did not return an execution id.',
            );
            return;
          }

          this.startingTestRun.set(false);
          this.runDialogOpen.set(false);
          this.runDialogTestPlan.set(null);
          this.runConfirmation.set(null);
          this.selectedBrowsers.set([]);
          this.listenForTestExecution(
            accepted.executionId,
            testPlanLabel,
            accepted._links?.['events']?.href,
            applicationId,
            stageId,
          );
        },
        error: (error: Error) => {
          this.startingTestRun.set(false);
          this.runningTestPlanId.set(null);
          this.runConfirmation.set(null);
          this.runError.set(error.message);
        },
      });
  }

  protected openTestPlanMetrics(testPlan: TestPlan): void {
    const applicationId = this.context.selectedApplicationId();
    const stageId = this.context.selectedStageId();
    const testPlanId = testPlan.id;

    if (
      applicationId === null ||
      stageId === null ||
      testPlanId === undefined ||
      !hasResourceLink(testPlan, 'history')
    ) {
      return;
    }

    void this.router.navigate(['/metrics'], {
      queryParams: {
        applicationId,
        stageId,
        testPlanId,
      },
    });
  }

  protected openTestPlan(testPlan: TestPlan): void {
    const applicationId = this.context.selectedApplicationId();
    const stageId = this.context.selectedStageId();
    const testPlanId = testPlan.id;

    if (
      applicationId === null ||
      stageId === null ||
      testPlanId === undefined ||
      this.openingTestPlanId() !== null
    ) {
      return;
    }

    this.openingTestPlanId.set(testPlanId);
    this.testPlansError.set(null);

    this.data
      .loadTestPlanActions(
        this.testPlans().find((item) => item.id === testPlanId),
        applicationId,
        stageId,
        testPlanId,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (actions) => {
          const definition = toTestPlanDefinition(testPlan, actions);

          if ((definition.testSteps?.length ?? 0) === 0) {
            this.openingTestPlanId.set(null);
            this.testPlansError.set(
              'The selected test plan did not return any actions that can be opened in the modeller.',
            );
            return;
          }

          this.graph.queueDefinition(definition);
          this.openingTestPlanId.set(null);
          void this.router.navigate(['/test-plan-modeller']);
        },
        error: (error: Error) => {
          this.openingTestPlanId.set(null);
          this.testPlansError.set(error.message);
        },
      });
  }

  protected openPromoteTestPlanDialog(testPlan: TestPlan): void {
    const promoteHref = resourceLinkHref(testPlan, 'promote');

    if (!promoteHref) {
      this.testPlansError.set('The API did not advertise permission to promote this test plan.');
      return;
    }

    this.promoteTarget.set({
      label: testPlan.label ?? `Test plan ${testPlan.id ?? ''}`.trim(),
      href: promoteHref,
    });
    this.promoteTargetStageId.set(null);
    this.promoteReadyToConfirm.set(false);
    this.promoteError.set(null);
    this.promoteDialogOpen.set(true);
  }

  protected closePromoteDialog(): void {
    if (!this.promoteLoading()) {
      this.promoteDialogOpen.set(false);
      this.promoteTarget.set(null);
      this.promoteTargetStageId.set(null);
      this.promoteReadyToConfirm.set(false);
      this.promoteError.set(null);
    }
  }

  protected updatePromoteTargetStageId(value: string | number | null): void {
    const parsed = typeof value === 'number' ? value : Number(value);
    this.promoteTargetStageId.set(Number.isInteger(parsed) ? parsed : null);
    this.promoteReadyToConfirm.set(false);
  }

  protected submitPromoteDialog(): void {
    const target = this.promoteTarget();
    const targetStageId = this.promoteTargetStageId();
    const targetStage = this.promoteTargetStage();

    if (!target || targetStageId === null || !targetStage) {
      this.promoteError.set('Select a target stage.');
      return;
    }

    if (!this.promoteReadyToConfirm()) {
      this.promoteReadyToConfirm.set(true);
      this.promoteError.set(null);
      return;
    }

    this.promoteLoading.set(true);
    this.promoteError.set(null);

    this.data
      .promoteTestPlan(target.href, targetStageId)
      .pipe(
        finalize(() => this.promoteLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.closePromoteDialog();
          this.reloadTestPlans();
        },
        error: (error: Error) => this.promoteError.set(error.message),
      });
  }

  protected deleteTestPlan(testPlan: TestPlan): void {
    const deleteHref = resourceLinkHref(testPlan, 'delete');
    const testPlanId = testPlan.id;
    const testPlanLabel = testPlan.label ?? `Test plan ${testPlanId ?? ''}`.trim();

    if (!deleteHref) {
      this.testPlansError.set('The API did not advertise permission to delete this test plan.');
      return;
    }

    if (testPlanId === undefined) {
      this.testPlansError.set('The test plan cannot be deleted because it does not have an ID.');
      return;
    }

    if (this.deletingTestPlanId() !== null) {
      return;
    }

    if (
      !window.confirm(
        `Delete test plan "${testPlanLabel}"? This retires it from the selected stage.`,
      )
    ) {
      return;
    }

    this.deletingTestPlanId.set(testPlanId);
    this.testPlansError.set(null);

    this.data
      .deleteTestPlan(deleteHref)
      .pipe(
        finalize(() => this.deletingTestPlanId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.reloadTestPlans(),
        error: (error: Error) => this.testPlansError.set(error.message),
      });
  }

  protected openRestoreTestPlanDialog(testPlan: TestPlan): void {
    const restoreHref = resourceLinkHref(testPlan, 'restore');

    if (!restoreHref) {
      this.testPlansError.set('The API did not advertise permission to restore this test plan.');
      return;
    }

    this.restoreTarget.set({
      label: testPlan.label ?? `Test plan ${testPlan.id ?? ''}`.trim(),
      href: restoreHref,
    });
    this.restoreError.set(null);
    this.restoreDialogOpen.set(true);
  }

  protected closeRestoreDialog(): void {
    if (!this.restoreLoading()) {
      this.restoreDialogOpen.set(false);
      this.restoreTarget.set(null);
      this.restoreError.set(null);
    }
  }

  protected submitRestoreDialog(): void {
    const target = this.restoreTarget();

    if (!target) {
      return;
    }

    this.restoreLoading.set(true);
    this.restoreError.set(null);

    this.data
      .restoreTestPlan(target.href)
      .pipe(
        finalize(() => this.restoreLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.testPlansTab.set('active');
          this.closeRestoreDialog();
          this.reloadTestPlans();
        },
        error: (error: Error) => this.restoreError.set(error.message),
      });
  }

  private loadTestPlans(applicationId: number, stageId: number): void {
    if (this.testPlansLoading()) {
      return;
    }

    this.testPlansLoading.set(true);
    this.testPlansError.set(null);

    this.data
      .loadTestPlans(applicationId, stageId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (testPlans) => {
          this.testPlans.set(testPlans);
          this.normalizeTestPlansTab(testPlans);
          this.testPlansLoading.set(false);
        },
        error: (error: Error) => {
          this.testPlansLoading.set(false);
          this.testPlansError.set(error.message);
        },
      });
  }

  private normalizeTestPlansTab(testPlans: TestPlan[]): void {
    this.testPlansTab.set(normalizeResourceTab(this.testPlansTab(), testPlans));
  }

  private canOpenRunDialog(testPlan: TestPlan): boolean {
    return (
      testPlan.id !== undefined &&
      this.runningTestPlanId() === null &&
      hasResourceLink(testPlan, 'execute')
    );
  }

  private listenForTestExecution(
    executionId: string,
    label: string,
    eventsHref: string | undefined,
    applicationId: number,
    stageId: number,
  ): void {
    this.executionNotifications
      .listenForCompletion(executionId, label, eventsHref, { applicationId, stageId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.runningTestPlanId.set(null),
        error: (error: Error) => {
          this.startingTestRun.set(false);
          this.runningTestPlanId.set(null);
          this.runError.set(error.message);
          this.executionNotifications.showEventStreamFailure(error);
        },
      });
  }
}
