import { Injectable, inject } from '@angular/core';
import { Observable, Subscriber } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { HATEOAS_API_BASE_URL } from '../core/api-config';

export type TestExecutionLifecycleEvent = {
  executionId?: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  message?: string;
  testRunId?: number;
};

@Injectable({
  providedIn: 'root',
})
export class TestExecutionEventsService {
  private readonly apiBaseUrl = inject(HATEOAS_API_BASE_URL);
  private readonly auth = inject(AuthService);

  listen(executionId: string, eventsHref?: string): Observable<TestExecutionLifecycleEvent> {
    return new Observable<TestExecutionLifecycleEvent>((subscriber) => {
      const abortController = new AbortController();
      const token = this.auth.accessToken();

      if (!token) {
        subscriber.error(
          new Error('A valid access token is required to follow the test execution event stream.'),
        );
        return undefined;
      }

      void this.streamEvents(
        this.eventUrl(executionId, eventsHref),
        token,
        abortController,
        subscriber,
      );

      return () => {
        abortController.abort();
      };
    });
  }

  private async streamEvents(
    url: string,
    token: string,
    abortController: AbortController,
    subscriber: Subscriber<TestExecutionLifecycleEvent>,
  ): Promise<void> {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${token}`,
        },
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        subscriber.error(new Error('Could not connect to the test execution event stream.'));
        return;
      }

      await this.readEventStream(response.body, subscriber);
    } catch {
      if (!abortController.signal.aborted && !subscriber.closed) {
        subscriber.error(new Error('Lost connection to the test execution event stream.'));
      }
    }
  }

  private async readEventStream(
    body: ReadableStream<Uint8Array>,
    subscriber: Subscriber<TestExecutionLifecycleEvent>,
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (!subscriber.closed) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      buffer = this.consumeBufferedEvents(buffer, subscriber);
    }

    buffer += decoder.decode();
    this.consumeBufferedEvents(`${buffer}\n\n`, subscriber);
    reader.releaseLock();
  }

  private consumeBufferedEvents(
    buffer: string,
    subscriber: Subscriber<TestExecutionLifecycleEvent>,
  ): string {
    const normalizedBuffer = buffer.replace(/\r\n/g, '\n');
    const messages = normalizedBuffer.split('\n\n');
    const remainingBuffer = messages.pop() ?? '';

    for (const message of messages) {
      if (subscriber.closed) {
        break;
      }

      this.publishMessage(message, subscriber);
    }

    return remainingBuffer;
  }

  private publishMessage(
    message: string,
    subscriber: Subscriber<TestExecutionLifecycleEvent>,
  ): void {
    const data = message
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');

    if (!data) {
      return;
    }

    const lifecycleEvent = this.parseEvent(data);

    if (!lifecycleEvent) {
      return;
    }

    subscriber.next(lifecycleEvent);

    if (lifecycleEvent.status === 'COMPLETED' || lifecycleEvent.status === 'FAILED') {
      subscriber.complete();
    }
  }

  private eventUrl(executionId: string, eventsHref?: string): string {
    if (eventsHref) {
      return this.toAbsoluteUrl(eventsHref);
    }

    return `${this.apiBaseUrl.replace(/\/$/, '')}/api/test/events/${encodeURIComponent(executionId)}`;
  }

  private toAbsoluteUrl(href: string): string {
    if (/^https?:\/\//i.test(href)) {
      return href;
    }

    return `${this.apiBaseUrl.replace(/\/$/, '')}/${href.replace(/^\//, '')}`;
  }

  private parseEvent(data: string): TestExecutionLifecycleEvent | null {
    try {
      const payload: unknown = JSON.parse(data);

      if (!this.isRecord(payload)) {
        return null;
      }

      const status = this.getString(payload, 'status', 'reservedStatus');

      if (status !== 'RUNNING' && status !== 'COMPLETED' && status !== 'FAILED') {
        return null;
      }

      return {
        executionId: this.getString(payload, 'executionId'),
        status,
        message: this.getString(payload, 'message'),
        testRunId: this.getNumber(payload, 'testRunId'),
      };
    } catch {
      return null;
    }
  }

  private getString(source: Record<string, unknown>, ...keys: string[]): string | undefined {
    for (const key of keys) {
      const value = source[key];

      if (typeof value === 'string') {
        return value;
      }
    }

    return undefined;
  }

  private getNumber(source: Record<string, unknown>, key: string): number | undefined {
    const value = source[key];
    return typeof value === 'number' ? value : undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
