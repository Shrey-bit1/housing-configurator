---
id: "0021"
title: A room that is two storeys tall
source: 0021-a-room-that-is-two-storeys-tall.md
status: complete
branch: run/0021
commit: f9dce15
completed: 2026-08-16
---

## Summary

A room can now be marked double height. The room below the void owns the mark,
stands on its own floor, and takes the volume over its own footprint. That
volume is blocked on the floor above the way a stairwell is, the walls rise
through both storeys, and the opening reads see-through so the room shows from
above.

The property travels as `storeys[i].openCeilings`, a per-cell list of the seams
that carry no floor. It answers the building app's question directly rather
than making it re-derive anything, and it absorbs stairwells, which open a
ceiling for a different reason and are the same fact to a reader. The format
version stays 1 because the field is optional and its absence means what every
earlier file meant.

The branch is `run/0021`, cut from `main` and pushed to `origin/run/0021` at
`f9dce15a73410a46798a8e0224408ef15dc06761`. Nothing was merged and run 0020 was
left alone.

## What I need back — answers

### 1. Commits, the branch state on main, and the preview

Four commits, oldest first, each figure from `git show --shortstat`:

- `3b21640` rooms: a room can be two storeys tall — 7 files, +220, −6.
- `e06e148` export: the void crosses the bridge — 2 files, +120, −1.
- `daf3f11` library: a unit with a double-height room — 11 files, +7067, −171.
- `f9dce15` rooms: tests, and PROJECT_STATE 2u — 5 files, +303, −2.

A fifth commit carrying this report, the prompt's move to `done/` and the LOG
row lands on the same branch and is pushed with it; the code under review is
exactly `f9dce15`.

**The branch state found on main.** `main` is at
`c524e57c055b6196b970889e1eaca95c9c801a55` and carries run 0019, as the
assumption said. **Run 0020 is pushed and NOT merged**: `git branch --merged
main` does not list it, and `origin/run/0020` sits at `05ab558`. It was left
alone. `run/0021` is cut from `main`, so nothing in this run sees run 0020's
stairs or bathrooms.

The preview follows the established pattern,
`https://run-0021--reconfigure-flat.netlify.app`. The site is
password-protected, so an unauthenticated check answers 401 rather than 200,
and 404 for a minute or two while the branch builds.

```bash
git fetch origin run/0021 && git checkout run/0021 && npm install && npm run dev
```

### 2. How a resident marks a room double height

Select one room and press the **Double height** button that appears in the
selection readout at the bottom of the viewport. The button is only there for a
single real room, because a connector is drawn as one merged cluster shell and
furniture has no volume worth opening, and it shows pressed when the room
already carries the mark, so the state is readable without opening anything.
Pressing it again clears the mark, which never fails.

Three captures, all byte-checked:

- **The editor control**: `#double-height-toggle` in the readout
  (`index.html:131-142`, wired at `src/main.ts:427-459`). It reads
  DOUBLE HEIGHT beside the room's name and size, outlined when off and filled
  ink when on.
- **The room standing two storeys tall**:
  `captures/0021-double-height-3d.png`, 214,669 bytes. The living room's walls
  rise the full 6.0 m past the single-storey kitchen beside it, with no ceiling
  over its footprint.
- **The upper storey showing the void**:
  `captures/0021-upper-storey-void.png`, 205,006 bytes. Floor 1 is the active
  floor, its bedroom is at full strength, and the double-height room below
  shows through the opening rather than sitting behind a dark plate.

### 3. The encoding, the justification, the version, the example

The field is **`storeys[i].openCeilings`**, a list of `[x, z]` cells of storey
i over which no floor is drawn between storey i and storey i+1, in the same
normalized unit-local space as `cells`. It is computed at
`src/core/unitExport.ts:354-362` and declared at `src/core/unitExport.ts:93-113`.

**The justification, in three sentences.** The consumer's question is per cell,
so a per-cell list answers it by lookup with no inference, where a room-level
"this room is double height" property would make the building app re-derive
which cells that room covers and which storey it sits on, which is exactly the
relationship that gets lost across a bridge. It also absorbs the stairwell,
which opens a ceiling for an entirely different reason and is the same fact to
a reader, so the building side never has to learn the cause. And it stays
correct as the editor grows further ways to open a ceiling, because it
describes the void rather than what made it.

