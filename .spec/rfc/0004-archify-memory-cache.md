# RFC 0004: Archify Memory Cache for Agents

**Status:** Draft

## Summary

Every successful `archify deliver` also writes/updates a knowledge-base entry under `.archify/<area>.json` (the frozen diagram spec — the intended architecture, source of truth) plus `.archify/<area>.html` (rendered viewer, human-facing). Any agent working in that repo consults `.archify/*.json` before acting, so its plan stays aligned with the recorded design intent instead of drifting into a direction that contradicts it. A recorded git SHA lets the agent tell when the KB entry no longer reflects the code it describes.

## Problem

Agents currently have no standing record of intended architecture to check themselves against. Without it, an agent can confidently implement something that technically works but goes against the system's actual design (wrong layering, wrong component boundary, duplicate of an existing flow, violates a documented boundary) — because nothing stopped it from acting on a wrong mental model. `archify` already produces the diagram that captures correct architecture; today that diagram is thrown away after one-off viewing instead of persisted somewhere an agent is expected to check before it commits to a direction.

## Goals

- On every successful `deliver`, write the frozen spec to `.archify/<area>.json` as a persistent design-KB entry, not just a one-off output file.
- Write the matching rendered `.archify/<area>.html` alongside it for human/browser consumption.
- Give agents (via SKILL.md guidance) a documented checkpoint: before proposing or implementing a change that touches an area with a `.archify/<area>.json` entry, read it and confirm the plan matches the recorded components/relationships/boundaries — self-correct before acting if it doesn't.
- Give agents a way to detect when a KB entry is stale (recorded git SHA vs. current state of the paths it covers) so a stale entry doesn't silently misdirect a decision.
- Keep this fully on-demand from the agent's perspective — the KB entry is a byproduct of normal `deliver` usage, never a background job, never required for archify to function without it.

## Non-goals

- No automatic background regeneration daemon/watcher — staleness is checked lazily, only when an agent consults the cache.
- No requirement that every repo maintain a "complete" architecture map — coverage is whatever areas users have asked archify to diagram over time; partial/absent KB is a normal, expected state, and an agent proceeds normally (no diagram to check against) when nothing covers the area it's touching.
- Agents do not read the PNG/HTML for understanding — image output stays human-facing only (per design decision); agents consume the JSON.
- No new diagram type, schema field, or renderer change — this only adds a persistence/discovery layer on top of existing `deliver`.
- No cross-repo or cross-machine sharing of `.archify/` — it is local, per-checkout, and would typically be gitignored (open question, see Design).
- This is a guidance/checkpoint mechanism, not an enforcement gate — nothing blocks an agent from proceeding against the KB; it is expected to self-correct on a mismatch, not be mechanically stopped.

## Design

**Directory layout**

```
.archify/
  <area-slug>.json        # frozen archify spec, unchanged bytes — same as deliver already produces
  <area-slug>.meta.json   # sidecar: design-KB metadata, versioned history
  <area-slug>.html        # rendered viewer, same as normal deliver output
```

`<area-slug>` is derived from the existing `deliver` output filename/slug the user already chose — no new naming scheme to design; it mirrors whatever `<output.html>` basename was passed to `deliver`.

**KB metadata (sidecar, not embedded)**

Metadata lives in a separate `<area-slug>.meta.json`, never inside the spec bytes — this keeps `<area-slug>.json` a pure, unmodified archify spec that any other tool can round-trip without risking dropped unknown keys:

```json
{
  "current": {
    "generatedAt": "ISO-8601 timestamp",
    "sourceRefs": ["path/to/file-or-dir", "..."],
    "sourceSha": "git SHA or blob-hash digest covering sourceRefs at generation time",
    "specFile": "<area-slug>.json"
  },
  "history": [
    { "generatedAt": "...", "sourceSha": "...", "specFile": "<area-slug>.20260910T121500.json" }
  ]
}
```

`sourceRefs` is whatever repository paths were inspected/cited as evidence for that diagram (archify already supports repository-evidence inspection for real-code diagrams); when no evidence paths were used (a purely conceptual diagram), `sourceRefs` is empty and staleness checking is skipped for that entry.

**Write path and collision handling**

`scripts/archify.mjs deliver <type> <candidate.json> <output.html>` gains a side effect: after a successful delivery, also write `.archify/<slug>.json`, `.archify/<slug>.meta.json`, and `.archify/<slug>.html`. This is additive to the existing deliver contract — existing callers who don't care about the KB see no behavior change to their requested `<output.html>`.

