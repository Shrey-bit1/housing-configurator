---
id: "0008"
title: Four checks, E1 hard, entrance marker, first test
created: 2026-07-30
---

## Context

Run 0007 left four claims unproven because the browser pane died mid-run: the
balcony wall standing in the interface view, WET1 firing, FAC1 firing, and the
view's exact restore after `partitionEdges` changed underneath it. This run
proves them first, before anything else changes, so the evidence describes the
code as committed.

Three decisions since then, all Shrey's. E1 goes hard: the entrance is the
unit's interface to the building, so its absence is a failure rather than a
characterisation. The concern that FAC1 would fire during authoring was wrong,
his correction: rules run only when Check Layout is pressed, so FAC1 stays
hard and untouched. And the repository gets its first unit test, because both
`isFacadeEdge` defects were found by reading and neither is reachable by
clicking around.

The entrance marker gets its rework in the same run. Dillenburger could not
find the entrance on the plan, and Shrey's own interface-view screenshots show
why: it is a magenta sliver one cell wide. His design: a door leaf with a
label reading Entry, two cells wide to match the doors.

There is a guest review on Tuesday 4 August. The checks, the commit and the
marker are review material; the test is not, and it is the droppable task.

## Assumptions

These may be wrong. Where a task depends on one, check it rather than trusting
it, and say in the report if it does not hold. Contradicting this section is
more useful than working around it.

Beyond that: where this prompt is ambiguous or silent, make a sensible choice,
keep going, and record the choice in the report's own-assumptions list (item
9). Stopping is for contradictions and refusals, not for gaps.

1. The entrance marker is built in `src/scene/entranceView.ts`, authored
   through `src/interaction/`, and stored as an authored marker on the model.
   Its exact data shape, and whether it is one cell or one edge, is unknown.
2. Doors span two cells and `src/scene/doorView.ts` draws a leaf and swing
   arc, so the marker can borrow that drawing language.
3. The export may carry the entrance. Its written shape must not change in
   this run. If widening the marker to two cells interacts with what
   `unitExport.ts` writes, keep the export writing exactly what it writes
   today and report the tension instead of resolving it.
4. E1 sits at `src/core/rules.ts:434-448`, severity `note`, with a variant
   message for all-entrances-blocked. E2 is already hard and stays untouched.
   Making E1 hard changes the counts line in Check Layout output.
5. `src/core/` imports no three.js (CONTEXT.md), so a test can build a real
   `Floor` headlessly and exercise the real `isOutside` and semi-exterior
   derivations. If some import drags three.js or the DOM in anyway, fall back
   to stub predicates and say so plainly.
6. Vitest is not installed. Adding it changes `package.json` and the
   lockfile; `npm ci` must stay green afterwards, because the professor runs
   it.
7. `isFacadeEdge` sits at `src/core/exteriorEdges.ts:88-100` with the amended
   signature `(cx, cz, side, occupied, isOutside, isSemiExterior)`.
8. Placing rooms by dragging from the palette works; moving an already-placed
   piece is unreliable (0007 report). Build each check layout by fresh drops
   rather than rearranging.
9. There is no test suite yet. Verification for non-test tasks means `tsc`
   clean, `npm run build` clean, and the browser.

## Task

0. **Probe the browser pane first.** One screenshot before anything else. If
   it is hidden, say so, do tasks 2 through 6 anyway, and convert task 1 into
   the manual-steps fallback at the end.

1. **The four checks from 0007, with pixels.**
   a. A room with an Outdoor — Double placed directly against one wall.
      Interface view on: the shared wall and its glazing stand, the parapet
      unchanged, other partitions dissolved. Screenshot.
   b. Kitchen and Bathroom — Small placed apart. Check Layout: the WET1 line
      appears; quote its rendered text exactly. Place them touching, Check
      Layout again: the line is gone. Screenshots of both reports.
   c. A Bedroom — Small ringed by rooms on all four sides so no edge reaches
      sky or balcony. Check Layout: FAC1 names it; quote the rendered text.
      Remove one surrounding room, Check Layout: it clears. Screenshots.
   d. Toggle Interface view on and off on the task-1a flat: the scene comes
      back exactly, door markers included. Screenshot of the restored state.

