# RFC 0003: Migrate Public Site to Vue and Vite

**Status:** Draft

## Summary

Move the public website from the root `docs/` publishing layout into `apps/site`, implemented as a Vue application built by Vite. Preserve current public page URLs and behavior while making `apps/site` the single owner of site components, styles, page assets, and site build logic. GitHub Pages publishes the Vite output from `apps/site/dist`. Root `templates/` remains exclusively for generating Archify assets under `archify/assets/`.

## Problem

The repository currently keeps public pages and generated site artifacts in `docs/`, page-generation templates and scripts in root `scripts/`, and deploys the entire `docs/` directory through GitHub Pages. The workspace has an `apps/viewer` Vite application but no `apps/site`. This splits site ownership across repository-level scripts, templates, and output files, and prevents the site from being developed and built as a workspace application.

## Goals

- Create `apps/site` as a Vue and Vite workspace application.
- Move public-site page source, styles, assets, and site-specific build logic under `apps/site`.
- Preserve existing public page URLs, language behavior, navigation, and published assets.
- Build deployable static output to `apps/site/dist` and have GitHub Pages publish that directory.
- Keep root `templates/` exclusively for Archify-generated assets under `archify/assets/`.

## Non-goals

- Do not redesign the public site or change its content and interaction behavior as part of relocation.
- Do not place site source or page templates under root `templates/`.
- Do not change Archify Skill runtime, generated Skill assets, or the Tauri app in `apps/viewer`.
- Do not move existing files out of root `test/`.
- Do not publish repository research notes or internal documentation merely because they currently live under `docs/`.

## Design

Create a pnpm workspace package at `apps/site` with Vue, Vite, and a multi-page build. Keep the existing public entry points (`index.html`, `gallery.html`, `guide.html`, and `start.html`) at their current URLs; use Vite multi-page inputs rather than introducing client-side routing or requiring server fallback behavior. Port each page shell and its interactive UI into Vue entry components while preserving current CSS, content, and browser behavior. Keep site-only source data and static assets within `apps/site`.

Move only public-site-owned inputs and build logic from `docs/` and root `scripts/` into `apps/site`. Keep non-site research and internal documents in root `docs/`. Root `templates/` must not contain site files and remains dedicated to generating files under `archify/assets/`. The site may consume published Archify artifacts as inputs, but must not read or modify root `templates/`.

Configure Vite's production base for the GitHub Pages project path and verify all internal links and assets resolve from the deployed subpath. Change `.github/workflows/ci.yml` to build `apps/site` after its checks and upload only `apps/site/dist` as the Pages artifact. Preserve deployment serialization, stale-run protection, environment permissions, and deploy-pages actions. Keep existing `docs/` release-manifest URLs available by emitting the required manifest at its current public path in the site output.

Add the site to `pnpm-workspace.yaml` and root orchestration. Keep existing root `test/` files in place; add app-specific tests under `apps/site` only for Vue page rendering, preserved routes, language/navigation behavior, and production asset paths.

## Acceptance

- `apps/site` is a Vue/Vite workspace package and its production build succeeds from the repository root.
- The built site preserves the existing homepage, gallery, guide, and start URLs, plus the stable update-manifest URL.
- GitHub Pages uploads `apps/site/dist`; no deployment step publishes root `docs/` wholesale.
- Production output works under the GitHub Pages repository subpath with no broken internal links or assets.
- Existing site content, language preference, navigation, and interaction checks pass without a visual redesign.
- Root `templates/` contains only inputs that generate files under `archify/assets/`; no site source is stored there.
- Existing root `test/` files remain in place, and the Archify Skill package boundary remains unchanged.
