import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { WorkspaceContextService } from '../../context/workspace-context.service';
import { resourceLinkHref } from '../../core/hateoas-links';
import type {
  Element,
  PagedElement,
  PagedTestDataSet,
  PagedTestPlans,
  PersistedTestPlan,
  TestDataSet,
  TestPlanDefinition,
} from '../../generated/hateoas/types.gen';
import {
  TestPlanModellerGraphService,
  type ElementPaletteItem,
} from './test-plan-modeller-graph.service';
import { CreateTestPlanDialogComponent } from './create-test-plan-dialog.component';
import { TestPlanDefinitionPreviewDialogComponent } from './test-plan-definition-preview-dialog.component';
import { TestPlanModellerCanvasComponent } from './test-plan-modeller-canvas.component';
import { utilityPaletteItems } from './test-plan-modeller-palette';
import { TestPlanModellerPaletteSidebarComponent } from './test-plan-modeller-palette-sidebar.component';

@Component({
  selector: 'app-test-plan-modeller-page',
  imports: [
    CreateTestPlanDialogComponent,
    TestPlanModellerCanvasComponent,
    TestPlanDefinitionPreviewDialogComponent,
    TestPlanModellerPaletteSidebarComponent,
  ],
  templateUrl: './test-plan-modeller-page.component.html',
  styleUrl: './test-plan-modeller-page.component.css',
  host: {
    '(document:fullscreenchange)': 'onFullscreenChange()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestPlanModellerPageComponent {
  private readonly document = inject<Document>(DOCUMENT);
  protected readonly auth = inject(AuthService);
  protected readonly context = inject(WorkspaceContextService);
  protected readonly graph = inject(TestPlanModellerGraphService);
  protected readonly elements = signal<Element[]>([]);
  protected readonly elementsLoading = signal(false);
  protected readonly elementsError = signal<string | null>(null);
  protected readonly testDataSets = signal<TestDataSet[]>([]);
  protected readonly testDataLoading = signal(false);
  protected readonly testDataError = signal<string | null>(null);
  protected readonly createTestPlanLoading = signal(false);
  protected readonly createTestPlanMessage = signal<string | null>(null);
  protected readonly createTestPlanError = signal<string | null>(null);
  private readonly createTestPlanHref = signal<string | null>(null);
  protected readonly createTestPlanDialogOpen = signal(false);
  protected readonly createTestPlanName = signal('');
  protected readonly definitionPreviewOpen = signal(false);
  protected readonly definitionPreviewJson = signal('');
  protected readonly definitionPreviewImportError = signal<string | null>(null);
  protected readonly modellerDark = signal(false);
  protected readonly modellerFullscreen = signal(false);
  private readonly modellerShell = viewChild.required<ElementRef<HTMLElement>>('modellerShell');
  private loadedApplicationId: number | null = null;
  private loadedStageId: number | null = null;

  protected readonly utilityPaletteItems = computed<ElementPaletteItem[]>(() => [
    ...utilityPaletteItems,
  ]);

  protected readonly elementPaletteItems = computed<ElementPaletteItem[]>(() =>
    this.elements()
      .filter((element) => !element.retired)
      .map((element) => ({
        elementId: element.id ?? null,
        label: element.label ?? 'Unnamed element',
        locatorString: element.locatorString ?? '',
        locatorType: element.locatorType ?? '-',
        type: element.type ?? '-',
      })),
  );

  protected readonly definitionPreviewFileName = computed(
    () =>
      `${
        this.graph
          .currentPlanLabel()
          .trim()
          .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_') || 'test-plan-definition'
      }.json`,
  );

  constructor() {
    this.loadTestData();

    effect(() => {
      const applicationId = this.context.selectedApplicationId();
      const stageId = this.context.selectedStageId();

      if (applicationId === this.loadedApplicationId && stageId === this.loadedStageId) {
        return;
      }

      this.loadedApplicationId = applicationId;
      this.loadedStageId = stageId;
      this.graph.reset();

      if (applicationId !== null && stageId !== null) {
        untracked(() => {
          this.loadElements(applicationId, stageId);
          this.loadCreateTestPlanLink(applicationId, stageId);
        });
      } else {
        this.elements.set([]);
        this.createTestPlanHref.set(null);
      }
    });
  }

  protected reloadElements(): void {
    const applicationId = this.context.selectedApplicationId();
    const stageId = this.context.selectedStageId();

    if (applicationId === null || stageId === null) {
      return;
    }

    this.loadElements(applicationId, stageId);
  }

  protected openDefinitionPreview(): void {
    this.definitionPreviewJson.set(JSON.stringify(this.graph.testPlanDefinition(), null, 2));
    this.definitionPreviewImportError.set(null);
    this.definitionPreviewOpen.set(true);
  }

  protected closeDefinitionPreview(): void {
    this.definitionPreviewOpen.set(false);
  }

  protected clearDefinitionPreviewImportError(): void {
    this.definitionPreviewImportError.set(null);
  }

  protected importDefinitionJson(json: string): void {
    try {
      const parsed: unknown = JSON.parse(json);

      if (!isTestPlanDefinition(parsed)) {
        throw new Error('JSON must contain a valid TestPlanDefinitionDTO structure.');
      }

      this.graph.importDefinition(parsed, this.elements());
      this.definitionPreviewJson.set(JSON.stringify(this.graph.testPlanDefinition(), null, 2));
      this.definitionPreviewImportError.set(null);
    } catch (error: unknown) {
      this.definitionPreviewImportError.set(
        error instanceof Error ? error.message : 'Failed to import TestPlanDefinitionDTO JSON.',
      );
    }
  }

  protected toggleModellerTheme(): void {
    this.modellerDark.update((dark: boolean) => !dark);
  }

  protected toggleFullscreen(): void {
    const shell = this.modellerShell().nativeElement;

    if (this.document.fullscreenElement === shell) {
      void this.document.exitFullscreen().catch(() => undefined);
      return;
    }

    void shell.requestFullscreen().catch(() => undefined);
  }

  protected onFullscreenChange(): void {
    this.modellerFullscreen.set(
      this.document.fullscreenElement === this.modellerShell().nativeElement,
    );
  }

  protected openCreateTestPlanDialog(event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();

    const applicationId = this.context.selectedApplicationId();
    const stageId = this.context.selectedStageId();
    const token = this.auth.accessToken();

    if (this.createTestPlanLoading() || this.createTestPlanDialogOpen()) {
      return;
    }

    if (applicationId === null || stageId === null) {
      this.createTestPlanMessage.set(null);
      this.createTestPlanError.set('Select an application and stage before creating a test plan.');
      return;
    }

    if (!token) {
      this.createTestPlanMessage.set(null);
      this.createTestPlanError.set('A valid token is required to create a test plan.');
      return;
    }

    const validationError = this.graph.testPlanDefinitionValidationError();
    if (validationError) {
      this.createTestPlanMessage.set(null);
      this.createTestPlanError.set(validationError);
      return;
    }

    if (!this.createTestPlanHref()) {
      this.createTestPlanMessage.set(null);
      this.createTestPlanError.set(
        'The API did not advertise permission to create a test plan for this stage.',
      );
      return;
    }

    const currentLabel = this.graph.currentPlanLabel();
    this.createTestPlanName.set(currentLabel === 'Modelled test plan' ? '' : currentLabel);
    this.createTestPlanMessage.set(null);
    this.createTestPlanError.set(null);
    this.createTestPlanDialogOpen.set(true);
  }

  protected closeCreateTestPlanDialog(): void {
    if (this.createTestPlanLoading()) {
      return;
    }

    this.createTestPlanDialogOpen.set(false);
  }

  protected createTestPlan(): void {
    const applicationId = this.context.selectedApplicationId();
    const stageId = this.context.selectedStageId();
    const token = this.auth.accessToken();
    const label = this.createTestPlanName().trim();

    if (this.createTestPlanLoading()) {
      return;
    }

    if (applicationId === null || stageId === null) {
      this.createTestPlanMessage.set(null);
      this.createTestPlanError.set('Select an application and stage before creating a test plan.');
      return;
    }

    if (!token) {
      this.createTestPlanMessage.set(null);
      this.createTestPlanError.set('A valid token is required to create a test plan.');
      return;
    }

    if (!label) {
      this.createTestPlanMessage.set(null);
      this.createTestPlanError.set('Enter a test plan name before creating it.');
      return;
    }

    const validationError = this.graph.testPlanDefinitionValidationError();
    if (validationError) {
      this.createTestPlanMessage.set(null);
      this.createTestPlanError.set(validationError);
      return;
    }

    let definition: TestPlanDefinition;

    try {
      this.graph.updatePlanLabel(label);
      definition = this.graph.testPlanDefinition();
    } catch (error: unknown) {
      this.createTestPlanMessage.set(null);
      this.createTestPlanError.set(
        error instanceof Error ? error.message : 'Failed to build test plan definition.',
      );
      return;
    }

    this.createTestPlanLoading.set(true);
    this.createTestPlanMessage.set(null);
    this.createTestPlanError.set(null);

    const createHref = this.createTestPlanHref();

    if (!createHref) {
      this.createTestPlanMessage.set(null);
      this.createTestPlanError.set(
        'The API did not advertise permission to create a test plan for this stage.',
      );
      return;
    }

    this.context
      .putResource<TestPlanDefinition, PersistedTestPlan>(createHref, definition)
      .pipe(finalize(() => this.createTestPlanLoading.set(false)))
      .subscribe({
        next: () => {
          this.createTestPlanDialogOpen.set(false);
          this.createTestPlanMessage.set(`Test plan "${label}" created.`);
        },
        error: (error: unknown) => {
          this.createTestPlanError.set(this.toCreateTestPlanError(error));
        },
      });
  }

  private loadElements(applicationId: number, stageId: number): void {
    if (this.elementsLoading()) {
      return;
    }

    this.elementsLoading.set(true);
    this.elementsError.set(null);

    this.fetchHydratedElements(applicationId, stageId).subscribe({
      next: (elements) => {
        this.elements.set(elements);
        this.graph.importQueuedDefinition(elements);
        this.elementsLoading.set(false);
      },
      error: (error: Error) => {
        this.elementsLoading.set(false);
        this.elementsError.set(error.message);
      },
    });
  }

  private loadTestData(): void {
    if (this.testDataLoading()) {
      return;
    }

    this.testDataLoading.set(true);
    this.testDataError.set(null);

    this.context
      .fetchPaged<TestDataSet, PagedTestDataSet>('/api/test-data')
      .pipe(
        switchMap((testDataSets) => {
          const requests = testDataSets.map((testDataSet) => {
            const selfHref = resourceLinkHref(testDataSet, 'self');

            if (!selfHref) {
              return of(testDataSet);
            }

            return this.context.fetchResource<TestDataSet>(selfHref).pipe(
              map((details) => ({
                ...testDataSet,
                ...details,
              })),
            );
          });

          return requests.length > 0 ? forkJoin(requests) : of([]);
        }),
        finalize(() => this.testDataLoading.set(false)),
      )
      .subscribe({
        next: (testDataSets) =>
          this.testDataSets.set(testDataSets.filter((testDataSet) => testDataSet.retired !== true)),
        error: (error: Error) => this.testDataError.set(error.message),
      });
  }

  private fetchHydratedElements(applicationId: number, stageId: number) {
    const elementsHref = resourceLinkHref(this.context.selectedStage(), 'elements');

    return this.context
      .fetchPaged<
        Element,
        PagedElement
      >(elementsHref ?? `/api/applications/${applicationId}/stages/${stageId}/elements`)
      .pipe(
        switchMap((elements) => {
          const requests = elements.map((element) => {
            if (element.id === undefined) {
              return of(element);
            }

            return this.context
              .fetchResource<Element>(
                resourceLinkHref(element, 'self') ??
                  `/api/applications/${applicationId}/stages/${stageId}/elements/${element.id}`,
              )
              .pipe(
                map((details) => ({
                  ...element,
                  ...details,
                })),
              );
          });

          return requests.length > 0 ? forkJoin(requests) : of([]);
        }),
      );
  }

  private loadCreateTestPlanLink(applicationId: number, stageId: number): void {
    const testPlansHref =
      resourceLinkHref(this.context.selectedStage(), 'testPlans') ??
      `/api/applications/${applicationId}/stages/${stageId}/testPlans`;

    this.createTestPlanHref.set(null);
    this.context.getPage<PagedTestPlans>(testPlansHref, 0).subscribe({
      next: (page) => this.createTestPlanHref.set(resourceLinkHref(page, 'create')),
      error: () => this.createTestPlanHref.set(null),
    });
  }

  private toCreateTestPlanError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error?.message === 'string') {
        return error.error.message;
      }

      if (typeof error.error === 'string' && error.error.trim()) {
        return error.error;
      }

      return error.message || 'Failed to create test plan.';
    }

    return 'Failed to create test plan.';
  }
}

