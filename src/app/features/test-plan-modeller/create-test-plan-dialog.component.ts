import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TuiButton, TuiDialog, TuiLoader } from '@taiga-ui/core';

@Component({
  selector: 'app-create-test-plan-dialog',
  imports: [MatIconModule, TuiButton, TuiDialog, TuiLoader],
  templateUrl: './create-test-plan-dialog.component.html',
  styleUrl: './test-plan-modeller-page.component.css',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateTestPlanDialogComponent {
  readonly open = input.required<boolean>();
  readonly loading = input.required<boolean>();
  readonly name = input.required<string>();
  readonly error = input.required<string | null>();

  readonly openChange = output<boolean>();
  readonly nameChange = output<string>();
  readonly close = output<void>();
  readonly create = output<void>();

  protected nameValid(): boolean {
    return this.name().trim().length > 0;
  }

  protected onNameInput(event: Event): void {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    this.nameChange.emit(input?.value ?? '');
  }
}
