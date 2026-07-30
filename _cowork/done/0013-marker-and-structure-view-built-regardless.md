---
id: "0013"
title: Marker, Structure view, plans, and the backlog
created: 2026-07-30
---

## Context

Four runs have deferred the entrance marker because its acceptance is visual
and the pane kept dying. The policy changes here, deliberately: this run
BUILDS everything whatever the pane says. The safety is the working pattern
of this bridge: nothing enters history before Shrey's eyes except the two
commits this prompt names, and one `git checkout --` undoes an unseen build
that fails his eye. Four deferrals with the review on Tuesday is the larger
risk.

This run is also deliberately large, because a stronger model is running it.
The ladder at the end of the Task section says what matters most if it runs
long. Beyond the two visual items, it takes the next review-critical piece,
readable floor plans (meeting item 11, reachable now that TOP VIEW is proven
to work), one meeting commitment that is pure repo work (item 25, the PDFs),
the export test, the N1 and DP1 explanations, and, as the stretch, the
orientation preference (meeting item 7), which is cheap now because the
panel already derives glazing orientation per room.

## Assumptions

These may be wrong. Where a task depends on one, check it rather than
trusting it, and say in the report if it does not hold. Contradicting this
section is more useful than working around it. Beyond that: where this
prompt is ambiguous or silent, make a sensible choice, keep going, and
record it in the report's own-assumptions list.

1. Run 0012 left modified: `src/core/rules.ts` (ST3 plus the three gating
   filters), `README.md`, `PROJECT_STATE.md`, and the untracked
   `testflats/flat-1-no-stair.json`. Five tests green at that state, both
   fixture panels measured in its report.
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
6. TOP VIEW (`enterPlanMode`, `src/main.ts:403-414`) hides floors above the
   active one, shows door-swing arcs, locks rotation and frames from top.
   How it composes with the Interface and Structure toggles has never been
   observed.
7. Canonical panels: `flat-1-two-storey.json` reads
   `12 issues (1 hard, 11 soft)`; `flat-1-no-stair.json` reads
   `7 issues (1 hard, 6 soft)` with ST3 as the hard. Any drift needs a
   named cause.
8. `buildUnitExport` may or may not run headlessly over a `FloorManager`.
   If constructing one drags the render layer into the suite, report the
   cost and skip that task rather than forcing it.
9. N1 stopped firing and DP1 plausibly stopped on the no-stair fixture;
   neither computation has been read.
10. `docs/rules-list.pdf` and `docs/rules-reference.pdf` are generated
    artifacts (by `docs/build-pdf.py` from the HTMLs), Shrey committed in
    the meeting to moving them to the Drive, and git history keeps them
    retrievable after removal.
11. The project JSON (`flat-configurator-project` v1) is tolerant and
    versioned, so an additive optional field is legal there. The
    `dwelling-unit` export is a separate contract and stays frozen.
12. The panel already derives and displays glazing orientation per room, so
    an orientation-preference rule can compare against an existing
    derivation rather than computing anything new.

## Task

0. **Probe the pane.** One screenshot, note the state, continue regardless.
   It only decides screenshots versus the closing walk.

1. **Commit run 0012's files:** `src/core/rules.ts`, `README.md`,
   `PROJECT_STATE.md` and `testflats/flat-1-no-stair.json`, message
   `ST3 stair rule with reachability gating (run 0012)`. ST3 is
   panel-verified, so it enters history. `git status --porcelain` first;
   nothing else rides along.

2. **The entrance marker. Build it now, unconditionally.** Keep the model
   untouched; derive the second cell at draw time: prefer the east
   neighbour on north- and south-facing walls and the south neighbour on
   east- and west-facing walls, fall back to the other side, keep the
   one-cell width when neither qualifies, so no saved project becomes
   invalid. Rework `makeEntranceMesh` into a door-leaf profile in the
   doorView drawing language, two cells wide, with a flat `Entry` label in
   the plane of the wall (canvas texture; if you have pixels and it is
   illegible at normal zoom, show that rather than silently switching to a
   camera-facing sprite). It must survive the interface view, the cutaway
   and dimming through the `baseColor` conventions. E2 keeps checking the
   anchor edge. The export stays byte-identical, proven by exporting a flat
   with an entrance before and after and diffing, which needs no pixels.
   Screenshots (normal view, interface view, zoomed to review distance) if
   the pane allows.

3. **The Structure view rework. Build it now, unconditionally.** New
   meaning, the fixed layer: bathrooms, kitchens and stairs render as
   built, walls and furniture included, and the staircase must no longer
   hide. Everything else, dry rooms, circulation and outdoor alike, drops
   to bare neutral plates with no walls and no furniture, the
   interface-view stripping pattern with a stricter filter. Structure and
   Interface toggles: mutually exclusive or composing, choose the cheaper,
   report which. Record what the old elastic x-ray did in
   `PROJECT_STATE.md`. Screenshots on flat-1 via the loader if the pane
   allows, plus a toggle-off restore check.

