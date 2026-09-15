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
import type { Element } from '../../generated/hateoas/types.gen';
import type { ResourceTab } from './data-management.models';

const rowsPerPage = 10;

@Component({
  selector: 'app-elements-table',
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
  templateUrl: './elements-table.component.html',
  styleUrl: './data-management-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class ElementsTableComponent {
  readonly elements = input.required<Element[]>();
  readonly selectedTab = input.required<ResourceTab>();
  readonly loading = input.required<boolean>();
  readonly error = input.required<string | null>();
  readonly deletingElementId = input.required<number | null>();
  readonly canCreate = input.required<boolean>();
  readonly canShowRetiredTab = input.required<boolean>();
  readonly hasSelectedContext = input.required<boolean>();

  readonly selectedTabChange = output<ResourceTab>();
  readonly reload = output<void>();
  readonly createElement = output<void>();
  readonly viewElement = output<Element>();
  readonly editElement = output<Element>();
  readonly restoreElement = output<Element>();
  readonly promoteElement = output<Element>();
  readonly deleteElement = output<Element>();

  protected readonly pageIndex = signal(0);
  protected readonly rowsPerPage = rowsPerPage;
  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.elements().length / rowsPerPage)),
  );
  protected readonly visibleElements = computed(() => {
    const pageIndex = Math.min(this.pageIndex(), this.pageCount() - 1);
    const start = pageIndex * rowsPerPage;

    return this.elements().slice(start, start + rowsPerPage);
  });

  protected readonly activeTabIndex = computed(() => (this.selectedTab() === 'retired' ? 1 : 0));

  protected locatorIcon(locatorType: Element['locatorType']): string {
    return locatorType === 'XPATH' ? 'account_tree' : 'css';
  }

  protected setTab(index: number): void {
    this.pageIndex.set(0);
    this.selectedTabChange.emit(index === 1 ? 'retired' : 'active');
  }
}
