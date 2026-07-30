---
id: "0009"
title: Circulation wall bug, test flats, modes guide, rules QA
created: 2026-07-30
---

## Context

Shrey found a bug with a screenshot: where circulation meets outdoor, no wall
and no french windows get built, so the flat stands open to its own balcony
along the corridor. It is visible on the upper floor of
`testflats/flat-1-two-storey.json`. Rooms get a wall with french-window
glazing at the same boundary, so the corridor case is the odd one out.

The same run prepares the app for Prof. Ng, who will review it from GitHub
before Tuesday: three example flats now sit at `testflats/` as fixtures, the
README needs a section explaining what every control does, and the rules get
a stress test before a supervisor pokes at them. Run 0008 also left four
checks unproven (pane hidden throughout) and the entrance marker undone, and
both are picked up here, pane permitting.

Run order puts everything DOM-provable first. Check Layout's panel is DOM, so
rule texts can be read without pixels; runs 0007 and 0008 proved that.

## Assumptions

These may be wrong. Where a task depends on one, check it rather than
trusting it, and say in the report if it does not hold. Contradicting this
section is more useful than working around it. Beyond that: where this prompt
is ambiguous or silent, make a sensible choice, keep going, and record it in
the report's own-assumptions list.

1. The bug's likely home is one of two places: `computeSemiExterior`'s
   boundary construction only considering rooms, or the cluster shell builder
   dissolving cluster-to-cluster boundaries from both sides. Diagnose before
   fixing; do not trust this guess.
2. PROJECT_STATE §2n documents outdoor-to-stair keeping a full wall as
   deliberate. Check whether circulation-to-outdoor is documented as
   deliberate anywhere; if it is, stop the fix and report instead.
3. The three fixtures are project JSONs (`flat-configurator-project` v1) that
   Import accepts: `flat-1-two-storey.json` (2 floors, the bug is on its
   upper floor), `flat-2-single-storey.json`, `flat-3-terrace.json`. They are
   untracked until task 8 commits them.
4. Run 0008 left uncommitted: `src/core/rules.ts`, `README.md`,
   `package.json`, `package-lock.json`, `PROJECT_STATE.md`, and the new
   `src/core/exteriorEdges.test.ts`.
5. The test file reproduces about fifteen lines of `computeSemiExterior`'s
   boundary construction in its private `derive()`. The bug fix changes that
   construction, so without the refactor in task 3 the test and the app
   diverge the moment the fix lands.
6. The entrance model is one cell plus one side (`src/core/entrance.ts`),
   `makeEntranceMesh` in `src/scene/entranceView.ts` serves both marker and
   ghost, and the export must stay byte-identical for entrances.
7. `CONTEXT.md`'s claim that `src/core/` contains no three.js is false
   (`grid.ts:1`, `floor.ts:1`); the file is tracked and its correction rides
   the record commit automatically.
8. Deleting a placed element happens by selecting it and pressing Del.
   Re-import the fixture between deletion experiments rather than trusting
   undo.
9. Visual verification means the pane; DOM verification via the page works
   with the pane hidden. `npm test` exists and takes under a second.

## Task

0. **Probe the pane.** One screenshot. Hidden or shown, the run continues;
   this only decides whether tasks 6 and 7 run with pixels or get deferred.

1. **Commit run 0008's files** (assumption 4's list, exactly), message
   `E1 hard, first test (run 0008)`. Run `git status --porcelain` first and
   leave everything else out, including `testflats/`.

2. **Correct `CONTEXT.md`.** The `src/core/` line claims no three.js; make it
   true (grid and floor import three.js, and floor imports scene modules),
   keeping the section's brevity.

3. **Diagnose and fix the circulation-to-outdoor bug.** First reproduce it:
   import flat-1, upper floor, find the corridor against the balcony, and
   read the code to name the mechanism precisely. Check assumption 2 first.
   Then fix it so a circulation-to-outdoor boundary builds the wall and its
   french-window glazing the same way a habitable room's boundary does.
   Bathrooms stay excluded (privacy, `semiExterior.ts:151`), and
   outdoor-to-stair keeps its full wall per §2n.

   As part of the same change, export the boundary construction from
   `semiExterior.ts` as one named function and point the test's `derive()` at
   it, so the app and the test cannot diverge (assumption 5). Add a fifth
   test case for the circulation edge. `npm test` green after.

   The export's glazing content may grow because built glazing grew. The
   format does not change. Report the export delta on flat-1: what the
   dwelling-unit file lists before and after the fix, counts suffice.
   Exported glazing must equal built glazing on the same flat.

4. **Import each fixture and record its baseline.** Loads clean or not,
   console errors, floor and room counts. Screenshot each when the pane
   allows; DOM-level confirmation regardless.