**The version stays 1.** The field is optional and purely additive, and its
absence means every seam is floored, which is exactly what every file written
before this run meant. An importer that ignores `openCeilings` therefore
behaves the way it always did. Reversing the default would have been the one
choice that made old files wrong, which is why absence means floored rather
than open. This is the same additive rule `cellKinds` and `cellRooms` were
added under in run 0018.

The worked example is in `docs/bridge-format.md:272-350`, a two-storey flat
whose ground-floor living room is double height, with the four covered cells
listed on storey 0 and an empty list on storey 1. The reading rule is one line:
for a cell `[x, z]` on storey `i`, the floor above exists unless
`storeys[i].openCeilings` contains `[x, z]`.

### 4. The floor above, and the storey height

**When the floor above is occupied the mark is REFUSED and the obstruction is
named.** `ModuleStore.setDoubleHeight` (`src/core/store.ts:196-211`) returns
`{ ok: false, blockedBy }` and the caller lists the cells in an error toast.
Nothing on the floor above is touched. The check itself is
`store.doubleHeightObstruction`, set by the FloorManager at
`src/core/floorManager.ts:156-162`, and it returns the obstructing cells rather
than a boolean precisely so the refusal can say which ones.

Shown rather than described, measured live on a 7×5 living room with a 5×4
bedroom directly above it:

```
{"refusal":{"ok":false,"blockedCount":16,"firstFew":["10,2","10,3","10,4","10,5"]},
 "kitchenStillSingle":false,"bedroomAboveStillThere":true}
```

and again in the suite at `src/core/doubleHeight.slow.test.ts:66-75`, where 20
cells are named, the bedroom above is still in its store, and the room below is
still single height.

**The derived storey height does not change.** The room takes the storey above
rather than making its own storey taller, so `maxRoomHeightCells` still reads
`def.height` and the stack does not move. Measured live on a marked living
room: walls reaching 6.0 m while the floor height stayed 3.0 m and
`maxRoomHeightCells` stayed 4.

```
{"wallTopWhenDouble":6,"storeyHeight":3,"maxRoomHeightCells":4}
```

`src/core/doubleHeight.slow.test.ts:94-106` asserts both halves: the floor
height before and after are equal, and every floor's `group.position.y` is
unchanged, so the stack really did not move.

There is one case with no obvious right answer and I chose the quiet one: a
room marked on the TOPMOST floor has no floor above to claim. It is allowed,
nothing is blocked because there is nothing to block, and no floor is created.
Auto-creating one, the way a stair does, would invent a storey the resident did
not ask for.

### 5. The library unit, and the counts

**Unit 5 is new and purpose-built**, committed as `public/units/unit-5.json`
(1,513 lines) with its preview. It is a two-storey flat: a 7×5 living room on
the ground storey marked double height, a kitchen beside it, a stair, an
entrance, and a bedroom on the upper storey placed clear of the void. Its
storey 0 reports **47 open ceilings**, 35 from the living room and 12 from the
stairwell; its storey 1 reports **0**, because it is the top.

**It is new rather than an edit, and that was a deliberate trade.** The only
other two-storey unit is `unit-2`, and every one of its five ground-floor rooms
is completely built over on its upper floor: measured, the living room is
blocked by 35 cells, the large bedroom by 28, the recreation room by 25, and
the kitchen and bathroom by 16 each. Giving it a double-height room would have
meant deleting two large bedrooms from a unit Shrey authored, and the upper
bedroom that overlaps could not be moved clear either (three attempts, all
refused by the grid edge). Adding a unit was the smaller change.

**The other five were re-exported in place**, through the real exporter, each
keeping its id and its ORIGINAL preview image, so the only thing that changed
in them is the new field:

| unit | storeys | openCeilings per storey |
|---|---|---|
| `flat-2-single-storey` | 1 | 0 |
| `flat-3-terrace` | 1 | 0 |
| `unit-1` | 1 | 0 |
| `unit-2` | 2 | 12, then 0 |
| `unit-3` | 1 | 0 |

