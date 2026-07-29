---
id: "0006"
title: Interface view and a soft rule for split wet areas
source: 0006-interface-view-and-a-soft-rule-for-split-wet-areas.md
status: partial
branch: main
commit: fb38663
completed: 2026-07-29
---

## Summary

Task 1 is complete and is the most useful part of this report, because two of its
answers change what the following prompts can assume. Task 2 is implemented and both
`tsc` and `npm run build` are clean, but the Browser pane is not displayed, so the four
screenshots do not exist and the view has not been seen working. Tasks 3 and 4 of the
verification, meaning the split-wet-areas rule and its browser evidence, are not done.
The prompt names stopping after task 2 as the right early stop, and that is where this
run stopped.

Two assumptions were wrong in ways that matter. There is no shaft type and no separate
WC type, so the wet vocabulary is three ids rather than four or more. Rules already
carry a severity field with three values, so the soft tier the prompt asks for exists,
and what is missing is the different distinction between cited law and advice.

## What I did

The vocabulary came first because the prompt makes it independent of everything else.
Reading it changed the design of task 2 twice. The first change was finding that rooms
keep all of their own walls, so a room in the middle of a flat carries a full perimeter
of partitions and a room on the edge carries the facade, both built by the same code.
The second was finding that those walls are merged into one mesh per direction, which
means a single mesh holds facade and partition segments together and mesh visibility
cannot separate them. That ruled out copying the existing Structure view, which works
by flipping `.visible` on whole wall meshes.

What made the view cheap anyway is that `rebuildRoomWalls` already accepts a `skip` set
of edges to dissolve, added for the Outdoor boundary, and the room caller never passes
it. Handing it the interior edges gives exactly the target state with no new geometry
path. After that the remaining work was furniture, colour and door markers, which are
ordinary visibility and material state.

- `src/core/modules.ts:88-114` gained `WET_TYPES`, `isWet`, `BEDROOM_TYPES` and
  `isBedroom`, next to the existing `BATHROOM_TYPES` and `isBathroom`.
- `src/core/floorManager.ts` gained `INTERFACE_TINT_BEDROOMS`, the plate colours,
  an `interfaceView` flag, `partitionEdges()`, `setInterfaceView()` and
  `applyInterfaceView()`, plus one new argument at the `rebuildRoomWalls` call.
- `src/core/floor.ts` gained `refreshColors()`.
- `src/scene/doorView.ts` gained `setVisible()`.
- `index.html` gained the `#interface-toggle` button and `src/main.ts` its handler.
- `PROJECT_STATE.md` §5 gained the Interface view entry.

## Findings

### Task 1, the vocabulary

**Room type ids.** Eleven room presets exist in `MODULE_DEFS`
(`src/core/modules.ts:114-280`), plus three furniture modules and one stair, all in one
id space because they share placement mechanics and one occupancy map:

| id | name | footprint | category | cluster |
|---|---|---|---|---|
| `living` | Living Room | 7×5 | room | none |
| `kitchen` | Kitchen | 4×4 | room | none |
| `bedroom_small` | Bedroom — Small | 5×4 | room | none |
| `bedroom_large` | Bedroom — Large | 6×5 | room | none |
| `bathroom_small` | Bathroom — Small | 3×3 | room | none |
| `bathroom_large` | Bathroom — Large | 4×4 | room | none |
| `recreation` | Recreation Room | 5×5 | room | none |
| `circulation_single` | Circulation — Single | 1×1 | room | `circulation` |
| `circulation_double` | Circulation — Double | 1×2 | room | `circulation` |
| `outdoor_single` | Outdoor — Single | 1×1 | room | `outdoor` |
| `outdoor_double` | Outdoor — Double | 1×2 | room | `outdoor` |
| `single`, `domino`, `ltriomino` | furniture | 1 to 3 cells | module | none |
| `stair` | Stair (dogleg) | 2×6 | stair | none |

**Which count as wet.** Three: `bathroom_small`, `bathroom_large`, `kitchen`. That is
now `WET_TYPES` at `src/core/modules.ts:97`.

**There is no shaft type, and assumption 2 is right to suspect it.** Nothing in
`MODULE_DEFS`, in the `Category` union, or anywhere in `src/core/` represents a shaft.
Both the view and the rule are therefore scoped to the three wet room ids above. The
comment at `src/core/modules.ts:91-96` records where a shaft type belongs when it
arrives, which is inside `WET_TYPES`, because every consumer asks whether a cell needs
a pipe rather than whether it is a bathroom.

