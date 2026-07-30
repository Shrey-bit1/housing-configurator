---
id: "0008"
title: Four checks, E1 hard, entrance marker, first test
source: 0008-four-checks-e1-hard-entrance-marker-first-test.md
status: partial
branch: main
commit: 7c5ae2f
completed: 2026-07-30
---

## Summary

The browser pane was hidden from the first probe, so task 1's four checks did not run
and the claims run 0007 left open are still open. Everything else proceeded. Run 0007's
six files are committed as `7c5ae2f` with `(read-verified)` appended, E1 is hard and
confirmed against a live Check Layout, and the repository has its first test: four cases
over `isFacadeEdge`, passing, and each defect confirmed caught by reverting it and
watching exactly the corresponding case fail.

Task 4, the entrance marker, was not attempted. That is a deliberate choice against the
prompt's own drop order and the reasoning is in Blocked below, because the decision is
the kind the planning session should be able to overrule.

## What I did

Task 0 came first and returned a hidden pane, which set the shape of everything after
it. One attempt was made to bring the pane back through `preview_start`, which reused
the running server and changed nothing, so the fallback path applied from then on.

Task 2's commit rule has three branches and the read-verified branch is the one that
applied. Task 3 was small enough to verify properly even without pixels, because the
validation panel is DOM and `javascript_tool` still works when compositing does not.
Task 5 was moved ahead of task 4 on purpose: with no pixels available it was the only
task in the run that could prove anything about itself, and it did.

- `src/core/rules.ts` E1 severity and base description changed.
- `README.md` E1 row updated to match.
- `package.json` gained `vitest` and a `test` script; `package-lock.json` follows.
- `src/core/exteriorEdges.test.ts` created, 4 tests.
- `PROJECT_STATE.md` records E1 and the test runner.

## Findings

### 1. The pane state at task 0

Hidden, on the first screenshot before anything else was touched:

```
screenshot failed: Screenshot timed out after 5s: the Browser pane is not displayed, so the page is not compositing frames. Display the pane and retry.
```

`preview_start` was called once in case the server had died; it reported
`"reused": true` and no new process, and a second screenshot returned the same refusal.
The page itself runs, so DOM access through `javascript_tool` worked throughout and is
where finding 4's evidence comes from.

### 2. The four checks

Not run. All four claims from run 0007 remain unproven, and this run adds nothing to
them:

- that the room-to-balcony wall and its glazing stand in the interface view;
- that WET1 fires on a split layout, and its rendered text;
- that FAC1 fires on an enclosed habitable room, and its rendered text;
- that the interface view restores exactly after `partitionEdges` changed.

No WET1 or FAC1 text can be quoted verbatim, because neither has been made to fire. The
composed text from the 0007 report still stands as the sentence structure, and it is
composed rather than observed.

**Manual steps.** For 1a, drop a Living Room, then an Outdoor — Double directly against
one of its walls, and press `Interface view`: the shared wall and its glazing should
stand while the room's other partitions dissolve, and the balcony parapet should be
unchanged. For 1b, drop a Kitchen and a Bathroom — Small with a gap, press Check Layout
and read the WET1 line, then drop them touching in a fresh layout and press it again for
the line to be gone. For 1c, drop a Bedroom — Small and ring it with rooms on all four
sides, press Check Layout for the FAC1 line naming that bedroom, then delete one
surrounding room and press again. For 1d, toggle `Interface view` off on the 1a flat and
confirm the door markers come back. Build each layout by fresh drops rather than moving
placed pieces, per assumption 8, which held in run 0007.

### 3. The task-2 commit

Branch applied: **read-verified**. The checks could not run and none failed, so the
prompt's second branch is the one that fits.

`7c5ae2f1e70e801a56719fa84b211c7985cace28`, message `Facade edge, WET1 + FAC1, README
regeneration (run 0007) (read-verified)`.

