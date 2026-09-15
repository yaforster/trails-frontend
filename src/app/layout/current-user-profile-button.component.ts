import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnDestroy,
  Signal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NavigationStart, Router } from '@angular/router';
import {
  LucideCheck,
  LucideLogOut,
  LucidePencil,
  LucideTrash2,
  LucideUser,
  LucideX,
} from '@lucide/angular';
import { TuiButton, TuiLoader } from '@taiga-ui/core';
import { finalize } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { CurrentUserProfileService } from '../auth/current-user-profile.service';
import { CapabilitiesService } from '../core/capabilities.service';
import type { UserProfile, UserProfileUpdate } from '../generated/hateoas/types.gen';

type ProfileForm = FormGroup<{
  firstName: FormControl<string>;
  lastName: FormControl<string>;
  email: FormControl<string>;
  phoneNumber: FormControl<string>;
}>;

type AvatarFormat = {
  label: string;
  mimeType: string;
  extensions: string[];
};

const avatarFormatAliases: Record<string, AvatarFormat> = {
  png: { label: 'PNG', mimeType: 'image/png', extensions: ['.png'] },
  jpeg: { label: 'JPEG', mimeType: 'image/jpeg', extensions: ['.jpg', '.jpeg'] },
  jpg: { label: 'JPEG', mimeType: 'image/jpeg', extensions: ['.jpg', '.jpeg'] },
  gif: { label: 'GIF', mimeType: 'image/gif', extensions: ['.gif'] },
  bmp: { label: 'BMP', mimeType: 'image/bmp', extensions: ['.bmp'] },
  webp: { label: 'WEBP', mimeType: 'image/webp', extensions: ['.webp'] },
};

