---
id: "0011"
title: Marker, Structure view, circulation glazing, stair rule
source: 0011-marker-structure-view-circulation-glazing-stair-rule.md
completed: 2026-07-30
status: partial
branch: main
commit: a43604a
---

## Summary

Tasks 0, 1 and 2 are done. Run 0010's four files are committed, and cause B is closed:
circulation clusters now enter the semi-exterior system through a parallel map, the
boundary construction is one exported function that the app and the test both call, and
the suite is five cases green.

Task 2 turned up something the prompt did not anticipate. `unitExport.ts` carries the
same rooms-only filter that caused the bug, so making corridors glazed would have made
built glazing and exported glazing disagree, which is the invariant the prompt names.
That is fixed in the same change rather than left.

Tasks 3, 4 and 5 are not done. The pane was alive throughout, so nothing was blocked;
the run simply ended.

## What I did

Task 2 was the whole run. The prompt's decision, a parallel map, held up: rooms and
corridors are different kinds of thing, an instance and a merged component, and keeping
them in separate maps meant the room path was not touched at all.

Extracting the boundary construction first was what made the rest small. Once
`semiExteriorBands` existed, the corridor path was a second caller of it rather than a
second copy, and pointing the test's `derive()` at it closed the divergence assumption 4
describes.

Checking the export was not asked for as a risk, only as a measurement, and it is where
the run's most useful finding came from.

- `src/core/semiExterior.ts`: `glazedByCluster` on the plan, `semiExteriorBands`
  exported, the corridor loop added.
- `src/scene/clusterShells.ts`: a windows map per component, wired into
  `buildBoundaryWalls`.
- `src/core/unitExport.ts`: cluster glazing added to the exported glazed set.
- `src/core/exteriorEdges.test.ts`: `derive()` points at the exported function, fifth
  case added.

## Findings

### 1. Pane state

Alive. The first screenshot showed flat-1 loaded through `?project=` with the panel open
at `12 issues (1 hard, 11 soft)`, matching the canonical baseline exactly, including
`Room: Circulation (F1, 8,14)` on C1 and A1 with run 0010's disambiguated labels. Every
browser claim below is executed.

### 2. The task-1 commit

`a43604a6ae9c45a34ccbd9888e677948fb35475b`, message `Dev loader and label
disambiguation (run 0010)`.

```
 PROJECT_STATE.md          | 22 ++++++++++++++++++
 README.md                 |  5 +++-
 src/main.ts               | 59 +++++++++++++++++++++++++++++++++++++++++------
 src/ui/validationPanel.ts | 46 +++++++++++++++++++++++++++++-------
 4 files changed, 116 insertions(+), 16 deletions(-)
```

Exactly assumption 1's four files. `git status --porcelain` beforehand also showed the
0011 prompt and three untracked files under `docs/`, both left out.

### 3. Cause B, closed

**The map's shape.** `SemiExteriorPlan` gains
`glazedByCluster: Map<string, Set<string>>`, keyed by the cluster token
`clusterNodeId("circulation", component)`, which is the same token `buildSpaceTargets`
and the adjacency graph use, holding ABSOLUTE edge keys. `glazedByRoom` is untouched and
still keyed by room instance id. The doc comment says why they are two maps: a room is an
instance and a corridor is a merged component, so one map would hold two kinds of key and
every consumer would have to know which it was reading.

**The exported boundary function.** `semiExteriorBands(cells, qualifying, boundary)` in
`src/core/semiExterior.ts`, returning `{ glazed, accessTokens }` and recording every
boundary edge into `boundary` as a side effect. It is the code that previously sat inline
in the per-room loop, moved out unchanged: bucket boundary edges per side and line, split
into maximal contiguous runs, glaze a centred band whose width comes from
`frenchBandWidth`, and confer nothing on a one-cell contact.

Three call sites. The room loop in `computeSemiExterior`, unchanged in behaviour. The new
corridor loop in the same function, which collects circulation cells, runs
`connectedComponents` over them, and stores the result under the cluster token. And
`derive()` in `src/core/exteriorEdges.test.ts`, which previously reproduced about fifteen
lines of that construction privately, which is the divergence assumption 4 describes and
is now closed.

**The windows parameter.** `rebuildClusterShells` looks up
`floor.semiExterior?.glazedByCluster.get(nodeId)` for the component it is about to draw
and passes a `Map<string, WindowVariant>` of those keys at `"french"` into
`buildBoundaryWalls`, along with a glass material. It already computed `nodeId` for
highlight purposes, so nothing new had to be derived. Outdoor clusters get no entry and
therefore no glass, which is correct because a balcony is the outside.

Bathrooms stay excluded, because the exclusion is still at the top of the room loop and
the corridor loop never sees a bathroom. Outdoor-to-stair keeps its full wall, because
that lives in `clusterWallOpts` and was not touched.

