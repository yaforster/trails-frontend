import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FExternalItem } from '@foblex/flow';
import { LucideBox, LucideRefreshCw } from '@lucide/angular';
import { TuiButton, TuiLoader } from '@taiga-ui/core';
import { WorkspaceContextService } from '../../context/workspace-context.service';
import type { ElementPaletteItem } from './test-plan-modeller-graph.service';
import { actionTypeIcon } from './test-plan-modeller-action-icons';

@Component({
  selector: 'app-test-plan-modeller-palette-sidebar',
  imports: [FExternalItem, LucideBox, LucideRefreshCw, MatIconModule, TuiButton, TuiLoader],
  templateUrl: './test-plan-modeller-palette-sidebar.component.html',
  styleUrl: './test-plan-modeller-page.component.css',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestPlanModellerPaletteSidebarComponent {
  protected readonly context = inject(WorkspaceContextService);
  protected readonly actionTypeIcon = actionTypeIcon;

  readonly utilityItems = input.required<ElementPaletteItem[]>();
  readonly elementItems = input.required<ElementPaletteItem[]>();
  readonly loading = input.required<boolean>();
  readonly error = input.required<string | null>();

  readonly reload = output<void>();
}
