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
import { LucidePlus, LucideRefreshCw } from '@lucide/angular';
import { TuiButton, TuiLoader } from '@taiga-ui/core';
import { TuiMessage, TuiPagination, TuiSegmented } from '@taiga-ui/kit';
import type { TestDataEntry, TestDataSet } from '../../generated/hateoas/types.gen';
import type { ResourceTab } from './data-management.models';

const profileRowsPerPage = 10;
const entryRowsPerPage = 10;

@Component({
  selector: 'app-test-data-profiles',
  imports: [
    LucidePlus,
    LucideRefreshCw,
    MatIconModule,
    TuiButton,
    TuiLoader,
    TuiMessage,
    TuiPagination,
    TuiSegmented,
  ],
  templateUrl: './test-data-profiles.component.html',
  styleUrl: './data-management-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class TestDataProfilesComponent {
  readonly profiles = input.required<TestDataSet[]>();
  readonly selectedTab = input.required<ResourceTab>();
  readonly selectedProfile = input.required<TestDataSet | null>();
  readonly selectedProfileId = input.required<number | null>();
  readonly selectedEntries = input.required<TestDataEntry[]>();
  readonly loading = input.required<boolean>();
  readonly error = input.required<string | null>();
  readonly deletingProfileId = input.required<number | null>();
  readonly canCreate = input.required<boolean>();
  readonly canShowRetiredTab = input.required<boolean>();

  readonly selectedTabChange = output<ResourceTab>();
  readonly reload = output<void>();
  readonly createProfile = output<void>();
  readonly selectProfile = output<TestDataSet>();
  readonly editProfile = output<TestDataSet>();
  readonly restoreProfile = output<TestDataSet>();
  readonly deleteProfile = output<TestDataSet>();

  protected readonly profilePageIndex = signal(0);
  protected readonly entryPageIndex = signal(0);
  protected readonly profileRowsPerPage = profileRowsPerPage;
  protected readonly entryRowsPerPage = entryRowsPerPage;
  protected readonly profilePageCount = computed(() =>
    Math.max(1, Math.ceil(this.profiles().length / profileRowsPerPage)),
  );
  protected readonly entryPageCount = computed(() =>
    Math.max(1, Math.ceil(this.selectedEntries().length / entryRowsPerPage)),
  );
  protected readonly visibleProfiles = computed(() => {
    const pageIndex = Math.min(this.profilePageIndex(), this.profilePageCount() - 1);
    const start = pageIndex * profileRowsPerPage;

    return this.profiles().slice(start, start + profileRowsPerPage);
  });
  protected readonly visibleEntries = computed(() => {
    const pageIndex = Math.min(this.entryPageIndex(), this.entryPageCount() - 1);
    const start = pageIndex * entryRowsPerPage;

    return this.selectedEntries().slice(start, start + entryRowsPerPage);
  });

  protected readonly activeTabIndex = computed(() => (this.selectedTab() === 'retired' ? 1 : 0));

  protected selectProfileRow(profile: TestDataSet): void {
    this.entryPageIndex.set(0);
    this.selectProfile.emit(profile);
  }

  protected setTab(index: number): void {
    this.profilePageIndex.set(0);
    this.entryPageIndex.set(0);
    this.selectedTabChange.emit(index === 1 ? 'retired' : 'active');
  }
}