`unit-2`'s 12 are its stairwell, described on the wire for the first time. The
single-storey units report 0 because a top storey never lists any.

**`unit-4` is the exception and needs saying.** It was sitting uncommitted in
the working tree at the start of this run, saved by Shrey through the library
endpoint, and it uses `stair_dogleg` and `bathroom_full`: types that exist only
on run 0020. It was committed unchanged in `daf3f11` so it is not lost, and it
was NOT re-exported, because loading it on this branch would silently drop
those rooms. It will need re-exporting once run 0020 merges.

### 6. The sample file

`_cowork/outbox/0021-double-height-unit.json`, 22,579 bytes, is Unit 5's
exported `dwelling-unit` file, byte-identical to `public/units/unit-5.json`.

A reader will find `format: "dwelling-unit"`, `version: 1`, and two storeys.
Storey 0 has 63 cells and an `openCeilings` array of 47 of them. Storey 1 has
42 cells and an empty `openCeilings`. Cross-referencing storey 0's
`openCeilings` against its `cellRooms` shows 35 of the open cells belong to the
living room and 12 to the stair, which is the two causes of a void appearing in
one list exactly as the format documents. `sourceProject` is embedded as
always, and its living-room instance carries `"doubleHeight": true`, so the
file also demonstrates the editor-side property the field is derived from.

### 7. Tests and the fixture baselines

Before this run: `npm test` 84 passed in 10 files, `npm run test:slow` 6 passed
plus 1 expected fail.

After: **`npm test` 84 passed**, 578 ms, and **`npm run test:slow` 18 passed
plus 1 expected fail**, 4.60 s. The 12 new slow cases are
`src/core/doubleHeight.slow.test.ts`. `npx tsc --noEmit` exits 0 and
`npm run build` completes in 5.66 s. The expected fail is the standing
french-window case at `src/core/unitExport.slow.test.ts:194`, untouched.

The fast count is unchanged at 84 because one existing case had to be repaired
rather than added to. `src/library/naming.test.ts` pinned the next free unit
number at the literal 4, which was true of the library on the day run 0019
wrote it and false the moment a unit landed; the library now holds five, so it
failed with "expected 6 to be 4". It asserts the property instead: the number
returned is free and every smaller one is taken. This is the second time a test
has hardcoded a fact about library CONTENT, after run 0018's entry count, and
both failed the same way.

Both fixture baselines, read from `#validation-panel` after Check Layout,
unchanged before and after:

- `flat-1-two-storey.json` — "1 must fix, 11 worth a look, 5 note", the 12.
- `flat-1-no-stair.json` — "1 must fix, 6 worth a look, 4 note", the 7.

`git diff main..f9dce15 --stat` lists nothing under `testflats/`.

### 8. Skills read from disk

Both were reachable, under
`~/Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/f1d881be-.../c2d4eab5-.../skills/`,
and read as `SKILL.md` files rather than through the skill tool.

**`interoperability`** decided the encoding. Its section 1.4 data-loss taxonomy
separates metadata loss from RELATIONSHIP loss, the second being connections
and hierarchy that break in translation, and a room-level "this room is double
height" property is exactly a relationship: the consumer would have to
reconstruct which cells the room covers and which storey it stands on before it
could answer anything. Naming that failure mode is what made the per-cell list
the obvious choice rather than a close call. Its repeated insistence that a
receiving tool must behave sanely when it ignores a field is also why absence
means floored rather than open.

**`design-automation`** decided where the property does NOT belong. Its section
1.3 splits hard rules, which invalidate a design, from soft ones, which
penalise it. A double-height room is neither: it is a fact about the design, so
it belongs in the model and the format, and nothing in `rules.ts` was touched.
That reading matches the run's own constraint that rules advise and never
block, and it is why the refusal when the floor above is occupied lives in the
store as a precondition rather than as a rule that fires afterwards.

**Rejected.** From `interoperability`, the whole platform layer, IFC, Speckle,
glTF and the Autodesk APIs: this repo shares exactly one JSON file with exactly
one other repo by deliberate design, and its section 2 format encyclopedia has
nothing to say about a private contract between two codebases. I also declined
its preference for open standards over proprietary formats for the same reason.
From `design-automation`, sections 3 and 4 on constraint satisfaction and space
planning describe generating layouts from adjacency programs, which inverts
this app's premise that the resident places rooms and the app advises.

