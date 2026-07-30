---
id: "0011"
title: Marker, Structure view, circulation glazing, stair rule
created: 2026-07-30
---

## Context

The canonical baseline is settled. Shrey loaded `flat-1-two-storey.json`
through the new `?project=` loader and his panel matches run 0010's
measurement line for line: `12 issues (1 hard, 11 soft)`, H1 on Bathroom —
Large (F1), C1 and A1 on Circulation (F1, 8,14), N1 on floor 1 at 26 %, WET1
twice, S7 three times, all with the disambiguated labels. Every before and
after in this run diffs against that panel. The earlier 9-issue reading is
retired and no longer interesting.

This run merges what were planned as two runs, one visual and one logic. The
logic half is DOM-provable and always runs. The visual half needs the pane;
if the pane is dead it is deferred with a manual script, never shipped
unseen, because one of the two objects is the entrance marker Dillenburger
already failed to find once.

Decisions already taken, none open to the run: cluster glazing is keyed by a
parallel map so the room path stays untouched; the stair rule's gating covers
the reachability family and leaves width rules alone; the marker design is
Shrey's, a door leaf with an Entry label, two cells wide; the Structure view's
new meaning is Shrey's definition, the fixed layer of bathrooms, kitchens and
stairs.

## Assumptions

These may be wrong. Where a task depends on one, check it rather than
trusting it, and say in the report if it does not hold. Contradicting this
section is more useful than working around it. Beyond that: where this prompt
is ambiguous or silent, make a sensible choice, keep going, and record it in
the report's own-assumptions list.

1. Run 0010 left uncommitted: `src/main.ts`, `src/ui/validationPanel.ts`,
   `README.md`, `PROJECT_STATE.md`, the loader and the label disambiguation,
   proven in its report and confirmed live by Shrey's canonical panel.
2. Cause B's diagnosis stands: `src/core/semiExterior.ts:141` filters with
   `if (def.category !== "room" || def.cluster) continue;`, and
   `rebuildClusterShells` passes `undefined` for windows. `glazedByRoom` is
   keyed by room instance id.
3. The bathroom privacy exclusion (`semiExterior.ts:151`) and the
   outdoor-to-stair full wall (§2n) are behaviours to preserve.
4. The test's `derive()` privately reproduces the boundary construction;
   after this run the app and the test call one exported function.
5. The entrance model is one cell plus one side (`src/core/entrance.ts`, 18
   lines) and stays exactly as it is. `makeEntranceMesh` in
   `src/scene/entranceView.ts` serves the real marker and the placement
   ghost. `src/scene/doorView.ts` draws two-cell leaves and swing arcs, the
   reference drawing language.
6. The Structure view is `FloorManager.setStructureView`
   (`floorManager.ts:322`), today an elastic x-ray. Under the new meaning
   its two observed behaviours are both wrong: circulation walls show and
   the staircase hides.
7. The interface view's machinery, rebuild-time skip sets and `baseColor`
   plates with per-frame idempotent display state, is the stripping pattern
   to reuse.
8. three.js has no text primitive, so the Entry label is a canvas texture on
   a flat plane lying in the wall plane, turning with the model.
9. The canonical baseline panel is in the bridge chat; the counts line and
   the H1 target are the anchor points for every diff.
10. Rules read graph nodes; the ST id family is stairs; the free id is the
    run's to choose. `npm test` runs four cases in under a second.

## Task

0. **Probe the pane.** One screenshot. Tasks 1 to 3 run regardless of the
   result; tasks 4 and 5 defer if it is hidden.

1. **Commit run 0010's files** (assumption 1's four, exactly), message
   `Dev loader and label disambiguation (run 0010)`. Run
   `git status --porcelain` first; nothing else rides along.

2. **Cause B, circulation glazing.** Lift the rooms-only filter so
   circulation clusters enter the semi-exterior system: a parallel map keyed
   by cluster component feeds a new windows parameter on
   `rebuildClusterShells`; rooms stay in `glazedByRoom` untouched; bathrooms
   stay excluded; outdoor-to-stair keeps its full wall. In the same change,
   export the boundary construction from `semiExterior.ts` as one named
   function, point the app and the test's `derive()` at it, and add the
   fifth test case: a circulation edge onto an open adjacent balcony is
   facade. `npm test` green. Measure the export delta on flat-1: glazing
   counts before and after, format unchanged, and exported glazing equal to
   built glazing on the same flat. If the pane is alive, screenshot the
   corridor-to-balcony boundary showing glass where the wall stood solid.

