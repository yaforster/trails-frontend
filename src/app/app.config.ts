import { provideTaiga } from '@taiga-ui/core';
import {
  ApplicationConfig,
  ENVIRONMENT_INITIALIZER,
  inject,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';

import { HATEOAS_API_BASE_URL } from './core/api-config';
import { client as hateoasClient } from './generated/hateoas/client.gen';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        hateoasClient.setConfig({
          baseUrl: inject(HATEOAS_API_BASE_URL),
        });
      },
    },
    provideHttpClient(),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideTaiga(),
  ],
};
