import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, type Params } from '@angular/router';
import { TuiSegmented } from '@taiga-ui/kit';
import { WorkspaceContextService } from '../../context/workspace-context.service';
import { DeploymentReportSectionComponent } from './deployment-report-section.component';
import { ElementsSectionComponent } from './elements-section.component';
import { TestDataProfilesSectionComponent } from './test-data-profiles-section.component';
import { TestPlansSectionComponent } from './test-plans-section.component';

type DataManagementSection = 'test-plans' | 'elements' | 'test-data' | 'deployments';

interface DataManagementSectionOption {
  readonly id: DataManagementSection;
  readonly label: string;
}

const dataManagementSections: readonly DataManagementSectionOption[] = [
  { id: 'test-plans', label: 'Test plans' },
  { id: 'elements', label: 'Elements' },
  { id: 'test-data', label: 'Test data' },
  { id: 'deployments', label: 'Deployments' },
];

@Component({
  selector: 'app-data-management-page',
  imports: [
    DeploymentReportSectionComponent,
    ElementsSectionComponent,
    TestDataProfilesSectionComponent,
    TestPlansSectionComponent,
    TuiSegmented,
  ],
  templateUrl: './data-management-page.component.html',
  styleUrl: './data-management-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataManagementPageComponent {
  private readonly context = inject(WorkspaceContextService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly selectedSection = signal<DataManagementSection>('test-plans');

  protected readonly sections = dataManagementSections;
  protected readonly selectedSectionIndex = computed(() =>
    dataManagementSections.findIndex((section) => section.id === this.selectedSection()),
  );

  constructor() {
    this.context.ensureApplications();
    this.route.queryParams.pipe(takeUntilDestroyed()).subscribe((params: Params) => {
      this.selectedSection.set(this.sectionFromParam(params['section']));
    });
  }

  protected selectSectionByIndex(value: number | string): void {
    const section = dataManagementSections[Number(value)];

    if (section) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { section: section.id },
        queryParamsHandling: 'merge',
      });
    }
  }

  protected isSelectedSection(section: DataManagementSection): boolean {
    return this.selectedSection() === section;
  }

  private sectionFromParam(value: unknown): DataManagementSection {
    return isDataManagementSection(value) ? value : 'test-plans';
  }
}

function isDataManagementSection(value: unknown): value is DataManagementSection {
  return dataManagementSections.some((section) => section.id === value);
}