**The fifth test case**, in `src/core/exteriorEdges.test.ts`:

```ts
  it("counts a CIRCULATION edge onto an open adjacent balcony as facade", () => {
    const corridor = rect(4, 4, 4, 6); // a 1x3 run of circulation cells
    const balcony = rect(5, 4, 5, 6); // directly east, open beyond
    const { occupied, isOutside, isSemiExterior } = derive(10, 10, corridor, balcony);
    expect(occupied.has(cellKey(5, 5))).toBe(true); // the balcony is occupied
    expect(isFacadeEdge(4, 5, "east", occupied, isOutside, isSemiExterior)).toBe(true);
  });
```

```
npm test
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

**The export, and the invariant this nearly broke.** `src/core/unitExport.ts` computes
its glazed edge set with `if (inst.def.category !== "room" || inst.def.cluster) continue;`,
which is the identical rooms-only filter that caused cause B in the first place. So after
making corridors glazed in the wall pass, the export would still have described only room
glass, and built glazing would no longer equal exported glazing on the same flat. That is
precisely the invariant the prompt states, and it would have been a silent divergence of
the kind this project has been bitten by before.

It is fixed in the same change: the cluster glazing is added to `glazedKeys` directly
rather than being re-derived through `computeWindows`, because a corridor has no daylight
target to make up a shortfall against, so the semi-exterior band is the whole of its
glass. The keys are already absolute, so they land in the same space.

**The export delta was NOT measured numerically**, which is the one part of task 2 left
open. Reading the export blob from the page failed: patching `URL.createObjectURL` from
`javascript_tool` did not capture the export's blob, apparently because the tool's script
context and the page's are not the same `window`. What can be stated from the code is the
direction and the shape: the format is unchanged, no field was added or removed, and the
`glazed` edge count rises by exactly the number of entries across
`glazedByCluster`, which for flat-1 is the corridor-to-balcony band on floor 1. The count
itself is unverified.

**The panel is unchanged** by the whole task-2 change: reloading flat-1 through
`?project=` and pressing Check Layout still gives `12 issues (1 hard, 11 soft)`. That is
the expected result, since the change adds glass and access rather than removing a space,
and it is worth recording as a negative check: nothing regressed.

**The corridor screenshot** was taken on floor 1 of flat-1 and shows the corridor-to-
balcony boundary standing with glazed panels in it. It is not conclusive at that zoom
about which panels are glass and which are the balcony beyond, so the rung here is weaker
than the code and the test: the geometry builds and renders, and a close reading of that
one boundary is still worth doing by eye.

### 4. The stair root-cause rule

Not done. No rule, no `testflats/flat-1-no-stair.json`, no panels, no WET1 invariant
check. Nothing blocked it.

The canonical baseline does contain the evidence the rule is aimed at, and it is worth
recording for whoever picks this up. On flat-1 with its stair present, H1 fires once on
`Bathroom — Large (F1)`, and C1 and A1 both fire on `Circulation (F1, 8,14)`. So even the
connected fixture shows one situation described three times, which suggests the gating
list the prompt sketches, H1, C1 and OD1, is the right shape and that A1 correctly stays
out of it.

### 5. The entrance marker

Not done, and this is the second run in which it has not been done. The design is settled
and recorded in run 0008's finding 5 and this prompt's task 4; what is missing is only
the work.

### 6. Structure view

Not done.

### 7. tsc, npm run build, npm test

All clean, after every change in this run:

```
npx tsc --noEmit
TSC_CLEAN
```

```
npm test
      Tests  5 passed (5)
