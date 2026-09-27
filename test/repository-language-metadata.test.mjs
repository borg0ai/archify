import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function linguistGenerated(relativePath) {
  const output = execFileSync(
    'git',
    ['check-attr', 'linguist-generated', '--', relativePath],
    { cwd: repoRoot, encoding: 'utf8' },
  ).trim();
  return output.slice(output.lastIndexOf(':') + 1).trim();
}

test('repository language metadata separates generated artifacts from implementation source', () => {
  for (const generatedPath of [
    'archify/assets/template.html',
    'archify/examples/web-app-rendered.html',
    'examples/web-app.html',
    'apps/site/cases/mco-runtime.architecture.html',
    'apps/site/gallery.html',
    'apps/site/gallery/artifacts/web-app.architecture.html',
    'apps/site/guide.html',
    'apps/site/start.html',
    'experiments/mco-showcase/mco-runtime.html',
    'archify/renderers/shared/generated-brand-marks.mjs',
    'archify/renderers/shared/generated-validators.mjs',
  ]) {
    assert.equal(
      linguistGenerated(generatedPath),
      'true',
      `${generatedPath} must be excluded from GitHub language statistics`,
    );
  }

  for (const sourcePath of [
    'templates/viewer/template.source.html',
    'templates/viewer/reader-layout.js',
    'templates/viewer/viewer-chrome-layout.js',
    'templates/viewer/viewer-camera.js',
    'templates/viewer/semantic-radar.js',
    'templates/viewer/motion-governor.js',
    'templates/viewer/node-finder.js',
    'templates/viewer/intent-trace.js',
    'templates/viewer/semantic-lens.js',
    'templates/viewer/route-probe.js',
    'templates/viewer/guided-views.js',
    'templates/viewer/focus.js',
    'templates/viewer/export.js',
    'templates/viewer/export-cleanup.js',
    'toolings/archify-dev/src/generate-viewer.ts',
    'toolings/archify-dev/src/cli.ts',
    'toolings/archify-dev/src/main.ts',
    'toolings/archify-dev/vite.config.ts',
    'apps/site/scripts/gallery-template.html',
    'apps/site/scripts/guide-template.html',
    'apps/site/scripts/start-template.html',
    'apps/site/index.html',
    'archify/renderers/shared/geometry.mjs',
  ]) {
    assert.equal(
      linguistGenerated(sourcePath),
      'unspecified',
      `${sourcePath} must remain visible as implementation source`,
    );
  }
});
