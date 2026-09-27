import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  expectedLockImporters,
  missingWorkspaceImporters,
  PNPM_LOCKFILE,
  PNPM_WORKSPACE,
} from '../toolings/archify-dev/src/commands/pnpm-workspace-lock.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TURBO_TASKS = ['build:viewer', 'generate:viewer', 'check:viewer', 'test:skill', 'test', 'build', 'dev'];
const POSTINSTALL = 'pnpm --filter archify-dev run build && pnpm build:viewer';

test('pnpm workspace and Turborepo tasks cover the archify-dev package', () => {
  const rootPackage = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const devCli = JSON.parse(fs.readFileSync(path.join(repoRoot, 'toolings/archify-dev/package.json'), 'utf8'));
  const turbo = JSON.parse(fs.readFileSync(path.join(repoRoot, 'turbo.json'), 'utf8'));
  const workspace = fs.readFileSync(path.join(repoRoot, PNPM_WORKSPACE), 'utf8');
  const lock = fs.readFileSync(path.join(repoRoot, PNPM_LOCKFILE), 'utf8');

  assert.equal(rootPackage.packageManager, 'pnpm@10.27.0');
  assert.equal(rootPackage.scripts.test, 'pnpm --filter archify-dev test && pnpm run test:skill');
  assert.equal(rootPackage.scripts.dev, 'pangu');
  assert.equal(rootPackage.scripts.release, 'qingniao');
  const pangu = JSON.parse(fs.readFileSync(path.join(repoRoot, 'pangu.config.json'), 'utf8'));
  assert.equal(pangu.packageManager, 'pnpm');
  assert.deepEqual(pangu.demos.map((demo) => demo.package), ['archify-viewer', 'archify-site']);
  assert.equal(pangu.demos.some((demo) => demo.value === 'dev'), false);
  assert.equal(rootPackage.scripts.postinstall, POSTINSTALL);
  assert.equal(rootPackage.scripts['build:viewer'], 'turbo run build:viewer');
  assert.equal(rootPackage.scripts['generate:viewer'], 'turbo run generate:viewer');
  assert.equal(rootPackage.scripts['check:viewer'], 'turbo run check:viewer');
  assert.equal(fs.existsSync(path.join(repoRoot, 'package-lock.json')), false);
  assert.deepEqual(missingWorkspaceImporters(lock, expectedLockImporters(repoRoot, workspace)), []);
  assert.match(workspace, /toolings\/\*/);
  assert.equal(devCli.name, 'archify-dev');
  assert.match(devCli.scripts.build, /tsc --noEmit && vite build/);
  assert.match(devCli.scripts['build:viewer'], /dist\/archify-dev\.js viewer generate/);
  assert.match(devCli.scripts['generate:viewer'], /dist\/archify-dev\.js viewer generate/);
  assert.match(devCli.scripts['check:viewer'], /dist\/archify-dev\.js viewer check/);
  assert.match(devCli.scripts.test, /vitest run/);
  for (const task of TURBO_TASKS) {
    assert.ok(turbo.tasks[task], task);
  }
});

test('workspace lock importer check rejects a package missing from the lock', () => {
  const lock = "lockfileVersion: '9.0'\n\nimporters:\n\n  .:\n";
  assert.deepEqual(missingWorkspaceImporters(lock, ['.', 'apps/viewer']), ['apps/viewer']);
});
