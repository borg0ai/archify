# Why: main

<!-- reasongraph:v1 generated 2026-09-27 — review before sharing; edit freely, edits are preserved -->

## Intent
Move standalone scripts out of scripts/ into the archify-dev workspace package and retarget package scripts, tests, and callers, keeping command behavior the same.

## Decisions

### Relocate standalone scripts into archify-dev command modules
Status: discussed
Touches: `scripts/*.mjs`, `scripts/build-zip.sh`, `toolings/archify-dev/src/commands/*`

Seven scripts/*.mjs files and scripts/build-zip.sh, about 1500 lines, were removed and their roles pointed at toolings/archify-dev/src/commands/. Named successors are stage-clean-skill.mjs, package-smoke.mjs, build-zip.mjs, third-party-notices-contract.mjs, pnpm-workspace-lock.mjs, and check-release-identity.mjs. The change is treated as a mechanical path redirect: command logic is unchanged, and CI entrypoints are expected to go through pnpm exec archify-dev. The destination sources do not appear in the reviewed diff, so file existence and export compatibility are not shown.

Risk: Missing, renamed, or signature-changed commands fail only when a test or CI step imports or spawns them.
Reviewer attention: Confirm toolings/archify-dev/src/commands/ contains those modules and that a full pnpm test run is green before treating the move as done.

### Retarget tests to import commands from archify-dev
Status: discussed
Touches: `**/brand-marks.test.mjs`, `**/clean-skill-staging.test.mjs`, `**/cursor-onboarding.test.mjs`, `**/golden.mjs`, `**/release-identity.test.mjs`, `toolings/archify-dev/src/commands/*`

Tests including brand-marks.test.mjs, clean-skill-staging.test.mjs, cursor-onboarding.test.mjs, golden.mjs, and release-identity.test.mjs now import from toolings/archify-dev/src/commands/ instead of scripts/. Assertions depend on those modules existing and on symbols such as stageCleanSkill and THIRD_PARTY_NOTICE_DISCLOSURE_COUNT keeping compatible signatures. Nothing in the diff shows the command implementations, so compatibility is unverified at review time.

Risk: Import or export drift fails at test runtime rather than as a visible diff conflict.
Reviewer attention: Require a passing pnpm test log; do not accept the retarget from the path edits alone.

### Correct the visual-check import depth in the desktop browser helper
Status: discussed
Touches: `test/helpers/desktop-browser.mjs`, `archify/scripts/visual-check.mjs`

test/helpers/desktop-browser.mjs changed its visual-check import from ../archify/scripts/visual-check.mjs to ../../archify/scripts/visual-check.mjs. From test/helpers/, a single .. resolves under test/, which is the wrong tree; ../../ reaches the repo root and then archify/scripts/, which is the correct target. This repairs a pre-existing bad relative path. The hunk was unstaged beside the rest of the refactor, and visual-check.mjs itself stays under archify/scripts/ rather than moving into archify-dev.

Risk: Callers that previously failed to resolve the module, or skipped, may now run and expose failures that the bad path had hidden, including skips caused only by Chrome being unavailable. No separate regression covers the ChromeVisualBrowser import path.
Reviewer attention: Run tests that load desktop-browser.mjs and confirm they pass because the import resolves, not because Chrome is missing.

### Run the root test script serially through archify-dev before skill tests
Status: discussed
Touches: `package.json`

The root test script changed from turbo run test:skill test to pnpm --filter archify-dev test && pnpm run test:skill. Serial order is the landed behavior so the tooling package tests finish before skill tests that depend on that package. Dropping turbo removes the previous parallel schedule and can lengthen CI.

Considered/rejected: Restoring turbo parallelism stays reasonable only if archify-dev test and test:skill do not depend on each other. If test:skill needs archify-dev build output, serial order is the one that matches that dependency and should be commented as such.
Risk: CI duration increases if the two tasks are actually independent.
Reviewer attention: Confirm whether test:skill depends on archify-dev, and either keep the serial script with that reason recorded or restore a parallel runner.

### Delegate test:skill to the archify-dev package and drop run-tests.mjs
Status: discussed
Touches: `package.json`, `scripts/run-tests.mjs`, `toolings/archify-dev/package.json`

The root test:skill script no longer runs node scripts/run-tests.mjs. That file was deleted. The replacement is pnpm --filter archify-dev run test:skill, which only works if archify-dev's own package.json defines test:skill. That script definition is not in the diff.

Risk: If test:skill is missing on the package, the root script can recurse into itself or skip the skill tests.
Reviewer attention: Show the test:skill script in toolings/archify-dev/package.json.

### Delegate release-identity checking to archify-dev and delete the old script
Status: discussed
Touches: `package.json`, `scripts/check-release-identity.mjs`, `toolings/archify-dev/src/commands/check-release-identity.mjs`

check:release-identity now runs pnpm --filter archify-dev run check:release-identity. scripts/check-release-identity.mjs, 308 lines of cross-file release identity checks covering the README badge, CHANGELOG, skill-release.json, and the update manifest, was deleted in full. The new command is named under toolings/archify-dev/src/commands/, but its body is not in the diff, so equivalent coverage is unproven.

Risk: Release identity validation can silently shrink if the package command omits any of the old checks.
Reviewer attention: Diff the archify-dev command against the deleted checks, or show a test that still fails when identity files are wrong.

### Replace the distribution-acceptance spawn of package-smoke's src path
Status: discussed — review requires the change; landed code still spawns the src file
Touches: `integrations/deepseek-harness/scripts/distribution-acceptance.mjs`, `toolings/archify-dev/src/commands/package-smoke.mjs`

distribution-acceptance.mjs spawnSyncs package-smoke via path.join(repoRoot, 'toolings', 'archify-dev', 'src', 'commands', 'package-smoke.mjs'), which reaches into the package src tree. The runner only checks the exit code and does not check that the file exists, so a later commands/ move or build-output change fails in CI as an opaque non-zero status. In the same file, stage-clean-skill.mjs is loaded with an ES module import through pack.mjs, which throws immediately on a bad path.

Considered/rejected: Leaving the hardcoded src path was rejected. The required shapes are pnpm exec archify-dev package smoke, or an ES import of a public archify-dev export of package-smoke.
Risk: Archify-dev directory or build layout changes break distribution acceptance only when that spawn runs, with a poor error source.
Reviewer attention: Remove the src path.join spawn before accepting the refactor.

### Point contributor docs at the plural templates/viewer path
Status: discussed
Touches: `CONTRIBUTING.md`

CONTRIBUTING.md path references were updated from template/viewer/ to templates/viewer/ so the docs match the refactored tree. The edit is treated as a mechanical documentation correction aligned with the code move.

Reviewer attention: Spot-check that no remaining docs still say template/viewer/.