### 9. Contradictions with the Assumptions, then my own

Assumption 1 holds exactly: `main` carries run 0019, run 0020 is pushed and
unmerged, and this run branched from `main` and merged nothing.

Assumption 2 holds. The cell is 0.6 m and the storey height is derived, 3.0 m
for a plain floor.

Assumption 3 holds and was the right place to look. `syncStairsAndHoles` was
the model: the same `setHoles` path now takes stair footprints and
double-height footprints together through `FloorManager.voidCells`
(`src/core/floorManager.ts:203-224`), so placement blocking, the missing plate,
and the opening all came for free.

Assumption 4 holds and one detail is worth passing on. `buildSpaceTargets`
(`src/core/door.ts:217-225`) builds its upward projection by reading the floor
below's STAIR INSTANCES directly, not the hole set, so adding double-height
rooms to the holes did not accidentally make a void a door target. A resident
cannot door onto thin air, which would have been the bug if that function had
read holes instead.

My own assumptions, where the prompt was silent:

- **The void uses the room's SEED footprint, not its grown one.** An elastic
  room's effective cells are derived after holes are set, because expansion
  reads holes, so holes cannot read expansion without a cycle. The effect is
  visible and honest rather than approximate: the living room in Unit 5 grew to
  49 cells with a 35-cell seed, and reports 35 open ceilings, because the other
  14 genuinely do have a floor above them.
- **A mark on the topmost floor is allowed and creates nothing**, reasoning
  under point 4.
- **Connectors and furniture cannot be marked**, because a cluster is one
  merged shell and a flag on a single piece has no coherent meaning.
- **`loadProject` restores the flag directly** rather than through
  `setDoubleHeight`, because the floors above are still being filled in during
  the load loop and re-validating mid-load would reject valid saved projects on
  loop order alone.
- **Marking is undoable** and clears any stale validation, treated as an
  ordinary mutating action.
- **`openCeilings` is always present on non-top storeys, empty when nothing is
  open**, rather than omitted. An empty array and an absent field mean the same
  thing to a reader, and always writing it makes the field visible in every
  file, which is easier to discover.

## What I did

- `src/core/store.ts`: `ModuleInstance.doubleHeight`, the
  `doubleHeightObstruction` hook, and `setDoubleHeight` (lines 196-211).
- `src/core/floorManager.ts`: `doubleHeightCells` and `voidCells` (203-224),
  the obstruction check (156-162), the two-storey wall height in
  `rebuildAllShells`, and the direct restore in `loadProject`.
- `src/core/projectIO.ts`: `doubleHeight?: boolean`, serialized and defaulted.
- `src/scene/holeView.ts`: the opening is translucent and never writes depth.
- `src/core/unitExport.ts`: `openCeilings`, computed and normalized.
- `docs/bridge-format.md`: the field, the reasoning, the worked example.
- `index.html`, `src/main.ts`, `src/style.css`: the control.
- `src/core/grid.ts`: a read-only `holeCount`.
- `src/core/doubleHeight.slow.test.ts`: 12 cases.
- `src/library/naming.test.ts`: the brittle assertion repaired.
- `PROJECT_STATE.md`: §2u, and §9 gained the field.

## Findings

- **The stairwell was already an answer to this question and nobody had said
  so.** Making `voidCells` the one list meant the export now describes stair
  voids too, which it never did: `unit-2` reported 12 open ceilings on its
  ground storey the moment it was re-exported, and those 12 seams were exactly
  as unfloored before this run as after. The building app's guess was wrong on
  15 of 185 seams for double-height rooms and silently wrong on every stairwell
  as well.
- **A test hardcoding library content failed for the second time**, described
  under point 7. Worth a convention: assertions about `public/units/` should
  state properties, never counts or literal numbers.
- **Every ground room of `unit-2` is built over**, with the numbers under point
  5. That is worth knowing beyond this run: the existing two-storey units were
  authored as two independent plans stacked, with no thought of the seam
  between them, which is the habit this property exists to change.
- **`buildSpaceTargets` reads stair instances rather than holes**, which is
  what stopped a double-height void becoming a door target by accident.

