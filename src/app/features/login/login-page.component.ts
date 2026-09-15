import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideLogIn } from '@lucide/angular';
import { TuiButton, TuiInput, TuiTextfield, TuiTextfieldOptionsDirective } from '@taiga-ui/core';
import { TuiButtonLoading } from '@taiga-ui/kit';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [
    LucideLogIn,
    ReactiveFormsModule,
    TuiButton,
    TuiButtonLoading,
    TuiInput,
    TuiTextfield,
    TuiTextfieldOptionsDirective,
  ],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
    clientId: ['', Validators.required],
    clientSecret: [''],
  });

  protected login(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const value = this.form.getRawValue();
    this.auth
      .login({
        username: value.username,
        password: value.password,
        clientId: value.clientId,
        clientSecret: value.clientSecret || undefined,
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          void this.router.navigate(['/data-management']);
        },
        error: (error: Error) => {
          this.loading.set(false);
          this.error.set(error.message);
        },
      });
  }
}
