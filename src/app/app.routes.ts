import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { metricsSelectionGuard } from './features/metrics/metrics-selection.guard';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'login',
      },
      {
        path: 'login',
        loadComponent: () =>
          import('./features/login/login-page.component').then((m) => m.LoginPageComponent),
      },
      {
        path: 'data-management',
        loadComponent: () =>
          import('./features/data-management/data-management-page.component').then(
            (m) => m.DataManagementPageComponent,
          ),
        canActivate: [authGuard],
      },
      {
        path: 'test-plan-modeller',
        loadComponent: () =>
          import('./features/test-plan-modeller/test-plan-modeller-page.component').then(
            (m) => m.TestPlanModellerPageComponent,
          ),
        canActivate: [authGuard],
      },
      {
        path: 'test-results',
        loadComponent: () =>
          import('./features/test-results/test-results-page.component').then(
            (m) => m.TestResultsPageComponent,
          ),
        canActivate: [authGuard],
      },
      {
        path: 'test-results/:applicationId/:stageId/:testRunId',
        loadComponent: () =>
          import('./features/test-results/test-result-details-page.component').then(
            (m) => m.TestResultDetailsPageComponent,
          ),
        canActivate: [authGuard],
      },
      {
        path: 'metrics',
        loadComponent: () =>
          import('./features/metrics/metrics-page.component').then((m) => m.MetricsPageComponent),
        canActivate: [authGuard, metricsSelectionGuard],
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