**There is also no separate WC or toilet type.** A toilet is a `bathroom_small` today.
That matters directly for the meeting question the prompt quotes, since deciding
whether to decouple the toilet shaft from the bathroom and kitchen shafts cannot be
expressed in the current vocabulary at all. The model cannot currently tell a WC from a
small bathroom, so the decision the view is meant to support needs a fourth wet id
before it can be made in the app rather than on paper.

**The shape of a `RULES` entry.** Defined at `src/core/rules.ts:60-65`:

```
export interface Rule {
  id: string;
  severity: Severity;
  description: string;
  check: (graph: DwellingGraph, ctx: RuleContext) => Violation[];
}
```

`Severity` is `"hard" | "soft" | "note"` (`rules.ts:43`), with a taxonomy spelled out at
`rules.ts:30-39`: hard means uninhabitable or against near-universal code, soft means a
deviation from empirical practice or comfort norms, note means characterisation rather
than judgment. `SEVERITY_COLORS` at `rules.ts:68-72` maps them to red, amber and green,
and `worstSeverity` at `rules.ts:77` ranks them. There are 37 rules in `RULES`.

So assumption 3 is half right. A severity concept exists and a soft tier is already
there, which means the new rule needs no new field to read softer. What does not exist
is any field distinguishing cited law from advice. Severity says how serious a problem
is; it says nothing about who says so. The regulation work needs the second axis, and it
is genuinely a second axis, because a hard rule can be practice rather than law and a
soft one can be law.

**Where scene objects are built.**

| Object | Where |
|---|---|
| Room shell: floor slab plus perimeter walls | `src/scene/moduleMesh.ts` `buildRoomShell` (~L509), rebuilt by `rebuildRoomWalls` (~L565) |
| Wall and glazing geometry | `src/scene/moduleMesh.ts` `buildBoundaryWalls` (~L259), merged per direction at ~L451-498 |
| Merged connector clusters (Circulation, Outdoor) | `src/scene/clusterShells.ts` `rebuildClusterShells` |
| Furniture props | `src/scene/props/place.ts` `buildPropsMesh` (~L218), one `InstancedMesh` per room |
| Stairs | `src/scene/stairMesh.ts` |
| Entrance markers | `src/scene/entranceView.ts` |
| Door markers and swing arcs | `src/scene/doorView.ts` |
| Stair holes in the plate above | `src/scene/holeView.ts` |
| Elastic seed outlines | `Floor.rebuildSeedOutlines`, `src/core/floor.ts` |

The orchestrator is `FloorManager.rebuildAllShells()` (`src/core/floorManager.ts:232`),
which runs on every change and rebuilds room walls and cluster shells across all floors.

**How visibility is controlled today.** Four mechanisms already exist, and the new view
had to compose with all of them rather than replace any:

- Per-floor visibility, `Floor.setVisible` via `FloorManager.setFloorVisible`.
- Dimming of inactive floors, `Floor.setDimmed`, which recolours every material through
  `fade()` at `src/core/floor.ts:307`. A material's own `userData.baseColor` wins over
  the room colour, which is the hook the new view uses.
- The camera-aware cutaway, `src/scene/cutaway.ts`, which flips `.visible` on meshes
  tagged `userData.wallNormal` and respects `userData.structureHidden`.
- The Structure x-ray, `FloorManager.setStructureView` at `floorManager.ts:322`, which
  hides walls and glazing of elastic rooms by flipping `.visible` on children tagged
  `userData.isWall`.

Mesh tags in play: `isWall`, `wallNormal`, `isGlass`, `railing`, `isSlab`, `props`,
`baseColor`, `noDim`, `structureHidden`.

**Things the coming interface-versus-interior model split will need to know.**

Rooms keep all of their own walls. The comment at `floorManager.ts:288-291` states it
directly: the dissolve is one-sided and only the Outdoor or Circulation cluster drops
its boundary segment. So there is no perimeter object anywhere. The flat's outline is an
emergent property of which room walls happen to face unoccupied cells, recomputed on
every change. A model-level split into interface and interior will have to decide
whether the perimeter becomes a real object or stays derived, and the honest cost of a
real one is that walls, glazing, doors, entrances and the export all currently agree by
deriving from the same occupancy set, so introducing a stored outline creates the first
thing in this app that can disagree with the grid.

Wall meshes are merged one per direction. Any future feature that wants to treat
individual wall segments differently, which a real interface level almost certainly
does, has to work at rebuild time through the `skip` and `windows` sets rather than at
render time through visibility.