function isTestPlanDefinition(value: unknown): value is TestPlanDefinition {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isOptionalArray(value['testSteps'], isActionDefinition) &&
    isOptionalArray(value['groups'], isTestPlanGroup)
  );
}

function isActionDefinition(value: unknown): boolean {
  if (!isRecord(value) || typeof value['referenceID'] !== 'number' || !isRecord(value['details'])) {
    return false;
  }

  return (
    typeof value['details']['detailsType'] === 'string' &&
    isOptionalArray(
      value['nextActions'],
      (nextAction: unknown): boolean => typeof nextAction === 'number',
    ) &&
    (value['position'] === undefined || isPosition(value['position']))
  );
}

function isTestPlanGroup(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['xCoordinate'] === 'number' &&
    typeof value['yCoordinate'] === 'number' &&
    typeof value['widthPixels'] === 'number' &&
    typeof value['heightPixels'] === 'number' &&
    isOptionalArray(
      value['actionReferenceIds'],
      (referenceId: unknown): boolean => typeof referenceId === 'number',
    )
  );
}

function isPosition(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['xCoordinate'] === 'number' &&
    typeof value['yCoordinate'] === 'number'
  );
}

function isOptionalArray(value: unknown, itemValidator: (item: unknown) => boolean): boolean {
  return value === undefined || (Array.isArray(value) && value.every(itemValidator));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
