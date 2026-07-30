---
id: "0010"
title: Dev loader, circulation glazing, stair rule, message fixes
created: 2026-07-30
---

## Context

Shrey walked the 0009 verification script. The corridor wall is confirmed
with his own eyes, so it gets committed here. WET1 and FAC1 fire and clear
with their intended texts. His QA pass also produced findings, and this run
takes the logic half of them; the visual half (entrance marker, Structure
view rework) is a separate prompt so this one stays DOM-provable end to end.

Two decisions are taken in this prompt, both overridable by Shrey but not by
the run. First, the app gets a dev-only project loader, because run 0009
proved no injection route can feed Import, which walled three tasks. Second,
cluster glazing is keyed by a parallel map rather than widening the room map,
because it keeps the room path untouched and the two kinds of thing separate.

His stair finding sets a rule-design principle: when one missing thing
explains a pile of symptoms, the engine should say the cause once rather than
the symptoms many times. E1 already gates the reachability rules, so the
pattern exists in the engine.

## Assumptions

These may be wrong. Where a task depends on one, check it rather than
trusting it, and say in the report if it does not hold. Contradicting this
section is more useful than working around it. Beyond that: where this prompt
is ambiguous or silent, make a sensible choice, keep going, and record it in
the report's own-assumptions list.

1. The wall fix sits uncommitted in `src/scene/clusterShells.ts` plus a
   `PROJECT_STATE.md` note, exactly as run 0009 left them.
2. Import goes through `readAndImport` at `src/main.ts:733-738` with a
   `FileReader`. The loader must enter the same downstream path; only the
   file-acquisition step may differ.
3. Cause B is `src/core/semiExterior.ts:141` skipping anything with
   `def.cluster`, and `rebuildClusterShells` calls `buildBoundaryWalls` with
   `undefined` for windows. `glazedByRoom` is keyed by room instance id.
4. The bathroom privacy exclusion (`semiExterior.ts:151`) and the
   outdoor-to-stair full wall (§2n) are behaviours to preserve.
5. The test's `derive()` privately reproduces the boundary construction;
   after this run both the app and the test call one exported function.
6. Shrey's baseline panel for `flat-1-two-storey.json` reads
   `9 issues (1 hard, 8 soft)` with H1 on Bathroom — Large (F1); his full
   text is in the bridge chat and the counts are enough for equivalence.
7. Rules read graph nodes; H1 is the orphan rule; rule ids in the ST family
   relate to stairs. The exact free id is the run's to choose.
8. Two rooms of the same type on the same floor render identical labels in
   the panel, e.g. two `Bathroom — Small (F0)`.
9. `npm test` exists (4 cases) and takes under a second.

## Task

0. **Probe the pane.** One screenshot. This run needs no pixels; the probe
   just records the state.

1. **Commit the verified wall fix:** `src/scene/clusterShells.ts` and the
   `PROJECT_STATE.md` lines describing it, message
   `Circulation-to-outdoor wall (run 0009)`. `git status --porcelain` first;
   nothing else rides along.

2. **The dev loader.** A `?project=` query parameter, dev builds only, that
   fetches the named file (relative paths resolve against `testflats/`) and
   feeds it through the exact same import path as the Import button, with
   the same error handling. No second loading semantics: if `readAndImport`
   changes someday, the loader must not need to know. Prove it by loading
   `flat-1-two-storey.json` through the URL and reading the Check Layout
   panel from the DOM: it must match Shrey's baseline, `9 issues (1 hard, 8
   soft)`, H1 on Bathroom — Large (F1). Quote the panel.

3. **Cause B, circulation glazing.** Lift the rooms-only filter so
   circulation clusters enter the semi-exterior system: a parallel map keyed
   by cluster component feeds a new windows parameter on
   `rebuildClusterShells`, rooms stay in `glazedByRoom` untouched. Bathrooms
   stay excluded, outdoor-to-stair keeps its full wall. In the same change,
   export the boundary construction from `semiExterior.ts` as one named
   function, point the app and the test's `derive()` at it, and add the
   fifth test case: a circulation edge onto an open adjacent balcony is
   facade. `npm test` green.

   Then measure the export delta on flat-1: glazing counts in the
   dwelling-unit file before and after, format unchanged, and exported
   glazing equal to built glazing on the same flat.

4. **The stair root-cause rule.** New hard rule, id from the ST family:
   a dwelling whose occupied floors are not all connected by stairs fires
   ONE violation naming the disconnected floors. When it fires, H1 does not
   also list every room on the disconnected floors; follow E1's gating
   precedent and pick the least-magic mechanism, reported. Verify through
   the loader with a derived fixture: write
   `testflats/flat-1-no-stair.json`, flat-1 minus its stair instance, load
   it, quote the panel before and after the rule exists, expecting the 4× H1
   pile to collapse into the one line plus what legitimately remains.

5. **Label disambiguation.** When two rooms would render the same label in a
   violation message, append a stable discriminator (the room's anchor cell
   is enough): `Bathroom — Small (F0, 8,14)`. Only when labels collide;
   unique labels stay as they are.

6. **Reproduce Shrey's two anomalies on flat-1 and explain each.** One:
   baseline WET1 names Kitchen plus one Bathroom — Small with group anchor
   (11,14), while after deleting the stair it names three rooms with anchor
   (8,14). Two: S7 en-suite appears once for (F0) in baseline and twice
   after the stair deletion. For each: correct behaviour with a reason, or a
   defect with a fix. Deleting the stair may not be scriptable; if so, use
   the no-stair fixture from task 4 and diff the two panels through the
   loader.

7. **README:** a row for the new rule, and one line in Views and modes for
   the `?project=` loader. **`PROJECT_STATE.md`** for everything.

8. **Verify.** `tsc`, `npm run build`, `npm test`, all clean, quoted. Panel
   quotes for tasks 2, 4 and 6 from the DOM.

If the run runs long: tasks 1 and 2 are the point, then 3, then 4; 5 and 6
can slip to the next run.

## Constraints

- Code changes stay uncommitted apart from task 1. Derived fixtures under
  `testflats/` may be committed with the record if created. Never push.
- The loader exists in dev builds only and must not appear in `npm run
  build` output paths that ship.
- No change to the `dwelling-unit` export format; content changes only as
  task 3 measures them. Touch nothing under `docs/`.
- Rules never block placement, save or export. WET1, FAC1, E1 semantics
  unchanged; message text changes only via task 5's disambiguation.
- No interior-solver work.

## What I need back

Quote raw command output rather than summarising it, and state the
verification rung for each claim separately.

1. Pane state, first.
2. The task-1 commit hash with `git show --stat`.
3. The loader: where it hooks in, proof it shares the import path, and the
   equivalence panel quote against Shrey's baseline.
4. Cause B: the map's shape, the windows parameter, the exported boundary
   function with both call sites, the fifth test case, `npm test` output,
   and the export delta counts.
5. The new rule quoted with id and line range, the gating mechanism chosen,
   and the before-and-after panels from the no-stair fixture.
6. The disambiguation change and one colliding-label message before and
   after.
7. The two anomaly explanations, each labelled correct-with-reason or
   defect-with-fix.
8. `tsc`, `npm run build`, `npm test` output.
9. Anything that contradicts the Assumptions section.
10. Your own assumptions, including every sensible choice where the prompt
    was ambiguous or silent, each with what it affected.

The report follows `WRITING.md`: connected sentences that carry their own
logic, no em dashes as glue, no contrast flourishes, neutral voice, plain
words, prose before any list or table, and every number exact.
