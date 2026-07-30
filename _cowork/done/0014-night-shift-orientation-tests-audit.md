---
id: "0014"
title: Night shift, orientation, tests, audit
created: 2026-07-30
---

## Context

This run goes overnight and unattended, and that shapes it. Nothing here
refactors, renames or restructures working code: improvement arrives as new
tests and as a written audit whose output is proposals. Anything visual is
secondary, because nobody is watching; anything provable by test or DOM is
primary. The review is Tuesday, so the codebase must be in a known-good
state in the morning, which every task below preserves.

Run 0013's work is committed first on the strength of its evidence: measured
geometry, byte-identical export, driven-button proofs, and the planning
session has viewed four of the ten captures. Shrey reviews the commits in
the morning and a revert is one command.

Restart the dev server before anything else. Run 0013 proved a live pane can
serve a stale build, and the rule now is that no pane observation counts
until the server has been restarted in the same session.

## Assumptions

These may be wrong. Where a task depends on one, check it rather than
trusting it, and say in the report if it does not hold. Contradicting this
section is more useful than working around it. Beyond that: where this
prompt is ambiguous or silent, make a sensible choice, keep going, and
record it in the report's own-assumptions list.

1. Run 0013 left uncommitted: `src/scene/entranceView.ts`, `src/core/floor.ts`,
   `src/core/floorManager.ts`, `src/main.ts`, `vite.config.ts`,
   `src/core/unitExport.test.ts`, `PROJECT_STATE.md`, plus untracked
   `captures/` (ten PNGs) and possibly the capture-sink additions. Eight
   tests green at that state.
2. Glazing sectors per room are already derived (`floor.windowStats`) and
   printed by the panel under GLAZING ORIENTATION. On flat-1 the
   north-lit rooms are exactly Living Room (F0) and Bedroom — Small (F1).
3. The project JSON is tolerant and versioned; one additive optional field
   beside `northAngle` in `src/core/projectIO.ts` is legal. The
   dwelling-unit export is frozen and gains nothing.
4. `isFixedLayer` sits in `src/core/floorManager.ts` and currently excludes
   outdoor clusters. `window.__app.capture(name)` writes PNGs to
   `captures/`.
5. A `FloorDeps` stub is about a dozen lines and lets `FloorManager` run
   headlessly; the import costs roughly 12 s, so it belongs in a separate
   script (`test:slow`), keeping `npm test` fast.
6. Canonical panels: flat-1 `12 issues (1 hard, 11 soft)`; no-stair
   `7 issues (1 hard, 6 soft)`. Any drift needs a named cause, and task 2
   legitimately changes flat-1's count when the avoid preference is set.
7. The rules engine has 40 rules; the ones touched or leaned on this week
   are E1, E2, H1, C1, OD1, A1, N1, DP1, WET1, FAC1, ST3.

## Task

0. **Restart the dev server, clear `node_modules/.vite`, then probe the
   pane.** One screenshot. Visual tasks defer politely if it is hidden;
   everything else proceeds.

1. **Commit run 0013's work** (assumption 1's files; `captures/` stays
   untracked), message `Entrance marker, Structure view, plans, capture
   sink (run 0013)`. `git status --porcelain` first; nothing else rides.

2. **Orientation preference, meeting item 7.** A per-project preferred
   orientation and avoid orientation, both optional, one additive field in
   the project JSON (assumption 3), never in the dwelling-unit export. One
   soft rule comparing habitable rooms' derived glazing sectors against the
   avoid preference, message naming the room, its orientation and the
   preference, no citation because it is preference rather than law. UI in
   the left panel near the compass. README row. ACCEPTANCE, exact: with
   avoid set to north on `flat-1-two-storey.json`, the rule fires on
   precisely Living Room (F0) and Bedroom — Small (F1) and nothing else,
   and with no preference set both canonical panels are unchanged. Quote
   the panels.

3. **The balcony A/B, pane permitting.** Flip `isFixedLayer` to include
   outdoor clusters, capture `plan-f0-3-structure.png` as
   `plan-f0-3-structure-B.png`, flip it back, confirm the original capture
   still matches. Two images for Shrey's morning decision; the code ends
   the night in the balconies-out state it started in.

4. **The slow export test.** A `FloorDeps` stub, a `test:slow` script, and
   one test that builds a small layout through the real `FloorManager`,
   calls the real `buildUnitExport`, and asserts exported glazing equals
   built glazing. The fast suite stays under two seconds; `test:slow` may
   take what it takes. If the stub turns out to need more than the render
   layer's absence allows, stop, report the exact member that blocks it,
   and leave the fast tests as they are.

5. **The rules test pack.** For each of assumption 7's eleven rules, a
   minimal firing fixture and a minimal silent fixture as pure tests
   against the real graph derivations, in one new test file. Where a rule
   cannot be exercised without the render layer, say so per rule rather
   than forcing it. Every test that fails against current behaviour is a
   FINDING to report, never something to fix silently.

6. **The read-only audit.** No edits anywhere in this task. Read the whole
   of `src/` and write, into the report: dead code and unused exports;
   duplicated logic that exists in two places and could drift (the
   rooms-only filter class was one; name others); PROJECT_STATE claims
   that no longer match the code, checked by sampling every section
   heading; inconsistencies in naming or conventions worth a deliberate
   pass; and a ranked shortlist of at most ten cleanups, each one line,
   with what it risks. Proposals only; the planning session turns survivors
   into prompts.

7. **`PROJECT_STATE.md`** for tasks 2 through 4 as applicable.

8. **Verify.** `tsc`, `npm run build`, `npm test`, plus `npm run test:slow`
   if it exists by then, all quoted. Both canonical panels re-measured with
   drift named (task 2's preference-off state must match them). If visual
   tasks deferred, say so plainly.

If the run runs long: tasks 1 and 2 are the point; then 4, then 5; task 3
needs the pane and defers without loss; task 6 may be shortened but not
skipped, because the morning plan is built from it.

## Constraints

- No refactoring, renaming, restructuring or "cleanup" edits anywhere. The
  audit proposes; it does not touch.
- Code changes stay uncommitted apart from task 1's commit. `captures/`
  stays untracked. Never push.
- No change to the `dwelling-unit` export format. `docs/` untouched.
- Rules never block placement, save or export; existing rule semantics
  unchanged (task 2 only adds).
- The fast `npm test` stays fast; anything slow lives behind `test:slow`.
- No interior-solver work.

## What I need back

Quote raw command output rather than summarising it, and state the
verification rung for each claim separately.

1. Pane state after the restart, first.
2. The task-1 commit hash with `git show --stat`.
3. The preference: where it is stored, the rule quoted, the rendered
   message, and the two acceptance panels.
4. The A/B captures, or their deferral.
5. `test:slow`: the stub, the test, its output, or the exact blocking
   member.
6. The rules pack: per rule, firing and silent results, and every finding
   where current behaviour surprised the test.
7. The audit: the full list, and the ranked shortlist of at most ten.
8. `tsc`, `npm run build`, `npm test`, `test:slow` output.
9. Anything that contradicts the Assumptions section.
10. Your own assumptions, each with what it affected.

The report follows `WRITING.md`: connected sentences that carry their own
logic, no em dashes as glue, no contrast flourishes, neutral voice, plain
words, prose before any list or table, and every number exact.