Elastic rooms already blur the two levels. `living`, `bedroom_small`, `bedroom_large`
and `recreation` grow to absorb enclosed empty space (`src/core/expansion.ts`), so their
effective footprint is derived, while wet rooms and clusters are fixed. That maps
suspiciously well onto the binding versus exchangeable split, and it may be that the
interface level is close to "everything that is not elastic" plus the perimeter.

### Task 2, the interface view

The toggle is `#interface-toggle`, labelled `Interface view`, added at
`index.html:78` next to Cutaway, Seeds and Structure, and wired at
`src/main.ts:534-544`. It calls `FloorManager.setInterfaceView`.

**What the filter runs on, as the actual lists in code:**

Kept exactly as they are, by being excluded from the strip:

- Wet rooms, tested by `isWet(inst.def)` (`src/core/modules.ts:104`), which is
  `bathroom_small`, `bathroom_large`, `kitchen`.
- Stairs and Outdoor and Circulation clusters, because `applyInterfaceView` and the wall
  branch both skip anything that is not a non-clustered room
  (`inst.def.category !== "room" || inst.def.cluster`).
- Entrance markers, which live in `entranceView` and are never touched.
- Every wall segment on the flat's outer boundary, with its glazing, because those edges
  are deliberately left out of the skip set.

Stripped from every non-wet room:

- Interior partitions, via `partitionEdges()` in `floorManager.ts`, which walks each
  effective cell and each of the four sides and adds the LOCAL edge key whenever the
  neighbour cell is in the floor's `occupied` set. An edge whose neighbour is unoccupied
  faces outside and is kept. The set is passed as `BoundaryWallOpts.skip` to
  `rebuildRoomWalls`.
- Furniture, by hiding the child whose `userData.props` is true.
- The room's own colour, by setting `material.userData.baseColor` to `OPEN_PLATE`
  (`0xd8d4cb`) and calling `Floor.refreshColors()`.
- Interior door markers and their arcs, by `DoorView.setVisible(false)`.

**The perimeter does not get punched through**, which is the failure the prompt asked
about. Because the skip set is built from the neighbour test rather than from room
identity, a room on the flat's edge keeps precisely the segments that face out and loses
precisely the ones that face another space. This is better than the fallback the prompt
offered, and it needs no outline object.

**The bedroom-tint flag** is `INTERFACE_TINT_BEDROOMS`, an exported const in
`src/core/floorManager.ts` immediately after `CLEARANCE_CELLS`, currently `true`. When
true a bedroom's plate takes `BEDROOM_TINT` (`0xa9bcd0`) instead of `OPEN_PLATE`.
Flipping it is one line and changes nothing else, which is what the prompt asked for,
since the meeting's 30:20 wording and the export list disagree about whether bedroom
positions are binding.

**Restore.** This is where the evidence is thin and it should be read as thin. The
mechanism restores by construction: the wall skip set is passed only while the flag is
on, so turning it off runs the same `rebuildAllShells` that every other change runs and
rebuilds the walls that were dissolved; `delete mat.userData.baseColor` returns colour
to the room's own `def.color` through the same `fade()` path; props visibility returns to
true; and `DoorView.setVisible(true)` restores the arc state that `setArcsVisible` last
set rather than a guess. What has actually been observed is that the button exists, is
labelled `Interface view`, and that two full on and off cycles leave its class list back
at empty with no console errors. That is a wiring check. It is not proof that the scene
is pixel-identical, and the prompt explicitly asked for proof rather than assertion, so
this claim is unproven.

### Task 5, verification, and why the screenshots are missing

`tsc` and `npm run build` are both clean. Raw output:

```
npx tsc --noEmit
--- tsc exit: 0 ---
```

```
npx vite build
dist/assets/index-CfkTz7DP.css     15.51 kB │ gzip:   3.06 kB
dist/assets/index-CBNY50xy.js   3,364.35 kB │ gzip: 393.95 kB
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 16.21s
```

The chunk-size warning predates this run and is unrelated to it.

The dev server is running on port 5173 and the page loads, but every screenshot attempt
returned the same refusal, twice:

```
screenshot failed: Screenshot timed out after 5s: the Browser pane is not displayed, so the page is not compositing frames. Display the pane and retry.
```

The constraint covering this says to stop at `tsc` and `npm run build` when the pane is
hidden, say so plainly, and give the manual steps. So there are no screenshots, the view
has never been seen, and the rule was not built.

**Manual steps to check the view by hand.** Open the app, place a kitchen and a bathroom
so they do not touch, add a living room and a bedroom around them, and place an entrance
on an outer edge. Then click `Interface view` in the bottom-right controls. Expect the
outer walls and their glazing to stay, the kitchen and bathroom to keep their walls and
furniture, the living room and bedroom to lose their partitions and furniture, the
bedroom to show a blue-grey plate and the living room a warm grey one, and every door
marker to disappear. Click it again and expect the scene to return, including the door
markers. Toggling Cutaway and switching the active floor while the view is on checks
that it composes with dimming and the cutaway.

