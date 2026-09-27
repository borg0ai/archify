import assert from 'node:assert/strict';
import { test } from 'vitest';
import { parseDevCliArgs } from '../cli.ts';

test('release identity command routes into archify-dev and preserves arguments', () => {
  assert.deepEqual(parseDevCliArgs(['release', 'check-identity', '--root', '/repo']), {
    kind: 'script',
    command: 'check-release-identity',
    args: ['--root', '/repo'],
  });
});

test('development commands route to their sole command modules', () => {
  const cases = [
    [['release', 'check-stable-manifest', '--root', '/repo'], 'check-stable-update-manifest'],
    [['package', 'stage', '--dest', '/tmp/skill'], 'stage-clean-skill'],
    [['package', 'smoke', '/tmp/skill'], 'package-smoke'],
    [['package', 'zip', '/tmp/skill.zip'], 'build-zip'],
    [['test', 'skill'], 'run-tests'],
  ] as const;

  for (const [args, command] of cases) {
    assert.deepEqual(parseDevCliArgs(args), {
      kind: 'script',
      command,
      args: args.slice(2),
    });
  }
});