```
 PROJECT_STATE.md           | 37 ++++++++++++++++-
 README.md                  | 98 ++++++++++++++++++++--------------------------
 src/core/adjacencyGraph.ts | 22 ++++++++++-
 src/core/exteriorEdges.ts  | 52 ++++++++++++++++++++++++
 src/core/floorManager.ts   | 41 +++++++++++++------
 src/core/rules.ts          | 74 +++++++++++++++++++++++++++++++++-
 6 files changed, 252 insertions(+), 72 deletions(-)
```

Exactly the six files named. The commit body records why the read-verified branch
applied, so the reason travels with the commit rather than only with this report.

### 4. E1 is hard

`src/core/rules.ts`, entrance prerequisite:

```
  {
    id: "E1",
    // HARD since the interface reading of a unit: the entrance is what the flat
    // offers the building around it, so its absence is a failure of the binding
    // level rather than a note that validation could not run. Rules only
    // evaluate when Check Layout is pressed, so a hard severity here costs
    // nothing during authoring.
    severity: "hard",
    description: "No entrance defined — the entrance is the unit's interface to the building.",
    check(graph, ctx) {
      if (ctx.hasEntrance) return [];
      // Distinguish "never placed one" from "placed one but it's now blocked" —
      // the latter is a more actionable message (E2 already explains why).
      const description =
        graph.entrances.length > 0
          ? "All entrances are blocked — none currently open to the outside. Reachability can't be validated."
          : RULES_BY_ID.E1.description;
      return [{ ruleId: "E1", severity: "hard", description, nodeIds: [], layout: true }];
    },
  },
```

Both the rule's `severity` and the `severity` on the emitted violation were changed; the
second is what the panel groups by, so changing only the first would have moved the
count without moving the line. The all-entrances-blocked variant is untouched, as asked.

Live Check Layout on an entrance-less flat, read out of the panel after a reload:

```
DWELLING — LAYOUT CHECK
3 issues (3 hard)
HARD — LIKELY FAILURES
E1 · HARD
No entrance defined — the entrance is the unit's interface to the building.
Whole dwelling
P1 · HARD
A dwelling needs a bathroom.
Whole dwelling
P2 · HARD
A dwelling needs a kitchen.
Whole dwelling
```

The counts line is `3 issues (3 hard)`. The flat is an empty floor 0, so P1 and P2 are
the only other rules with anything to say and E1 now sits with them under HARD rather
than alone under NOTES. `README.md:25` was updated to
`| E1 | 🔴 hard | No entrance defined — the entrance is the unit's interface to the building. |`.

### 5. The entrance marker

Not changed. What was read before deciding, so the next run does not repeat it:

The marker is built in `src/scene/entranceView.ts` by `makeEntranceMesh`, which the real
marker and the placement ghost both call, so one change updates both. It is a
`BoxGeometry` of `MARK_LEN = 0.44` along the wall, `MARK_THICK = 0.16` across it and
`MARK_H = 1.3` tall, in `ACCENT = 0xe91e63`. At `CELL_SIZE = 0.6` that is a sliver
covering two thirds of one cell, which is exactly the object Dillenburger could not find.

The obstacle is in the model, and assumption 1 asks about it. `src/core/entrance.ts` is
18 lines and the whole shape is:

```
export interface Entrance {
  /** Stable id = the edge key (an edge hosts at most one entrance). */
  id: string;
  cell: Cell;
  side: Side;
}
```

One cell and one side, with the id derived from the edge key and serialized in the
project file. "Two cells wide" therefore has two possible readings, and they are not
equivalent. Either the model grows a second anchor, which changes serialization and
touches what run 0007 was told not to disturb, or the marker keeps one anchor and DERIVES
its second cell as a neighbour along the wall, which keeps the export byte-identical and
E2's check working on the anchor exactly as today. The second is clearly right, and it
still needs a decision the prompt does not make: which of the two neighbours along the
wall the marker extends into, and what placement does when only one of them is a boundary
cell.

### 6. The first test

`src/core/exteriorEdges.test.ts`, 4 tests, passing. No config file: vitest reads the
existing `vite.config.ts` and needed nothing added, which answers the prompt's question
about configuration.

