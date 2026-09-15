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
        resultMessage: 'Could not resize viewport.',
        exceptionMessageFromAction:
          'Requested viewport: 800 x 600 CSS pixels. Last measured viewport: unavailable. Cause: Node rejected resize.',
      },
      screenshotBlob: null,
      screenshotUrl: null,
    });
    fixture.detectChanges();
  });

  it('renders viewport resize technical diagnostics', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Requested viewport: 800 x 600 CSS pixels. Last measured viewport: unavailable. Cause: Node rejected resize.',
    );
  });
});