### The stale-documentation list

`src/core/rules.ts` currently defines 37 rules: E1, E2, DR1, DR2, P1, P2, P3, MB1, H1,
H2, H3, H4, S6, H6, C1, C2, A1, O1, OD1, ST1, ST2, D1, D2, W1, OR1, G1, G2, S1, S2, S3,
AC1, S5, S7, DP1, N1, PG1, F1.

`README.md` documents 24 in its rule tables: C1, C2, D1, D2, DP1, E1, E2, G1, G2, H1,
H2, H3, H4, H6, P1, P2, P3, S1, S2, S3, S4, S5, ST1, ST2. It is stale in both
directions. Thirteen rules in the code are undocumented there, and it documents an `S4`
that does not exist in `RULES` at all. `README.md` is hand-maintained.

Under `docs/`, four files carry the rule set:

| File | Size | Generated or hand-maintained |
|---|---|---|
| `docs/rules-reference.html` | 47840 bytes | hand-maintained, and `CLAUDE.md` requires editing it when `rules.ts` changes |
| `docs/rules-reference.pdf` | 270714 bytes | generated from the HTML by `docs/build-pdf.py` |
| `docs/rules-list.html` | 35993 bytes | hand-maintained by the same convention |
| `docs/rules-list.md` | 11800 bytes | hand-maintained |
| `docs/rules-list.pdf` | 393030 bytes | generated by `docs/build-pdf.py` |

Their contents were not diffed against `rules.ts`, because nothing under `docs/` may be
touched in this run and no rule was added, so the comparison would report a
pre-existing state rather than anything this run caused. The README count above is the
one that was measured, and it is enough to show the documentation has drifted.

Three further untracked files sit under `docs/`: `research-precedents.md`,
`research-swiss-regulations.md` and `review-storyline-2026-08-04.md`. They were written
outside this run and were left alone.

### What contradicts the Assumptions section

Assumption 1 is right that placed cells carry a room type and that presets live in
`src/core/`, and right to flag the ids as unknown. It is wrong to leave open whether a
WC type exists: it does not, and a toilet is currently a `bathroom_small`.

Assumption 2 is right. No shaft type exists, and both the view and the rule are scoped
to the three wet ids.

Assumption 3 is half wrong. `RULES` does carry a `severity` field with three values and
a documented taxonomy, so the soft tier already exists. The field the regulation work
needs, separating cited law from advice, does not exist and is a different axis from
severity.

Assumptions 4, 5, 6, 7, 8 and 9 all hold as stated. On 4 in particular, rooms are indeed
hollow shells recomputed on every change, and the view does filter rather than mutate.

## Evidence

Rungs stated separately, because they are not equal.

- Vocabulary, room ids, footprints, categories and clusters: read directly from
  `src/core/modules.ts:114-280`. Rung: read the file.
- Absence of a shaft type and of a WC type: searched `MODULE_DEFS` and the `Category`
  union. Rung: absence of a match, which is weaker than a positive read, though the
  registry is a single literal and easy to enumerate.
- `Rule` shape and `Severity`: read from `src/core/rules.ts:43-80`. Rung: read the file.
- Rule count of 37 and the id list: regex over `rules.ts` for the `id:` field inside
  `RULES`. Rung: counted, not eyeballed.
- README rule count of 24 and the `S4` discrepancy: regex over `README.md` table rows,
  then compared to the code list. Rung: counted.
- Wall meshes merged per direction: read from `src/scene/moduleMesh.ts:451-498`. Rung:
  read the file.
- `skip` set already supported and unused by the room caller: read from
  `moduleMesh.ts:253-257` and the call site at `floorManager.ts:292`. Rung: read.
- `tsc` and `npm run build` clean: both run, output quoted above. Rung: executed.
- Toggle exists, is labelled, and cycles without error: executed in the live page, which
  returned `{"exists":true,"label":"Interface view","before":"","mid":"active","after":""}`
  and no console errors. Rung: executed, but this is DOM state only.
- The view's visual behaviour and the restore being exact: **not verified**. No pixels.

## Artifacts produced

- `src/core/modules.ts`, `src/core/floorManager.ts`, `src/core/floor.ts`,
  `src/scene/doorView.ts`, `src/main.ts`, `index.html`, all modified.