5. **Write `## Views and modes` into the README,** for a first-time user, one
   short entry per control: DIAGRAM and TOP VIEW top left; CHECK LAYOUT,
   RESET VIEW and `?` top right; CUTAWAY, Seeds, Structure, Interface view
   and the compass bottom right; Export, Import, Export Unit, the floor list
   and the palette on the left. Source each from code, confirm by clicking
   where possible, and call out explicitly whether TOP VIEW works and what it
   renders, because meeting item 11 hangs on that answer.

6. **Baseline Check Layout per fixture,** full panel text quoted from the
   DOM. Then **the deletion stress test**, one deletion at a time with
   re-import between: the kitchen; one bathroom; the entrance; all doors of
   one room; one balcony piece adjacent to a room; the stair on flat-1.
   After each, Check Layout, and record what fired and what cleared. Quote
   any message that is wrong or confusing, and name the three worst messages
   in your judgment. If a deletion produces something that should fire and
   does not, that is a finding, not a fix; report it.

7. **Pane-only, in this order, each deferred with a plain statement if the
   pane is hidden:**
   a. The four outstanding checks from 0008's finding 2: balcony wall in the
      interface view; WET1 firing and clearing with its rendered text; FAC1
      firing and clearing with its rendered text; the exact restore.
   b. Pixel proof of the task-3 fix: the corridor-to-balcony wall and
      glazing standing, normal view and interface view.
   c. The entrance marker. Keep the `Entrance` model as it is; derive the
      second cell: prefer the east neighbour on north- and south-facing
      walls and the south neighbour on east- and west-facing walls, fall
      back to the other side, and keep the one-cell marker when neither
      qualifies, so no saved project becomes invalid. Widen
      `makeEntranceMesh` (marker and ghost together), give it a door-leaf
      profile and a flat `Entry` label lying in the plane of the wall
      (canvas texture; if it is illegible at normal zoom, report with a
      screenshot rather than silently switching to a camera-facing sprite).
      E2 keeps checking the anchor. Export untouched. Screenshots in normal
      view and interface view.

   **If the pane stayed hidden, close the run by writing a manual
   verification script for Shrey:** every deferred visual claim as a
   numbered sequence of exact placements, exact clicks and the exact
   expected outcome of each step, in the order he should walk them, so one
   short pass in the app closes everything this run could not see. Write it
   for someone doing it quickly, one action per step, nothing to interpret.

8. **Commits.** The fixtures and the README section as
   `Test flats and modes guide (run 0009)`. The task-3 fix as its own commit
   `Circulation-to-outdoor wall and glazing (run 0009)` ONLY if task 7b
   proved it with pixels; otherwise it stays uncommitted for Shrey with a
   note. Marker changes stay uncommitted for Shrey's eyes regardless.

9. **Update `PROJECT_STATE.md`** for everything this run changed.

10. **Verify.** `tsc`, `npm run build`, `npm test`, all clean, output quoted.

If the run runs long: drop 7c first, then 7a and 7b, then 6's later flats.
Tasks 1, 2, 3 and the fixtures-plus-README commit are the point, because the
push for Prof. Ng depends on them.

## Constraints

- Code changes stay uncommitted apart from the commits tasks 1, 3/8 and 8
  name. The record commit stages `_cowork/` as the skill says. Never push.
- No change to the `dwelling-unit` export format or `docs/bridge-format.md`;
  content may change only as task 3 describes. Touch nothing under `docs/`.
- Rules never block placement, save or export. WET1, FAC1 and E1 are not
  modified.
- No interior-solver work.
- `npm test` runs alongside `tsc` and the build for any change under
  `src/core/`.

## What I need back

Quote raw command output rather than summarising it, and state the
verification rung for each claim separately.

1. Pane state, first.
2. All commit hashes with `git show --stat`, and for the task-3 fix, which
   branch of task 8 applied.
3. The `CONTEXT.md` correction, quoted.
4. The bug: mechanism named with files and lines, the fix, the exported
   boundary function's name and both call sites, the fifth test case, and
   `npm test` output.
5. The export delta on flat-1, counts before and after.
6. Fixture baselines, and the full baseline Check Layout text per flat.
7. The README section, quoted in full, with the TOP VIEW answer called out.
8. The deletion log: per deletion, fired and cleared, quoted texts for
   anything wrong, and the three worst messages.
9. Task 7's evidence, or the manual verification script: numbered steps,
   exact placements and clicks, the expected outcome of each, covering every
   deferred claim in the order Shrey should walk them.
10. `tsc`, `npm run build`, `npm test` output.
11. Anything that contradicts the Assumptions section.
12. Your own assumptions, including every sensible choice made where the
    prompt was ambiguous or silent, each with what it affected.

The report follows `WRITING.md`: connected sentences that carry their own
logic, no em dashes as glue, no contrast flourishes, neutral voice, plain
words, prose before any list or table, and every number exact.
