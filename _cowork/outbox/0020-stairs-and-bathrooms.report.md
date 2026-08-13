---
id: "0020"
title: Stairs you can climb, and bathrooms in two sizes
source: 0020-stairs-and-bathrooms.md
status: complete
branch: run/0020
commit: 9ad4e36
completed: 2026-08-13
---

## Summary

The editor now offers four real stairs and three real bathrooms. Every stair
proportion is derived from the storey height rather than assumed, and every
riser and tread is drawn at that true size, so a flight reads correctly from
the side and a section through it can be measured. The one-cell stair the
meeting called illegal is retired from the palette and kept loadable, so no
existing flat loses its floor-to-floor connection.

The bathroom sizes the prompt proposed all hold. They were checked rather than
trusted, by drawing the fixtures at true size and measuring the clear floor
each layout leaves.

One thing did not come out as proposed and is reported rather than worked
around. The spiral at 4 by 4 cells cannot meet the 2R + T rule at its walking
line. The number is 227 mm of going where 270 is wanted, and reaching 270 needs
a 5 by 5 square. The 4 by 4 was built as asked and the miss is stated with the
remedy.

The branch is `run/0020`, pushed to `origin/run/0020` at
`9ad4e36c0466d6dd67baaec5bcb1e3cf1d32779e`. Nothing was merged and `main` was
not touched.

## What I need back — answers

### 1. Commits and the preview address

Four commits, oldest first, each figure from `git show --shortstat`:

- `a005d7a` stairs: four types at real size — 6 files, +938, −147.
- `b1007a1` bathrooms: minimal and full — 3 files, +220.
- `dc68f48` stairs: the flight below reads through its own opening — 2 files,
  +56, −7.
- `9ad4e36` stairs: PROJECT_STATE sections 2a and 2t — 1 file, +106, −33.

`git push -u origin run/0020` succeeded and `git rev-parse origin/run/0020`
returned `9ad4e36c0466d6dd67baaec5bcb1e3cf1d32779e`, equal to local HEAD. A
fifth commit carrying this report, the prompt's move to `done/` and the LOG row
lands on the same branch after this file is written and is pushed with it; the
code under review is exactly `9ad4e36`.

The preview follows the pattern run 0019 established:
`https://run-0020--reconfigure-flat.netlify.app`. The site is
password-protected, so an unauthenticated check answers 401 rather than 200,
and 404 for the first minute or two while the branch builds. Nothing in the
repository names the site; the name comes from run 0019's prompt and is now
recorded in `_cowork/CONTEXT.md`.

```bash
git fetch origin run/0020 && git checkout run/0020 && npm install && npm run dev
```

### 2. The cell size and storey height as found

The cell is **0.6 m**, `CELL_SIZE` at `src/core/grid.ts:4`, as the prompt
assumed.

The storey height is **derived, not configured**, which is the part worth
knowing. `FloorManager.floorHeight` computes
`(max(DEFAULT_FLOOR_CELLS, tallest placed room) + CLEARANCE_CELLS) × CELL_SIZE`
with `DEFAULT_FLOOR_CELLS = 4` (`floorManager.ts:35`) and
`CLEARANCE_CELLS = 1` (`floorManager.ts:39`). So a floor with no unusually tall
room is **(4 + 1) × 0.6 = 3.0 m**, and a floor holding a taller room grows in
0.6 m steps. Every number in the stair table below is for the 3.0 m default,
and every one of them re-derives when the floor changes, which is what
`rebuildStairRise` exists for.

### 3. The stair table

All four types share one derivation, in `src/core/stairSpec.ts`. The storey
height fixes the total rise, so the riser count is the count that lands nearest
the 170 mm target rather than a number anyone chose: 3000 / 170 is 17.65, so
18 risers, and the exact riser is 3000 / 18 = **166.667 mm**, carried unrounded
through to the geometry. The tread holds at 270 mm. That gives
2R + T = 603.3 mm, which is 6.7 mm under the 610 target, and it is under
because the riser had to shrink to divide the storey evenly.

