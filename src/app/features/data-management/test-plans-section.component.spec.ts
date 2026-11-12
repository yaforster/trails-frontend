import { ChangeDetectionStrategy, Component, NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { By } from '@angular/platform-browser';
import { provideTaiga, TuiRoot } from '@taiga-ui/core';
import { EMPTY, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { WorkspaceContextService } from '../../context/workspace-context.service';
import type { Browser, TestPlan, TestPlanRunDefinition } from '../../generated/hateoas/types.gen';
import { TestPlanModellerGraphService } from '../test-plan-modeller/test-plan-modeller-graph.service';
import { TestPlanExecutionNotificationService } from './test-plan-execution-notification.service';
import { TestPlansSectionComponent } from './test-plans-section.component';
import { TestPlansSectionDataService } from './test-plans-section-data.service';
import { TestPlansTableComponent } from './test-plans-table.component';

@Component({
  selector: 'app-test-plans-table',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestPlansTableStub {}

@Component({
  imports: [TuiRoot, TestPlansSectionComponent],
  template: '<tui-root><app-test-plans-section /></tui-root>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class DialogHost {}

type TestPlansSectionHarness = {
  readonly canStartTestRun: () => boolean;
  readonly recipientEmailError: () => string | null;
  openRunDialog(testPlan: TestPlan): void;
  setEmailNotificationEnabled(enabled: boolean): void;
  toggleBrowser(browser: Browser): void;
  updateRecipientEmails(emails: string[]): void;
  startTestRun(): void;
};

describe('TestPlansSectionComponent', () => {
  const startTestRun = vi.fn();
  let fixture: ComponentFixture<DialogHost>;

  beforeAll(() => {
    HTMLElement.prototype.scrollTo = (): void => undefined;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string): MediaQueryList =>
        ({
          matches: false,
          media: query,
          onchange: null,
          addEventListener: (): void => undefined,
          removeEventListener: (): void => undefined,
          dispatchEvent: (): boolean => false,
          addListener: (): void => undefined,
          removeListener: (): void => undefined,
        }) as MediaQueryList,
    });
  });

  beforeEach(() => {
    startTestRun.mockReset();
    TestBed.configureTestingModule({
      imports: [DialogHost],
      providers: [
        provideTaiga(),
        {
          provide: WorkspaceContextService,
          useValue: {
            selectedApplicationId: signal(7),
            selectedStageId: signal(11),
            stages: signal([]),
          },
        },
        {
          provide: TestPlansSectionDataService,
          useValue: {
            loadTestPlans: () => of([]),
            startTestRun,
          },
        },
        {
          provide: TestPlanExecutionNotificationService,
          useValue: { listenForCompletion: () => EMPTY },
        },
        { provide: TestPlanModellerGraphService, useValue: { queueDefinition: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn(), events: EMPTY } },
      ],
    });
    TestBed.overrideComponent(TestPlansSectionComponent, {
      remove: { imports: [TestPlansTableComponent] },
      add: { imports: [TestPlansTableStub], schemas: [NO_ERRORS_SCHEMA] },
    });
    fixture = TestBed.createComponent(DialogHost);
    fixture.detectChanges();
  });

  it('requires valid recipients when completion email is selected', () => {
    const component = harness();

    component.openRunDialog(executableTestPlan());
    component.toggleBrowser('CHROME');
    component.setEmailNotificationEnabled(true);

    expect(component.recipientEmailError()).toBe('Add at least one recipient email address.');
    expect(component.canStartTestRun()).toBe(false);

    component.updateRecipientEmails(['result@example.com']);

    expect(component.recipientEmailError()).toBeNull();
    expect(component.canStartTestRun()).toBe(true);
  });

  it('sends selected email recipients in test-run definition', () => {
    startTestRun.mockReturnValue(of({ executionId: 'execution-id' }));
    const component = harness();

    component.openRunDialog(executableTestPlan());
    component.toggleBrowser('CHROME');
    component.setEmailNotificationEnabled(true);
    component.updateRecipientEmails([' result@EXAMPLE.com ']);
    component.startTestRun();

    expect(startTestRun).toHaveBeenCalledWith('/api/test', {
      testPlanID: 42,
      browsersToTest: ['CHROME'],
      completionNotification: {
        emailEnabled: true,
        recipientEmails: ['result@example.com'],
      },
    } satisfies TestPlanRunDefinition);
  });

  it.each([false, true])(
    'omits notification when disabled (previously enabled: %s)',
    (previouslyEnabled) => {
      startTestRun.mockReturnValue(of({ executionId: 'execution-id' }));
      const component = harness();
      component.openRunDialog(executableTestPlan());
      component.toggleBrowser('CHROME');
      if (previouslyEnabled) {
        component.setEmailNotificationEnabled(true);
        component.updateRecipientEmails(['a@example.test']);
        component.setEmailNotificationEnabled(false);
      }
      component.startTestRun();
      expect(startTestRun).toHaveBeenCalledWith('/api/test', {
        testPlanID: 42,
        browsersToTest: ['CHROME'],
      });
    },
  );

  it('associates visible validation with the labeled recipient input', async () => {
    const input = await openRecipientEditor();
    expect(document.querySelector(`label[for="${input.id}"]`)?.textContent).toContain(
      'Recipient email addresses',
    );
    expect(input.getAttribute('aria-invalid')).toBe('true');
    for (const id of input.getAttribute('aria-describedby')!.split(' ')) {
      expect(document.getElementById(id)?.textContent).toBeTruthy();
    }
    expect(document.querySelector<HTMLButtonElement>('.start-run-button')?.disabled).toBe(true);
  });

  it('adds with Enter and removes a focused chip with Backspace', async () => {
    const input = await openRecipientEditor();
    input.focus();
    input.value = 'a@example.test';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(input.getAttribute('aria-invalid')).toBe('false');
    const chip = document.querySelector<HTMLElement>('tui-input-chip')!;
    chip.focus();
    chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(document.activeElement).toBe(input);
    expect(harness().canStartTestRun()).toBe(false);
  });

  it('keeps the dialog editable and announces a server validation error', async () => {
    startTestRun.mockReturnValue(
      throwError(() => new Error('Completion email delivery is unavailable.')),
    );
    await openRecipientEditor();
    harness().updateRecipientEmails(['a@example.test']);
    harness().startTestRun();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      'Completion email delivery is unavailable.',
    );
    expect(document.querySelector<HTMLInputElement>('#run-recipient-emails')?.disabled).toBe(false);
  });

  it('renders invalid recipient feedback and prevents submission', async () => {
    const input = await openRecipientEditor();
    input.value = 'invalid-address';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    harness().startTestRun();
    expect(document.getElementById('run-recipient-error')?.textContent).toContain(
      'Use ASCII email addresses',
    );
    expect(startTestRun).not.toHaveBeenCalled();
  });

  async function openRecipientEditor(): Promise<HTMLInputElement> {
    harness().openRunDialog(executableTestPlan());
    harness().toggleBrowser('CHROME');
    await fixture.whenStable();
    fixture.detectChanges();
    document.querySelector<HTMLInputElement>('.run-notification-toggle input')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    return document.querySelector<HTMLInputElement>('#run-recipient-emails')!;
  }

  function harness(): TestPlansSectionHarness {
    return fixture.debugElement.query(By.directive(TestPlansSectionComponent))
      .componentInstance as TestPlansSectionHarness;
  }

  function executableTestPlan(): TestPlan {
    return {
      id: 42,
      label: 'Smoke test',
      _links: { execute: { href: '/api/test' } },
    };
  }
});
