import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { Subject, of } from 'rxjs';
import { SavedTestResultFilesService } from './saved-test-result-files.service';
import {
  TestResultDetailsLoaderService,
  type TestRunDetailsLoadResult,
} from './test-result-details-loader.service';
import type { TestRunDetailsView } from './test-result-details.models';
import { TestResultDetailsPageComponent } from './test-result-details-page.component';

describe('TestResultDetailsPageComponent', () => {
  let fixture: ComponentFixture<TestResultDetailsPageComponent>;
  let detailsLoad: Subject<TestRunDetailsLoadResult>;

  beforeEach(() => {
    detailsLoad = new Subject<TestRunDetailsLoadResult>();
    TestBed.configureTestingModule({
      imports: [TestResultDetailsPageComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(
              convertToParamMap({ applicationId: '1', stageId: '1', testRunId: '6952' }),
            ),
          },
        },
        {
          provide: TestResultDetailsLoaderService,
          useValue: { loadDetails: () => detailsLoad.asObservable() },
        },
        {
          provide: SavedTestResultFilesService,
          useValue: {
            downloadSavedFiles: () => of(void 0),
            savedFileCount: () => 0,
          },
        },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
      ],
    });
    fixture = TestBed.createComponent(TestResultDetailsPageComponent);
    fixture.detectChanges();
  });

  it('keeps result content hidden behind a skeleton until details complete', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.details-skeleton')).not.toBeNull();
    expect(root.querySelector('app-test-run-summary-panel')).toBeNull();

    detailsLoad.next({ details: testRunDetails(), screenshotUrls: [] });
    fixture.detectChanges();

    expect(root.querySelector('.details-skeleton')).toBeNull();
    expect(root.querySelector('app-test-run-summary-panel')).not.toBeNull();
  });

  it('replaces skeleton with load error', () => {
    detailsLoad.error(new Error('Test result details failed.'));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.details-skeleton')).toBeNull();
    expect(root.querySelector('.details-error')?.textContent).toContain(
      'Test result details failed.',
    );
  });
});

function testRunDetails(): TestRunDetailsView {
  return {
    result: { id: 6952, label: 'Result' },
    testSets: [],
  } as TestRunDetailsView;
}
