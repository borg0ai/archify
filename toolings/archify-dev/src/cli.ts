import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateViewerTemplate,
  SHELL_FILENAME,
  TEMPLATE_OUTPUT,
  TEMPLATE_VIEWER,
} from './generate-viewer.ts';

export const COMMAND_VIEWER = 'viewer';
export const ACTION_GENERATE = 'generate';
export const ACTION_CHECK = 'check';
export const FLAG_ROOT = '--root';
export const USAGE = [
  'Usage: archify-dev viewer generate [--root <dir>]',
  '       archify-dev viewer check [--root <dir>]',
  '       archify-dev release check-identity [args...]',
  '       archify-dev release check-stable-manifest [args...]',
  '       archify-dev package stage [args...]',
  '       archify-dev package smoke [args...]',
  '       archify-dev package zip [args...]',
  '       archify-dev test skill',
].join('\n');

const VIEWER_ACTIONS = new Set<string>([ACTION_GENERATE, ACTION_CHECK]);
const SCRIPT_COMMANDS = new Map<string, string>([
  ['release check-identity', 'check-release-identity'],
  ['release check-stable-manifest', 'check-stable-update-manifest'],
  ['package stage', 'stage-clean-skill'],
  ['package smoke', 'package-smoke'],
  ['package zip', 'build-zip'],
  ['test skill', 'run-tests'],
]);

export type ParsedDevCli = {
  readonly kind: 'viewer';
  readonly check: boolean;
  readonly repoRoot: string;
} | {
  readonly kind: 'script';
  readonly command: string;
  readonly args: readonly string[];
};

// Walk parents until templates/viewer/template.source.html exists.
export function findRepoRoot(start: string): string {
  let current = path.resolve(start);
  const filesystemRoot = path.parse(current).root;
  while (true) {
    if (fs.existsSync(path.join(current, TEMPLATE_VIEWER, SHELL_FILENAME))) return current;
    if (current === filesystemRoot) break;
    current = path.dirname(current);
  }
  throw new Error(`Could not find ${TEMPLATE_VIEWER} from ${start}.`);
}

export function parseDevCliArgs(argv: readonly string[], cwd = process.cwd()): ParsedDevCli {
  const [command, action, ...rest] = argv;
  const script = action ? SCRIPT_COMMANDS.get(`${command} ${action}`) : undefined;
  if (script) return { kind: 'script', command: script, args: rest };
  if (command !== COMMAND_VIEWER || !action || !VIEWER_ACTIONS.has(action)) throw new Error(USAGE);
  let root: string | undefined;
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] !== FLAG_ROOT) throw new Error(USAGE);
    const value = rest[index + 1];
    if (!value || value.startsWith('-')) throw new Error(USAGE);
    if (root) throw new Error(USAGE);
    root = path.resolve(value);
    index += 1;
  }
  return {
    kind: 'viewer',
    check: action === ACTION_CHECK,
    repoRoot: root ?? findRepoRoot(cwd),
  };
}

export function runDevCli(argv: readonly string[], cwd = process.cwd()): void {
  const options = parseDevCliArgs(argv, cwd);
  if (options.kind === 'viewer') {
    generateViewerTemplate(options.repoRoot, { check: options.check });
    if (!options.check) console.log(`generated ${TEMPLATE_OUTPUT}`);
    return;
  }
  const cliDirectory = path.dirname(fileURLToPath(import.meta.url));
  const sourceDirectory = path.basename(cliDirectory) === 'dist'
    ? path.resolve(cliDirectory, '../src')
    : cliDirectory;
  const scriptPath = path.join(sourceDirectory, 'commands', `${options.command}.mjs`);
  const result = spawnSync(process.execPath, [scriptPath, ...options.args], {
    cwd,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`archify-dev command terminated by ${result.signal}`);
  process.exitCode = result.status ?? 1;
}
