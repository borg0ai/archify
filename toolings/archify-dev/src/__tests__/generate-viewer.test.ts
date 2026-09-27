import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { onTestFinished, test } from 'vitest';
import assert from 'node:assert/strict';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const TEMPLATE_VIEWER = 'templates/viewer';
const ARCHIFY_DEV = path.join(repoRoot, 'toolings/archify-dev/dist/archify-dev.js');
const COMMAND_VIEWER = 'viewer';
const ACTION_GENERATE = 'generate';
const ACTION_CHECK = 'check';
const FLAG_ROOT = '--root';
const FLAG_CHECK = '--check';
const marker = '/* ARCHIFY:READER_LAYOUT */';
const exportMarker = '/* ARCHIFY:EXPORT */';
const cleanupMarker = '/* ARCHIFY:EXPORT_CLEANUP */';
const chromeMarker = '/* ARCHIFY:CHROME_LAYOUT */';
const cameraMarker = '/* ARCHIFY:CAMERA */';
const radarMarker = '/* ARCHIFY:RADAR */';
const motionMarker = '/* ARCHIFY:MOTION_GOVERNOR */';
const finderMarker = '/* ARCHIFY:NODE_FINDER */';
const intentMarker = '/* ARCHIFY:INTENT_TRACE */';
const lensMarker = '/* ARCHIFY:SEMANTIC_LENS */';
const routeMarker = '/* ARCHIFY:ROUTE_PROBE */';
const focusMarker = '/* ARCHIFY:FOCUS */';
const guidedMarker = '/* ARCHIFY:GUIDED_VIEWS */';
const fragments: Record<string, string> = {
  export: exportMarker,
  reader: marker,
  cleanup: cleanupMarker,
  chrome: chromeMarker,
  camera: cameraMarker,
  radar: radarMarker,
  motion: motionMarker,
  finder: finderMarker,
  intent: intentMarker,
  lens: lensMarker,
  route: routeMarker,
  guided: guidedMarker,
  focus: focusMarker,
};

interface ViewerFixture {
  root: string;
  output: string;
  shell: string;
  export: string;
  reader: string;
  cleanup: string;
  chrome: string;
  camera: string;
  radar: string;
  motion: string;
  finder: string;
  intent: string;
  lens: string;
  route: string;
  guided: string;
  focus: string;
  run: (...args: string[]) => SpawnSyncReturns<string>;
}

function fixtureFile(current: ViewerFixture, name: string): string {
  const value = current[name as keyof ViewerFixture];
  if (typeof value !== 'string') throw new Error(`Fixture has no file ${name}.`);
  return value;
}

function fixture(): ViewerFixture {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-viewer-build-'));
  onTestFinished(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'archify/assets'), { recursive: true });
  fs.mkdirSync(path.join(root, 'templates'), { recursive: true });
  fs.cpSync(path.join(repoRoot, TEMPLATE_VIEWER), path.join(root, TEMPLATE_VIEWER), { recursive: true });
  const output = path.join(root, 'archify/assets/template.html');
  fs.copyFileSync(path.join(repoRoot, 'archify/assets/template.html'), output);
  return {
    root, output,
    shell: path.join(root, TEMPLATE_VIEWER, 'template.source.html'),
    export: path.join(root, TEMPLATE_VIEWER, 'export.js'),
    reader: path.join(root, TEMPLATE_VIEWER, 'reader-layout.js'),
    cleanup: path.join(root, TEMPLATE_VIEWER, 'export-cleanup.js'),
    chrome: path.join(root, TEMPLATE_VIEWER, 'viewer-chrome-layout.js'),
    camera: path.join(root, TEMPLATE_VIEWER, 'viewer-camera.js'),
    radar: path.join(root, TEMPLATE_VIEWER, 'semantic-radar.js'),
    motion: path.join(root, TEMPLATE_VIEWER, 'motion-governor.js'),
    finder: path.join(root, TEMPLATE_VIEWER, 'node-finder.js'),
    intent: path.join(root, TEMPLATE_VIEWER, 'intent-trace.js'),
    lens: path.join(root, TEMPLATE_VIEWER, 'semantic-lens.js'),
    route: path.join(root, TEMPLATE_VIEWER, 'route-probe.js'),
    guided: path.join(root, TEMPLATE_VIEWER, 'guided-views.js'),
    focus: path.join(root, TEMPLATE_VIEWER, 'focus.js'),
    run: (...args) => {
      // Unknown flags must fail before any --root default can touch the fixture.
      if (args.some((arg) => arg !== FLAG_CHECK)) {
        return spawnSync(process.execPath, [ARCHIFY_DEV, ...args], { cwd: os.tmpdir(), encoding: 'utf8' });
      }
      const action = args.includes(FLAG_CHECK) ? ACTION_CHECK : ACTION_GENERATE;
      return spawnSync(process.execPath, [ARCHIFY_DEV, COMMAND_VIEWER, action, FLAG_ROOT, root], {
        cwd: os.tmpdir(), encoding: 'utf8',
      });
    },
  };
}

test('the committed Viewer rebuilds deterministically outside the repository working directory', () => {
  const f = fixture();
  const baseline = fs.readFileSync(f.output);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const generated = f.run();
    assert.equal(generated.status, 0, generated.stderr);
    assert.deepEqual(fs.readFileSync(f.output), baseline);
  }
  const beforeCheck = fs.statSync(f.output).mtimeMs;
  const checked = f.run('--check');
  assert.equal(checked.status, 0, checked.stderr);
  assert.equal(fs.statSync(f.output).mtimeMs, beforeCheck, '--check must not rewrite output');
});

