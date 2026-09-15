import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { metricsSelectionFromParams } from './metrics-selection';

export const metricsSelectionGuard: CanActivateFn = (route) => {
  return (
    metricsSelectionFromParams(route.queryParamMap) !== null ||
    inject(Router).createUrlTree(['/data-management'])
  );
};
