---
id: "0012"
title: Marker first, Structure view, stair rule, export test
created: 2026-07-30
---

## Context

Three runs have now ended before reaching the entrance marker, and it is the
object Dillenburger could not find, with the review on Tuesday. So this run
inverts the usual order: the marker is the first substantive task, and the
DOM-provable work comes after it, because the logic keeps proving itself in
any run while the marker keeps slipping.

Run 0011 closed cause B and left its four files uncommitted; Shrey has seen
the corridor band, decided to keep the glazing as built, and the commit
happens here. The stair rule's design is fully settled from prompts 0010 and
0011. The Structure view rework is Shrey's definition from his QA walk. Two
small extras close loose ends from 0011's report: the export delta measured
as a test, and the rooms-only filter survey.

## Assumptions

These may be wrong. Where a task depends on one, check it rather than
trusting it, and say in the report if it does not hold. Contradicting this
section is more useful than working around it. Beyond that: where this
prompt is ambiguous or silent, make a sensible choice, keep going, and
record it in the report's own-assumptions list.

1. Run 0011 left uncommitted: `src/core/semiExterior.ts`,
   `src/scene/clusterShells.ts`, `src/core/unitExport.ts`,
   `src/core/exteriorEdges.test.ts`. Five tests green at that state.
2. The entrance model is one cell plus one side (`src/core/entrance.ts`)
   and stays untouched. `makeEntranceMesh` in `src/scene/entranceView.ts`
   serves the real marker and the placement ghost (`MARK_LEN 0.44`,
   `MARK_THICK 0.16`, `MARK_H 1.3`, colour `0xe91e63`).
   `src/scene/doorView.ts` draws two-cell leaves and swing arcs, the
   reference drawing language.
3. The Structure view is `FloorManager.setStructureView`
   (`floorManager.ts:322`), today an elastic x-ray; under the new meaning
   circulation walls showing and the staircase hiding are both wrong.
4. The interface view's machinery, rebuild-time skip sets and `baseColor`
   plates, is the stripping pattern to reuse.
5. three.js has no text primitive; the Entry label is a canvas texture on a
   flat plane in the wall plane.
6. The canonical baseline for `flat-1-two-storey.json` is
   `12 issues (1 hard, 11 soft)`; the full panel is in the bridge chat.
   H1 fires on Bathroom — Large (F1), C1 and A1 on Circulation (F1, 8,14).
7. The gating list for the stair rule is settled: H1, C1 and OD1 fold
   behind it for subjects on disconnected floors; A1 keeps firing.
8. `buildUnitExport` is callable over a `FloorManager` outside the browser.
   If constructing one drags the render layer into the test in a way that
   breaks under Node, report the cost and skip task 5 rather than forcing
   it.
9. The pattern `def.category !== "room" || def.cluster` appears in more
   places than the two already found; each site is either a legitimate
   rooms-only question or an envelope question wearing the wrong test.

## Task

0. **Probe the pane.** One screenshot. Tasks 1, 4, 5 and 6 run regardless;
   tasks 2 and 3 defer with a manual script if it is hidden.

1. **Commit run 0011's files** (assumption 1's four, exactly), message
   `Circulation glazing, shared boundary construction (run 0011)`.
   `git status --porcelain` first; nothing else rides along.

2. **The entrance marker, before anything else that can eat the run.** Keep
   the model untouched; derive the second cell at draw time: prefer the
   east neighbour on north- and south-facing walls and the south neighbour
   on east- and west-facing walls, fall back to the other side, keep the
   one-cell width when neither qualifies, so no saved project becomes
   invalid. Rework `makeEntranceMesh` into a door-leaf profile in the
   doorView drawing language, two cells wide, with a flat `Entry` label in
   the plane of the wall (canvas texture; if it is illegible at normal
   zoom, report with a screenshot rather than silently switching to a
   camera-facing sprite). It must read at normal zoom, stay legible in the
   interface view, and survive the cutaway and dimming through the
   `baseColor` conventions. E2 keeps checking the anchor edge. The export
   stays byte-identical, proven by exporting a flat with an entrance before
   and after and diffing. Screenshots: normal view, interface view, and one
   zoomed out to review distance.

