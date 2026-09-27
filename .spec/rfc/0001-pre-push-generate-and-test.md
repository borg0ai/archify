# RFC 0001: Run viewer generation and tests before push

**Status:** Draft

## Summary

Add a tracked Git `pre-push` hook that regenerates the Archify HTML viewer template and runs the repository's full `pnpm test` suite before allowing a push. If generation changes `archify/assets/template.html` relative to the commit being pushed, reject the push and require the generated artifact to be committed; never stage or commit it automatically.

## Problem

Viewer template source is assembled by the `archify-dev` workspace CLI, while `pnpm test` runs the workspace regression suite and freshness checks. A developer can push without invoking either command locally. CI can detect problems after the push, but cannot prevent publishing a commit with stale generated output.

## Goals

- Run viewer generation before each push.
- Run the existing complete `npm test` command before each push.
- Reject push when generation produces an artifact not represented by the current commit.
- Make hook activation reproducible for repository clones without adding a runtime dependency or shell wrapper.

## Non-goals

- Do not commit, stage, amend, or otherwise mutate Git history from the hook.
- Do not change CI's independent validation responsibilities.
- Do not run Tauri desktop-app builds as part of this hook.
- Do not add a second copy of existing test or viewer-generation logic.

## Design

Use a repository-managed `pre-push` hook implemented as a small Node entrypoint under `.githooks/`, with a Node-based setup command that configures this clone's `core.hooksPath`. Wire setup into the repository's existing pnpm install lifecycle so normal dependency installation activates the tracked hook. Keep hook logic to the ordered commands `pnpm generate:viewer`, `pnpm test`, then a check that `archify/assets/template.html` matches `HEAD`. Any non-zero command or artifact mismatch aborts push with a clear message. The hook must not silently stage the generated file; developer commits regenerated output, then retries push.

Alternative considered: add a Git-hook manager dependency. It simplifies installation but adds a dependency and its generated hook format may rely on shell glue, contrary to repository constraints. A manually installed, untracked `.git/hooks/pre-push` is also insufficient because clones would silently lack the guard. The tracked Node hook plus npm lifecycle bootstrap keeps implementation local and reproducible.

## Acceptance

- A fresh clone followed by normal `pnpm install` activates the tracked pre-push hook.
- Hook runs generation before the full existing test suite; any command failure blocks push.
- A successful generation that changes the committed output blocks push and reports how to regenerate, test, commit, and retry.
- When generated output already matches `HEAD` and tests pass, hook exits successfully and does not alter the index or commit.
- Hook tests cover command order, failure propagation, and generated-artifact mismatch without making a network push.
- Existing CI and viewer-generation checks remain passing.