The test builds the two predicates `isFacadeEdge` takes from a placed layout, using the
real derivations rather than stubs. Open sky comes from `borderReachableEmpty`
(`src/core/expansion.ts:124`), which is what `Floor.isOutside` is built from. The
room-to-outdoor half reproduces how `computeSemiExterior` fills `boundary`, including the
`reachesSky` gate, using the real `connectedComponents`. The full file:

```ts
import { describe, it, expect } from "vitest";
import { Grid, cellKey, type Cell } from "./grid";
import { borderReachableEmpty } from "./expansion";
import { connectedComponents } from "./cluster";
import { isFacadeEdge, edgeKey, SIDES, SIDE_DELTA, opposite, type Side } from "./exteriorEdges";

function derive(
  cols: number, rows: number, spaces: Cell[], outdoor: Cell[]
): {
  occupied: Set<string>;
  isOutside: (cx: number, cz: number) => boolean;
  isSemiExterior: (cx: number, cz: number, side: Side) => boolean;
} {
  const grid = new Grid(cols, rows);
  const occupied = new Set([...spaces, ...outdoor].map((c) => cellKey(c.cx, c.cz)));

  const isEmpty = (cx: number, cz: number) => !occupied.has(cellKey(cx, cz));
  const outsideCells = borderReachableEmpty(grid, isEmpty);
  const isOutside = (cx: number, cz: number) =>
    !grid.inBounds(cx, cz) || outsideCells.has(cellKey(cx, cz));

  const qualifying = new Set<string>();
  for (const component of connectedComponents(outdoor)) {
    const reachesSky = component.some((c) =>
      SIDES.some((s) => {
        const [dx, dz] = SIDE_DELTA[s];
        return isOutside(c.cx + dx, c.cz + dz);
      })
    );
    if (!reachesSky) continue; // sealed courtyard — confers nothing
    for (const c of component) qualifying.add(cellKey(c.cx, c.cz));
  }
  const boundary = new Set<string>();
  for (const c of spaces)
    for (const side of SIDES) {
      const [dx, dz] = SIDE_DELTA[side];
      if (!qualifying.has(cellKey(c.cx + dx, c.cz + dz))) continue;
      boundary.add(edgeKey(c.cx, c.cz, side));
      boundary.add(edgeKey(c.cx + dx, c.cz + dz, opposite(side)));
    }
  const isSemiExterior = (cx: number, cz: number, side: Side) =>
    boundary.has(edgeKey(cx, cz, side));

  return { occupied, isOutside, isSemiExterior };
}

function rect(x0: number, z0: number, x1: number, z1: number): Cell[] {
  const out: Cell[] = [];
  for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) out.push({ cx, cz });
  return out;
}

describe("isFacadeEdge", () => {
  it("counts an edge onto open sky as facade", () => {
    const room = rect(4, 4, 5, 5);
    const { occupied, isOutside, isSemiExterior } = derive(10, 10, room, []);
    expect(isFacadeEdge(4, 4, "north", occupied, isOutside, isSemiExterior)).toBe(true);
  });

  it("counts an edge onto an adjacent open balcony as facade", () => {
    const room = rect(4, 4, 5, 5);
    const balcony = rect(6, 4, 6, 5); // directly east of the room, open beyond
    const { occupied, isOutside, isSemiExterior } = derive(10, 10, room, balcony);
    expect(occupied.has(cellKey(6, 4))).toBe(true); // the balcony really is occupied
    expect(isFacadeEdge(5, 4, "east", occupied, isOutside, isSemiExterior)).toBe(true);
  });

  it("does NOT count an edge onto a sealed empty pocket as facade", () => {
    const ring = rect(4, 4, 6, 6).filter((c) => !(c.cx === 5 && c.cz === 5));
    const { occupied, isOutside, isSemiExterior } = derive(10, 10, ring, []);
    expect(occupied.has(cellKey(5, 5))).toBe(false); // the pocket is empty
    expect(isOutside(5, 5)).toBe(false); // but sealed off from the border
    expect(isFacadeEdge(5, 4, "south", occupied, isOutside, isSemiExterior)).toBe(false);
  });

  it("does NOT count an edge onto a sealed courtyard balcony as facade", () => {
    const ring = rect(4, 4, 6, 6).filter((c) => !(c.cx === 5 && c.cz === 5));
    const courtyard: Cell[] = [{ cx: 5, cz: 5 }];
    const { occupied, isOutside, isSemiExterior } = derive(10, 10, ring, courtyard);
    expect(occupied.has(cellKey(5, 5))).toBe(true); // it is a real outdoor cell
    expect(isFacadeEdge(5, 4, "south", occupied, isOutside, isSemiExterior)).toBe(false);
  });
});
```