test('editing any authoritative source requires explicit regeneration', () => {
  const f = fixture();
  for (const input of [f.shell, f.export, f.reader, f.cleanup, f.chrome, f.camera, f.radar, f.motion, f.finder, f.intent, f.lens, f.route, f.guided, f.focus]) {
    const previous = fs.readFileSync(f.output);
    fs.appendFileSync(input, '\n/* source change */\n');
    const stale = f.run('--check');
    assert.equal(stale.status, 1);
    assert.match(stale.stderr ?? '', /stale.*generate:viewer/);
    assert.deepEqual(fs.readFileSync(f.output), previous);
    assert.equal(f.run().status, 0);
    assert.equal(f.run('--check').status, 0);
    assert.notDeepEqual(fs.readFileSync(f.output), previous);
  }
});

test('a missing generated template is stale and can be regenerated', () => {
  const f = fixture();
  fs.unlinkSync(f.output);
  assert.equal(f.run('--check').status, 1);
  assert.equal(fs.existsSync(f.output), false);
  assert.equal(f.run().status, 0);
  assert.equal(f.run('--check').status, 0);
});

for (const [fragment, slot] of Object.entries(fragments)) {
  for (const failure of ['missing shell', 'missing fragment', 'missing marker', 'duplicate marker', 'empty fragment', ...Object.keys(fragments).map((name) => `${name} marker`)]) {
    test(`assembly rejects ${fragment}: ${failure} without overwriting a valid artifact`, () => {
      const f = fixture();
      const previous = fs.readFileSync(f.output);
      if (failure === 'missing shell') fs.unlinkSync(f.shell);
      if (failure === 'missing fragment') fs.unlinkSync(fixtureFile(f, fragment));
      const owner = fragment === 'cleanup' ? f.export : f.shell;
      if (failure === 'missing marker') fs.writeFileSync(owner, fs.readFileSync(owner, 'utf8').replace(slot, ''));
      if (failure === 'duplicate marker') fs.appendFileSync(owner, slot);
      if (failure === 'empty fragment') fs.writeFileSync(fixtureFile(f, fragment), ' \n');
      const embeddedSlot = fragments[failure.replace(/ marker$/, '')];
      if (embeddedSlot) fs.appendFileSync(fixtureFile(f, fragment), embeddedSlot);
      for (const args of [[], [FLAG_CHECK]] as const) {
        const result = f.run(...args);
        assert.equal(result.status, 1, failure);
        assert.match(result.stderr ?? '', /ENOENT|marker|empty/);
        assert.deepEqual(fs.readFileSync(f.output), previous);
        assert.deepEqual(fs.readdirSync(path.dirname(f.output)), ['template.html']);
      }
    });
  }
}

test('assembly preserves literal replacement tokens, Unicode and source line endings', () => {
  const f = fixture();
  const reader = '// $& $\' $` $$ 中文 \u{1f5fa}\r\n(function () {})();\r\n';
  fs.writeFileSync(f.shell, `<script>\r\n${focusMarker}${guidedMarker}${routeMarker}${lensMarker}${intentMarker}${finderMarker}${motionMarker}${radarMarker}${cameraMarker}${chromeMarker}${exportMarker}${marker}</script>\n`);
  fs.writeFileSync(f.export, reader + cleanupMarker);
  fs.writeFileSync(f.cleanup, reader);
  fs.writeFileSync(f.chrome, reader);
  fs.writeFileSync(f.camera, reader);
  fs.writeFileSync(f.radar, reader);
  fs.writeFileSync(f.motion, reader);
  fs.writeFileSync(f.finder, reader);
  fs.writeFileSync(f.intent, reader);
  fs.writeFileSync(f.lens, reader);
  fs.writeFileSync(f.route, reader);
  fs.writeFileSync(f.guided, reader);
  fs.writeFileSync(f.focus, reader);
  fs.writeFileSync(f.reader, reader);
  assert.equal(f.run().status, 0);
  assert.equal(fs.readFileSync(f.output, 'utf8'), `<script>\r\n${reader}${reader}${reader}${reader}${reader}${reader}${reader}${reader}${reader}${reader}${reader}${reader}${reader}</script>\n`);
  assert.equal(f.run('--check').status, 0);
});

test('an invalid invocation cannot silently regenerate the template', () => {
  const f = fixture();
  const previous = fs.readFileSync(f.output);
  const result = f.run('--chek');
  assert.equal(result.status, 1);
  assert.match(result.stderr ?? '', /Usage:/);
  assert.deepEqual(fs.readFileSync(f.output), previous);
});

test('viewer check uses the working directory when --root is omitted', () => {
  const f = fixture();
  const beforeCheck = fs.statSync(f.output).mtimeMs;
  const checked = spawnSync(process.execPath, [ARCHIFY_DEV, COMMAND_VIEWER, ACTION_CHECK], {
    cwd: f.root,
    encoding: 'utf8',
  });
  assert.equal(checked.status, 0, checked.stderr);
  assert.equal(fs.statSync(f.output).mtimeMs, beforeCheck);
});

for (const placement of ['additional shell slot', 'moved to shell']) {
  test(`Cleanup ownership rejects ${placement} without overwriting output`, () => {
    const f = fixture();
    const previous = fs.readFileSync(f.output);
    fs.appendFileSync(f.shell, cleanupMarker);
    if (placement === 'moved to shell') {
      fs.writeFileSync(f.export, fs.readFileSync(f.export, 'utf8').replace(cleanupMarker, ''));
    }
    for (const args of [[], [FLAG_CHECK]] as const) {
      const result = f.run(...args);
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr ?? '', /marker/);
      assert.deepEqual(fs.readFileSync(f.output), previous);
      assert.deepEqual(fs.readdirSync(path.dirname(f.output)), ['template.html']);
    }
  });
}