The tread compresses only when a footprint would otherwise be overrun, which
never happens at 3.0 m. `stairSpec.test.ts:125-136` checks every type across
storeys from 2.4 to 4.2 m and asserts the flights always fit the cells they
claim, because occupancy is the contract and geometry leaving its footprint
would be a lie about what the flat contains.

| type | cells | metres | flights | risers | exact riser | tread | run per flight |
|---|---|---|---|---|---|---|---|
| `stair_straight` | 2 × 8 | 1.2 × 4.8 | 1 | 18 | 166.667 mm | 270 mm | 17 × 270 = 4.59 m |
| `stair_dogleg` | 3 × 6 | 1.8 × 3.6 | 2 | 9 + 9 | 166.667 mm | 270 mm | 8 × 270 = 2.16 m |
| `stair_dogleg_wide` | 4 × 6 | 2.4 × 3.6 | 2 | 9 + 9 | 166.667 mm | 270 mm | 2.16 m |
| `stair_spiral` | 4 × 4 | 2.4 × 2.4 | 1 turn | 18 | 166.667 mm | see below | 20° per tread |
| `stair_c` | 4 × 6 | 2.4 × 3.6 | 3 | 6 + 6 + 6 | 166.667 mm | 270 mm | 5 × 270 = 1.35 m |

**The dogleg width.** The default ships TIGHT, two 0.9 m flights in 1.8 m,
because that is the standard domestic dogleg and it is what a dwelling can
actually spare next to the rooms it serves. The generous 2.4 m version, two
1.2 m flights, is a separate palette entry rather than an option hidden on the
same one, so choosing it is a visible decision. Both are 6 cells long: a 2.16 m
flight plus a landing as deep as a flight is wide.

**The C's footprint, derived.** Three flights of 6 risers give 5 goings each,
so 1.35 m of run per flight. Across the stair that is one run plus one landing,
1.35 + 0.9 = 2.25 m; along it, landing plus run plus landing,
0.9 + 1.35 + 0.9 = 3.15 m. On the 0.6 m grid that rounds up to **4 × 6 cells,
2.4 × 3.6 m**, the same footprint as the generous dogleg, which is worth
knowing when choosing between them.

**The spiral, and what 4 × 4 costs.** A going on a spiral is an arc, so it
depends where it is measured, and the walking line sits half the clear width
out from the newel. In a 2.4 m circle with a 100 mm newel the clear width is
1.1 m, putting the walking line at 650 mm, where 18 treads of 20° give a
**226.9 mm** going. So 2R + T at the walking line is **560.2 mm**, not 610. The
outer edge is generous at 418.9 mm, which is the usual spiral compromise.
Reaching 270 mm at 20° per tread needs a 773.5 mm walking line, hence a 2.89 m
circle and a **5 × 5 cell** square. `spiralPlan` returns both numbers
(`stairSpec.ts:208-232`) and `stairSpec.test.ts:179-192` pins them, so the
trade stays visible instead of being quietly made. The 4 × 4 was built as the
prompt asked; the miss is the finding.

**Measured from the built geometry**, not from the plan that produced it. Every
stair was placed in the running app and its vertices read back:

| type | drawn width | drawn length | rise | footprint | fits |
|---|---|---|---|---|---|
| `stair_straight` | 1.14 m | 4.59 m | 3.0000 m | 1.2 × 4.8 | yes |
| `stair_dogleg` | 1.74 m | 3.60 m | 3.0000 m | 1.8 × 3.6 | yes |
| `stair_dogleg_wide` | 2.34 m | 3.60 m | 3.0000 m | 2.4 × 3.6 | yes |
| `stair_spiral` | 2.40 m | 2.40 m | 3.0000 m | 2.4 × 2.4 | yes |
| `stair_c` | 2.40 m | 3.57 m | 3.0000 m | 2.4 × 3.6 | yes |

