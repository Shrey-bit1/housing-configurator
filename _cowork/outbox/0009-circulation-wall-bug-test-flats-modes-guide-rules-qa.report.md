---
id: "0009"
title: Circulation wall bug, test flats, modes guide, rules QA
source: 0009-circulation-wall-bug-test-flats-modes-guide-rules-qa.md
status: partial
branch: main
commit: 3916602
completed: 2026-07-30
---

## Summary

The bug is diagnosed exactly and half fixed. It has two independent causes, not one,
and only the wall half is repaired: circulation now keeps its wall against a balcony.
The glazing half is blocked on a design decision about how a merged cluster is keyed,
which is stated below rather than guessed at.

Three commits landed: run 0008's files, and the fixtures plus the README modes guide,
which is what the push for Prof. Ng depends on. TOP VIEW works and the README says what
it does.

The pane was hidden at task 0 and became available partway through, but importing a
fixture programmatically failed through both injection paths, so tasks 4, 6 and 7 did
not run. A manual verification script closes them.

## What I did

Task 0 returned a hidden pane, so the run started on the DOM-provable and code-only
work. Partway through task 3 the pane came back, which should have unlocked tasks 4, 6
and 7, and did not, because all three need a fixture loaded and no programmatic route
into Import worked. That is recorded as a finding rather than worked around.

Task 3's diagnosis came before any edit, as asked. Reading it changed the shape of the
task: assumption 1 offers two candidate mechanisms as alternatives, and both are real
and independent. Fixing one does not fix the other.

- `src/scene/clusterShells.ts` dissolve rule changed, plus its doc comment.
- `README.md` gained `## Views and modes`.
- `PROJECT_STATE.md` records the fix and the unfixed half.
- Three commits, listed below.

## Findings

### 1. Pane state

Hidden at task 0:

```
screenshot failed: Screenshot timed out after 5s: the Browser pane is not displayed, so the page is not compositing frames. Display the pane and retry.
```

It became available partway through task 3 and the viewport was resized to 1100×800 to
fit the app. So the pane is not the reason tasks 4, 6 and 7 are missing; finding 6 is.

### 2. Commits

| Hash | Message | Contents |
|---|---|---|
| `b6df5967ff64a351369fcdf3163e41fa4816f872` | `E1 hard, first test (run 0008)` | 6 files, 1365 insertions, 14 deletions |
| `3916602d5e1477a44bdd6fc0713374eac76911d0` | `Test flats and modes guide (run 0009)` | 4 files, 1293 insertions |

`b6df596`:

```
 PROJECT_STATE.md               |   25 +
 README.md                      |    2 +-
 package-lock.json              | 1209 +++++++++++++++++++++++++++++++++++++++-
 package.json                   |    6 +-
 src/core/exteriorEdges.test.ts |  126 +++++
 src/core/rules.ts              |   11 +-
```

Exactly assumption 4's list. `git status --porcelain` beforehand also showed
`testflats/`, the 0009 prompt and three untracked files under `docs/`, all left out as
instructed.

`3916602`:

```
 README.md                           |  70 +++++
 testflats/flat-1-two-storey.json    | 594 ++++++++++++++++++++++++++++++++++++
 testflats/flat-2-single-storey.json | 324 ++++++++++++++++++++
 testflats/flat-3-terrace.json       | 305 ++++++++++++++++++
```

**Which branch of task 8 applied to the fix: the second.** Task 7b did not run, so the
fix was not proved with pixels, so it stays uncommitted in `src/scene/clusterShells.ts`
for Shrey. The note he needs is finding 4 and step 1 of the manual script.

### 3. The CONTEXT.md correction

Already done. Run 0008 corrected it and the record commit `c74b17c` carries it, which is
assumption 7 behaving exactly as predicted. `_cowork/CONTEXT.md:44-46` now reads:

```
- `src/core/` — the model and all logic: grid and occupancy, room-type presets,
  floors, doors, entrances, the adjacency graph, the rules engine, window generation,
  save/load, and the flat export. It does import three.js; see Non-obvious things.
```

