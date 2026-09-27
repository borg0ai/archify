import fs from 'node:fs';
import path from 'node:path';

// Skill HTML fragments. Not the desktop app in apps/viewer.
export const TEMPLATE_VIEWER = 'templates/viewer';
export const TEMPLATE_OUTPUT = 'archify/assets/template.html';
export const SHELL_FILENAME = 'template.source.html';
export const EXPORT_FILENAME = 'export.js';
export const CLEANUP_MARKER = '/* ARCHIFY:EXPORT_CLEANUP */';
export const STALE_TEMPLATE_MESSAGE = 'Viewer template is stale — run pnpm generate:viewer from repository root.';

export interface ViewerFragment {
  readonly marker: string;
  readonly filename: string;
}

export const FRAGMENTS: readonly ViewerFragment[] = Object.freeze([
  Object.freeze({ marker: '/* ARCHIFY:EXPORT */', filename: EXPORT_FILENAME }),
  Object.freeze({ marker: '/* ARCHIFY:READER_LAYOUT */', filename: 'reader-layout.js' }),
  Object.freeze({ marker: '/* ARCHIFY:CHROME_LAYOUT */', filename: 'viewer-chrome-layout.js' }),
  Object.freeze({ marker: '/* ARCHIFY:CAMERA */', filename: 'viewer-camera.js' }),
  Object.freeze({ marker: '/* ARCHIFY:RADAR */', filename: 'semantic-radar.js' }),
  Object.freeze({ marker: '/* ARCHIFY:MOTION_GOVERNOR */', filename: 'motion-governor.js' }),
  Object.freeze({ marker: '/* ARCHIFY:NODE_FINDER */', filename: 'node-finder.js' }),
  Object.freeze({ marker: '/* ARCHIFY:FOCUS */', filename: 'focus.js' }),
  Object.freeze({ marker: '/* ARCHIFY:INTENT_TRACE */', filename: 'intent-trace.js' }),
  Object.freeze({ marker: '/* ARCHIFY:SEMANTIC_LENS */', filename: 'semantic-lens.js' }),
  Object.freeze({ marker: '/* ARCHIFY:ROUTE_PROBE */', filename: 'route-probe.js' }),
  Object.freeze({ marker: '/* ARCHIFY:GUIDED_VIEWS */', filename: 'guided-views.js' }),
  Object.freeze({ marker: CLEANUP_MARKER, filename: 'export-cleanup.js' }),
]);

export type ReadViewerSource = (filename: string) => string;

// readSource returns fragment text. Callers own the filesystem.
export function assembleViewerTemplate(readSource: ReadViewerSource): string {
  let generated = readSource(SHELL_FILENAME);
  for (const { marker, filename } of FRAGMENTS) {
    const source = readSource(filename);
    const parts = generated.split(marker);
    if (parts.length !== 2) throw new Error(`Viewer source must contain exactly one ${filename} marker.`);
    // Export owns the sole nested fragment; expand it before Cleanup.
    const childMarker = filename === EXPORT_FILENAME ? CLEANUP_MARKER : null;
    if (!source.trim() || (childMarker && source.split(childMarker).length !== 2) ||
        FRAGMENTS.some((fragment) => source.includes(fragment.marker) && fragment.marker !== childMarker)) {
      throw new Error(`${filename} source is empty or contains an unresolved marker.`);
    }
    // Preserve classic-script scope, execution position and literal source bytes,
    // including characters with String.replace semantics.
    generated = parts[0] + source + parts[1];
  }
  return generated;
}

export interface GenerateViewerOptions {
  readonly check?: boolean;
}

// check compares bytes and does not write. generate replaces the artifact atomically.
export function generateViewerTemplate(repoRoot: string, { check = false }: GenerateViewerOptions = {}): void {
  const sourceRoot = path.join(repoRoot, TEMPLATE_VIEWER);
  const output = path.join(repoRoot, TEMPLATE_OUTPUT);
  const generated = assembleViewerTemplate((filename) => fs.readFileSync(path.join(sourceRoot, filename), 'utf8'));
  if (check) {
    if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== generated) {
      throw new Error(STALE_TEMPLATE_MESSAGE);
    }
    return;
  }
  const temporary = `${output}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, generated);
    fs.renameSync(temporary, output);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}