3. **The Structure view rework.** New meaning, the fixed layer: bathrooms,
   kitchens and stairs render as built, walls and furniture included, and
   the staircase must no longer hide. Everything else, dry rooms,
   circulation and outdoor alike, drops to bare neutral plates with no
   walls and no furniture, the interface-view stripping pattern with a
   stricter filter. Toggling off restores exactly; prove it. Structure and
   Interface toggles: mutually exclusive or composing, choose the cheaper,
   report which. Record what the old elastic x-ray did in
   `PROJECT_STATE.md`. Screenshots on flat-1 via the loader: view on, both
   floors, one with the cutaway active.

4. **The stair root-cause rule.** New hard rule, id from the ST family: a
   dwelling whose occupied floors are not all connected by stairs fires ONE
   violation naming the disconnected floors. Gating per assumption 7,
   E1's precedent, least-magic mechanism, reported. Write
   `testflats/flat-1-no-stair.json`, flat-1 minus its stair instance, load
   both fixtures through `?project=`, quote both panels, diff against the
   canonical baseline, expecting the orphan pile to collapse into the one
   root-cause line plus what legitimately remains. Invariant on the way:
   WET1's floor-0 line reads identically in both fixtures; a difference is
   a finding to report, not fix. README gets the new rule's row.

5. **The export test.** A new test case that builds a small layout with a
   room, a corridor and an adjacent open balcony, runs the real derivations,
   and asserts that the exported glazed set equals the built glazed set,
   which encodes the f2af130 invariant permanently and yields the export
   delta as a measured number. Assumption 8 governs; skipping with a stated
   cost is acceptable, forcing the render layer into the suite is not.

6. **The filter survey.** Find every site of
   `def.category !== "room" || def.cluster` (and trivial variants), and for
   each say in one line whether it is a legitimate rooms-only question or
   an envelope question wearing the wrong test. Report only; fix nothing.

7. **Documentation.** `PROJECT_STATE.md` for everything; README already
   covered by task 4.

8. **Verify.** `tsc`, `npm run build`, `npm test`, all clean, quoted.
   Panels for task 4 from the DOM, screenshots for tasks 2 and 3. If the
   pane stayed hidden, close with the manual verification script: numbered
   steps, exact placements and clicks, expected outcome each, covering
   every deferred visual claim in walk order.

If the run runs long: tasks 1 and 2 are the point this time; then 3, then
4; 5 and 6 slip first.

## Constraints

- Code changes stay uncommitted apart from task 1's commit. Derived
  fixtures under `testflats/` may ride the record commit. Never push.
- No change to the `dwelling-unit` export format; `entrance.ts` untouched;
  nothing under `docs/`.
- Rules never block placement, save or export. WET1, FAC1 and E1 semantics
  unchanged beyond task 4's gating.
- No interior-solver work.
- `npm test` runs alongside `tsc` and the build for any change under
  `src/core/`.

## What I need back

Quote raw command output rather than summarising it, and state the
verification rung for each claim separately.

1. Pane state, first.
2. The task-1 commit hash with `git show --stat`.
3. The marker: the derivation rule with its fallback cases, the label
   mechanism, the export byte-identity diff, and the three screenshots or
   their deferral.
4. Structure view: the exact filter as implemented, where the old x-ray is
   recorded, the restore proof, the exclusivity-or-composition choice, and
   the screenshots or their deferral.
5. The rule: quoted with id and line range, the gating mechanism, both
   fixture panels quoted, the diff against the canonical baseline, the WET1
   invariant result, and the README row.
6. The export test: the case quoted, the measured delta, `npm test` output,
   or the stated cost of skipping.
7. The filter survey: every site, one line each.
8. `tsc`, `npm run build`, `npm test` output.
9. Anything that contradicts the Assumptions section.
10. Your own assumptions, including every sensible choice where the prompt
    was ambiguous or silent, each with what it affected.

The report follows `WRITING.md`: connected sentences that carry their own
logic, no em dashes as glue, no contrast flourishes, neutral voice, plain
words, prose before any list or table, and every number exact.