with a numbered entry under Non-obvious things naming `src/core/grid.ts:1` and
`src/core/floor.ts` and explaining that the separation is about responsibility rather
than dependencies. Nothing was needed this run.

### 4. The bug: two causes, one fixed

**Assumption 2 first.** The nearest thing to a deliberate statement is
`PROJECT_STATE.md`, which read `Cluster shells (Circulation/Outdoor) never get
windows.` That sentence sits inside §2d, the derived EXTERIOR window generator, where
circulation genuinely has no daylight target. The french-window mechanism is §2o, a
different system with a different question. I judged it a statement about §2d rather
than a decision about the corridor-to-balcony boundary, and proceeded. That judgment is
the one thing in this report most worth a second opinion, and §2d has been reworded so
the distinction is explicit either way.

**Cause A, the missing wall, in `src/scene/clusterShells.ts`.** The dissolve was
TWO-SIDED. Before:

```
      const dissolves = outdoor
        ? isRoom || def.cluster === "circulation"
        : isRoom || def.category === "stair" || def.cluster === "outdoor";
```

Outdoor dissolved toward circulation, and circulation dissolved toward outdoor. Each
side deferred to the other and neither built a segment, so the boundary had no wall at
all. Every other case in that function is one-sided, which is the convention
`PROJECT_STATE` §2n states: a room keeps all its walls and only the connector gives way.
Two clusters facing each other is the case the convention did not cover. After:

```
      const dissolves = outdoor
        ? isRoom || def.cluster === "circulation"
        : isRoom || def.category === "stair";
```

Circulation now keeps its wall toward outdoor; outdoor still gives way to circulation,
so the boundary carries exactly one segment, the corridor's, matching room-to-outdoor.

**Cause B, the missing glazing, in `src/core/semiExterior.ts:141`. Not fixed.** The
per-room loop opens with:

```
    if (def.category !== "room" || def.cluster) continue; // rooms only
```

A circulation cluster has `def.cluster === "circulation"`, so it never enters
`plan.boundary` and never receives french-window glazing. Assumption 1's first candidate
is therefore also correct, and the two causes are independent: the wall fix does not
give the corridor glass, and the glazing fix would not have given it a wall.

Fixing B needs a decision this run should not take alone. `glazedByRoom` is keyed by
ROOM INSTANCE id, while a circulation cluster is a merged component that
`rebuildClusterShells` draws per component, currently calling `buildBoundaryWalls` with
`undefined, // clusters never get windows`. So B requires a second key space, or keying
the glazing by cluster node id, and then plumbing a windows map into the cluster shell
builder that has never taken one. That is a design change to two subsystems rather than
a filter adjustment.

**What the half fix leaves.** A corridor now has a solid wall to its balcony where a
room would have glass, so the flat is enclosed and the balcony is not visible or
reachable from the corridor without an authored door. Because circulation is absent from
`plan.boundary`, a door there IS authorable today, so the balcony is still reachable.
That is coherent and strictly better than standing open to the sky, and it is not the
end state.