The drawn widths are 60 mm under their flight widths because `STEP_INSET`
shrinks each flight so two lanes read separately. The straight run's 4.59 m is
17 × 270 exactly. Every base is y = 0 and every top is y = 3.0000, so all four
arrive at the upper floor rather than near it.

**The dogleg really turns**, checked by sampling rather than by eye. Its
vertices at y = 3.0 lie at z = −0.30, the BASE end, in x 0.63 to 1.47, which is
the second lane; its vertices at y = 1.5 span z 1.86 to 3.30, which is the
landing at the far end; and the whole assembly spans x −0.27 to 1.47, two
0.84 m lanes side by side. So the flight climbs away, turns on a half-landing
at mid-height, and comes back to arrive above where it started.

**A stair occupies both storeys.** The footprint is claimed on the floor it
stands on and projected up as a stairwell hole into the floor above
(`FloorManager.syncStairsAndHoles`), which blocks placement there. Measured on
the 3 × 6 dogleg: floor 1 reports **18 hole cells**, exactly the footprint.

### 4. The bathroom fit

The fixtures are drawn from voxel data at 50 mm per voxel, so a prop's authored
size is its real size. The WC is 400 × 700, the basin 500 × 400, and the
bathtub **1700 × 750**, which is exactly the 170 by 75 the meeting named. Those
three numbers are read off the same files the app draws and asserted in
`props/bathroomFit.test.ts:40-55`, so a prop re-authored larger fails the suite
rather than quietly overlapping a wall.

Each layout was then measured for the clear floor it leaves, against the
domestic figures a WC needs to sit down (600 mm), a basin to stand at (600 mm),
and a bath to step into (700 mm).

**The minimal WC at 2 × 3 cells, 1.2 × 1.8 m. VERDICT: holds.** The WC sits
centred on the end wall, 700 mm deep, with 400 mm of wall either side of it.
The basin hangs on the side wall at the far end, 400 mm deep and 500 mm along
the wall, so it never stands in front of the WC. That leaves
1800 − 700 − 500 = **600 mm** of clear floor in front of the WC across the full
1.2 m width, and 1200 − 400 = **800 mm** of clear width past the basin. Tight,
and a standard cloakroom.

**The full bathroom at 4 × 4 cells, 2.4 × 2.4 m. VERDICT: holds comfortably.**
The tub runs along one wall with 2400 − 1700 = 700 mm to spare, the WC faces it
from the opposite wall, and the basin takes the side. Clear floor between the
tub's face and the WC's is 2400 − 750 − 700 = **950 mm**, comfortably past the
700 the bath needs, and the basin's 400 mm projection still leaves 2000 mm
across.

**The compact full bathroom at 3 × 4 cells, 1.8 × 2.4 m. VERDICT: holds, and
the tub is what binds.** The same 950 mm between tub and WC, and 1400 mm across
once the basin projects. The tight dimension is the tub itself: 1700 mm in an
1800 mm wall leaves **100 mm**, which is real but is the number to argue with
if this size is revisited. One cell narrower is 1.2 m and does not admit a
1.7 m bath at all, which is why 3 × 4 is the floor rather than a preference.

All three carry the wet interface. They were added to `BATHROOM_TYPES`
(`modules.ts:75-84`), which is the single list `isBathroom`, `isWet`,
`WET_TYPES` and rules.ts's `ctx.is.bathroom` all read, so a solid wall against
outdoor space, the wet-room treatment and the rules all follow with no other
edit anywhere.

### 5. Screenshots

Pane screenshots do not write files in this environment, the limit runs 0016,
0018 and 0019 recorded, so they live in the session record. The canvas captures
DO write files and every one was byte-checked:

| path | bytes |
|---|---|
| `captures/0020-four-stairs-axo.png` | 197,034 |
| `captures/0020-upper-storey-reads-through.png` | 284,430 |
| `captures/0020-bathrooms-axo.png` | 174,379 |
| `captures/0020-bathrooms-plan.png` | 192,804 |