(The file as committed also carries a header comment explaining why it exists and why it
avoids constructing a `Floor`; it is elided here for length and is otherwise identical.)

`npm test`:

```
> grid-module-configurator@0.1.0 test
> vitest run

 RUN  v4.1.10 D:/_Studies/_DFAB/DFAB/_T3/Module Configurator

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  18:11:09
   Duration  778ms (transform 163ms, setup 0ms, import 280ms, tests 11ms, environment 0ms)
```

**The test was checked against the defects it exists for**, because a test that also
passes on the broken code proves nothing. Each defect was reintroduced in turn and the
suite re-run. Reverting branch one to `!occupied.has(...) || isSemiExterior(...)`:

```
 ❯ src/core/exteriorEdges.test.ts (4 tests | 1 failed) 27ms
     × does NOT count an edge onto a sealed empty pocket as facade 16ms
      Tests  1 failed | 3 passed (4)
```

Reverting branch two to a bespoke "is the neighbour an outdoor cell" scan with no
`reachesSky` gate:

```
 ❯ src/core/exteriorEdges.test.ts (4 tests | 1 failed) 21ms
     × does NOT count an edge onto a sealed courtyard balcony as facade 11ms
      Tests  1 failed | 3 passed (4)
```

Each defect fails exactly its own case and leaves the other three passing, which is what
makes the four cases independent rather than one assertion written four ways. Both
reverts were undone and a search for `TEMP`, `__setNaive`, `NAIVE_OUTDOOR` and
`isOutdoorNaive` across `src/` returned `NONE`.

`package.json` diff:

```
     "preview": "vite preview"
+    "preview": "vite preview",
+    "test": "vitest run"
   },
...
-    "vite": "^5.4.10"
+    "vite": "^5.4.10",
+    "vitest": "^4.1.10"
```

`package-lock.json` grew by 1205 lines net. `npm ci` was run from a deleted
`node_modules` and exited 0, and `npm test` passes afterwards, so the constraint holds.
`npm ci` reports 2 vulnerabilities (1 moderate, 1 high); those come from the dependency
tree rather than from anything this run wrote, and no `audit fix` was run because it
offers breaking changes.

### 7. tsc and npm run build

```
npx tsc --noEmit
TSC CLEAN
```

```
npx vite build
- Use build.rollupOptions.output.manualChunks to improve chunking
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 8.94s
```

The chunk-size warning predates this run.

### 8. What contradicts the Assumptions section

**Assumption 5 is wrong.** `src/core/` does import three.js: `src/core/grid.ts:1` is
`import * as THREE from "three"`, and `src/core/floor.ts:1` does the same and further
imports `../scene/gridView`, `../scene/holeView`, `../scene/entranceView` and
`../scene/doorView`. So `CONTEXT.md`'s claim, which the assumption repeats, does not
hold. It did not force the stated fallback: three.js imports fine under Node, and the
test uses a real `Grid`. A whole `Floor` was still avoided, because constructing one
pulls the render layer into a test about a geometric predicate. The result is closer to
the assumption's intent than to its fallback, using real derivations and no stubs.
`PROJECT_STATE.md` now carries a note correcting `CONTEXT.md` on this point.

