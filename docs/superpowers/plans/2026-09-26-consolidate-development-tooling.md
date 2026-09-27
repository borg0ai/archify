# RFC 0002 Implementation Plan

**Goal:** Move generated-asset templates and developer-only tooling into clear workspace boundaries while keeping Archify runtime and root behavior tests intact.

**Architecture:** Keep `archify/` as the shipped Skill runtime. Put development commands and their tests in `toolings/archify-dev`, with root pnpm/Turbo/CI scripts delegating to that package. Put generator inputs under root `templates/`; generated outputs retain current consumer paths.

**Tech Stack:** Node.js, TypeScript, pnpm workspaces, Turborepo, Vitest, Node test runner.

**Spec:** `.spec/rfc/0002-consolidate-development-tooling.md`

## Global Constraints

- Do not add shell-script wrappers; implement migrated commands in JavaScript/TypeScript.
- Keep Archify runtime under `archify/` and Tauri Viewer under `apps/viewer/`.
- Keep generated asset paths and bytes unchanged for relocation-only changes.
- Keep root package scripts and CI as thin delegators.
- Keep all root `test/` files in place as Archify content/shipped-runtime coverage.
- Do not use `examples/` as Birdify architecture evidence.
- Preserve existing worktree changes; touch only RFC 0002 scope.

## Review Focus

- Generator migration must preserve byte-identical output at existing consumer paths.
- Template moves must not leave stale path literals in tooling, docs, or tests.
- `test/cli.test.mjs` exercises shipped Skill behavior through its command entry point; keep it in root `test/`.
- Do not move any existing file out of root `test/`; add new `archify-dev` tests under its package.

## Tasks

### Task 1: Move canonical templates

**Files:**
- Move only Archify's `template/viewer/*` asset sources to `templates/viewer/*`.
- Keep public-site source, templates, and page-build logic out of root `templates/` and `archify-dev`; RFC 0003 assigns them to `apps/site`.
- Modify `toolings/archify-dev/src/generate-viewer.ts` and its tests.
- Update Viewer generator modules, command delegators, and references in `CONTRIBUTING.md`, `README.md`, and tests.

- [x] Update generator source constants and template imports to new canonical paths.
- [x] Keep generated artifacts at current paths; compare bytes before and after relocation.
- [x] Update template path assertions and documentation references.

### Task 2: Consolidate developer commands

**Files:**
- Move Archify developer-only implementations from root `scripts/` into command modules under `toolings/archify-dev/src/`; leave site-owned build code for RFC 0003 and deployment-only commands with deployment workflows.
- Modify `toolings/archify-dev/src/cli.ts`, `main.ts`, and `package.json`.
- Modify root `package.json`, `turbo.json`, `.github/workflows/ci.yml`, `.github/workflows/dsh.yml`, and contributor documentation.
- Replace `scripts/build-zip.sh` with a JavaScript/TypeScript CLI command; keep deployment-only `scripts/publish-star-history.sh` outside the developer CLI.

- [x] Classify every root script by runtime, developer command, or deployment ownership.
- [x] Add command modules for generation, repository checks, package staging, and deterministic ZIP output that currently live in root scripts.
- [x] Keep root script names as thin pnpm delegators where compatibility needs them; remove duplicate implementations.
- [x] Update all direct callers, imports, CI paths, and documentation references found by repository search.

### Task 3: Preserve root test ownership

**Files:**
- Keep `test/cli.test.mjs` and all Archify content/runtime/generated-artifact tests in root `test/`.
- Keep existing `toolings/archify-dev/src/__tests__/generate-viewer.test.ts` with its package.
- Keep every existing file in root `test/`; developer-tool tests stay in their package.
- Update root test imports in place if moved implementations require new module paths.

- [x] Keep all existing root tests in place; `test/cli.test.mjs` remains Archify Skill behavior coverage.
- [x] Keep developer CLI tests with `toolings/archify-dev`; add coverage there only if migration needs it.
- [x] Update root test imports in place after moving implementations; do not relocate or duplicate root tests.

### Task 4: Validate migration

- [x] Run `pnpm --filter archify-dev test`.
- [x] Run `pnpm test` from repository root.
- [x] Run the tracked Skill staging/package smoke check and confirm root tests remain outside shipped Skill artifacts.
- [x] Re-run template freshness checks and compare generated output bytes against pre-migration outputs.
- [x] Run RFC validation and `.spec` sync check after confirming RFC and plan alignment.
- [x] Review final diff for stale root-script/template references and unrelated changes.
