import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  convertToParamMap,
} from '@angular/router';
import { metricsSelectionGuard } from './metrics-selection.guard';

describe('metricsSelectionGuard', () => {
  const router = { createUrlTree: (commands: unknown[]) => commands } as unknown as Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: router }] });
  });

  it('allows one nonblank value for every contextual selection parameter', () => {
    const route = routeWith({ applicationId: ' 1 ', stageId: '2', testPlanId: '3' });

    expect(TestBed.runInInjectionContext(() => metricsSelectionGuard(route, state()))).toBe(true);
  });

  it.each([
    { stageId: '2', testPlanId: '3' },
    { applicationId: '1', testPlanId: '3' },
    { applicationId: '1', stageId: '2' },
    { applicationId: ' ', stageId: '2', testPlanId: '3' },
    { applicationId: '1', stageId: ' ', testPlanId: '3' },
    { applicationId: '1', stageId: '2', testPlanId: ' ' },
    { applicationId: ['1', '2'], stageId: '2', testPlanId: '3' },
    { applicationId: '1', stageId: ['2', '3'], testPlanId: '3' },
    { applicationId: '1', stageId: '2', testPlanId: ['3', '4'] },
    { applicationId: 'x', stageId: '2', testPlanId: '3' },
    { applicationId: '1', stageId: 'x', testPlanId: '3' },
    { applicationId: '1', stageId: '2', testPlanId: 'x' },
    { applicationId: '-1', stageId: '2', testPlanId: '3' },
    { applicationId: '1', stageId: '-2', testPlanId: '3' },
    { applicationId: '1', stageId: '2', testPlanId: '-3' },
    { applicationId: '1.5', stageId: '2', testPlanId: '3' },
  ])('redirects invalid context values', (query) => {
    expect(
      TestBed.runInInjectionContext(() => metricsSelectionGuard(routeWith(query), state())),
    ).toEqual(['/data-management']);
  });
});

function routeWith(query: Record<string, string | string[] | undefined>): ActivatedRouteSnapshot {
  return { queryParamMap: convertToParamMap(query) } as ActivatedRouteSnapshot;
}

function state(): RouterStateSnapshot {
  return { url: '/metrics', root: {} as ActivatedRouteSnapshot } as RouterStateSnapshot;
}
