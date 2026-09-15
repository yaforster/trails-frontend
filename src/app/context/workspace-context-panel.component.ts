import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, type Observable } from 'rxjs';
import {
  LucideArchiveRestore,
  LucideChevronDown,
  LucideLayers,
  LucideMonitorCog,
  LucidePlus,
  LucideTrash2,
} from '@lucide/angular';
import { TuiButton, TuiDialog, TuiLoader } from '@taiga-ui/core';
import { linkHref, resourceLinkHref } from '../core/hateoas-links';
import type {
  ApplicationDefinition,
  DatabaseDeletionResult,
  PagedApplication,
  PagedStage,
  PersistedApplication,
  PersistedStage,
  StageDefinition,
} from '../generated/hateoas/types.gen';
import { WorkspaceContextService } from './workspace-context.service';

type ContextDialogMode =
  | 'application-create'
  | 'stage-create'
  | 'application-retire'
  | 'stage-retire'
  | 'application-restore'
  | 'stage-restore';

@Component({
  selector: 'app-workspace-context-panel',
  imports: [
    FormsModule,
    LucideArchiveRestore,
    LucideChevronDown,
    LucideLayers,
    LucideMonitorCog,
    LucidePlus,
    LucideTrash2,
    TuiButton,
    TuiDialog,
    TuiLoader,
  ],
  templateUrl: './workspace-context-panel.component.html',
  styleUrl: './workspace-context-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceContextPanelComponent implements OnInit {
  protected readonly context = inject(WorkspaceContextService);
  protected readonly expanded = signal(true);
  protected readonly dialogMode = signal<ContextDialogMode | null>(null);
  protected readonly applicationLabel = signal('');
  protected readonly stageLabel = signal('');
  protected readonly stageUrl = signal('');
  protected readonly actionLoading = signal(false);
  protected readonly actionError = signal<string | null>(null);
  private readonly applicationCreateHref = signal<string | null>(null);
  private readonly stageCreateHref = signal<string | null>(null);

  protected readonly selectedApplicationRetired = computed(
    () => this.context.selectedApplication()?.retired === true,
  );
  protected readonly selectedStageRetired = computed(
    () => this.context.selectedStage()?.retired === true,
  );

  ngOnInit(): void {
    this.context.ensureApplications();
    this.loadApplicationCreateLink();
  }

  constructor() {
    effect(() => {
      const applicationId = this.context.selectedApplicationId();

      if (applicationId === null) {
        this.stageCreateHref.set(null);
        return;
      }

      untracked(() => this.loadStageCreateLink(applicationId));
    });
  }

  protected toggleExpanded(): void {
    this.expanded.update((expanded) => !expanded);
  }

  protected openDialog(mode: ContextDialogMode): void {
    this.actionError.set(null);
    this.dialogMode.set(mode);

    if (mode === 'application-create') {
      this.applicationLabel.set('');
    }

    if (mode === 'stage-create') {
      this.stageLabel.set('');
      this.stageUrl.set('');
    }
  }

  protected closeDialog(): void {
    if (!this.actionLoading()) {
      this.dialogMode.set(null);
      this.actionError.set(null);
    }
  }

  protected dialogHeader(): string {
    switch (this.dialogMode()) {
      case 'application-create':
        return 'Create application';
      case 'stage-create':
        return 'Create stage';
      case 'application-retire':
        return 'Retire application';
      case 'stage-retire':
        return 'Retire stage';
      case 'application-restore':
        return 'Restore application';
      case 'stage-restore':
        return 'Restore stage';
      default:
        return '';
    }
  }

  protected submitDialog(): void {
    switch (this.dialogMode()) {
      case 'application-create':
        this.createApplication();
        return;
      case 'stage-create':
        this.createStage();
        return;
      case 'application-retire':
        this.retireApplication();
        return;
      case 'stage-retire':
        this.retireStage();
        return;
      case 'application-restore':
        this.restoreApplication();
        return;
      case 'stage-restore':
        this.restoreStage();
        return;
    }
  }

  protected canCreateApplication(): boolean {
    return this.applicationCreateHref() !== null;
  }

  protected canCreateStage(): boolean {
    return (
      this.stageCreateHref() !== null &&
      this.context.selectedApplicationId() !== null &&
      !this.selectedApplicationRetired()
    );
  }

  protected canRetireApplication(): boolean {
    return resourceLinkHref(this.context.selectedApplication(), 'delete') !== null;
  }

  protected canRestoreApplication(): boolean {
    return resourceLinkHref(this.context.selectedApplication(), 'restore') !== null;
  }

  protected canRetireStage(): boolean {
    return resourceLinkHref(this.context.selectedStage(), 'delete') !== null;
  }

  protected canRestoreStage(): boolean {
    return resourceLinkHref(this.context.selectedStage(), 'restore') !== null;
  }

  protected applicationOptionLabel(
    application: { label?: string; retired?: boolean } | null | undefined,
  ): string {
    if (!application) {
      return 'Select application';
    }

    return `${application.label ?? 'Unnamed application'}${application.retired ? ' (retired)' : ''}`;
  }

  protected stageOptionLabel(
    stage: { label?: string; retired?: boolean } | null | undefined,
  ): string {
    if (!stage) {
      return 'Select stage';
    }

    return `${stage.label ?? 'Unnamed stage'}${stage.retired ? ' (retired)' : ''}`;
  }

  private createApplication(): void {
    const href = this.applicationCreateHref();
    const label = this.applicationLabel().trim();

    if (!href || !label) {
      this.actionError.set('Enter an application label.');
      return;
    }

    this.runAction(
      this.context.putResource<ApplicationDefinition, PersistedApplication>(href, { label }),
      () => {
        this.context.reloadApplications();
        this.loadApplicationCreateLink();
      },
    );
  }

  private createStage(): void {
    const href = this.stageCreateHref();
    const label = this.stageLabel().trim();
    const url = this.stageUrl().trim();

    if (!href || !label || !url) {
      this.actionError.set('Enter a stage label and URL.');
      return;
    }

    this.runAction(
      this.context.putResource<StageDefinition, PersistedStage>(href, { label, url }),
      () => this.context.reloadStages(),
    );
  }

  private retireApplication(): void {
    this.runSelectedDeletion(resourceLinkHref(this.context.selectedApplication(), 'delete'), () =>
      this.context.reloadApplications(),
    );
  }

  private restoreApplication(): void {
    this.runSelectedPost(resourceLinkHref(this.context.selectedApplication(), 'restore'), () =>
      this.context.reloadApplications(),
    );
  }

  private retireStage(): void {
    this.runSelectedDeletion(resourceLinkHref(this.context.selectedStage(), 'delete'), () =>
      this.context.reloadStages(),
    );
  }

  private restoreStage(): void {
    this.runSelectedPost(resourceLinkHref(this.context.selectedStage(), 'restore'), () =>
      this.context.reloadStages(),
    );
  }

  private runSelectedDeletion(href: string | null, afterSuccess: () => void): void {
    if (!href) {
      this.actionError.set('The API did not advertise this action.');
      return;
    }

    this.runAction(this.context.deleteResource<DatabaseDeletionResult>(href), afterSuccess);
  }

  private runSelectedPost(href: string | null, afterSuccess: () => void): void {
    if (!href) {
      this.actionError.set('The API did not advertise this action.');
      return;
    }

    this.runAction(
      this.context.postResource<null, DatabaseDeletionResult>(href, null),
      afterSuccess,
    );
  }

  private runAction(action: Observable<unknown>, afterSuccess: () => void): void {
    this.actionLoading.set(true);
    this.actionError.set(null);

    action.pipe(finalize(() => this.actionLoading.set(false))).subscribe({
      next: () => {
        this.dialogMode.set(null);
        afterSuccess();
      },
      error: (error: Error) => this.actionError.set(error.message),
    });
  }

  private loadApplicationCreateLink(): void {
    this.context.getPage<PagedApplication>('/api/applications?includeRetired=true', 0).subscribe({
      next: (page) => this.applicationCreateHref.set(linkHref(page._links?.['create'])),
      error: () => this.applicationCreateHref.set(null),
    });
  }

  private loadStageCreateLink(applicationId: number): void {
    this.context
      .getPage<PagedStage>(`/api/applications/${applicationId}/stages?includeRetired=true`, 0)
      .subscribe({
        next: (page) => this.stageCreateHref.set(linkHref(page._links?.['create'])),
        error: () => this.stageCreateHref.set(null),
      });
  }
}