3. **The stair root-cause rule.** New hard rule, id from the ST family: a
   dwelling whose occupied floors are not all connected by stairs fires ONE
   violation naming the disconnected floors. Gating follows E1's precedent
   with this scope: violations about reachability from the entrance, whose
   subjects sit on floors the new rule declares disconnected, fold behind
   it. H1, C1 and OD1 are the observed members; apply the principle, report
   the final list and the mechanism. A1 keeps firing, because width is true
   regardless of connection. Verify with a derived fixture: write
   `testflats/flat-1-no-stair.json`, flat-1 minus its stair instance, load
   both fixtures through `?project=`, quote both panels, and diff against
   the canonical baseline, expecting the orphan pile to collapse into the
   one root-cause line plus what legitimately remains. One invariant on the
   way: WET1's floor-0 line must read identically in both fixtures, since a
   stair is not wet; if it differs, that is a real finding to report, not
   fix.

4. **The entrance marker** (pane). Keep the model untouched; derive the
   second cell at draw time: prefer the east neighbour on north- and
   south-facing walls and the south neighbour on east- and west-facing
   walls, fall back to the other side, keep the one-cell width when neither
   qualifies, so no saved project becomes invalid. Rework `makeEntranceMesh`
   into a door-leaf profile in the doorView drawing language, two cells
   wide, with a flat `Entry` label in the plane of the wall (canvas
   texture; if it is illegible at normal zoom, report with a screenshot
   rather than silently switching to a camera-facing sprite). It must read
   at normal zoom, stay legible in the interface view, and survive the
   cutaway and dimming through the `baseColor` conventions. E2 keeps
   checking the anchor edge. The export stays byte-identical, proven by
   exporting a flat with an entrance before and after and diffing.
   Screenshots: normal view, interface view, and one zoomed out to review
   distance.

5. **The Structure view rework** (pane for proof, code regardless). New
   meaning, Shrey's definition, the fixed layer: bathrooms, kitchens and
   stairs render as built, walls and furniture included, and the staircase
   must no longer hide. Everything else, dry rooms, circulation and outdoor
   alike, drops to bare neutral plates with no walls and no furniture, the
   interface-view stripping pattern with a stricter filter. Toggling off
   restores exactly; prove it. Check how the Structure and Interface toggles
   interact, mutually exclusive or composing, choose the cheaper and report
   which. Record what the old elastic x-ray did in `PROJECT_STATE.md` where
   the view is documented. Screenshots on flat-1 via the loader: view on,
   both floors, plus one with the cutaway active.

6. **Documentation.** README: the new rule's row, and Views and modes
   updated for Structure view's new meaning. `PROJECT_STATE.md` for
   everything this run changed.

7. **Verify.** `tsc`, `npm run build`, `npm test`, all clean, quoted. Panels
   for tasks 2 and 3 from the DOM, screenshots for 4 and 5. If the pane
   stayed hidden, close the run with the manual verification script:
   numbered steps, exact placements and clicks, the expected outcome of
   each, covering every deferred visual claim in the order Shrey should
   walk them.

If the run runs long: tasks 1, 2 and 3 are the point and prove themselves;
task 4 outranks task 5.

## Constraints

- Code changes stay uncommitted apart from task 1's commit. Derived fixtures
  under `testflats/` may ride the record commit. Never push.
- No change to the `dwelling-unit` export format; content changes only as
  task 2 measures them. `entrance.ts` untouched. Nothing under `docs/`.
- Rules never block placement, save or export. WET1, FAC1 and E1 semantics
  unchanged beyond the gating task 3 defines.
- No interior-solver work.
- `npm test` runs alongside `tsc` and the build for any change under
  `src/core/`.

## What I need back

Quote raw command output rather than summarising it, and state the
verification rung for each claim separately.

1. Pane state, first.
2. The task-1 commit hash with `git show --stat`.
3. Cause B: the map's shape, the windows parameter, the exported boundary
   function with its call sites, the fifth test case, `npm test` output, the
   export delta counts, and the corridor screenshot or its deferral.
4. The rule: quoted with id and line range, the gating list and mechanism as
   implemented, both fixture panels quoted, the diff against the canonical
   baseline, and the WET1 invariant result.
5. The marker: the derivation rule with its fallback cases, the label
   mechanism, the export byte-identity diff, and the three screenshots or
   their deferral.
6. Structure view: the exact filter as implemented, where the old x-ray's
   purpose is now recorded, the restore proof, the exclusivity-or-composition
   choice, and the screenshots or their deferral.
7. `tsc`, `npm run build`, `npm test` output.
8. Anything that contradicts the Assumptions section.
9. Your own assumptions, including every sensible choice made where the
   prompt was ambiguous or silent, each with what it affected.

The report follows `WRITING.md`: connected sentences that carry their own
logic, no em dashes as glue, no contrast flourishes, neutral voice, plain
words, prose before any list or table, and every number exact.
