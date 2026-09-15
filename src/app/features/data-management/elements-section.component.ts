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
import { LucidePlus } from '@lucide/angular';
import { TuiButton, TuiDialog, TuiLoader } from '@taiga-ui/core';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { WorkspaceContextService } from '../../context/workspace-context.service';
import { CapabilitiesService } from '../../core/capabilities.service';
import { expandQueryTemplate, linkHref, resourceLinkHref } from '../../core/hateoas-links';
import type {
  Artifact,
  DatabaseDeletionResult,
  Element,
  ElementDefinition,
  ElementType,
  LocatorType,
  PagedElement,
  PersistedElement,
  Stage,
} from '../../generated/hateoas/types.gen';
import {
  elementTypes,
  locatorTypes,
  type ElementDialogMode,
  type ResourceTab,
} from './data-management.models';
import { includeRetired } from './data-management-links';
import { buildElementDefinition, toElementType, toLocatorType } from './element-form';
import { ElementsTableComponent } from './elements-table.component';
import { hasRestorableRetiredResource, normalizeResourceTab } from './resource-tabs';
import {
  formatBytes,
  isSupportedScreenshotType,
  screenshotAcceptTypes,
  screenshotFormatsFromCapability,
  supportedScreenshotFormatLabels,
  type ScreenshotFormat,
} from './screenshot-formats';

type PromoteTarget = {
  label: string;
  href: string;
};

type RestoreTarget = {
  label: string;
  href: string;
};