What each shows:

- **All four stairs in the palette.** The PLACE panel's STRUCTURE & ACCESS
  group lists Stair — Straight 2×8, Stair — Dogleg 3×6, Stair — Dogleg
  generous 4×6, Stair — Spiral 4×4 and Stair — C three flights 4×6. The retired
  one-cell stair is absent.
- **Each placed once**, in `0020-four-stairs-axo.png`: all five entries on one
  floor, treads and risers visible on every flight, the spiral reading as a
  spiral with its newel.
- **A dogleg on both storeys**, in `0020-upper-storey-reads-through.png`, which
  is also the upper-storey editing view: floor 1 active, the flight below
  showing through the opening as a translucent ghost rather than being hidden
  behind a grey plate. The materials behind that picture read
  `{transparent: true, opacity: 0.35, depthWrite: false}` on the lower floor and
  `{opacity: 0.18, depthWrite: false}` on the opening panel.
- **Both bathrooms with furniture**, in the axonometric and the plan. The plan
  is the clearer one: the WC shows its two fixtures with the clear floor
  between them, and both full bathrooms show the tub along the top wall with
  the WC and basin on the other two. Prop voxel counts placed: 1,260 for the
  WC, 4,870 for the full bathroom, 4,488 for the compact.

### 6. What happened to the old stair

It is deprecated, hidden, and still loadable, which is the combination the
prompt asked for.

`MODULE_DEFS.stair` stays in the registry (`modules.ts`, renamed to
"Stair (dogleg, retired)") and is absent from `STAIR_LIST`, so the palette
never offers it and nothing new can be placed. It stays in the registry because
`loadProject` resolves every saved instance through `MODULE_DEFS` by type:
deleting the entry would silently drop the stair out of any pre-0020 flat,
taking its stairwell hole and its floor-to-floor connection with it.

That path is exercised, not assumed. `testflats/flat-1-two-storey.json` still
contains one, and loading it in the running app reports its stair types as
`["stair"]` and still reads its 12-issue baseline. Anything placed from an old
file renders, can be selected and can be deleted; only creation is gone. The
geometry falls back to the tight dogleg's shape at its own 2-cell width
(`stairMesh.ts:79-87`), so an old flat looks like what it was rather than
throwing.

### 7. Test counts and the fixture baselines

Before this run: `npm test` 84 passed in 8 files. After: **126 passed in 10
files**, 3.99 s. The 42 new cases are `stairSpec.test.ts` (23, the proportions,
the split, the footprint-fit invariant across storey heights, and the spiral's
miss) and `props/bathroomFit.test.ts` (19, the fixture sizes and every
clearance quoted above).

`npm run test:slow` reports **6 passed and 1 expected fail**, 4.83 s. The
expected fail is the standing french-window case at
`src/core/unitExport.slow.test.ts:194`, untouched. `npx tsc --noEmit` exits 0
and `npm run build` completes in 6.24 s.

Both fixture baselines re-read from `#validation-panel` after Check Layout, and
both hold:

- `flat-1-two-storey.json` — "1 must fix, 11 worth a look, 5 note", the 12.
- `flat-1-no-stair.json` — "1 must fix, 6 worth a look, 4 note", the 7.

Neither fixture was edited: `git diff main..9ad4e36 --stat` lists nothing under
`testflats/`.

### 8. Skills read

**`parametric-modeling`**: not read, and the reason is worth stating rather
than leaving as an omission. The stair work turned out not to be parametric
modelling in that skill's sense. There is no parameter space to explore and no
associative graph to build: the storey height is given, the riser count follows
from it by one rule, and everything else is arithmetic with a single answer.
What the job needed was a pure derivation with tests, which is what
`stairSpec.ts` is. Reading a skill about parameter spaces and constraint
propagation would have added vocabulary, not decisions, and I would rather name
that than claim an influence I did not take.

