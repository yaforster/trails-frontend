import { TestBed } from '@angular/core/testing';
import { CapabilitiesService } from '../../core/capabilities.service';
import { TestPlanGraphValidationService } from './test-plan-graph-validation.service';

describe('TestPlanGraphValidationService', () => {
  it('uses the current server limits rather than frontend defaults', () => {
    const limits: Record<string, number> = {
      TEST_PLAN_MAXIMUM_ACTIONS: 1,
      TEST_PLAN_MAXIMUM_PATHS: 1,
      TEST_PLAN_MAXIMUM_ACTION_OCCURRENCES: 2,
    };
    TestBed.configureTestingModule({
      providers: [
        {
          provide: CapabilitiesService,
          useValue: { numberValue: (name: string) => limits[name] },
        },
      ],
    });
    const validation = TestBed.inject(TestPlanGraphValidationService);
    expect(
      validation.validationError([{ referenceID: 1, nextActions: [2] }, { referenceID: 2 }]),
    ).toContain('1 actions');
  });

  it.each([null, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'blocks saving when graph metadata is missing or invalid: %s',
    (value) => {
      TestBed.configureTestingModule({
        providers: [
          {
            provide: CapabilitiesService,
            useValue: { numberValue: () => value },
          },
        ],
      });
      expect(
        TestBed.inject(TestPlanGraphValidationService).validationError([{ referenceID: 1 }]),
      ).toContain('limits are unavailable');
    },
  );
});
