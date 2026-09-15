import { InjectionToken, inject } from '@angular/core';

export type TrailsFrontendRuntimeConfig = {
  trailsApiBaseUrl: string;
  keycloakTokenUrl: string;
};

declare global {
  interface Window {
    __TRAILS_FRONTEND_CONFIG__?: Partial<TrailsFrontendRuntimeConfig>;
  }
}

export const TRAILS_FRONTEND_CONFIG = new InjectionToken<TrailsFrontendRuntimeConfig>(
  'TRAILS_FRONTEND_CONFIG',
  {
    providedIn: 'root',
    factory: () => readRuntimeConfig(),
  },
);

export const HATEOAS_API_BASE_URL = new InjectionToken<string>('HATEOAS_API_BASE_URL', {
  providedIn: 'root',
  factory: () => inject(TRAILS_FRONTEND_CONFIG).trailsApiBaseUrl,
});

export const KEYCLOAK_TOKEN_URL = new InjectionToken<string>('KEYCLOAK_TOKEN_URL', {
  providedIn: 'root',
  factory: () => inject(TRAILS_FRONTEND_CONFIG).keycloakTokenUrl,
});

function readRuntimeConfig(): TrailsFrontendRuntimeConfig {
  const config: Partial<TrailsFrontendRuntimeConfig> | undefined =
    typeof window === 'undefined' ? undefined : window.__TRAILS_FRONTEND_CONFIG__;

  if (!config?.trailsApiBaseUrl || !config.keycloakTokenUrl) {
    throw new Error('Missing frontend runtime configuration. Check trails-frontend-config.js.');
  }

  return {
    trailsApiBaseUrl: config.trailsApiBaseUrl,
    keycloakTokenUrl: config.keycloakTokenUrl,
  };
}