2. **Commit run 0007's six files.** If the checks passed, commit
   `src/core/exteriorEdges.ts`, `src/core/floorManager.ts`,
   `src/core/adjacencyGraph.ts`, `src/core/rules.ts`, `README.md`,
   `PROJECT_STATE.md` with the message
   `Facade edge, WET1 + FAC1, README regeneration (run 0007)`. If the pane
   was hidden and the checks could not run, commit anyway on the strength of
   the read-verification and say so in the message by appending
   `(read-verified)`. If any check FAILED, do not commit; stop and report.

3. **E1 goes hard.** Change the severity and reword the base description so it
   reads as a failure rather than an instruction, keeping the
   all-entrances-blocked variant: something like `No entrance defined — the
   entrance is the unit's interface to the building.` Update the README table
   row. Quote the new Check Layout counts line on an entrance-less flat.

4. **Rework the entrance marker to Shrey's design.** A door leaf with a label
   reading `Entry`, two cells wide to match the doors. It must read at normal
   zoom in the normal view, in the interface view, and survive the cutaway
   and both lighting states the way other markers do. Placement follows: an
   entrance now needs two consecutive boundary cells, and E2's
   blocked-entrance check must still work on the widened footprint. Do not
   change what the export writes (assumption 3). Screenshots in normal view
   and interface view.

5. **The first unit test.** Add vitest as a devDependency and a
   `"test": "vitest run"` script. One test file for `isFacadeEdge` with four
   cases: an edge to open sky is facade; an edge to an open adjacent balcony
   is facade; an edge to a sealed empty pocket is not; an edge to a sealed
   courtyard balcony is not. Prefer building a real `Floor` and letting the
   real derivations answer (assumption 5); stubs only as the stated fallback.
   Quote `npm test` output and confirm `npm ci` still succeeds from a clean
   `node_modules`. Keep configuration minimal: no config file unless vitest
   genuinely needs one, and say so if it does.

6. **Update `PROJECT_STATE.md`** for E1, the marker, and the test runner.

7. **Verify.** `tsc` clean, `npm run build` clean, `npm test` passing. All
   screenshots named above.

If the run runs long, drop task 5 first, then task 4. Tasks 1 and 2 are the
point of the run.

## Constraints

- Code changes stay uncommitted apart from task 2's deliberate commit. The
  record commit stages `_cowork/` as the skill says. Never push.
- No change to the `dwelling-unit` export or `docs/bridge-format.md`. Touch
  nothing under `docs/`.
- Rules never block placement, save or export. No severity values beyond the
  existing three. FAC1 and WET1 are not modified.
- No interior-solver work.
- `npm ci` must work after the vitest addition; if it does not, revert the
  test task entirely and report why.
- If the pane is hidden, stop only task 1; everything else proceeds, and the
  report lists exactly which claims remain unproven.

## What I need back

Quote raw command output rather than summarising it, and state the
verification rung for each claim separately.

1. Task 0's pane state, first.
2. The four checks: screenshots, and the WET1 and FAC1 rendered texts quoted
   verbatim.
3. The task-2 commit hash and its `git show --stat`, and which branch of the
   commit rule applied (checks-passed, read-verified, or refused).
4. E1's new entry quoted, and the new counts line from a live Check Layout.
5. The marker: where it is built, what changed, and the two screenshots.
6. The test file quoted in full, `npm test` output, the `package.json` diff,
   and the `npm ci` result.
7. `tsc` and `npm run build` output.
8. Anything that contradicts the Assumptions section.
9. Your own assumptions, including every sensible choice made where the
   prompt was ambiguous or silent, listed clearly in one place, each with
   what it affected. An empty list is a valid answer.

The report follows `WRITING.md`: connected sentences that carry their own
logic, no em dashes as glue, no contrast flourishes, neutral voice, plain
words, prose before any list or table, and every number exact.