4. **Readable plans, meeting item 11.** First make the three display modes
   compose lawfully: TOP VIEW plus Interface view should give a plan of the
   contract, TOP VIEW plus the new Structure view a plan of the fixed
   layer, and any combination that cannot work should refuse cleanly
   rather than half-render. Fix what is trivially wrong; report what is
   not. Then, pane permitting, capture the review set on flat-1: per
   floor, the plain plan, the interface plan and the structure plan, six
   captures, each with door arcs visible. These captures are Tuesday's
   material and the proof that "extracted floor plans" exist.

5. **The PDFs leave the repo, meeting item 25.** `git rm docs/rules-list.pdf
   docs/rules-reference.pdf`, keep the HTMLs and `docs/build-pdf.py`, add
   one README line saying the PDFs are generated on demand and live on the
   Drive. Commit as `Remove generated PDFs from the repo (meeting item 25)`.
   This is the one sanctioned exception to the docs/ constraint, scoped to
   exactly these two paths. Shrey uploads them to the Drive himself.

6. **The export test.** A new test case building a small layout with a
   room, a corridor and an adjacent open balcony, running the real
   derivations, asserting the exported glazed set equals the built glazed
   set: the f2af130 invariant made permanent, with the export delta as a
   measured number. Assumption 8 governs; a skip with a stated cost is
   acceptable, the render layer in the suite is not.

7. **Explain N1 and DP1.** Read both computations and say why each stopped
   firing on the no-stair fixture. If a cause is an unintended side effect
   of the gating, fix it and re-measure both panels. If it is pre-existing
   behaviour, quote the deciding line and change nothing.

8. **Stretch: orientation preference, meeting item 7.** A per-project
   preference input (a preferred orientation and an avoid orientation,
   either optional, stored as an additive optional field in the project
   JSON per assumption 11, never in the dwelling-unit export). One new
   soft rule comparing habitable rooms' derived glazing orientation
   against the avoid preference, message naming the room, its orientation
   and the preference, citation-free because it is preference rather than
   law. UI in the left panel near the compass. If this task is reached,
   README gets its rule row.

9. **Update `PROJECT_STATE.md`** for everything that ran.

10. **Verify.** `tsc`, `npm run build`, `npm test`, all clean, quoted.
    Re-measure both fixture panels through `?project=` and compare to
    assumption 7, naming the cause of any drift. If the pane stayed hidden,
    close with the manual walk: numbered steps, exact placements and
    clicks, the expected outcome of each, covering the marker in all three
    views, the Structure view on and off, the plan compositions, and, if
    built, the orientation rule firing.

If the run runs long, the ladder: tasks 1, 2 and 3 are the point; then 4,
then 5; then 6 and 7; task 8 slips first and without apology.

## Constraints

- Code changes stay uncommitted apart from the commits tasks 1 and 5 name.
  Never push.
- No change to the `dwelling-unit` export format; `entrance.ts` untouched;
  `docs/` untouched except task 5's two `git rm` paths.
- The project JSON may gain the one additive optional field task 8
  describes, tolerated by old files; nothing else in it changes.
- Rules never block placement, save or export. WET1, FAC1, E1 and ST3
  semantics unchanged except a task-7 fix with its cause named.
- No interior-solver work.
- `npm test` runs alongside `tsc` and the build for any change under
  `src/core/`.

## What I need back

Quote raw command output rather than summarising it, and state the
verification rung for each claim separately.

1. Pane state, first.
2. Both commit hashes with `git show --stat`.
3. The marker: the derivation rule with its fallback cases, the label
   mechanism, the export byte-identity diff, and screenshots or walk steps.
4. Structure view: the exact filter, where the old x-ray is recorded, the
   exclusivity-or-composition choice, and screenshots plus restore proof or
   walk steps.
5. Plans: what composes with what, what was fixed, what refused, and the
   six captures or their walk steps.
6. The export test: the case quoted, the measured delta, or the stated
   cost of skipping.
7. N1 and DP1: each explanation with the deciding line quoted, and what if
   anything changed.
8. If reached, the orientation preference: where it is stored, the rule
   quoted, its rendered message, and a screenshot or walk step.
9. Both fixture panels re-measured, with any drift named.
10. `tsc`, `npm run build`, `npm test` output.
11. Anything that contradicts the Assumptions section.
12. Your own assumptions, including every sensible choice where the prompt
    was ambiguous or silent, each with what it affected.

The report follows `WRITING.md`: connected sentences that carry their own
logic, no em dashes as glue, no contrast flourishes, neutral voice, plain
words, prose before any list or table, and every number exact.
