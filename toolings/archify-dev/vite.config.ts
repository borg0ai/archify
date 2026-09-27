import type { LibraryFormats } from 'vite';
import { defineConfig } from 'vitest/config';

const CLI_ENTRY = 'src/main.ts';
const OUT_DIR = 'dist';
const OUT_NAME = 'archify-dev';
const NODE_TARGET = 'node18';
const SHEBANG = '#!/usr/bin/env node\n';
const CLI_FORMATS = ['es'] as const satisfies readonly LibraryFormats[];

function isNodeBuiltin(id: string): boolean {
  return id.startsWith('node:');
}

const TEST_INCLUDE = ['src/__tests__/**/*.test.ts'];

// Package build for the archify-dev command only. The desktop app keeps its own Vite config.
export default defineConfig({
  test: {
    include: TEST_INCLUDE,
    environment: 'node',
  },
  build: {
    lib: {
      entry: CLI_ENTRY,
      formats: [...CLI_FORMATS],
      fileName: OUT_NAME,
    },
    outDir: OUT_DIR,
    emptyOutDir: true,
    minify: false,
    target: NODE_TARGET,
    rolldownOptions: {
      external: isNodeBuiltin,
      output: {
        banner: SHEBANG,
      },
    },
  },
});
