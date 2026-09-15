import { Injectable, computed, signal } from '@angular/core';

export type AppNotificationSeverity = 'success' | 'error' | 'info' | 'warning';

export type AppNotificationAction = {
  readonly label: string;
  readonly run: () => void;
};

export type AppNotification = {
  readonly id: number;
  readonly severity: AppNotificationSeverity;
  readonly summary: string;
  readonly detail: string;
  readonly action?: AppNotificationAction;
};

export type AppNotificationRequest = Omit<AppNotification, 'id'> & {
  readonly life?: number;
};

type StoredAppNotification = AppNotification & {
  readonly timeoutId?: ReturnType<typeof setTimeout>;
};

@Injectable({ providedIn: 'root' })
export class AppNotificationService {
  private readonly notificationsSignal = signal<StoredAppNotification[]>([]);
  private nextId = 1;

  readonly notifications = computed<readonly AppNotification[]>(() =>
    this.notificationsSignal().map(({ timeoutId: _timeoutId, ...notification }) => notification),
  );

  show(request: AppNotificationRequest): number {
    const id: number = this.nextId++;
    const timeoutId: ReturnType<typeof setTimeout> | undefined =
      request.life === undefined
        ? undefined
        : setTimeout(() => {
            this.dismiss(id);
          }, request.life);

    this.notificationsSignal.update((notifications: StoredAppNotification[]) => [
      ...notifications,
      {
        id,
        severity: request.severity,
        summary: request.summary,
        detail: request.detail,
        action: request.action,
        timeoutId,
      },
    ]);

    return id;
  }

  dismiss(id: number): void {
    const notification: StoredAppNotification | undefined = this.notificationsSignal().find(
      (item: StoredAppNotification) => item.id === id,
    );

    if (notification?.timeoutId) {
      clearTimeout(notification.timeoutId);
    }

    this.notificationsSignal.update((notifications: StoredAppNotification[]) =>
      notifications.filter((item: StoredAppNotification) => item.id !== id),
    );
  }

  dismissAll(): void {
    for (const notification of this.notificationsSignal()) {
      if (notification.timeoutId) {
        clearTimeout(notification.timeoutId);
      }
    }

    this.notificationsSignal.set([]);
  }
}