**`design-automation`**, read: its section 1.3 splits rules into hard ones that
invalidate and soft ones that penalise, and that is the split I kept visible in
the code. The footprint-fit invariant is hard, so the tread compresses rather
than the geometry overrunning, and the suite fails if it ever does. The 2R + T
target is soft, so the spiral is allowed to miss it and is required to report
by how much. The same section's insistence that heuristics carry their source
is why the dogleg's two widths are both offered with the reason attached rather
than one being chosen silently. Its section 8.3 on graceful degradation is
where the deprecated stair's load-only path comes from: the failure mode to
design against is the one that silently drops data.

**Rejected**, with reasons. `design-automation`'s sections 3 and 4, on
constraint satisfaction and space planning, describe generating layouts from
adjacency programs, which is the opposite of what this app does: the resident
places rooms and the app advises. Adopting a CSP here would invert the thesis
argument. Its section 7 on automated code compliance is a closer call and still
refused: it would have been easy to add a rule failing a stair whose 2R + T
misses 610, and that would have broken the standing constraint that rules
advise and never block, and would have shipped a spiral that reports itself
illegal. The proportion is enforced where it belongs, in the derivation, and
the one type that cannot meet it is documented instead.

### 9. Contradictions with the Assumptions, then my own

**Assumption 1 is false, and it matters most.** It says the tip of main is run
0018's merge and that run 0019 sits pushed and unmerged on `run/0019`. Run 0019
was merged into `main` at `21d1d10` on 10 August and pushed, with a follow-up
at `c524e57`; `main`'s tip when this run started was `c524e57`, not run 0018's
`9089329`. So `run/0020` is cut from a main that already contains run 0019's
one-save dialog, its naming convention and its library housekeeping. I did not
merge anything and did not build on the `run/0019` branch; there was nothing
left to merge. The instruction not to build on run 0019 could not be honoured
in the sense meant, because its code is in main, and cutting from an older
commit instead would have meant developing against a main that no longer
exists. Worth knowing for the next prompt: **the save flow the planning session
thinks is unmerged is live.**

Assumption 2 holds: the cell is 0.6 m.

Assumption 3 holds. Multi-storey authoring exists and a stair is what connects
the storeys; the storey height is derived rather than configured, as set out
under point 2, and its default is 3.0 m.

Assumption 4 holds. Stairs and bathrooms are placed like the existing serviced
modules, through the same `MODULE_DEFS` registry and the same occupancy map,
and the `dwelling-unit` v1 export is untouched. The new types cross the bridge
as ordinary `cellRooms` ids with their names and colours in the legend, which
is what that field exists for.

My own assumptions, where the prompt left room:

- **The riser count is chosen nearest the 170 mm target, not by rounding up.**
  18 risers give 166.7 mm and 17 would give 176.5 mm; 18 is nearer. Effect: the
  riser is always slightly under target rather than always over, and 2R + T
  sits just under 610.
- **The tread stays 270 mm and the footprint takes the slack**, rather than the
  tread stretching to fill the footprint. Effect: the straight run leaves
  210 mm at its foot, which reads as a threshold. The alternative would have
  made the tread 282 mm and quietly broken the rule the meeting set.
- **A footprint is never overrun**: if a taller storey needs more run than the
  cells allow, every flight compresses together and the plan flags it. Effect:
  occupancy stays honest at any storey height, at the cost of a stair that
  reports itself out of proportion instead of drawing through a wall.
- **The spiral makes exactly one turn**, 18 treads of 20°. Effect: the tread
  angle is fixed by the riser count, which is what makes the walking-line going
  fall out as a consequence rather than a choice.
- **The C is a three-flight U in plan**, flights on three sides of a well with
  a landing at each corner. The prompt named three flights around a well
  without fixing the arrangement.
- **The dogleg tight is the default**, reasoning under point 3.
- **The compact full bathroom is a third preset**, not a variant toggle on the
  full one, matching how the two dogleg widths are offered.
