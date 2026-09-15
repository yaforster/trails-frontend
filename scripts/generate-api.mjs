import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';

const generatedRoot = join(root, 'src', 'app', 'generated');
const hateoasOutput = join(generatedRoot, 'hateoas');
const asyncapiOutput = join(generatedRoot, 'asyncapi');

function run(command, args) {
  execFileSync(isWindows ? `${command}.cmd` : command, args, {
    cwd: root,
    shell: isWindows,
    stdio: 'inherit',
  });
}

rmSync(hateoasOutput, { force: true, recursive: true });
rmSync(asyncapiOutput, { force: true, recursive: true });

run('openapi-ts', [
  '--input',
  './api/hateoas.yaml',
  '--output',
  './src/app/generated/hateoas',
  '--client',
  '@hey-api/client-angular',
]);

run('modelina', [
  'generate',
  'typescript',
  './api/asyncapi.yaml',
  '--output',
  './src/app/generated/asyncapi',
  '--tsModelType',
  'interface',
  '--tsEnumType',
  'union',
  '--tsExportType',
  'named',
]);

for (const file of readdirSync(asyncapiOutput)) {
  if (!file.endsWith('.ts')) {
    continue;
  }

  const path = join(asyncapiOutput, file);
  let source = readFileSync(path, 'utf8');
  source = source.replaceAll(/^import \{([^}]+)\} from/gm, 'import type {$1} from');
  source = source.replace(/^interface ([A-Za-z_$][\w$]*)/m, 'export interface $1');
  source = source.replace(/^type ([A-Za-z_$][\w$]*)/m, 'export type $1');
  source = source.replace(/^export \{ [A-Za-z_$][\w$]* \};\r?\n?/gm, '');
  writeFileSync(path, source);
}
