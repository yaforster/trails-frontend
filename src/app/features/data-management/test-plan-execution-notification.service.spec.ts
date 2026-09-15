import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { AppNotification, AppNotificationService } from '../../core/app-notification.service';
import {
  TestExecutionEventsService,
  TestExecutionLifecycleEvent,
} from '../../test-execution/test-execution-events.service';
import { TestPlanExecutionNotificationService } from './test-plan-execution-notification.service';

describe('TestPlanExecutionNotificationService', () => {
  let notifications: AppNotificationService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: TestExecutionEventsService,
          useValue: { listen: vi.fn() },
        },
      ],
    });
    notifications = TestBed.inject(AppNotificationService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    notifications.dismissAll();
    vi.useRealTimers();
  });

  function emit(event: TestExecutionLifecycleEvent): AppNotification {
    const events = TestBed.inject(TestExecutionEventsService);
    vi.mocked(events.listen).mockReturnValueOnce(of(event));
    TestBed.inject(TestPlanExecutionNotificationService)
      .listenForCompletion('execution-1', 'Test', undefined, {
        applicationId: 4,
        stageId: 8,
      })
      .subscribe();
    return notifications.notifications()[0];
  }

  it('shows completed success feedback with preserved detail and lifetime', () => {
    vi.useFakeTimers();
    const notification = emit({
      status: 'COMPLETED',
      message: 'Test completed with details.',
      testRunId: 12,
    });

    expect(notification).toMatchObject({
      severity: 'success',
      summary: 'Test completed',
      detail: 'Test completed with details. Test run result ID: 12.',
    });
    expect(notifications.notifications()).toHaveLength(1);
    vi.advanceTimersByTime(10000);
    expect(notifications.notifications()).toHaveLength(0);
  });

  it('shows failed error feedback with fallback detail', () => {
    expect(emit({ status: 'FAILED' })).toMatchObject({
      severity: 'error',
      summary: 'Test failed',
      detail: 'Test failed.',
    });
  });

  it('navigates to exact result route from View action', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const notification = emit({ status: 'COMPLETED', testRunId: 12 });

    notification.action?.run();

    expect(navigate).toHaveBeenCalledWith(['/test-results', 4, 8, 12]);
  });

  it('does not create an action or navigate without run ID', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const notification = emit({ status: 'FAILED' });

    expect(notification.action).toBeUndefined();
    expect(navigate).not.toHaveBeenCalled();
  });
});