```

```
npx vite build
✓ built in 15.60s
```

### 8. What contradicts the Assumptions section

**Assumption 2 is right and incomplete.** The diagnosis holds exactly. What it does not
say is that the same rooms-only filter also lives in `src/core/unitExport.ts`, so fixing
`semiExterior.ts` alone would have broken the built-equals-exported invariant. Two places
had the bug, not one.

**Assumption 9 now holds.** Shrey's canonical panel and this run's measurement agree line
for line, which retires the earlier discrepancy.

Assumptions 1, 3, 4, 5, 6, 7, 8 and 10 hold. Assumptions 5, 6, 7 and 8 were not
exercised, because tasks 4 and 5 did not run.

### 9. My own assumptions

1. **That cluster glazing should be added to the export directly rather than routed
   through `computeWindows`.** A corridor has no daylight target, so there is no shortfall
   for the band generator to make up and running it would add a band the wall pass never
   builds. Affects what the export lists: exactly the semi-exterior band, nothing more.
2. **That fixing the export was in scope.** The prompt says content may change as task 2
   measures it, and leaving it would have shipped a known divergence between built and
   exported glazing. Affects `unitExport.ts`, which the prompt did not name.
3. **That `semiExteriorBands` should mutate the boundary set rather than return it.**
   The caller wants every boundary edge recorded whether or not it ends up glazed, because
   the door-authoring block reads `boundary`. Returning a second set and merging would be
   the same thing with more ceremony. Affects the function's shape.
4. **That the corridor loop should use `connectedComponents` over all circulation cells
   rather than per instance.** That is the unit `rebuildClusterShells` draws and
   `clusterNodeId` names, so any other choice would key the map by something no consumer
   has. Affects the map's keys.
5. **That the unmeasured export delta should be reported rather than pursued.** Reading
   the blob failed twice and the remaining budget was better spent on this report. Affects
   finding 3, which states direction and shape without a number.

## Evidence

- Task-1 commit: `git show --stat`, quoted. Executed.
- Cause B's code: read after writing, all four files. Read.
- Five tests green, including the new circulation case: `npm test`, quoted. Executed.
- The rooms-only filter in `unitExport.ts`: read at the glazed-edge computation. Read.
- Panel unchanged at `12 issues (1 hard, 11 soft)` after the change: Check Layout clicked
  in the running page, panel read from the DOM. Executed.
- Corridor boundary renders with glass: screenshot of floor 1. Executed, but not
  conclusive at that zoom.
- `tsc`, `npm run build`, `npm test`: executed, quoted.
- The export delta count: **not measured**.
- The stair rule, the marker, the Structure view: **not done**.

## Artifacts produced

- `src/core/semiExterior.ts`, `src/scene/clusterShells.ts`, `src/core/unitExport.ts`,
  `src/core/exteriorEdges.test.ts`, modified and left uncommitted.
- `_cowork/outbox/0011-marker-structure-view-circulation-glazing-stair-rule.report.md`.
- `_cowork/done/0011-marker-structure-view-circulation-glazing-stair-rule.md`.
- `_cowork/LOG.md`, one row appended.

No fixture was derived, so nothing new is under `testflats/`.

## Decisions and rationale

Extracting `semiExteriorBands` before adding the corridor path was the ordering that made
the change small. Adding the corridor loop first would have meant writing the band logic
twice and then deduplicating it, and the version in the test would still have been a
third copy.

Fixing `unitExport.ts` was chosen over reporting it and stopping. The prompt allows
content changes and names the built-equals-exported invariant explicitly, so a change that
knowingly breaks it is not a smaller step, it is an incorrect one.

## Deviations from the prompt

Task 2's export delta is unmeasured, for the reason in finding 3.

Tasks 3, 4 and 5 were not attempted. The prompt's drop order says 1, 2 and 3 are the
point and that 4 outranks 5, so what slipped is 3, which should not have.

## Blocked / did not do

Nothing was blocked. Tasks 3, 4 and 5 were not reached, and the pane was alive
throughout, so all three are available to the next run with no obstacle.

## Open questions for you

1. **Should the corridor band be sized like a room's?** `frenchBandWidth` was tuned for
   rooms, where the band is a window in a habitable space. A corridor's boundary is
   circulation against outdoor, and the same rule now gives it a centred band with solid
   returns at each end. It may be that a corridor should be fully glazed along its
   contact, or fully solid with a door, rather than getting a room's window. This run
   applied the room rule because reusing one construction was the point of the task, and
   the result is unexamined at close range.

2. **How many other places carry the rooms-only filter?** It caused cause B in
   `semiExterior.ts` and it was about to cause a second divergence in `unitExport.ts`. The
   pattern `def.category !== "room" || def.cluster` is a legitimate test in most places
   and a bug in any place that is really asking about the envelope. A survey of its call
   sites is small and would say whether two was the whole of it.

## Suggested next prompt

Task 3, the stair rule, alone and first, because it is the one remaining item of the three
the last two prompts have called the point, and it proves itself entirely through the DOM
now that the loader exists.

Everything it needs is settled: the gating list is H1, C1 and OD1 with A1 left alone, the
fixture is flat-1 minus its stair instance written to `testflats/flat-1-no-stair.json`,
and both panels are read through `?project=` and diffed against `12 issues (1 hard, 11
soft)`. The WET1 floor-0 invariant is a good check to keep, since a stair is not wet.

Then the marker, which is now three runs old and is the object Dillenburger could not
find. Its design has not changed since run 0008: keep `entrance.ts` untouched, derive the
second cell at draw time preferring the east neighbour on north and south walls and the
south neighbour on east and west walls, fall back to the other side, keep one cell when
neither qualifies.

Worth folding into whichever prompt comes next: the export delta this run could not
measure. `npm run build` output cannot be read for it, and patching `URL.createObjectURL`
from the browser tool does not capture the blob. A run can instead call the export path in
a vitest test, since `buildUnitExport` is a pure function over a `FloorManager`, which
would make the count checkable in the suite rather than through the interface.