- `PROJECT_STATE.md` §5, with the Interface view entry.
- `_cowork/outbox/0006-interface-view-and-a-soft-rule-for-split-wet-areas.report.md`,
  this file.
- `_cowork/done/0006-interface-view-and-a-soft-rule-for-split-wet-areas.md`.
- `_cowork/LOG.md`, one row appended.

No screenshots. The code changes outside `_cowork/` are left uncommitted, as the skill
requires, so a person reads them before they enter history.

## Decisions and rationale

The wall filter runs at rebuild time rather than at render time. Copying the Structure
view would have been cheaper to write and would have been wrong, because that view flips
whole wall meshes and this one has to separate facade from partition inside a single
merged mesh. The alternative to a rebuild was to stop merging walls per direction so
each segment could be hidden on its own, which would give finer control at render time
and would cost a draw call per segment on every room on every floor.

Colour goes through `baseColor` rather than by setting `material.color` directly. Setting
the colour directly works until the floor dims or the cutaway runs, at which point
`fade()` overwrites it from `baseColor` or the room colour and the view silently
reverts. Writing `baseColor` instead means the existing pass carries the change.

`isWet` and `isBedroom` were added to `modules.ts` rather than kept local to the view,
following `BATHROOM_TYPES` and `isBathroom`, whose comment says the point of the shared
list is that the def-level and node-level tests cannot drift. The unbuilt rule needs the
same wet list, so putting it anywhere else would have created the drift that comment
warns about.

## Deviations from the prompt

None in what was built. The parts not built are listed below rather than approximated.

## Blocked / did not do

Task 3, the split-wet-areas rule, is not built. Nothing blocked it except the run
reaching its practical end, and the prompt names stopping after task 2 as correct. The
groundwork it needs is in place: `isWet` and `WET_TYPES` exist, and the connectivity test
it needs is a flood fill over wet cells with the four-neighbour rule, which the codebase
already has a precedent for in `src/core/expansion.ts`.

Task 5's browser verification is not done, because the Browser pane is not displayed.
The four screenshots, the rule firing, the rule clearing, and the view on and off, are
all missing, and the rule's message text cannot be quoted because the rule does not
exist.

Task 4 is done for the view only. `PROJECT_STATE.md` describes the Interface view and
says nothing about a rule, correctly, since there is none.

## Open questions for you

1. **A WC is not a distinct type, so the decision the view was built for cannot yet be
   made in the app.** The meeting question is whether to decouple the toilet shaft from
   the bathroom and kitchen shafts or bundle all three. Today a toilet is a
   `bathroom_small`, so the model cannot tell the two apart, and the view will show a
   3×3 bathroom whether it is a full bathroom or a WC. Adding a fourth wet id is small.
   What is not small is that it changes the palette the 4 August guest sees, and it
   changes the export vocabulary in the same week the export contract is being rewritten.
   The alternative is to demonstrate the view with bathrooms standing in for WCs and
   name the limitation aloud in the review.

2. **Severity and authority are two axes, and the prompt asked for one field.** Rules
   already carry `severity` with hard, soft and note, so the new rule can read softer
   today with no new field. The distinction the regulation work needs is different: a
   rule can be soft advice, soft law, hard advice or hard law, and the current taxonomy
   at `rules.ts:30-39` mixes the two by defining hard as "uninhabitable or violates
   near-universal building code". Adding a second field is easy. Deciding whether the
   existing 37 rules get classified retroactively is not, and until they are, a report
   cannot honestly say which of its warnings are law.

## Suggested next prompt

Build the split-wet-areas rule on the groundwork this run left, and settle the second
open question first, because the rule is the first occupant of the advice tier and
should not be written twice.

The prompt should say which field name carries the law-versus-advice distinction and
whether the existing 37 rules are classified now or left unclassified until later. Then
the rule itself is small: flood-fill the wet cells of one floor with four-neighbour
connectivity, where corner contact does not count, and emit one violation when the count
of groups exceeds one, naming the count and the group positions. `isWet` and `WET_TYPES`
at `src/core/modules.ts:97-105` are already there, and the rule reads cells rather than
graph nodes, which is a departure from every existing rule in `RULES` and worth stating
in the prompt so it is a decision rather than a surprise.

It should also carry the view forward, since the view has been written but never seen.
Ask for the four screenshots from this prompt's task 5 as the first thing the run does,
before the rule, so that if the pane is available the review has its evidence, and if it
is not, that is known early instead of at the end.

Worth knowing for scheduling: the `README.md` rule tables are stale by 13 rules and list
an `S4` that no longer exists. That is unrelated to this run and is a five-minute fix
whenever a run is allowed to touch it.