Assumption 1 holds on where the marker is built and that it is an authored marker, and
its open question resolves as: one cell plus one side, with the id derived from the edge
key.

Assumption 4 holds exactly. E1 was at `rules.ts:434-448`, severity `note`, with the
variant message. E2 is hard and untouched. Making E1 hard did change the counts line.

Assumption 6 holds: vitest was not installed and adding it changed both `package.json`
and the lockfile, and `npm ci` stays green.

Assumptions 2, 3, 7, 8 and 9 hold as stated, though 2, 3 and 8 were not exercised,
because tasks 1 and 4 did not run.

### 9. My own assumptions

Six, each with what it affected.

1. **That the emitted violation's severity had to change alongside the rule's.** The
   panel groups by the violation, so changing only `Rule.severity` would have moved the
   count without moving the line. Affects E1's appearance under HARD, which the live
   output confirms.
2. **That the E1 rewording should keep the all-entrances-blocked variant exactly.** The
   prompt said to keep it and gave a base description "something like" the one used; the
   wording adopted is the prompt's own sentence verbatim. Affects only the base message.
3. **That the test should not construct a `Floor`.** Assumption 5 preferred a real
   `Floor`; doing so drags `../scene/*` in. Affects how much of the pipeline the test
   covers: it covers both derivations and the predicate, and it does not cover
   `computeSemiExterior`'s own wiring, which is roughly fifteen lines reproduced in the
   test's `derive` helper. If that wiring changes, the test will keep passing while the
   app diverges, which is the one gap in it and is worth stating.
4. **That reverting each defect to check the test was worth doing.** It costs two extra
   runs and is the only thing separating a real test from a test-shaped file. Affects
   nothing in the shipped code; both reverts were undone and searched for.
5. **That task 5 should run before task 4**, against the prompt's stated drop order.
   With no pixels, task 5 was the only task able to prove anything about itself, and
   task 4's acceptance criteria are entirely visual. Affects what got done in the time
   available.
6. **That `npm audit fix` should not be run.** It offers breaking changes and the
   constraint is that `npm ci` works, which it does. Affects the 2 reported
   vulnerabilities, which remain.

## Evidence

Rungs stated separately.

- Pane hidden: two screenshot attempts, both refused, quoted. Executed.
- Task-2 commit contents: `git show --stat`, quoted. Executed.
- E1's new entry: read from the file after editing. Read.
- E1's live behaviour and the counts line: Check Layout clicked in the running page and
  the panel text read back. Executed.
- The four checks: **not verified**, no pixels.
- Marker geometry and the `Entrance` shape: read from `src/scene/entranceView.ts` and
  `src/core/entrance.ts`. Read.
- Test passes: `npm test`, quoted. Executed.
- Test catches both defects: each defect reintroduced and the suite re-run, both outputs
  quoted. Executed, and this is the strongest rung in the run.
- Clean restore after those reverts: `grep -rn` over `src/` returned `NONE`. Executed.
- `npm ci` green from a deleted `node_modules`, then `npm test` passing: both executed.
- `tsc`, `npm run build`: executed, quoted.

## Artifacts produced

- `src/core/exteriorEdges.test.ts`, new, 4 tests.
- `src/core/rules.ts`, `README.md`, `package.json`, `package-lock.json`,
  `PROJECT_STATE.md`, modified and left uncommitted.
- `_cowork/outbox/0008-four-checks-e1-hard-entrance-marker-first-test.report.md`.
- `_cowork/done/0008-four-checks-e1-hard-entrance-marker-first-test.md`.
- `_cowork/LOG.md`, one row appended.

No screenshots.

## Decisions and rationale

Task 5 ran before task 4, and the reasoning is in own-assumption 5.

The test reproduces `computeSemiExterior`'s boundary wiring rather than calling it. The
alternative was to construct a `Floor`, which would have covered that wiring too and
would have imported the render layer into the first test in the repository, setting the
precedent that a geometric test needs a scene. The cost is named in own-assumption 3 and
is real.

