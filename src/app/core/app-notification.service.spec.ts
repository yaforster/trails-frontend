import { AppNotificationService } from './app-notification.service';

describe('AppNotificationService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores notifications until they are dismissed', () => {
    const service = new AppNotificationService();

    const id: number = service.show({
      severity: 'success',
      summary: 'Done',
      detail: 'The action completed.',
    });

    expect(service.notifications()).toEqual([
      {
        id,
        severity: 'success',
        summary: 'Done',
        detail: 'The action completed.',
        action: undefined,
      },
    ]);

    service.dismiss(id);

    expect(service.notifications()).toEqual([]);
  });

  it('auto-dismisses notifications with a lifetime', () => {
    vi.useFakeTimers();
    const service = new AppNotificationService();

    service.show({
      severity: 'info',
      summary: 'Queued',
      detail: 'The notification will close.',
      life: 1000,
    });

    expect(service.notifications()).toHaveLength(1);

    vi.advanceTimersByTime(1000);

    expect(service.notifications()).toEqual([]);
  });

  it('clears pending timers when dismissing all notifications', () => {
    vi.useFakeTimers();
    const service = new AppNotificationService();

    service.show({
      severity: 'warning',
      summary: 'Pending',
      detail: 'The notification has a timer.',
      life: 1000,
    });

    service.dismissAll();
    vi.advanceTimersByTime(1000);

    expect(service.notifications()).toEqual([]);
  });
});