- **Dimming now carries part of its meaning as translucency**, so
  `DIM_AMOUNT` dropped from 0.74 to 0.62. Effect: every inactive floor
  everywhere in the app reads slightly more colourful and considerably more
  see-through, not only floors under a stair.

## What I did

- `src/core/stairSpec.ts` (230 lines): `STAIR_SPECS`, `planStair`,
  `riserCountFor`, `splitRisers`, `spiralPlan`. Pure, no three.js.
- `src/core/stairSpec.test.ts` (197 lines, 23 cases).
- `src/scene/stairMesh.ts`: rewritten for four kinds. `buildStairGroup` gained
  a `storeyHeightM` parameter and builds at true size; `rebuildStairRise` is
  new; geometries are normalized to non-indexed before merging.
- `src/scene/moduleMesh.ts:63`: passes the floor's real `wallHeight` to the
  stair builder.
- `src/core/floorManager.ts`: `updateStairScales` holds `scale.y` at 1 and
  rebuilds a stair whose floor height moved.
- `src/core/modules.ts`: five stair entries and three bathroom entries; the old
  `stair` deprecated; `STAIR_LIST`, `ROOM_LIST` and `BATHROOM_TYPES` updated.
- `src/scene/props/rooms.ts` + `index.ts`: three bathroom layouts.
- `src/scene/props/bathroomFit.test.ts` (163 lines, 19 cases).
- `src/core/floor.ts`: `fade()` drops opacity when dimmed and restores each
  material exactly; `DIM_OPACITY` added, `DIM_AMOUNT` softened.
- `src/scene/holeView.ts`: the opening is translucent and never writes depth.
- `PROJECT_STATE.md`: §2a rewritten, §2t added, the systems table updated.

## Findings

- **The old stair was worse than one cell wide.** It was also built at a fixed
  3.0 m reference and stretched by `scale.y`, so on any floor with a tall room
  the risers on screen were never the risers the model meant and the proportion
  drifted invisibly. Fixing the width without fixing that would have shipped a
  stair that is legal at one storey height and wrong at every other.
- **The spiral cannot meet the rule at 2.4 m**, quantified under point 3. This
  is the one place the meeting's numbers and the prompt's footprint disagree.
- **`mergeGeometries` returns null rather than throwing** when its inputs mix
  indexed and non-indexed geometry, and the null only fails later inside
  `new THREE.Mesh` with a message about morph targets that names nothing
  useful. The spiral's newel is an indexed cylinder among non-indexed
  extrusions, so this cost real time; `stairMesh.ts` now normalizes before
  merging and throws with the stair's type in the message.
- **A translucent lower storey needs `depthWrite: false`, not just opacity.**
  With depth writing left on, the plate still culled the flight below it and
  the opening still read as a hole, which looks identical to having changed
  nothing.
- **Two `fade()` calls per material need the original opacity remembered.**
  Reading it at dim time would compound: activate, dim, activate again and the
  material would settle at a fraction of a fraction. It is captured once on
  first touch instead.

## Evidence

- Geometry: every stair placed in the running app and its vertices read back;
  the tables under point 3 are those measurements.
- The dogleg's turn: vertex sampling at y = 3.0 and y = 1.5, quoted under
  point 3.
- Hole occupancy: `floors[1].grid.holeCells.size` = 18 for the 3 × 6 dogleg.
- Transparency: material state read off the live scene, quoted under point 5.
- Fit: `props/bathroomFit.test.ts`, 19 cases, reading the same voxel files the
  app draws.
- Suites: `npm test` 126 passed in 10 files; `npm run test:slow` 6 passed and
  1 expected fail; `tsc` silent; `npm run build` built in 6.24 s.
- Baselines: `#validation-panel` text after Check Layout on both fixtures.
- Deprecation: loading `flat-1-two-storey.json` reports stair types `["stair"]`
  and its unchanged baseline.
- Captures: four PNGs with the byte counts under point 5.

## Artifacts produced

