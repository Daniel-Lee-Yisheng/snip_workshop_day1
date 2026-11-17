import { spawnSync } from 'node:child_process';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundleDir = path.join(root, 'bundle');
const shouldPush = process.argv.slice(2).includes('--push');
const unknownArgs = process.argv.slice(2).filter((arg) => arg !== '--push');

if (unknownArgs.length) {
  throw new Error(`Unknown argument(s): ${unknownArgs.join(', ')}`);
}

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32' && ['npm', 'npx'].includes(command),
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function hasStagedChanges(cwd) {
  const result = spawnSync('git', ['diff', '--cached', '--quiet'], {
    cwd,
    stdio: 'ignore',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status === 0) {
    return false;
  }
  if (result.status === 1) {
    return true;
  }
  throw new Error(`git diff --cached failed with exit code ${result.status}`);
}

run('git', ['submodule', 'update', '--init', '--remote', 'backend', 'frontend', 'cli']);
run('npm', ['install'], path.join(root, 'frontend'));
run('npx', ['ng', 'build'], path.join(root, 'frontend'));

const frontendBuild = path.join(
  root,
  'frontend',
  'dist',
  'snip-frontend',
  'browser',
);
const indexPath = path.join(frontendBuild, 'index.html');
try {
  await import('node:fs/promises').then(({ access }) => access(indexPath));
} catch {
  throw new Error(`Angular build output is missing: ${indexPath}`);
}

await mkdir(bundleDir, { recursive: true });
await cp(path.join(root, 'backend', 'server.js'), path.join(bundleDir, 'server.js'));
await cp(path.join(root, 'cli', 'cli.js'), path.join(bundleDir, 'cli.js'));

const publicDir = path.join(bundleDir, 'public');
await rm(publicDir, { recursive: true, force: true });
await cp(frontendBuild, publicDir, { recursive: true });

const generatedFiles = new Map([
  [
    '.env',
    'PUBLIC_DIR=./public\n',
  ],
  [
    'package.json',
    `${JSON.stringify({ name: 'snip-bundle', private: true, scripts: { start: 'bun server.js' } }, null, 2)}\n`,
  ],
  [
    'Dockerfile',
    'FROM oven/bun:1-alpine\nCOPY . .\nENV PORT=3000\nEXPOSE 3000\nCMD ["bun", "server.js"]\n',
  ],
  [
    '.dockerignore',
    'node_modules\n.git\n*.log\n',
  ],
  [
    'railway.json',
    `${JSON.stringify(
      {
        '$schema': 'https://railway.com/railway.schema.json',
        build: { builder: 'DOCKERFILE' },
      },
      null,
      2,
    )}\n`,
  ],
]);

for (const [file, contents] of generatedFiles) {
  await writeFile(path.join(bundleDir, file), contents, 'utf8');
}

run('git', ['add', '-A'], bundleDir);
if (hasStagedChanges(bundleDir)) {
  run(
    'git',
    [
      'commit',
      '-m',
      'Regenerate Snip release bundle',
      '-m',
      'Co-authored-by: OpenBot <335604065+openbotgit[bot]@users.noreply.github.com>',
    ],
    bundleDir,
  );
} else {
  console.log('Bundle unchanged; nothing to commit.');
}

run('git', ['add', 'backend', 'frontend', 'cli', 'bundle'], root);
if (hasStagedChanges(root)) {
  run(
    'git',
    [
      'commit',
      '-m',
      'Update generated bundle and component pointers',
      '-m',
      'Co-authored-by: OpenBot <335604065+openbotgit[bot]@users.noreply.github.com>',
    ],
    root,
  );
} else {
  console.log('Superproject unchanged; nothing to commit.');
}

if (shouldPush) {
  run('git', ['push', 'origin', 'HEAD:bundle'], bundleDir);
  run('git', ['push', 'origin', 'HEAD:main'], root);
} else {
  console.log('Local commits created; rerun with --push to publish them.');
}
