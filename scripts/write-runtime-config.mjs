import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const envFilePath = resolve(process.env.TRAILS_FRONTEND_ENV_FILE ?? 'trails-frontend.env');
const outputPath = resolve('public/trails-frontend-config.js');
const requiredVariables = ['TRAILS_API_BASE_URL', 'TRAILS_KEYCLOAK_TOKEN_URL'];

const envValues = {
  ...readEnvFile(envFilePath),
  ...readProcessEnv(requiredVariables),
};

for (const variable of requiredVariables) {
  if (!envValues[variable]) {
    throw new Error(
      `Missing ${variable}. Configure it in trails-frontend.env or the process environment.`,
    );
  }
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, toRuntimeConfig(envValues), 'utf8');
console.log(`Wrote ${outputPath}`);

function readEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .reduce((values, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        return values;
      }

      const separatorIndex = trimmed.indexOf('=');

      if (separatorIndex < 1) {
        return values;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();

      values[key] = unquote(value);
      return values;
    }, {});
}

function readProcessEnv(keys) {
  return keys.reduce((values, key) => {
    const value = process.env[key];

    if (value !== undefined) {
      values[key] = value;
    }

    return values;
  }, {});
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function toRuntimeConfig(values) {
  return `window.__TRAILS_FRONTEND_CONFIG__ = ${JSON.stringify(
    {
      trailsApiBaseUrl: values.TRAILS_API_BASE_URL,
      keycloakTokenUrl: values.TRAILS_KEYCLOAK_TOKEN_URL,
    },
    null,
    2,
  )};\n`;
}
