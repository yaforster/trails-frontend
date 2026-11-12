import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../auth/auth.service';
import { HATEOAS_API_BASE_URL } from '../../core/api-config';
import { TestPlansSectionDataService } from './test-plans-section-data.service';

describe('test execution validation response', () => {
  it('preserves service validation feedback through the authenticated request boundary', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { accessToken: () => 'fixture-token' } },
        { provide: HATEOAS_API_BASE_URL, useValue: '' },
      ],
    });
    let feedback = '';
    TestBed.inject(TestPlansSectionDataService)
      .startTestRun('/api/test', {
        testPlanID: 42,
        browsersToTest: ['CHROME'],
        completionNotification: { emailEnabled: true, recipientEmails: ['a@example.test'] },
      })
      .subscribe({
        error: (error: Error) => {
          feedback = error.message;
        },
      });
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne('/api/test');
    expect(request.request.headers.get('Authorization')).toBe('Bearer fixture-token');
    request.flush(
      [
        {
          code: 'COMPLETION_NOTIFICATION_UNAVAILABLE',
          message: 'Completion email delivery is unavailable.',
          path: '/completionNotification/emailEnabled',
        },
      ],
      { status: 400, statusText: 'Bad Request' },
    );
    expect(feedback).toBe('Completion email delivery is unavailable.');
    http.verify();
  });
});