@Component({
  selector: 'app-current-user-profile-button',
  imports: [
    LucideCheck,
    LucideLogOut,
    LucidePencil,
    LucideTrash2,
    LucideUser,
    LucideX,
    ReactiveFormsModule,
    TuiButton,
    TuiLoader,
  ],
  templateUrl: './current-user-profile-button.component.html',
  styleUrl: './current-user-profile-button.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurrentUserProfileButtonComponent implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly capabilities = inject(CapabilitiesService);
  private readonly currentUser = inject(CurrentUserProfileService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  protected readonly avatarUrl: Signal<string | null> = this.currentUser.avatarUrl;
  protected readonly error: Signal<string | null> = this.currentUser.error;
  protected readonly loading: Signal<boolean> = this.currentUser.loading;
  protected readonly profile: Signal<UserProfile | null> = this.currentUser.profile;
  protected readonly editing = signal(false);
  protected readonly avatarSaving = signal(false);
  protected readonly editError = signal<string | null>(null);
  protected readonly menuOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly form: ProfileForm = new FormGroup({
    firstName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(100)],
    }),
    lastName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(100)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email, Validators.maxLength(255)],
    }),
    phoneNumber: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(50)],
    }),
  });
  protected readonly displayName = computed(() => this.profileDisplayName(this.profile()));
  protected readonly initials = computed(() => this.profileInitials(this.profile()));

  constructor() {
    this.capabilities.ensureCapabilities();
    this.currentUser.ensureProfile();

    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.closeMenu();
      }
    });
  }

  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  protected closeMenu(): void {
    this.menuOpen.set(false);
    this.editing.set(false);
    this.editError.set(null);
  }

  protected toggleMenu(): void {
    const nextOpenState: boolean = !this.menuOpen();
    this.menuOpen.set(nextOpenState);

    if (nextOpenState) {
      this.currentUser.ensureProfile();
    }
  }

  protected startEditing(profile: UserProfile): void {
    this.fillForm(profile);
    this.editError.set(null);
    this.editing.set(true);
  }

  protected cancelEditing(): void {
    this.editing.set(false);
    this.editError.set(null);
    this.fillForm(this.profile());
  }

  protected saveProfile(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.editError.set(null);

    this.currentUser
      .updateProfile(this.toProfileUpdate())
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.editing.set(false);
          this.form.markAsPristine();
        },
        error: (error: Error) => {
          this.editError.set(error.message);
        },
      });
  }

  protected openAvatarFilePicker(input: HTMLInputElement): void {
    if (!this.avatarSaving()) {
      input.click();
    }
  }

  protected onAvatarSelected(event: Event): void {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const file = input?.files?.[0] ?? null;

    if (input) {
      input.value = '';
    }

    if (!file || this.avatarSaving()) {
      return;
    }

    this.avatarSaving.set(true);
    this.editError.set(null);

    this.validateAvatar(file)
      .then(() => {
        this.currentUser
          .updateProfilePicture(file)
          .pipe(
            finalize(() => this.avatarSaving.set(false)),
            takeUntilDestroyed(this.destroyRef),
          )
          .subscribe({
            error: (error: Error) => this.editError.set(error.message),
          });
      })
      .catch((error: Error) => {
        this.avatarSaving.set(false);
        this.editError.set(error.message);
      });
  }

  protected deleteAvatar(): void {
    if (this.avatarSaving() || !this.avatarUrl()) {
      return;
    }

    if (!window.confirm('Remove your profile picture?')) {
      return;
    }

    this.avatarSaving.set(true);
    this.editError.set(null);

    this.currentUser
      .deleteProfilePicture()
      .pipe(
        finalize(() => this.avatarSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: (error: Error) => this.editError.set(error.message),
      });
  }

  protected avatarAcceptTypes(): string[] {
    return this.supportedAvatarFormats()
      .flatMap((format) => [format.mimeType, ...format.extensions])
      .filter((value, index, all) => all.indexOf(value) === index);
  }

  protected logout(): void {
    this.auth.logout();
    this.currentUser.clear();
    this.closeMenu();
    void this.router.navigate(['/login']);
  }

  private profileDisplayName(profile: UserProfile | null): string {
    const firstName: string | null = this.trimmed(profile?.firstName);
    const lastName: string | null = this.trimmed(profile?.lastName);
    const fullName: string = [firstName, lastName]
      .filter((value: string | null): value is string => value !== null)
      .join(' ');

    if (fullName) {
      return fullName;
    }

    return this.trimmed(profile?.email) ?? 'User profile';
  }

  private profileInitials(profile: UserProfile | null): string {
    const firstName: string | null = this.trimmed(profile?.firstName);
    const lastName: string | null = this.trimmed(profile?.lastName);

    if (firstName || lastName) {
      return `${firstName?.charAt(0) ?? ''}${lastName?.charAt(0) ?? ''}`.toUpperCase();
    }

    const email: string | null = this.trimmed(profile?.email);
    return email ? email.charAt(0).toUpperCase() : 'U';
  }

  private trimmed(value: string | undefined): string | null {
    const trimmedValue: string = value?.trim() ?? '';
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  private fillForm(profile: UserProfile | null): void {
    this.form.reset({
      firstName: profile?.firstName ?? '',
      lastName: profile?.lastName ?? '',
      email: profile?.email ?? '',
      phoneNumber: profile?.phoneNumber ?? '',
    });
  }

  private toProfileUpdate(): UserProfileUpdate {
    return {
      firstName: this.nullable(this.form.controls.firstName.value),
      lastName: this.nullable(this.form.controls.lastName.value),
      email: this.nullable(this.form.controls.email.value),
      phoneNumber: this.nullable(this.form.controls.phoneNumber.value),
    };
  }

  private nullable(value: string): string | null {
    const trimmedValue: string = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  private async validateAvatar(file: File): Promise<void> {
    if (!this.capabilities.loaded()) {
      throw new Error(
        'Profile picture upload rules are still loading. Try again once service capabilities are available.',
      );
    }

    const maxSize = this.capabilities.numberValue('USER_IMAGE_MAX_SIZE_BYTES');
    const supportedFormats = this.supportedAvatarFormats();

    if (supportedFormats.length === 0) {
      throw new Error('The service did not provide supported profile picture file types.');
    }

    if (maxSize !== null && file.size > maxSize) {
      throw new Error(`Profile picture file size must not exceed ${this.formatBytes(maxSize)}.`);
    }

    if (!this.isSupportedAvatarType(file, supportedFormats)) {
      throw new Error(
        `Profile picture type must be one of: ${this.supportedAvatarFormatLabels(supportedFormats)}.`,
      );
    }
  }

  private supportedAvatarFormats(): AvatarFormat[] {
    const value = this.capabilities.value('SUPPORTED_IMAGE_FORMATS');

    if (!value) {
      return [];
    }

    return value
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .map((item) => this.toAvatarFormat(item))
      .filter((format): format is AvatarFormat => format !== null)
      .filter(
        (format, index, all) =>
          all.findIndex((candidate) => candidate.mimeType === format.mimeType) === index,
      );
  }

  private toAvatarFormat(value: string): AvatarFormat | null {
    const key = value.replace(/^image\//, '').replace(/^\./, '');

    return avatarFormatAliases[key] ?? null;
  }

  private isSupportedAvatarType(file: File, supportedFormats: AvatarFormat[]): boolean {
    const mimeType = file.type.trim().toLowerCase();
    const extension = this.fileExtension(file.name);

    return supportedFormats.some(
      (format) =>
        format.mimeType === mimeType ||
        (extension !== null && format.extensions.includes(extension)),
    );
  }

  private fileExtension(fileName: string): string | null {
    const match = /\.[^.]+$/.exec(fileName.trim().toLowerCase());
    return match?.[0] ?? null;
  }

  private supportedAvatarFormatLabels(supportedFormats: AvatarFormat[]): string {
    return supportedFormats
      .map((format) => format.label)
      .filter((label, index, all) => all.indexOf(label) === index)
      .join(', ');
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  ngOnDestroy(): void {
    this.currentUser.clear();
  }
}
