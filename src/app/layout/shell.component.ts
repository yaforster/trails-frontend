import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import {
  LucideClipboardCheck,
  LucideDatabase,
  LucideLockKeyhole,
  LucideLogOut,
  LucideMenu,
  LucideMoon,
  LucidePanelLeftClose,
  LucideSun,
  LucideWorkflow,
} from '@lucide/angular';
import { TuiButton, TuiLoader, TuiNotification } from '@taiga-ui/core';
import { TuiNavigation } from '@taiga-ui/layout/components/navigation';
import { AuthService } from '../auth/auth.service';
import { WorkspaceContextPanelComponent } from '../context/workspace-context-panel.component';
import {
  AppNotification,
  AppNotificationSeverity,
  AppNotificationService,
} from '../core/app-notification.service';
import { CapabilitiesService } from '../core/capabilities.service';
import { ThemeService } from '../core/theme.service';
import { CurrentUserProfileButtonComponent } from './current-user-profile-button.component';

@Component({
  selector: 'app-shell',
  imports: [
    LucideClipboardCheck,
    LucideDatabase,
    LucideLockKeyhole,
    LucideLogOut,
    LucideMenu,
    LucideMoon,
    LucidePanelLeftClose,
    LucideSun,
    LucideWorkflow,
    RouterLink,
    RouterOutlet,
    TuiButton,
    TuiLoader,
    TuiNavigation,
    TuiNotification,
    CurrentUserProfileButtonComponent,
    WorkspaceContextPanelComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly capabilities = inject(CapabilitiesService);
  private readonly notificationsService = inject(AppNotificationService);
  private readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private navigationFeedbackTimeout: ReturnType<typeof setTimeout> | null = null;

  protected readonly authenticated = computed(() => this.auth.authenticated());
  protected readonly navigationPending = signal(false);
  protected readonly navigationFeedback = signal(false);
  protected readonly navigationExpanded = signal(true);
  protected readonly showNavigationSpinner = computed(
    () => this.navigationPending() || this.navigationFeedback(),
  );
  protected readonly userFeaturesActive = computed(
    () => this.capabilities.booleanValue('USER_FEATURES_ACTIVE') === true,
  );
  protected readonly darkMode = this.theme.darkMode;
  protected readonly notifications = this.notificationsService.notifications;

  constructor() {
    effect(() => {
      if (this.auth.authenticated()) {
        untracked(() => this.capabilities.ensureCapabilities());
      }
    });

    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.navigationPending.set(true);
        return;
      }

      if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.navigationPending.set(false);
      }
    });
  }

  protected showTabLoadingFeedback(): void {
    this.navigationFeedback.set(true);

    if (this.navigationFeedbackTimeout) {
      clearTimeout(this.navigationFeedbackTimeout);
    }

    this.navigationFeedbackTimeout = setTimeout(() => {
      this.navigationFeedback.set(false);
      this.navigationFeedbackTimeout = null;
    }, 900);
  }

  protected logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }

  protected toggleDarkMode(): void {
    this.theme.toggle();
  }

  protected toggleNavigation(): void {
    this.navigationExpanded.update((expanded: boolean) => !expanded);
  }

  protected notificationAppearance(severity: AppNotificationSeverity): string {
    switch (severity) {
      case 'success':
        return 'positive';
      case 'error':
        return 'negative';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
    }
  }

  protected dismissNotification(notification: AppNotification): void {
    this.notificationsService.dismiss(notification.id);
  }

  protected runNotificationAction(notification: AppNotification): void {
    notification.action?.run();
    this.notificationsService.dismiss(notification.id);
  }

  ngOnDestroy(): void {
    if (this.navigationFeedbackTimeout) {
      clearTimeout(this.navigationFeedbackTimeout);
    }
  }
}
