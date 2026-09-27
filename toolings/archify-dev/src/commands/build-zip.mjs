#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const commandDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(commandDirectory, '../../../..');
const requestedOutput = process.argv[2] || path.join(repoRoot, 'archify.zip');
const windowsAbsolute = /^[A-Za-z]:[/\\]|^\\\\/.test(requestedOutput);
const output = path.resolve(windowsAbsolute ? path.win32.normalize(requestedOutput) : requestedOutput);
const nodeMajor = Number(process.versions.node.split('.')[0]);

if (nodeMajor !== 22) {
  throw new Error(`canonical archify.zip builds require Node 22 (current: ${process.versions.node})`);
}

const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-zip-'));
const skill = path.join(stage, 'archify');
const manifest = path.join(stage, 'modes.json');

function run(script, args, options = {}) {
  const result = spawnSync(process.execPath, [path.join(commandDirectory, script), ...args], {
    cwd: repoRoot,
    stdio: 'inherit',
    ...options,
  });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`${script} terminated by ${result.signal}`);
  if (result.status !== 0) throw new Error(`${script} failed with status ${result.status}`);
}

try {
  run('stage-clean-skill.mjs', ['--root', repoRoot, '--dest', skill, '--mode-manifest', manifest], {
    stdio: 'ignore',
  });
  run('write-deterministic-zip.mjs', [skill, output, '--mode-manifest', manifest]);
  console.log(`built ${output}`);
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
}