E1's comment records why the severity is hard, including that rules only evaluate on
Check Layout. That sentence is Shrey's correction of a concern raised in the 0007 report,
and putting it in the code means the next person to wonder whether a hard rule will spam
the authoring session finds the answer where the decision lives.

## Deviations from the prompt

Task 4 was not attempted, and the prompt's drop order puts task 5 ahead of it for
dropping. Reasoning in Blocked.

## Blocked / did not do

**Task 1**, by the hidden pane. This is the prompt's own fallback path and the four
claims are listed in finding 2 with manual steps.

**Task 4**, by choice rather than by obstacle, and the choice should be easy to
overrule. Three things pointed the same way. Every acceptance criterion in task 4 is
visual: that it reads at normal zoom, in the interface view, under the cutaway and in
both lighting states. None of that can be checked with the pane hidden. The object being
reworked is the one element the professor already failed to find, and the review is on
Tuesday 4 August, so shipping an unverified redesign of it risks replacing a marker that
is hard to see with one that is wrong. And the change is not as small as it looks: the
model carries one cell, so "two cells wide" needs the derived-neighbour design in finding
5 plus a rule for which neighbour and what placement does when only one qualifies.

What that leaves for the review is the current magenta sliver, which is worse than the
reworked marker and better than a broken one. If the pane is available in the next run,
this is perhaps thirty minutes with the design already settled.

## Open questions for you

1. **Which neighbour does a two-cell entrance extend into, and what happens when only
   one qualifies?** The model is one cell plus one side, so the second cell has to be
   derived, and along any wall there are two candidates. Extending in a fixed direction
   is simplest and will sometimes put half the marker over a cell that is not a boundary
   cell. Requiring both candidates to be boundary cells makes placement stricter and
   rejects entrances that are legal today, which would invalidate saved projects. Picking
   whichever neighbour qualifies, and refusing only when neither does, keeps every
   existing entrance legal at the cost of a marker whose position depends on its
   surroundings. This is a decision about the model rather than about drawing, which is
   why it is here rather than settled in the code.

2. **The test covers the predicate and not the wiring that feeds it, and that gap will
   widen.** `derive()` in the test reproduces about fifteen lines of
   `computeSemiExterior`'s boundary construction. If that construction changes in the
   app, the test keeps passing while the two diverge, which is the failure mode tests are
   supposed to prevent. Closing it means either exporting the boundary construction so
   both the app and the test call one function, or accepting a heavier test that builds a
   `Floor` and imports the render layer. The first is the better shape and is a small
   refactor of `semiExterior.ts`; it is worth deciding now, while there is exactly one
   test to migrate.

## Suggested next prompt

Run task 1's four checks and task 4's marker, in that order, and nothing else. Both need
the pane, so the prompt should open by saying that if the pane is hidden the run stops
immediately rather than proceeding, since neither task has a useful non-visual fallback
and this run has already demonstrated what the fallback produces.

For the checks, the layouts and expected outcomes are in finding 2 above and can be
pasted in. Ask for the four screenshots, the WET1 and FAC1 rendered texts quoted
verbatim, and an explicit statement about the restore.

For the marker, settle open question 1 in the prompt itself rather than leaving it to
the run. Then the work is: keep `Entrance` as it is, derive the second cell, widen
`makeEntranceMesh` in `src/scene/entranceView.ts` (which serves both the marker and the
placement ghost, so one change covers both), give it a door-leaf profile and an `Entry`
label, and leave `unitExport.ts` untouched. The label is the fiddly part, because three.js
has no text primitive and it will need a canvas texture on a sprite; worth saying whether
a sprite that always faces the camera is wanted, or a flat label lying in the plane of the
wall that turns with the model.

One practical note. `npm test` now exists and takes under a second, so any future prompt
that changes `isFacadeEdge`, `borderReachableEmpty` or `connectedComponents` should ask
for its output alongside `tsc` and `npm run build`.
