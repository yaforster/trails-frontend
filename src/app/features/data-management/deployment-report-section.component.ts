import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostBinding,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiLoader } from '@taiga-ui/core';
import { TuiMessage } from '@taiga-ui/kit';
import { finalize } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { WorkspaceContextService } from '../../context/workspace-context.service';
import type { Deployment, DeploymentDefinition } from '../../core/deployment-types';
import { toIsoDateTime, toLocalDateTimeInputValue } from './date-time-input';

@Component({
  selector: 'app-deployment-report-section',
  imports: [FormsModule, TuiButton, TuiLoader, TuiMessage],
  templateUrl: './deployment-report-section.component.html',
  styleUrl: './data-management-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeploymentReportSectionComponent {
  protected readonly auth = inject(AuthService);
  protected readonly context = inject(WorkspaceContextService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly activeApplications = computed(() =>
    this.context.applications().filter((application) => application.retired !== true),
  );
  protected readonly activeStages = computed(() =>
    this.context.stages().filter((stage) => stage.retired !== true),
  );
  protected readonly canReportDeployments = computed(() => this.auth.hasRole('admin'));
  protected readonly deploymentVersion = signal('');
  protected readonly deploymentDeployedAt = signal(toLocalDateTimeInputValue(new Date()));
  protected readonly deploymentLoading = signal(false);
  protected readonly deploymentError = signal<string | null>(null);
  protected readonly deploymentConfirmation = signal<string | null>(null);
  protected readonly canSubmitDeployment = computed(
    () =>
      this.canReportDeployments() &&
      this.context.selectedApplicationId() !== null &&
      this.context.selectedStageId() !== null &&
      this.deploymentVersion().trim().length > 0 &&
      this.deploymentDeployedAt().trim().length > 0 &&
      !this.deploymentLoading(),
  );

  @HostBinding('style.display')
  protected get hostDisplay(): 'block' | 'none' {
    return this.canReportDeployments() ? 'block' : 'none';
  }

  protected selectDeploymentApplication(applicationId: number | null): void {
    this.context.selectApplication(applicationId);
    this.deploymentError.set(null);
    this.deploymentConfirmation.set(null);
  }

  protected selectDeploymentStage(stageId: number | null): void {
    this.context.selectStage(stageId);
    this.deploymentError.set(null);
    this.deploymentConfirmation.set(null);
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

  protected reportDeployment(): void {
    const applicationId = this.context.selectedApplicationId();
    const stageId = this.context.selectedStageId();
    const version = this.deploymentVersion().trim();
    const deployedAt = toIsoDateTime(this.deploymentDeployedAt());

    this.deploymentError.set(null);
    this.deploymentConfirmation.set(null);

    if (!this.canReportDeployments()) {
      this.deploymentError.set('Only administrators can report deployments from this page.');
      return;
    }

    if (applicationId === null || stageId === null) {
      this.deploymentError.set('Select an application and stage.');
      return;
    }

    if (!version) {
      this.deploymentError.set('Enter the deployed version.');
      return;
    }

    if (!deployedAt) {
      this.deploymentError.set('Enter a valid deployment timestamp.');
      return;
    }

    this.deploymentLoading.set(true);

    this.context
      .putResource<DeploymentDefinition, Deployment>(
        `/api/applications/${applicationId}/stages/${stageId}/deployments`,
        { version, deployedAt },
      )
      .pipe(
        finalize(() => this.deploymentLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (deployment) => {
          const deployedVersion = deployment.version ?? version;
          this.deploymentConfirmation.set(`Deployment ${deployedVersion} was reported.`);
        },
        error: (error: Error) => this.deploymentError.set(error.message),
      });
  }
}
