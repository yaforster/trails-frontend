import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { LucideArrowLeft, LucideDownload, LucideRefreshCw } from '@lucide/angular';
import { TuiButton, TuiLoader } from '@taiga-ui/core';
import { TuiSkeleton } from '@taiga-ui/kit/directives/skeleton';
import type { DetailsRoute, TestRunDetailsView } from './test-result-details.models';
import { TestResultDetailsLoaderService } from './test-result-details-loader.service';
import { SavedTestResultFilesService } from './saved-test-result-files.service';
import { TestRunSummaryPanelComponent } from './test-run-summary-panel.component';
import { TestSetResultPanelComponent } from './test-set-result-panel.component';

@Component({
  selector: 'app-test-result-details-page',
  imports: [
    LucideArrowLeft,
    LucideDownload,
    LucideRefreshCw,
    TuiButton,
    TuiLoader,
    TuiSkeleton,
    TestRunSummaryPanelComponent,
    TestSetResultPanelComponent,
  ],
  templateUrl: './test-result-details-page.component.html',
  styleUrl: './test-result-details-page.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestResultDetailsPageComponent implements OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly files = inject(SavedTestResultFilesService);
  private readonly loader = inject(TestResultDetailsLoaderService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly screenshotUrls = new Set<string>();

  protected readonly details = signal<TestRunDetailsView | null>(null);
  protected readonly detailsRoute = signal<DetailsRoute | null>(null);
  protected readonly loading = signal(false);
  protected readonly downloadingArtifacts = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params: ParamMap) => {
      const detailsRoute = this.toDetailsRoute(params);

      if (!detailsRoute) {
        this.detailsRoute.set(null);
        this.details.set(null);
        this.error.set('The selected test result route is incomplete.');
        return;
      }

      this.detailsRoute.set(detailsRoute);
      this.loadDetails(detailsRoute);
    });
  }

  protected backToResults(): void {
    void this.router.navigate(['/test-results']);
  }

  protected reloadDetails(): void {
    const detailsRoute = this.detailsRoute();

    if (!detailsRoute) {
      return;
    }

    this.loadDetails(detailsRoute);
  }

  protected savedFileCount(details: TestRunDetailsView): number {
    return this.files.savedFileCount(details);
  }

  protected downloadSavedFiles(details: TestRunDetailsView): void {
    if (this.downloadingArtifacts()) {
      return;
    }

    if (this.savedFileCount(details) === 0) {
      this.error.set('This test run has no saved files to download.');
      return;
    }

    this.downloadingArtifacts.set(true);
    this.error.set(null);

    this.files
      .downloadSavedFiles(details)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.downloadingArtifacts.set(false),
        error: (error: Error) => {
          this.downloadingArtifacts.set(false);
          this.error.set(error.message);
        },
      });
  }

  private loadDetails(detailsRoute: DetailsRoute): void {
    if (this.loading()) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.details.set(null);
    this.revokeScreenshots();

    this.loader
      .loadDetails(detailsRoute)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ details, screenshotUrls }) => {
          screenshotUrls.forEach((url) => this.screenshotUrls.add(url));
          this.details.set(details);
          this.loading.set(false);
        },
        error: (error: Error) => {
          this.loading.set(false);
          this.error.set(error.message);
        },
      });
  }

  private toDetailsRoute(params: ParamMap): DetailsRoute | null {
    const applicationId = this.numberParam(params, 'applicationId');
    const stageId = this.numberParam(params, 'stageId');
    const testRunId = this.numberParam(params, 'testRunId');

    if (applicationId === null || stageId === null || testRunId === null) {
      return null;
    }

    return {
      applicationId,
      stageId,
      testRunId,
    };
  }

  private numberParam(params: ParamMap, key: string): number | null {
    const value = params.get(key);

    if (value === null) {
      return null;
    }

    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  private revokeScreenshots(): void {
    for (const url of this.screenshotUrls) {
      URL.revokeObjectURL(url);
    }

    this.screenshotUrls.clear();
  }

  ngOnDestroy(): void {
    this.revokeScreenshots();
  }
}
