import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActionResultCardComponent } from './action-result-card.component';

describe('ActionResultCardComponent', () => {
  let fixture: ComponentFixture<ActionResultCardComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ActionResultCardComponent] });
    fixture = TestBed.createComponent(ActionResultCardComponent);
    fixture.componentRef.setInput('action', {
      result: {
        resultType: 'TECHNICAL_FAILURE',
        resultMessage: 'Could not interact with the required web page element.',
      },
      screenshotBlob: null,
      screenshotUrl: null,
    });
    fixture.detectChanges();
  });

  it('renders service-safe failure message', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Could not interact with the required web page element.',
    );
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Exception Message');
  });
});