## Evidence

- Live behaviour: the refusal, the storey height, and the hole counts are the
  JSON quoted under points 4 and 5, read out of the running app.
- Suites: `npm test` 84 passed; `npm run test:slow` 18 passed plus 1 expected
  fail; `tsc` silent; `npm run build` built in 5.66 s.
- Baselines: `#validation-panel` text after Check Layout on both fixtures.
- The re-export: the per-unit table under point 5 is the endpoint's own replies.
- Captures: two PNGs with the byte counts under point 2.
- Branch state: `git rev-parse main`, and `git branch --merged main` not
  listing run/0020.

## Artifacts produced

- `_cowork/outbox/0021-double-height-unit.json` (22,579 bytes).
- `public/units/unit-5.json` and `unit-5.jpg`, plus the five re-exported units.
- `captures/0021-double-height-3d.png` (214,669 bytes) and
  `captures/0021-upper-storey-void.png` (205,006 bytes), untracked as
  `captures/` always is.
- `PROJECT_STATE.md` §2u; `docs/bridge-format.md`'s new section.

## Decisions and rationale

- **One void concept, two causes**, so the reader never learns the cause and
  the editor has one place to change.
- **Refusal names its cells**, because deleting authored work on a floor the
  resident is not looking at is the worst available answer.
- **The storey height does not move**, because the room takes the storey above
  rather than growing its own, which is what "two storeys tall" means.
- **The seed footprint defines the void**, to avoid a derivation cycle and
  because it is the authored claim.
- **Version stays 1**, because the field is additive and absence means what old
  files meant.

## Deviations from the prompt

- **The library unit is new rather than an existing one edited**, with the
  measured reasoning under point 5.
- **`unit-4` was committed but not re-exported**, under point 5. It was
  Shrey's uncommitted work and it depends on run 0020's types.
- **An existing test was repaired**, under point 7, which the prompt did not
  ask for but "both fixture baselines hold" and a green suite required.
- **`window.__app.buildUnit` was added** to the dev-only handle so the
  re-export could go through the real exporter rather than a reimplementation.
  It ships nowhere, behind the same `import.meta.env.DEV` gate as `capture`.
- **The opening was made see-through here**, which run 0020 also does in its
  own `holeView.ts`. The prompt asked for that reading and forbade merging run
  0020, so the change is duplicated. Expect a small conflict in
  `src/scene/holeView.ts` when both branches merge; the two versions are the
  same three lines and either resolves it.

## Blocked / did not do

None.

## Open questions for you

1. **Two branches now touch `src/scene/holeView.ts` the same way.** Run 0020
   and run 0021 both make the opening translucent, independently, because
   neither may merge the other. Whichever merges second will conflict on three
   lines. Worth deciding the merge order rather than discovering it.
2. **`unit-4` cannot be re-exported until run 0020 merges**, so the library
   will hold one unit without `openCeilings` until then. The building app
   should treat a missing field as "all seams floored" and will be right about
   unit-4 in the meantime, but it is a real inconsistency inside one folder.
3. **Should a double-height room's void follow its elastic growth?** Today it
   is the seed, for the derivation-cycle reason under point 9. The alternative
   is a second expansion pass after holes settle, which is real work and would
   let a grown room open its whole grown area. Nobody has asked for it yet, and
   the honest answer today is that the 14 extra cells do have a floor.
4. **Nothing advises on a double-height room that makes no sense**, such as one
   with no stair anywhere in the flat, or a marked room whose void is the only
   route between two upper spaces. Rules were deliberately untouched here. The
   first is a plausible advisory; the second may be a real trap.

## Suggested next prompt

Merge order first, then the building side. Ask Shrey to settle run 0020, since
open question 1 makes it cheaper to merge 0020 before 0021 and re-export
`unit-4` immediately after. Then point the building repo at
`_cowork/outbox/0021-double-height-unit.json` and have it replace its stopgap:
draw a floor at a seam unless the lower storey's `openCeilings` lists that
cell, and report the same 1562-pair and 185-seam figures again so the guess and
the property can be compared on the same reference building. That comparison is
the thing that proves this run worked, and it can only be measured over there.