**The exported boundary function, the fifth test case, and the export delta are all
not done**, because each of them depends on B. Exporting the boundary construction is
worth doing regardless (assumption 5's divergence risk is real), but doing it in the
same run that changes what that construction produces would have made the refactor and
the behaviour change indistinguishable in one diff.

### 5. The export delta on flat-1

Not measured. It depends on cause B, which is unfixed, so built glazing did not change
and the export cannot have changed either. The wall fix adds geometry that the export
does not describe: `unitExport.ts` writes cells, kinds, rooms and glazing, and a
corridor's solid wall is none of those.

### 6. Importing a fixture programmatically failed

This is why tasks 4, 6 and 7 are missing, and it is worth more than the tasks it cost.

Three routes were tried against `testflats/flat-1-two-storey.json`, fetched successfully
from the dev server each time. Assigning `input.files` from a `DataTransfer` and firing
`change` on the hidden picker at `src/main.ts:747-754` did nothing. Dispatching a
synthetic `drop` carrying the same `DataTransfer` at the canvas did nothing. Dispatching
it at `#viewport`, which is where the real handler lives, also did nothing. After all
three the app still showed one empty FLOOR 0.

The same `input.files` technique worked in the companion repository earlier in this
session, so the difference is in this app's handlers rather than in the technique.
`readAndImport` at `src/main.ts:733-738` uses a `FileReader`, which a synthetic event
may not satisfy the same way, and that is a guess rather than a diagnosis.

The consequence for the bridge is concrete: **no run can load a fixture without a human
clicking IMPORT**, which makes every fixture-based check a manual step. Fixing that, for
instance by accepting a `?project=` query parameter in dev, would convert tasks 4, 6 and
7 from manual to automatic, and it is probably the highest-leverage small change
available to this project's verification story.

### 7. The README section

Written at `README.md:72-141`, sourced from `src/main.ts` rather than from memory, and
quoted in full in the artifact rather than here for length. The section covers DIAGRAM
and TOP VIEW; CHECK LAYOUT, RESET VIEW and `?`; CUTAWAY, Seeds, Structure, Interface
view and the compass; and EXPORT, IMPORT, EXPORT UNIT, the floor list and the palette.
It ends by pointing at `testflats/`.

**TOP VIEW works, and here is what it does**, which is meeting item 11's answer. Pressing
it calls `enterPlanMode` (`src/main.ts:403-414`), which hides every floor ABOVE the
active one and keeps those at or below it (`applyPlanVisibility`, `main.ts:396-401`),
turns the door-swing arcs ON because they are a plan symbol and are hidden otherwise,
sets `controls.enableRotate = false` so the view cannot be tumbled off axis, and frames
the content box from `"top"`. The button relabels to **Axo View**. Pressing it again
restores every floor's pre-plan visibility, hides the arcs, unlocks rotation and
re-frames to the axonometric. It is mutually exclusive with DIAGRAM, which it closes on
entry. Rung: read from the code, not clicked, because the fixture would not load and an
empty grid shows nothing useful in plan.

### 8. The deletion log

Not run, for the reason in finding 6. No baselines, no deletions, no three worst
messages. The manual script in finding 9 includes the deletion sequence so the pass can
be done by hand in one sitting.

### 9. Manual verification script

Written for a quick pass, one action per step. Steps 1 to 4 close this run's fix; 5 to 8
close run 0008's outstanding four; 9 to 15 are the rules QA.

1. Click IMPORT and open `testflats/flat-1-two-storey.json`. Expect two floors in the
   FLOORS list and no console errors.
2. Click FLOOR 1 to make the upper floor active. Find the corridor running against the
   balcony.
3. Look at the corridor-to-balcony boundary. **Expect a solid full-height wall along it.**
   Before this run's fix there was no wall at all and the flat stood open to the balcony.
   There should be NO glass in that wall; that half is not fixed.
4. Click `Interface view`. Expect that same corridor wall to remain standing.
5. With flat-1 still open, find a ROOM that sits against a balcony. Click
   `Interface view`. Expect the wall between them to stand WITH its glazing, and the
   balcony parapet unchanged, while that room's other partitions disappear.
6. Click `Interface view` again to turn it off. Expect the scene to come back exactly,
   including the door markers.
7. On an empty grid, drop a Kitchen, then a Bathroom — Small several cells away, not
   touching. Click CHECK LAYOUT. Expect a WET1 line naming two groups. Write down its
   exact text.
8. Start fresh, drop a Kitchen and a Bathroom — Small touching each other, click CHECK
   LAYOUT. Expect no WET1 line.
9. Start fresh, drop a Bedroom — Small, then ring it with four other rooms so no side of
   it reaches open space or a balcony. Click CHECK LAYOUT. Expect a FAC1 line naming
   that bedroom. Write down its exact text. Delete one surrounding room and click CHECK
   LAYOUT again; expect the FAC1 line to be gone.
10. Re-import flat-1. Click CHECK LAYOUT and screenshot the whole panel. This is the
    baseline.
11. Select the kitchen, press Delete, click CHECK LAYOUT. Expect P2 to appear. Note
    anything else that appears or disappears.
12. Re-import flat-1. Delete one bathroom, click CHECK LAYOUT.
13. Re-import flat-1. Delete the entrance, click CHECK LAYOUT. Expect E1, now hard, with
    `No entrance defined — the entrance is the unit's interface to the building.`
14. Re-import flat-1. Delete every door of one room, click CHECK LAYOUT. Expect that room
    to read as orphaned.
15. Re-import flat-1. Delete one balcony piece next to a room, click CHECK LAYOUT. Then
    re-import and delete the stair, click CHECK LAYOUT.

Re-import between each deletion rather than relying on undo, per assumption 8. For each
step, note what fired, what cleared, and any message that reads wrongly.

### 10. tsc, npm run build, npm test

All three clean, run after the fix:

```
npx tsc --noEmit
TSC CLEAN
```

```
npm test
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

```
npx vite build
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 8.87s
```

The chunk-size warning predates this run. The four tests are run 0008's; no fifth was
added, per finding 4.

### 11. What contradicts the Assumptions section

**Assumption 1 is wrong in shape.** It offers two candidate mechanisms as if one were
the cause. Both are real, independent, and both must be fixed; only the second is.

**Assumption 2 nearly holds and needed a judgment.** `PROJECT_STATE` did document
"Cluster shells (Circulation/Outdoor) never get windows", which is close enough to a
deliberate statement to be worth stopping over. Finding 4 explains why I read it as
scoped to §2d and continued.

**Assumption 3 is wrong about `testflats/` being untracked until task 8**, only in that
task 1 had to explicitly exclude it, which it did. The fixtures are as described: three
`flat-configurator-project` v1 files. flat-1 has 2 floors, floor 0 with 24 instances, 8
doors and 1 entrance, floor 1 with 41 instances, 4 doors and 0 entrances, and floor 1
carries 13 `circulation_double` against 24 `outdoor_double`, which is the reported case.

**Assumption 5 holds and its risk did not materialise**, because the boundary
construction was not changed, so the test's `derive()` still matches the app.

**Assumption 9 is wrong in practice.** DOM verification via the page works only for
things reachable from an empty grid. Everything in tasks 4, 6 and 7 needs a fixture
loaded, and finding 6 shows that cannot be done from the page.

Assumptions 4, 6, 7 and 8 hold; 6 and 8 were not exercised.

### 12. My own assumptions

1. **That the wall half was worth shipping without the glazing half.** A corridor with a
   solid wall to its balcony is coherent and strictly better than one open to the sky,
   and a door is still authorable there. Affects what the fix delivers and means the
   boundary is not yet the same as a room's.
2. **That the semiExterior boundary refactor should wait.** Doing it in the same run that
   changes what the construction produces would put a refactor and a behaviour change in
   one indistinguishable diff. Affects assumption 5's divergence risk, which stays open
   but has not yet been triggered.
3. **That §2d's sentence should be reworded rather than left.** It is now explicit that
   it describes the exterior generator only. Affects whether the next reader repeats my
   judgment call.
4. **That the README should describe controls rather than teach the app.** One entry per
   control, sourced from code, no walkthrough. Affects its length, 70 lines.
5. **That TOP VIEW's answer should be read from code since it could not be clicked.**
   Affects the rung on finding 7, which is read rather than executed.
6. **That the import failure was worth three attempts and then a finding.** Affects how
   much of this run went to tasks 4, 6 and 7, which is none.

## Evidence

- Commits: `git show --stat` on both, quoted. Executed.
- Cause A: read at `src/scene/clusterShells.ts`, before and after quoted. Read, then
  `tsc`, `npm test` and the build run clean. Not seen on screen.
- Cause B: read at `src/core/semiExterior.ts:141`. Read.
- Assumption 2's documentation: read from `PROJECT_STATE.md` §2d. Read.
- Fixture contents: parsed from the JSON, counts quoted in finding 11. Executed.
- Import failure: three attempts, each followed by a screenshot or DOM query showing one
  empty FLOOR 0. Executed.
- TOP VIEW behaviour: read from `src/main.ts:396-431`. Read, not clicked.
- `tsc`, `npm test`, `npm run build`: executed, quoted.
- The corridor wall standing, and everything in tasks 4, 6 and 7: **not verified**.

## Artifacts produced

- `src/scene/clusterShells.ts`, modified, left uncommitted for Shrey.
- `PROJECT_STATE.md`, modified, left uncommitted.
- `README.md` and the three fixtures, committed as `3916602`.
- `_cowork/outbox/0009-circulation-wall-bug-test-flats-modes-guide-rules-qa.report.md`.
- `_cowork/done/0009-circulation-wall-bug-test-flats-modes-guide-rules-qa.md`.
- `_cowork/LOG.md`, one row appended.

## Decisions and rationale

The fix stayed uncommitted because task 8 says so when 7b did not run, and 7b could not
run. The alternative was to commit it on the strength of the reading, as run 0008 did
for a different change, and the difference is that run 0008's change was covered by a
passing test while this one changes geometry that nothing tests.

Cause B was diagnosed and left rather than attempted. Attempting it means inventing a
key space for cluster glazing and plumbing a windows map into a builder that has never
taken one, in a run that cannot see its own output, three days before a review.

## Deviations from the prompt

Task 3 is half done and the reasons are in finding 4. The exported boundary function,
the fifth test case and the export delta all depend on the unfixed half.

Tasks 4, 6 and 7 did not run, because no fixture could be loaded. The prompt's drop
order expects 7 to go first and 6's later flats next; what actually happened is that
everything fixture-dependent went, which is a different cut than intended.

## Blocked / did not do

Tasks 4, 6, 7a, 7b and 7c, all blocked by finding 6. The manual script in finding 9
covers every one of them.

Cause B of the bug, blocked on the keying decision in finding 4.

## Open questions for you

1. **How should cluster glazing be keyed?** `glazedByRoom` maps room instance id to
   glazed edges, and a circulation cluster is a merged component with no instance to key
   by. Either the map grows a second key space and every consumer learns which it is
   holding, or glazing is keyed by cluster node id in a parallel map and
   `rebuildClusterShells` gains a windows parameter. The second is more code and keeps
   rooms untouched; the first is smaller and puts two kinds of thing in one map. This
   decides the shape of the remaining fix and nothing else in the app depends on it yet,
   which is the best moment to choose.

2. **Should the app be able to load a project without a human?** Finding 6 is the reason
   three of this run's ten tasks produced nothing, and it will cost every future run the
   same way, because every interesting layout lives in a file. A dev-only `?project=`
   query parameter that fetches and imports on load would be a few lines and would make
   fixtures usable by any run. Against it: it is a code path that exists only for
   testing, in an app whose convention is that loaded state goes through the same path as
   authored state, and it would need to honour that.

## Suggested next prompt

Have Shrey walk finding 9's script first, because it closes six outstanding visual claims
in one pass and needs no run at all. Its results decide whether the corridor fix can be
committed and whether run 0008's four checks can finally be struck off.

Then one prompt doing two things, in this order. Settle open question 2 and add the
loading route, because every subsequent verification depends on it and it is small.
Then settle open question 1 and finish cause B, with the exported boundary function and
the fifth test case that were deferred with it, so the corridor boundary ends up the same
as a room's rather than half of it.

Worth knowing for scheduling: the corridor wall fix is one uncommitted line in
`src/scene/clusterShells.ts` plus its comment. If Shrey's pass confirms step 3, that
commit is `Circulation-to-outdoor wall (run 0009)` and takes a minute.
