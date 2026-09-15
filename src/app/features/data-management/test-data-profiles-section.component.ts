import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { LucidePlus } from '@lucide/angular';
import { TuiButton, TuiDialog, TuiLoader } from '@taiga-ui/core';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { WorkspaceContextService } from '../../context/workspace-context.service';
import { linkHref, resourceLinkHref } from '../../core/hateoas-links';
import type {
  DatabaseDeletionResult,
  PagedTestDataSet,
  TestDataSet,
  TestDataSetDefinition,
} from '../../generated/hateoas/types.gen';
import {
  type ResourceTab,
  type TestDataDialogMode,
  type TestDataDraftEntry,
} from './data-management.models';
import { includeRetired } from './data-management-links';
import { hasRestorableRetiredResource, normalizeResourceTab } from './resource-tabs';
import { buildTestDataDefinition, toDraftTestDataEntry } from './test-data-form';
import { TestDataProfilesComponent } from './test-data-profiles.component';

type RestoreTarget = {
  label: string;
  href: string;
};

@Component({
  selector: 'app-test-data-profiles-section',
  imports: [
    FormsModule,
    LucidePlus,
    MatIconModule,
    TuiButton,
    TuiDialog,
    TuiLoader,
    TestDataProfilesComponent,
  ],
  templateUrl: './test-data-profiles-section.component.html',
  styleUrl: './data-management-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestDataProfilesSectionComponent {
  protected readonly context = inject(WorkspaceContextService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly testDataSets = signal<TestDataSet[]>([]);
  protected readonly testDataLoading = signal(false);
  protected readonly testDataError = signal<string | null>(null);
  protected readonly deletingTestDataId = signal<number | null>(null);
  protected readonly testDataTab = signal<ResourceTab>('active');
  protected readonly selectedTestDataSetId = signal<number | null>(null);
  protected readonly testDataCreateHref = signal<string | null>(null);

  protected readonly testDataDialogOpen = signal(false);
  protected readonly testDataDialogMode = signal<TestDataDialogMode>('create');
  protected readonly testDataUpdateHref = signal<string | null>(null);
  protected readonly testDataLabel = signal('');
  protected readonly testDataValues = signal<TestDataDraftEntry[]>([]);
  protected readonly testDataSaveLoading = signal(false);
  protected readonly testDataSaveError = signal<string | null>(null);
  private nextTestDataDraftId = 1;

  protected readonly restoreDialogOpen = signal(false);
  protected readonly restoreTarget = signal<RestoreTarget | null>(null);
  protected readonly restoreLoading = signal(false);
  protected readonly restoreError = signal<string | null>(null);

  protected readonly activeTestDataSets = computed(() =>
    this.testDataSets().filter((testDataSet) => testDataSet.retired !== true),
  );
  protected readonly retiredTestDataSets = computed(() =>
    this.testDataSets().filter((testDataSet) => testDataSet.retired === true),
  );
  protected readonly displayedTestDataSets = computed(() =>
    this.testDataTab() === 'retired' ? this.retiredTestDataSets() : this.activeTestDataSets(),
  );
  protected readonly canShowRetiredTestDataTab = computed(() =>
    hasRestorableRetiredResource(this.retiredTestDataSets()),
  );
  protected readonly selectedTestDataSet = computed(() => {
    const selectedId = this.selectedTestDataSetId();
    return selectedId === null
      ? null
      : (this.testDataSets().find((testDataSet) => testDataSet.id === selectedId) ?? null);
  });
  protected readonly selectedTestDataEntries = computed(
    () => this.selectedTestDataSet()?.values ?? [],
  );

  constructor() {
    this.loadTestData();
    this.loadTestDataCreateLink();
  }

  protected reloadTestData(): void {
    this.loadTestData();
    this.loadTestDataCreateLink();
  }

  protected selectTestDataTab(tab: string | number | undefined): void {
    const selectedTab = tab === 'retired' ? 'retired' : 'active';

    if (selectedTab === 'retired' && !this.canShowRetiredTestDataTab()) {
      return;
    }

    this.testDataTab.set(selectedTab);
  }

  protected selectTestDataSet(testDataSet: TestDataSet | TestDataSet[] | undefined): void {
    if (!testDataSet || Array.isArray(testDataSet)) {
      return;
    }

    const testDataSetId = testDataSet.id;

    if (testDataSetId === undefined) {
      this.testDataError.set('The selected test data profile does not have an ID.');
      return;
    }

    this.selectedTestDataSetId.set(testDataSetId);

    const selfHref = resourceLinkHref(testDataSet, 'self');

    if (!selfHref) {
      return;
    }

    this.context.fetchResource<TestDataSet>(includeRetired(selfHref)).subscribe({
      next: (details) => this.mergeTestDataSet(details),
      error: (error: Error) => this.testDataError.set(error.message),
    });
  }

  protected openCreateTestDataDialog(): void {
    if (!this.testDataCreateHref()) {
      this.testDataError.set('The API did not advertise permission to create test data profiles.');
      return;
    }

    this.testDataDialogMode.set('create');
    this.testDataUpdateHref.set(null);
    this.testDataLabel.set('');
    this.testDataValues.set([]);
    this.testDataSaveError.set(null);
    this.testDataDialogOpen.set(true);
  }

  protected openEditTestDataDialog(testDataSet: TestDataSet): void {
    const updateHref = resourceLinkHref(testDataSet, 'update');

    if (!updateHref) {
      this.testDataError.set(
        'The API did not advertise permission to update this test data profile.',
      );
      return;
    }

    this.testDataDialogMode.set('edit');
    this.testDataUpdateHref.set(updateHref);
    this.testDataLabel.set(testDataSet.label ?? '');
    this.testDataValues.set(
      (testDataSet.values ?? []).map((entry) =>
        toDraftTestDataEntry(entry, this.nextTestDataDraftId++),
      ),
    );
    this.testDataSaveError.set(null);
    this.testDataDialogOpen.set(true);
  }

  protected closeTestDataDialog(): void {
    if (!this.testDataSaveLoading()) {
      this.testDataDialogOpen.set(false);
      this.testDataUpdateHref.set(null);
      this.testDataSaveError.set(null);
    }
  }

  protected addTestDataValue(): void {
    this.testDataValues.set([
      ...this.testDataValues(),
      {
        draftId: this.nextTestDataDraftId++,
        key: '',
        value: '',
      },
    ]);
  }

  protected updateTestDataValue(draftId: number, field: 'key' | 'value', value: string): void {
    this.testDataValues.set(
      this.testDataValues().map((entry) =>
        entry.draftId === draftId ? { ...entry, [field]: value } : entry,
      ),
    );
  }

  protected removeTestDataValue(draftId: number): void {
    this.testDataValues.set(this.testDataValues().filter((entry) => entry.draftId !== draftId));
  }

  protected saveTestData(): void {
    const mode = this.testDataDialogMode();
    const href = mode === 'create' ? this.testDataCreateHref() : this.testDataUpdateHref();
    const definition = this.testDataDefinition();

    if (!href || !definition) {
      return;
    }

    this.testDataSaveLoading.set(true);
    this.testDataSaveError.set(null);

    this.context
      .putResource<TestDataSetDefinition, TestDataSet>(href, definition)
      .pipe(
        finalize(() => this.testDataSaveLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (savedTestData) => {
          this.testDataDialogOpen.set(false);
          this.testDataUpdateHref.set(null);
          if (savedTestData.id !== undefined) {
            this.selectedTestDataSetId.set(savedTestData.id);
          }
          this.reloadTestData();
        },
        error: (error: Error) => this.testDataSaveError.set(error.message),
      });
  }

  protected deleteTestData(testDataSet: TestDataSet): void {
    const deleteHref = resourceLinkHref(testDataSet, 'delete');
    const testDataSetId = testDataSet.id;
    const testDataLabel = testDataSet.label ?? `Test data profile ${testDataSetId ?? ''}`.trim();

    if (!deleteHref) {
      this.testDataError.set(
        'The API did not advertise permission to retire this test data profile.',
      );
      return;
    }

    if (testDataSetId === undefined) {
      this.testDataError.set(
        'The test data profile cannot be retired because it does not have an ID.',
      );
      return;
    }

    if (this.deletingTestDataId() !== null) {
      return;
    }

    if (!window.confirm(`Retire test data profile "${testDataLabel}"?`)) {
      return;
    }

    this.deletingTestDataId.set(testDataSetId);
    this.testDataError.set(null);

    this.context
      .deleteResource<DatabaseDeletionResult>(deleteHref)
      .pipe(
        finalize(() => this.deletingTestDataId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.reloadTestData(),
        error: (error: Error) => this.testDataError.set(error.message),
      });
  }

  protected openRestoreTestDataDialog(testDataSet: TestDataSet): void {
    const restoreHref = resourceLinkHref(testDataSet, 'restore');

    if (!restoreHref) {
      this.testDataError.set(
        'The API did not advertise permission to restore this test data profile.',
      );
      return;
    }

    this.restoreTarget.set({
      label: testDataSet.label ?? `Test data profile ${testDataSet.id ?? ''}`.trim(),
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

    this.context
      .postResource<null, DatabaseDeletionResult>(target.href, null)
      .pipe(
        finalize(() => this.restoreLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.testDataTab.set('active');
          this.closeRestoreDialog();
          this.reloadTestData();
        },
        error: (error: Error) => this.restoreError.set(error.message),
      });
  }

  protected testDataDialogHeader(): string {
    return this.testDataDialogMode() === 'edit'
      ? 'Edit test data profile'
      : 'Add test data profile';
  }

  protected testDataDialogSubmitLabel(): string {
    return this.testDataDialogMode() === 'edit' ? 'Save profile' : 'Create profile';
  }

  private loadTestData(): void {
    if (this.testDataLoading()) {
      return;
    }

    this.testDataLoading.set(true);
    this.testDataError.set(null);

    this.fetchTestData().subscribe({
      next: (testDataSets) => {
        this.testDataSets.set(testDataSets);
        this.normalizeTestDataTab(testDataSets);
        this.normalizeSelectedTestDataSet(testDataSets);
        this.testDataLoading.set(false);
      },
      error: (error: Error) => {
        this.testDataLoading.set(false);
        this.testDataError.set(error.message);
      },
    });
  }

  private loadTestDataCreateLink(): void {
    this.testDataCreateHref.set(null);
    this.context.getPage<PagedTestDataSet>('/api/test-data?includeRetired=true', 0).subscribe({
      next: (page) => this.testDataCreateHref.set(linkHref(page._links?.['create'])),
      error: () => this.testDataCreateHref.set(null),
    });
  }

  private fetchTestData() {
    return this.context
      .fetchPaged<TestDataSet, PagedTestDataSet>('/api/test-data?includeRetired=true')
      .pipe(
        switchMap((testDataSets) => {
          const requests = testDataSets.map((testDataSet) => {
            const selfHref = resourceLinkHref(testDataSet, 'self');

            if (!selfHref) {
              return of(testDataSet);
            }

            return this.context.fetchResource<TestDataSet>(includeRetired(selfHref)).pipe(
              map((details) => ({
                ...testDataSet,
                ...details,
              })),
              catchError(() => of(testDataSet)),
            );
          });

          return requests.length > 0 ? forkJoin(requests) : of([]);
        }),
      );
  }

  private normalizeTestDataTab(testDataSets: TestDataSet[]): void {
    this.testDataTab.set(normalizeResourceTab(this.testDataTab(), testDataSets));
  }

  private normalizeSelectedTestDataSet(testDataSets: TestDataSet[]): void {
    const selectedId = this.selectedTestDataSetId();

    if (selectedId !== null && testDataSets.some((testDataSet) => testDataSet.id === selectedId)) {
      return;
    }

    this.selectedTestDataSetId.set(
      testDataSets.find((testDataSet) => testDataSet.retired !== true)?.id ?? null,
    );
  }

  private testDataDefinition(): TestDataSetDefinition | null {
    const result = buildTestDataDefinition(this.testDataLabel(), this.testDataValues());

    if (result.error) {
      this.testDataSaveError.set(result.error);
    }

    return result.definition;
  }

  private mergeTestDataSet(testDataSet: TestDataSet): void {
    const testDataSetId = testDataSet.id;

    if (testDataSetId === undefined) {
      return;
    }

    this.testDataSets.set(
      this.testDataSets().map((existing) =>
        existing.id === testDataSetId ? { ...existing, ...testDataSet } : existing,
      ),
    );
  }
}
