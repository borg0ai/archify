import fs from 'node:fs';
import path from 'node:path';

export const PNPM_LOCKFILE = 'pnpm-lock.yaml';
export const PNPM_WORKSPACE = 'pnpm-workspace.yaml';

const DEPENDENCY_FIELDS = Object.freeze([
  'dependencies',
  'devDependencies',
  'optionalDependencies',
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// pnpm omits a workspace package from the lock until it has dependencies.
export function expectedLockImporters(repoRoot, workspaceSource) {
  const importers = ['.'];
  const globs = [...workspaceSource.matchAll(/-\s+"([^"]+)"/g)].map((match) => match[1]);
  for (const pattern of globs) {
    if (!pattern.endsWith('/*')) continue;
    const parent = path.join(repoRoot, pattern.slice(0, -2));
    if (!fs.existsSync(parent)) continue;
    for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(parent, entry.name, 'package.json');
      if (!fs.existsSync(manifestPath)) continue;
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const hasDependencies = DEPENDENCY_FIELDS.some((field) => (
        manifest[field] && Object.keys(manifest[field]).length > 0
      ));
      if (hasDependencies) importers.push(path.posix.join(pattern.slice(0, -2), entry.name));
    }
  }
  return importers;
}

export function missingWorkspaceImporters(lockSource, importers) {
  const missing = [];
  if (!lockSource.includes('lockfileVersion:')) missing.push('lockfileVersion');
  for (const importer of importers) {
    if (!new RegExp(`^  ${escapeRegExp(importer)}:$`, 'm').test(lockSource)) missing.push(importer);
  }
  return missing;
}