- `captures/0020-four-stairs-axo.png`, `0020-upper-storey-reads-through.png`,
  `0020-bathrooms-axo.png`, `0020-bathrooms-plan.png` (untracked, as
  `captures/` always is).
- `src/core/stairSpec.ts` and its test; `src/scene/props/bathroomFit.test.ts`.
- `PROJECT_STATE.md` §2a and §2t.

## Decisions and rationale

- **The arithmetic is pure and separate from the geometry**, so the report's
  table and the drawn stair come from one derivation and cannot disagree. A
  footprint that stops holding its own flights fails the suite.
- **Stairs are built at true height rather than scaled**, matching what walls
  did in §2b and removing a hidden factor that would also have distorted any
  future stair texture or section drawing.
- **The proportion rule is enforced in the derivation, not as a layout rule.**
  Rules advise and never block, and a stair that reports itself illegal would
  have been the wrong kind of answer to a meeting that asked for stairs that
  are not.
- **The retired stair stays in the registry.** Deleting it would corrupt old
  flats silently, which is the failure mode worth the most care.
- **Dimming carries meaning through translucency as well as colour**, because
  colour alone had to go all the way to flat grey to read as inactive, and flat
  grey is opaque.

## Deviations from the prompt

- **Assumption 1 was false**, described under point 9. `run/0020` is cut from a
  main containing run 0019.
- **The bathrooms are three presets, not two.** The prompt asked for a minimal
  WC and a full bathroom with a default and a compact variant. Since the two
  dogleg widths are separate palette entries, the compact bathroom is one too,
  for consistency.
- **The dogleg is two palette entries rather than one with an option**, for the
  same reason: this app has no per-instance options, and adding one for this
  would have been a new concept.
- **A capture step is not in the prompt but is in the evidence**: the four PNGs
  are canvas captures, since pane screenshots write no file here.
- The `parametric-modeling` skill was not read; reasoning under point 8, given
  as a decision rather than an omission.

## Blocked / did not do

None. The stairs landed whole and the bathrooms did not need to slip.

## Open questions for you

1. **The spiral at 4 × 4 misses the walking rule by 43 mm of going.** Three
   ways out and they are yours to pick: keep 4 × 4 and accept that a spiral is
   a space-saver measured differently, grow it to 5 × 5 (3.0 × 3.0 m) so it
   meets 2R + T at the walking line, or ship both and let the resident choose.
   I built the 4 × 4 as asked and would default to shipping both, since the
   whole point of the meeting was that a stair should be climbable.
2. **The straight run is 4.8 m long**, which is longer than most rooms in these
   flats and will often not fit. Worth knowing before it is offered as an equal
   option beside the dogleg: it may deserve a note in the palette rather than
   appearing to be interchangeable.
3. **Nothing checks that a stair is reachable or that its landing lands
   somewhere useful.** A stair can currently arrive on the floor above into a
   cell no room touches. That is a rules question rather than a geometry one,
   and rules were frozen for this run, but it is the obvious next advisory.
4. **Should the storey height become authorable?** Everything here derives from
   it, and it is currently a consequence of the tallest room plus one cell.
   A resident who wants a 2.7 m or a 3.3 m storey has no way to say so, and the
   stair arithmetic would follow correctly the moment they could.

## Suggested next prompt

Rules for the new stairs and wet rooms, now that both exist. On a fresh branch
from main after this merges: add advisory checks that a stair's upper landing
arrives adjacent to a space on the floor above, that a stair is door-reachable
at both ends (the graph already models this, ST1 and ST2 cover part of it), and
that a dwelling with a bedroom above ground has a stair at all. Keep every one
of them advisory, in the RULES table, phrased through `ctx.is.*` rather than
hardcoded type lists. Return the rule ids and wording, the fixture counts
before and after for both baselines, and a note on whether the spiral's
proportion belongs in the rules or stays a property of the type. Settle open
question 1 first, since a fifth stair entry would change what the rules see.
