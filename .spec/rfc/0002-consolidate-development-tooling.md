# RFC 0002: Consolidate development CLI, templates, and tests

**Status:** Approved

## Summary

Define stable repository boundaries for Archify asset templates, development tooling, and tests. Root `templates/` owns only inputs used to generate assets under `archify/assets/`; it does not own public-site source. `toolings/archify-dev` becomes the developer-facing Archify build/generation/check CLI; root `test/` remains in place for Archify content and shipped Skill/runtime behavior. Root package scripts and CI orchestrate commands without duplicating implementations. Public-site ownership and deployment are specified separately in [RFC 0003](0003-migrate-site-to-vue-vite.md).

## Problem

The repository is moving to a pnpm monorepo, but Archify asset generation and developer tooling still span root `scripts/`, the Viewer source fragments, `toolings/archify-dev`, and root `test/`. This makes it unclear where new Skill asset generators and reusable development checks belong. The current Viewer generator is already partly in `toolings/archify-dev`, while its source fragments and tests remain elsewhere. Public-site code is a separate application concern and is explicitly excluded here; RFC 0003 owns it.

## Goals

- Make root `templates/` the canonical home only for source templates that generate committed files under `archify/assets/`.
- Make `toolings/archify-dev` the canonical home and CLI entry point for developer-only build, generation, and check commands.
- Keep `toolings/archify-dev` implementation tests with that package so its command behavior remains directly testable.
- Keep all Archify content and shipped Skill/runtime tests in root `test/`, including tests that invoke `archify/scripts/archify.mjs`.
- Keep root package scripts and CI as thin orchestration entry points.
- Preserve generated artifact paths and ensure generation remains reproducible.

## Non-goals

- Do not move runtime files shipped inside `archify/` into the developer tooling package.
- Do not place public-site source or templates in root `templates/`; public-site ownership belongs to `apps/site` under RFC 0003.
- Do not move the Tauri desktop application into `templates/` or make it responsible for generating Skill assets.
- Do not change generated asset content or consumer behavior as part of file relocation alone.
- Do not duplicate tests between root `test/` and `toolings/archify-dev`.
- Do not combine pre-push hook implementation from RFC 0001 into this RFC; root commands remain callable by that hook.

## Design

Use current `toolings/archify-dev` as the developer CLI, not a second `cli/` package. Add commands by moving development-only script logic behind this CLI's command modules; keep root `package.json` and CI command names as stable delegators where practical.

Move only the Viewer source fragments currently in `template/viewer/` into root `templates/viewer/`. These are the only inputs owned by root `templates/` in this RFC, and the generator writes their assembled output to `archify/assets/template.html`. Public-site pages, assets, and build inputs are not Archify asset templates; they belong to `apps/site` and are covered by RFC 0003.

Move Archify developer-only build, generation, packaging, and repository-check implementations currently under root `scripts/` into `toolings/archify-dev`; site-owned build and page-generation code is excluded and belongs to `apps/site`. Keep executable command parsing thin and extract testable logic into modules. Tests for `toolings/archify-dev` live with that package. Root `test/` files stay in place, including `test/cli.test.mjs`, which verifies shipped Skill behavior through its command entry point. Do not move or split root test content. `archify/scripts/` remains the installed Skill's runtime implementation and is not itself moved into the developer tooling package.

Classify each existing script and test by what it exercises before adding or changing coverage. Do not move any existing file out of root `test/`; that tree remains Archify content and shipped Skill/runtime coverage, including `test/cli.test.mjs`. Tests added for `toolings/archify-dev` belong in that package. Relocations must update imports, package manifests, Turbo tasks, CI, documentation, and fixtures in the same migration slice. Keep one-way source-to-generated flow and verify existing output bytes where relocation should be behavior-neutral.

## Acceptance

- Every source template used to generate files under `archify/assets/` is under root `templates/`; site source is excluded. Generators do not edit source templates or consume generated output as input.
- Every developer-only build/generate/check command has one implementation under `toolings/archify-dev`; root package scripts and CI delegate to it rather than maintaining parallel logic.
- Tests for `toolings/archify-dev` reside with that package; all root `test/` files remain Archify content, shipped runtime, or generated-artifact tests.
- Runtime files required by the installed Skill remain under `archify/`; Tauri app sources remain under `apps/viewer/`.
- Workspace build and test orchestration succeeds from the repository root, with coverage for command success, failure, and output freshness.
- Relocating existing templates and generators preserves generated artifact bytes unless an explicitly reviewed behavior change is included.