@Component({
  selector: 'app-elements-section',
  imports: [
    ElementsTableComponent,
    FormsModule,
    LucidePlus,
    MatIconModule,
    TuiButton,
    TuiDialog,
    TuiLoader,
  ],
  templateUrl: './elements-section.component.html',
  styleUrl: './data-management-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ElementsSectionComponent {
  protected readonly capabilities = inject(CapabilitiesService);
  protected readonly context = inject(WorkspaceContextService);
  private readonly destroyRef = inject(DestroyRef);
  private viewScreenshotRequestId = 0;

  protected readonly elements = signal<Element[]>([]);
  protected readonly elementsLoading = signal(false);
  protected readonly elementsError = signal<string | null>(null);
  protected readonly deletingElementId = signal<number | null>(null);
  protected readonly elementsTab = signal<ResourceTab>('active');
  protected readonly elementCreateHref = signal<string | null>(null);

  protected readonly activeElements = computed(() =>
    this.elements().filter((element) => element.retired !== true),
  );
  protected readonly retiredElements = computed(() =>
    this.elements().filter((element) => element.retired === true),
  );
  protected readonly displayedElements = computed(() =>
    this.elementsTab() === 'retired' ? this.retiredElements() : this.activeElements(),
  );
  protected readonly canShowRetiredElementsTab = computed(() =>
    hasRestorableRetiredResource(this.retiredElements()),
  );

  protected readonly elementDialogOpen = signal(false);
  protected readonly elementDialogMode = signal<ElementDialogMode>('create');
  protected readonly elementUpdateHref = signal<string | null>(null);
  protected readonly elementLabel = signal('');
  protected readonly elementType = signal<ElementType>('BUTTON');
  protected readonly locatorType = signal<LocatorType>('CSS');
  protected readonly locatorString = signal('');
  protected readonly screenshotFile = signal<File | null>(null);
  protected readonly elementCreateLoading = signal(false);
  protected readonly elementCreateError = signal<string | null>(null);
  protected readonly elementTypes = elementTypes;
  protected readonly locatorTypes = locatorTypes;

  protected readonly viewedElement = signal<Element | null>(null);
  protected readonly elementViewDialogOpen = signal(false);
  protected readonly viewScreenshotUrl = signal<string | null>(null);
  protected readonly viewScreenshotLoading = signal(false);
  protected readonly viewScreenshotError = signal<string | null>(null);
  protected readonly screenshotOverlayOpen = signal(false);

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
    this.capabilities.ensureCapabilities();

    effect(() => {
      const applicationId = this.context.selectedApplicationId();
      const stageId = this.context.selectedStageId();

      if (applicationId !== null && stageId !== null) {
        untracked(() => {
          this.elementsTab.set('active');
          this.loadElements(applicationId, stageId);
          this.loadElementCreateLink(applicationId, stageId);
        });
      } else {
        this.elements.set([]);
        this.elementCreateHref.set(null);
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
    this.loadElementCreateLink(applicationId, stageId);
  }

  protected selectElementsTab(tab: string | number | undefined): void {
    const selectedTab = tab === 'retired' ? 'retired' : 'active';

    if (selectedTab === 'retired' && !this.canShowRetiredElementsTab()) {
      return;
    }

    this.elementsTab.set(selectedTab);
  }

  protected openCreateElementDialog(): void {
    if (!this.elementCreateHref()) {
      this.elementsError.set(
        'The API did not advertise permission to create elements for this stage.',
      );
      return;
    }

    this.elementDialogMode.set('create');
    this.elementUpdateHref.set(null);
    this.elementLabel.set('');
    this.elementType.set('BUTTON');
    this.locatorType.set('CSS');
    this.locatorString.set('');
    this.screenshotFile.set(null);
    this.elementCreateError.set(null);
    this.elementDialogOpen.set(true);
  }

  protected openEditElementDialog(element: Element): void {
    const updateHref = resourceLinkHref(element, 'update');

    if (!updateHref) {
      this.elementsError.set('The API did not advertise permission to update this element.');
      return;
    }

    this.elementDialogMode.set('edit');
    this.elementUpdateHref.set(updateHref);
    this.elementLabel.set(element.label ?? '');
    this.elementType.set(toElementType(element.type));
    this.locatorType.set(toLocatorType(element.locatorType));
    this.locatorString.set(element.locatorString ?? '');
    this.screenshotFile.set(null);
    this.elementCreateError.set(null);
    this.elementDialogOpen.set(true);
  }

  protected openViewElementDialog(element: Element): void {
    const requestId = ++this.viewScreenshotRequestId;
    this.clearViewScreenshot();
    this.viewedElement.set(element);
    this.elementViewDialogOpen.set(true);

    const screenshotHref = resourceLinkHref(element, 'screenshot');

    if (!screenshotHref) {
      return;
    }

    this.viewScreenshotLoading.set(true);
    this.context
      .fetchBlob(screenshotHref)
      .pipe(
        finalize(() => {
          if (requestId === this.viewScreenshotRequestId) {
            this.viewScreenshotLoading.set(false);
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);

          if (requestId !== this.viewScreenshotRequestId || !this.elementViewDialogOpen()) {
            URL.revokeObjectURL(url);
            return;
          }

          this.viewScreenshotUrl.set(url);
        },
        error: (error: Error) => {
          if (requestId === this.viewScreenshotRequestId) {
            this.viewScreenshotError.set(error.message);
          }
        },
      });
  }

  protected closeViewElementDialog(): void {
    this.viewScreenshotRequestId++;
    this.elementViewDialogOpen.set(false);
    this.screenshotOverlayOpen.set(false);
    this.viewedElement.set(null);
    this.clearViewScreenshot();
  }

  protected openScreenshotOverlay(): void {
    if (this.viewScreenshotUrl()) {
      this.screenshotOverlayOpen.set(true);
    }
  }

  protected closeScreenshotOverlay(): void {
    this.screenshotOverlayOpen.set(false);
  }

  protected closeCreateElementDialog(): void {
    if (!this.elementCreateLoading()) {
      this.elementDialogOpen.set(false);
      this.elementCreateError.set(null);
      this.elementUpdateHref.set(null);
    }
  }

  protected onScreenshotSelected(event: Event): void {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const file = input?.files?.[0] ?? null;
    this.screenshotFile.set(file);
    this.elementCreateError.set(null);
  }

  protected saveElement(): void {
    const mode = this.elementDialogMode();
    const href = mode === 'create' ? this.elementCreateHref() : this.elementUpdateHref();
    const definition = this.elementDefinition();

    if (!href || !definition) {
      return;
    }

    this.elementCreateLoading.set(true);
    this.elementCreateError.set(null);

    this.validateScreenshot(this.screenshotFile())
      .then(() => {
        this.context
          .putResource<ElementDefinition, PersistedElement | Element>(href, definition)
          .pipe(
            switchMap((savedElement) => {
              const screenshot = this.screenshotFile();
              const uploadHref = resourceLinkHref(savedElement, 'uploadScreenshot');

              if (!screenshot || !uploadHref) {
                return of(savedElement);
              }

              const formData = new FormData();
              formData.append('file', screenshot);
              return this.context.putFormData<Artifact>(uploadHref, formData);
            }),
            finalize(() => this.elementCreateLoading.set(false)),
            takeUntilDestroyed(this.destroyRef),
          )
          .subscribe({
            next: () => {
              this.elementDialogOpen.set(false);
              this.elementUpdateHref.set(null);
              this.reloadElements();
            },
            error: (error: Error) => this.elementCreateError.set(error.message),
          });
      })
      .catch((error: Error) => {
        this.elementCreateLoading.set(false);
        this.elementCreateError.set(error.message);
      });
  }

  protected deleteElement(element: Element): void {
    const deleteHref = resourceLinkHref(element, 'delete');
    const elementId = element.id;
    const elementLabel = element.label ?? `Element ${elementId ?? ''}`.trim();

    if (!deleteHref) {
      this.elementsError.set('The API did not advertise permission to delete this element.');
      return;
    }

    if (elementId === undefined) {
      this.elementsError.set('The element cannot be deleted because it does not have an ID.');
      return;
    }

    if (this.deletingElementId() !== null) {
      return;
    }

    if (
      !window.confirm(`Delete element "${elementLabel}"? This retires it from the selected stage.`)
    ) {
      return;
    }

    this.deletingElementId.set(elementId);
    this.elementsError.set(null);

    this.context
      .deleteResource<DatabaseDeletionResult>(deleteHref)
      .pipe(
        finalize(() => this.deletingElementId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.reloadElements(),
        error: (error: Error) => this.elementsError.set(error.message),
      });
  }

  protected openRestoreElementDialog(element: Element): void {
    const restoreHref = resourceLinkHref(element, 'restore');

    if (!restoreHref) {
      this.elementsError.set('The API did not advertise permission to restore this element.');
      return;
    }

    this.restoreTarget.set({
      label: element.label ?? `Element ${element.id ?? ''}`.trim(),
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
          this.elementsTab.set('active');
          this.closeRestoreDialog();
          this.reloadElements();
        },
        error: (error: Error) => this.restoreError.set(error.message),
      });
  }

  protected openPromoteElementDialog(element: Element): void {
    const promoteHref = resourceLinkHref(element, 'promote');

    if (!promoteHref) {
      this.elementsError.set('The API did not advertise permission to promote this element.');
      return;
    }

    this.promoteTarget.set({
      label: element.label ?? `Element ${element.id ?? ''}`.trim(),
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

    const href = expandQueryTemplate(target.href, { targetStageId });
    this.promoteLoading.set(true);
    this.promoteError.set(null);

    this.context
      .postResource<null, Element>(href, null)
      .pipe(
        finalize(() => this.promoteLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.closePromoteDialog();
          this.reloadElements();
        },
        error: (error: Error) => this.promoteError.set(error.message),
      });
  }

  protected elementDialogHeader(): string {
    return this.elementDialogMode() === 'edit' ? 'Edit element' : 'Add element';
  }

  protected elementDialogSubmitLabel(): string {
    return this.elementDialogMode() === 'edit' ? 'Save element' : 'Create element';
  }

  protected viewedElementLabel(): string {
    return this.viewedElement()?.label ?? '';
  }

  protected viewedElementType(): string {
    return this.viewedElement()?.type ?? '';
  }

  protected viewedElementLocatorType(): string {
    return this.viewedElement()?.locatorType ?? '';
  }

  protected viewedElementLocatorString(): string {
    return this.viewedElement()?.locatorString ?? '';
  }

  protected viewedElementId(): string {
    const id = this.viewedElement()?.id;
    return id === undefined ? '' : String(id);
  }

  protected screenshotAcceptTypes(): string[] {
    return screenshotAcceptTypes(this.supportedScreenshotFormats());
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
        this.normalizeElementsTab(elements);
        this.elementsLoading.set(false);
      },
      error: (error: Error) => {
        this.elementsLoading.set(false);
        this.elementsError.set(error.message);
      },
    });
  }

  private loadElementCreateLink(applicationId: number, stageId: number): void {
    const elementsHref =
      resourceLinkHref(this.context.selectedStage(), 'elements') ??
      `/api/applications/${applicationId}/stages/${stageId}/elements?includeRetired=true`;

    this.elementCreateHref.set(null);
    this.context.getPage<PagedElement>(elementsHref, 0).subscribe({
      next: (page) => this.elementCreateHref.set(linkHref(page._links?.['create'])),
      error: () => this.elementCreateHref.set(null),
    });
  }

  private fetchHydratedElements(applicationId: number, stageId: number) {
    const elementsHref = resourceLinkHref(this.context.selectedStage(), 'elements');

    return this.context
      .fetchPaged<
        Element,
        PagedElement
      >(includeRetired(elementsHref ?? `/api/applications/${applicationId}/stages/${stageId}/elements`))
      .pipe(
        switchMap((elements) => {
          const requests = elements.map((element) => {
            if (element.id === undefined || element.retired === true) {
              return of(element);
            }

            const selfHref =
              resourceLinkHref(element, 'self') ??
              `/api/applications/${applicationId}/stages/${stageId}/elements/${element.id}`;

            return this.context.fetchResource<Element>(includeRetired(selfHref)).pipe(
              map((details) => ({
                ...element,
                ...details,
              })),
              catchError(() => of(element)),
            );
          });

          return requests.length > 0 ? forkJoin(requests) : of([]);
        }),
      );
  }

  private normalizeElementsTab(elements: Element[]): void {
    this.elementsTab.set(normalizeResourceTab(this.elementsTab(), elements));
  }

  private elementDefinition(): ElementDefinition | null {
    const result = buildElementDefinition(
      this.elementLabel(),
      this.locatorString(),
      this.elementType(),
      this.locatorType(),
    );

    if (result.error) {
      this.elementCreateError.set(result.error);
    }

    return result.definition;
  }

  private async validateScreenshot(file: File | null): Promise<void> {
    if (!file) {
      return;
    }

    if (!this.capabilities.loaded()) {
      throw new Error(
        'Screenshot upload rules are still loading. Try again once service capabilities are available.',
      );
    }

    const maxSize = this.capabilities.numberValue('USER_IMAGE_MAX_SIZE_BYTES');
    const maxWidth = this.capabilities.numberValue('USER_IMAGE_MAX_WIDTH');
    const maxHeight = this.capabilities.numberValue('USER_IMAGE_MAX_HEIGHT');
    const supportedFormats = this.supportedScreenshotFormats();

    if (maxSize !== null && file.size > maxSize) {
      throw new Error(`Screenshot file size must not exceed ${formatBytes(maxSize)}.`);
    }

    if (supportedFormats.length === 0) {
      throw new Error('The service did not provide supported screenshot file types.');
    }

    if (!isSupportedScreenshotType(file, supportedFormats)) {
      throw new Error(
        `Screenshot type must be one of: ${supportedScreenshotFormatLabels(supportedFormats)}.`,
      );
    }

    const dimensions = await this.imageDimensions(file);

    if (maxWidth !== null && dimensions.width > maxWidth) {
      throw new Error(`Screenshot width must not exceed ${maxWidth}px.`);
    }

    if (maxHeight !== null && dimensions.height > maxHeight) {
      throw new Error(`Screenshot height must not exceed ${maxHeight}px.`);
    }
  }

  private supportedScreenshotFormats(): ScreenshotFormat[] {
    return screenshotFormatsFromCapability(this.capabilities.value('SUPPORTED_IMAGE_FORMATS'));
  }

  private imageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('The selected screenshot could not be read as an image.'));
      };

      image.src = url;
    });
  }

  private clearViewScreenshot(): void {
    const url = this.viewScreenshotUrl();

    if (url) {
      URL.revokeObjectURL(url);
    }

    this.viewScreenshotUrl.set(null);
    this.viewScreenshotLoading.set(false);
    this.viewScreenshotError.set(null);
  }
}
