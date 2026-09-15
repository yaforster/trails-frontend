import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { filter, map, Observable, tap } from 'rxjs';
import { AppNotificationService } from '../../core/app-notification.service';
import { TestExecutionEventsService } from '../../test-execution/test-execution-events.service';

type TestExecutionResultRoute = {
  applicationId: number;
  stageId: number;
  testRunId: number | undefined;
};

@Injectable({ providedIn: 'root' })
export class TestPlanExecutionNotificationService {
  private readonly events = inject(TestExecutionEventsService);
  private readonly notifications = inject(AppNotificationService);
  private readonly router = inject(Router);

  listenForCompletion(
    executionId: string,
    label: string,
    eventsHref: string | undefined,
    route: Omit<TestExecutionResultRoute, 'testRunId'>,
  ): Observable<void> {
    return this.events.listen(executionId, eventsHref).pipe(
      filter((event) => event.status !== 'RUNNING'),
      tap((event) => {
        const completed: boolean = event.status === 'COMPLETED';
        const fallbackMessage: string = `${label} ${completed ? 'completed' : 'failed'}.`;

        this.notifications.show({
          severity: completed ? 'success' : 'error',
          summary: completed ? 'Test completed' : 'Test failed',
          detail: this.testCompletedMessage(event.message ?? fallbackMessage, event.testRunId),
          action:
            event.testRunId === undefined
              ? undefined
              : {
                  label: 'View',
                  run: () => {
                    void this.router.navigate([
                      '/test-results',
                      route.applicationId,
                      route.stageId,
                      event.testRunId,
                    ]);
                  },
                },
          life: 10000,
        });
      }),
      map(() => undefined),
    );
  }

  showEventStreamFailure(error: Error): void {
    this.notifications.show({
      severity: 'error',
      summary: 'Test event stream failed',
      detail: error.message,
    });
  }

  private testCompletedMessage(message: string, testRunId: number | undefined): string {
    if (testRunId === undefined) {
      return message;
    }

    return `${message} Test run result ID: ${testRunId}.`;
  }
}