If `.archify/<slug>.json` already exists with a different `sourceSha` in its meta, `deliver` does not silently overwrite it: it renames the previous spec file into `history` (timestamped, as shown above) before writing the new current entry, and prints a one-line notice naming the prior `sourceSha` that was superseded. A `deliver` whose `sourceSha` matches the existing current entry (re-running on unchanged source) overwrites in place with no history entry — it is the same design being re-rendered, not a new one replacing an old one.

**Staleness check (agent-facing, documented in SKILL.md)**

Before trusting a `.archify/<slug>.json` entry as design intent, an agent:
1. Reads `<slug>.meta.json`'s `current.sourceRefs` and `current.sourceSha`.
2. Runs `git log -1 --format=%H -- <sourceRefs...>` (or equivalent) and compares to `current.sourceSha`.
3. Match → treat the JSON's nodes/edges/relationships/boundaries as the current intended design; check the planned change against it before proceeding.
4. Mismatch or `sourceRefs` empty → treat as stale/unknown; don't let it override the agent's own reading of current code, and optionally regenerate via a fresh `deliver` if the task warrants it.

**Design-KB checkpoint — mechanical trigger, not prose alone**

Prose guidance in SKILL.md is necessary but not sufficient — an agent under time pressure skims past a paragraph the same as any other. This RFC therefore requires a mechanical surface, not just documentation:

- Add `scripts/archify.mjs kb-check <path-or-glob>` — a small, fast command that greps `.archify/*.meta.json` for entries whose `sourceRefs` intersect the given path(s), validates staleness for each match, and prints (JSON or plain) the list of matching KB entries with their `specFile` and staleness state. Exit code 0 with empty results when nothing covers the path (normal, expected — see Non-goals).
- SKILL.md instructs agents to run `kb-check` on the file(s) they are about to edit as a normal step before editing (same category as "run validate before deliver") — this turns the checkpoint into a concrete command with visible output the agent must act on, rather than a recalled instruction.
- The checkpoint is still advisory, not blocking (per Non-goals: no enforcement gate) — `kb-check` surfaces the relevant KB entry; the agent still decides whether the plan aligns, adjusts, or regenerates. What changes is that "check the KB" becomes "run this command," which is far more reliably followed than "remember to consult a JSON file."

**Gitignore**

Recommend (in generated/updated `.gitignore` guidance, not enforced) that `.archify/` be gitignored by default, since it is a local derived-cache convenience, not a source-controlled artifact — mirrors how `node_modules/`-style caches are treated. A user who wants the cache shared/committed can opt out of the ignore.

## Acceptance

- Running `archify.mjs deliver` on any diagram type produces `.archify/<slug>.json`, `.archify/<slug>.meta.json`, and `.archify/<slug>.html` in addition to the existing requested output, with no change to the existing spec/output bytes.
- `.archify/<slug>.meta.json` parses as valid JSON and contains `current.generatedAt`, `current.sourceRefs`, `current.sourceSha`, `current.specFile`.
- Modifying a file listed in `sourceRefs` and re-running the staleness check (git SHA comparison) correctly flags the KB entry as stale.
- A `deliver` call with no repository-evidence inspection produces a KB entry with empty `sourceRefs` and the documented "skip staleness check" behavior.
- Delivering to a slug whose `sourceSha` differs from the existing current entry moves the prior spec into `history` and prints the superseded-`sourceSha` notice; delivering with the same `sourceSha` overwrites in place with no new history entry.
- `archify.mjs kb-check <path>` returns the correct matching `.archify/*.meta.json` entries (by `sourceRefs` intersection) with accurate staleness state, and empty results (exit 0) when nothing covers the path.
- **Behavioral test for the RFC's actual goal:** given a fixture repo with a `.archify/<slug>.json` KB entry describing an explicit boundary (e.g., "component A must not call component B directly"), and a task that asks for a change violating that boundary, running `kb-check` on the touched path surfaces the relevant KB entry's content in its output — i.e., the boundary-violating fact is mechanically retrievable at the point of the edit, not only documented as an aspiration. (This tests that the data reaches the agent at the right moment; it does not and cannot test that the agent always heeds it — that remains a documented expectation, not a guarantee.)
- SKILL.md contains the new design-KB checkpoint (including the `kb-check` step) and staleness guidance lines described above.
- Existing archify tests (`test:skill`, golden tests) continue to pass unmodified — this feature does not alter existing validate/deliver output for callers who ignore `.archify/`.
