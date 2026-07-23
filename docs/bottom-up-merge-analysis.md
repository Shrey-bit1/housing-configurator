# bottom-up-design × Re_Configure — merge-surface analysis

*Analysis only — no code was changed in either repo. Written 2026-07-19 against
`modelstadtt/bottom-up-design-main` (files dated 2026-06-22) and Re_Configure
branch `bundle-furnish-swing-verification` (commit `c3952ad`).*

**Repo identification.** The local clone lives at
`D:\_Studies\_DFAB\DFAB\_T3\modelstadtt\bottom-up-design-main`. There is **no
sibling tekto clone** — tekto arrives as an npm dependency
(`"tekto": "github:modellstadt/tekto"`, resolved v0.2.0, built by its `prepare`
hook into `node_modules/tekto/{src,dist}`). The app repo has no CLAUDE.md; its
README's "Files" table + "Setup notes & gotchas" section is the de-facto reading
guidance, and this analysis followed its recommended order (unitTypes →
building → main → app-shell).

---

## Part 1 — What it is

### Purpose and scale

A **building-scale massing generator**: it grows one multi-residential building
by packing whole **apartments** (named polyomino footprints: Studio … 3-Bed,
plus 2-storey Maisonette/Duplex) into a 3D occupancy grid, then **evolves the
unit mix** with a hill-climber. Before packing, it places a **vertical
circulation core** (stair and/or elevator) and, optionally, routes a **corridor**
from every placed unit to the core via Dijkstra. Everything is seeded
(mulberry32) and reproducible. Self-described as "Milestone 1 = the 3D grid
itself"; the main.ts header names the intended later layers: *facade panels,
unit reconfiguration, corridors + staircases*.

Its **atomic element is an entire apartment** — units are colored boxes with no
interior. That places it exactly **one scale level above Re_Configure**, whose
entire subject (one dwelling: rooms, doors, windows, furniture) is bottom-up's
smallest indivisible thing.

### Running it (verified live)

`npm run dev` (Vite, port 5182) works with the checked-in node_modules. The app
is a dark-theme single-page tool: parameter sidebar (Grid / Mix / Evolve /
Display / Actions groups), a Three.js viewport, a status overlay, and a
unit-type legend with little axonometric SVG icons. With defaults (10×5 modules,
7 floors, 80 unit attempts, seed 1) the live status read:

```
occupancy : 64.6% (904/1400)   units : 41   floors : 7/7
fitness   : 776.6              unreached : 5
units by type: 3-Bed 4 · Studio 10 · 2-Bed L 6 · Duplex 3BR 3 · 1-Bed 7 · Maisonette 5 · 2-Bed 6
```

Views: **Walls** (party walls colored by the unit on each side), **Solid units**,
**Voxels**, **Core** (stair ribbon only), **Timber** (post-and-beam frame with
window openings). Toggles add columns, corridors, roof terraces with
balustrades, and a 1.2 m facade panel grid with merged window bands. A top bar
gives Flat/Studio lighting, Solid/Wire/Hidden render modes, and a **Sun popover**
(date + lat/lon → tekto `SunPosition` → directional light; default Zürich,
summer solstice). *Caveat: the in-app screenshot tool timed out on this tab (its
continuous rAF loop starves the capture), so the visual description above is
from the DOM text + code; to eyeball it, open http://localhost:5182 after
`npm run dev` in the repo.*

### Architecture (flat, deliberately layered)

~2.4k LoC of strict TypeScript in six root files + one lib file. No routing, no
state framework, no persistence.

| File | Role |
|---|---|
| `unitTypes.ts` | Apartment catalog + footprint rotation |
| `building.ts` | The model: occupancy grid, greedy placement, corridors, fitness, evolution. **No rendering** |
| `core.ts` | Vertical-circulation cores (4 kinds) placed before units |
| `stair.ts` | Free-running "wandering stair" generator (tile ribbon) |
| `lib/voxelFaces.ts` | Labelled-voxel boundary-face extraction (partition/facade/void) |
| `main.ts` | Params, all renderers (walls/facade/timber/terraces/columns), legend, status |
| `app-shell.ts` | Reusable sidebar+viewport harness over tekto (copied from a `_template`) |

The split is intentional: "future layers … read the same `Building` without
touching evolution."

### The core data model (the part that matters for merging)

```ts
// unitTypes.ts
interface UnitType {
  id: number                       // 1-based; 0 = empty cell
  name: string                     // "Studio" … "Duplex 3BR"
  color: string                    // "#4dabf7" (hex string)
  cells: Array<[number, number]>   // footprint (dx,dy) in MODULES, per storey
  floors?: number                  // 1 (default) or 2 (maisonette/duplex)
  module?: number                  // per-type fine-cells-per-module override
}
// helpers: rect(w,d), lShape(w,d)  — same idiom as Re_Configure's modules.ts
// orientations(type) → the 4 quarter-turns, de-duped, normalised. NO mirror.

// building.ts
class Building {
  nx, ny, nz: number               // FINE grid dims; index = (x*ny+y)*nz + z
  grid: Int32Array                 // 0 empty, >0 PlacedUnit.id, or a reserved label
  units: PlacedUnit[]
  corridors: boolean               // route a corridor after each placement
  unreachable: number[]            // unit ids that couldn't reach the stair
  setStair(blocks, plateaus)       // reserve the core before randomize()
  randomize(count, gravity)        // fresh genome + greedy bottom-up placement
  evolve(steps, gravity)           // hill-climb: mutate → re-pack → keep if not worse
  fitness(gravity)                 // filled cells − gravity·Σz
  metrics(gravity): BuildingMetrics
  at(x,y,z): number                // 0 out-of-bounds — implements LabelVolume
}
interface PlacedUnit { id: number; type: UnitType; cells: Array<[x,y,z]> }
const STAIR_LABEL = -1; const CORRIDOR_LABEL = -2; const STAIR_PLATEAU_LABEL = -3

// core.ts
type CoreKind = "wandering-stair" | "straight-stair" | "elevator" | "stair-elevator"
interface Core {
  kind: CoreKind
  blocks: Cell[]     // solid reserved cells (units excluded)
  plateaus: Cell[]   // per-floor landings = the corridor anchors
  tiles: StairTile[] // folded-ribbon geometry (stairs)
  shaft: Cell[]      // elevator shaft cells
}

// stair.ts
interface StairTile { cx; cy; dir: [number,number]; h0; h1 } // heights in floor units

// lib/voxelFaces.ts — candidate for promotion into tekto per its own header
interface LabelVolume { nx; ny; nz; at(x,y,z): number }
type FaceKind = "partition" | "facade" | "void"   // void = enclosed pocket (flood fill from border)
interface VoxelFace { label; cell; neighbor; kind; axis: 0|1|2; sign: 1|-1; quad: [Vec3×4] }
function voxelFaces(vol, cell?: number|Vec3, origin?): VoxelFace[]
```

**Placement algorithm:** greedy bottom-up — each genome gene (a catalog index)
drops into the lowest → front-most → left-most position where any orientation
fits, all storeys of a multi-floor unit checked. **Corridors:** after each
placement, multi-source Dijkstra (tekto `GridGraph.grid2D4` +
`Graph.dijkstraFromSources`) from all landings/corridor cells on the unit's
entry floor to the unit's cheapest adjacent free cell (its "door"); the
back-traced path is stamped `CORRIDOR_LABEL`, so the network grows as a tree
and later units pack around it. **Evolution:** mutate (swap order / re-type one
gene) → re-pack → keep if fitness didn't drop.

### Stack, conventions, tekto

- **Language/build:** TypeScript strict, Vite 5, no semicolons (tekto house
  style), `three` ^0.183 as a direct dep, React present only as an unused dev
  dep, `web-ifc` externalized in vite config (tekto's `IfcFile` lazy-loads it;
  the app doesn't use it).
- **Coordinates: Z-up** (X/Y = plan, Z = storey index) — tekto's convention;
  the README explicitly warns the shell defaults to `"y"` and the app passes
  `up: "z"`.
- **Units: meters.** Two plan resolutions: a **fine positioning grid**
  (`fineXY`, default **1.25 m**, slider 0.5–2.5) and a **unit module** of
  `moduleCells` fine cells (default 2 → **2.5 m**). Floor height `cellZ`
  default **2.75 m**, uniform for the whole building.
- **Serialization: none.** No save/load, no export of any kind. The building
  exists only in memory; reproducibility comes from the seed.
- **tekto v0.2.0** (the chair's geometry library) supplies: `Scene` +
  `ThreeRenderer` (+ SVG renderer), `ConnectedMesh`/`Mesh`/`FlatMesh`, `Vec3`,
  `ParamStore` auto-GUI, `SunPosition`, `Graph`/`GridGraph` (Dijkstra), and —
  unused by this app but highly merge-relevant — a **BIM layer**
  (`src/bim/`: walls with balloon-frame / **holzrahmenbau** (CH, 0.625 m) /
  **CLT** constructions, slabs, `Space` (IfcSpace analogue: boundary polygon +
  elevation + height + function + Psets), stairs, opening types) and an **io
  layer** (`IfcWriter` — a dependency-free STEP-21 **IFC4 Design Transfer View
  exporter** covering storeys, walls + `IfcExtrudedAreaSolid`, material layer
  sets, openings + `IfcDoor`/`IfcWindow`, framed members, joints, Psets — plus
  `DxfExporter`). tekto's `WallOpening` is
  `{centerlinePosition, width, sillHeight, headHeight, name?, type?, properties?}`
  with `WallOpening.door(pos, w=0.9, head=2.1)`.
- **Maturity:** the app is an experimental, well-commented milestone-1 — no
  tests, no persistence, no CI config in-repo. tekto is the structured side
  (vitest suite, playground, dist build, its own CLAUDE.md per the README).
  Pinned to a GitHub branch, so API churn is a real (acknowledged) risk.

---

## Part 2 — The merge surface with Re_Configure

### Scale relationship (this determines the merge's shape)

**bottom-up operates strictly one level above Re_Configure.** Precisely:

- a bottom-up `PlacedUnit` ≙ an entire Re_Configure **project** (one dwelling);
- a bottom-up corridor "door" cell (the Dijkstra target adjacent to a unit) ≙
  Re_Configure's **`Entrance`** (edge-bound reachability root);
- bottom-up `Core`/`STAIR_PLATEAU_LABEL` ≙ the building-side counterpart of
  Re_Configure's stair + entrance system;
- bottom-up has **nothing** below apartment granularity (no rooms, doors,
  windows-as-openings, furniture); Re_Configure has **nothing** above one
  dwelling (no second unit, no shared corridor, no site).

So the natural merge is **vertical composition** (building engine feeds unit
envelopes down; unit engine feeds furnishability/quality up), not a fusion of
overlapping features.

### What Re_Configure could consume from it

| Item | Concretely | Value |
|---|---|---|
| **tekto `IfcWriter` + `DxfExporter`** (`tekto/src/io`) | Map `FloorManager.floors` → storeys, room shells → `WallSystem` of `Wall`s with `WallOpening`s, rooms → `Space` (function = `def.type`), stairs → bim `Stair`. Re_Configure's `DOOR_OPENING_H = 2.1` **exactly matches** tekto's door default `headHeight = 2.1`; window sill/head come from the panel kit's `SILL_H`/`LINTEL_H`. | A real BIM/IFC deliverable out of the thesis tool — currently Re_Configure's only output is its own JSON. |
| **tekto `bim/walls` constructions** (`holzrahmenbau`, `clt`) | Feed the same mapped `Wall`s through a `WallConstruction` to get stud/plate/header decomposition or CLT `MaterialLayer[]` — a fabrication-level "timber view" like bottom-up's, but standards-based instead of hand-rolled. | Construction-scale credibility; pairs with the IFC export (members aggregate under walls). |
| **`voxelFaces`** (`lib/voxelFaces.ts`) | 3D labelled-volume boundary extraction with `partition`/`facade`/`void` classification (enclosed pockets found by border flood fill). Re_Configure's `exteriorEdges()` is 2D-per-floor and has no void concept. | Marginal today (Re_Configure's per-room wall shells serve the current features); becomes relevant only for a whole-dwelling-as-volume view. Reference, don't adopt. |
| **The evolution pattern** (`Building.evolve` + seeded mulberry32) | A ~100-line genome/hill-climb/seed idiom, directly reusable for a Re_Configure "auto-layout" mode: mutate room placement, score with the existing `RULES` engine (violation count is a ready-made fitness), keep if not worse. | High thesis value as a *pattern import* — no dependency needed. |
| **tekto `SunPosition`** | Replace OR1's binary north/not-north with real altitude/azimuth (the class is self-contained; copying it is cheaper than adopting tekto for one file). | Small, visible daylight-quality upgrade. |

### What it could consume from Re_Configure

| Item | Concretely | At what boundary |
|---|---|---|
| **Unit interiors** | A `PlacedUnit`'s footprint (polyomino × storeys) becomes a Re_Configure canvas: pre-blocked cells outside the boundary (the existing `Grid.setHoles` mechanism can enforce a non-rectangular boundary), a pre-seeded `Entrance` on the edge where the corridor's door cell touches, then the user (or a future auto-layout) furnishes it. | A small JSON handoff: bottom-up currently has **no serialization**, so the bridge is a new export on its side — `{unit: {id, type, cells@0.6m, floors}, entryEdge: {cx, cz, side}}` — consumed by a "new project from unit footprint" import that feeds Re_Configure's existing tolerant `parseProject`/`loadProject` path. |
| **Furnishability as fitness** | Re_Configure answers "does a rule-clean interior exist for this footprint?" — per `UnitType` (offline, cached) or per placed unit (headless). Result folds into `fitness()` as a per-type weight, so evolution stops packing shapes that can't be furnished. | Stage A: a static score table (hand-produced with Re_Configure). Stage B: headless scoring service (expensive — see Part 3). |
| **The advisory-rules pattern** | bottom-up's `unreachable: number[]` is a proto-rule (a building-scale F1). Re_Configure's `RULES` table + `DwellingGraph` + tiered advisory reporting is the mature version of the same idea and ports as a pattern to building scale (ST1/ST2/F1/N1 analogues). | Pattern-level; or a building-scale graph adapter if the rules engine is ever extracted into a shared package. |
| **Door-swing & entrance semantics, prop library** | The 5 cm voxel-prop JSONs and placement conventions are grid-pitch-independent below 0.6 m and could furnish bottom-up's future "unit reconfiguration" layer. | File-level reuse (`format: "voxel-prop"` JSONs). |

### Convention clashes (everything an integration must adapt across)

| Axis | bottom-up / tekto | Re_Configure | Adaptation |
|---|---|---|---|
| Up axis | **Z-up** (X/Y plan, Z storey) | **Y-up** (three.js default; X/Z plan, floors stacked via `group.position.y`) | Swap in the boundary mapper only; never convert either core. |
| Grid pitch | fine **1.25 m** default (param), module 2.5 m | **0.6 m** fixed (`CELL_SIZE`) | 1.25/0.6 is incommensurable (25/12). **Run bottom-up at `fineXY = 1.2`** → module 2.4 m = exactly **4×4 Re_Configure cells**. A parameter convention, zero code. |
| Floor height | uniform `cellZ` param (2.75 m) | **derived per floor**: `(max(4, tallest room) + 1) × 0.6` ≈ 3.0 m | Handoff carries heights explicitly; or standardize 3.0 m (5 cells) for bridged projects. |
| Cell addressing | `[x, y, z]` tuples; one flat `Int32Array`, `index = (x*ny+y)*nz+z`, whole building | `{cx, cz}` objects; per-floor `Grid` occupancy `Map`, floors are separate objects | Mapper concern only. |
| Orientation ops | 4 quarter-turns, de-duped, **no mirror** (a chiral unit's reflection is unreachable) | rotation 0–3 **plus `mirrored` flag** (mirror-aware footprint transform) | If unit footprints flow down, mirrored variants exist in Re_Configure that bottom-up can't represent going back up. |
| Serialization | **none** | versioned tolerant `ProjectFile` v1 (`format: "flat-configurator-project"`) | Any bridge format must be added on the bottom-up side. |
| Naming | "unit" = apartment; "module" = 2.5 m aggregation cell | "module" = placeable furniture (`category: "module"`); rooms are rooms | Pure vocabulary trap — rename at the boundary (`unit` → `dwelling envelope`). |
| Colors | hex **string** (`"#4dabf7"`) | hex **number** (`0x4dabf7`) | Trivial. |
| three.js | ^0.183 direct; tekto peer `>=0.150` | ^0.169 | tekto's peer range **already accepts 0.169** — adopting tekto does not force an upgrade. |
| Style | no semicolons, 2-space | semicolons | Per-repo; irrelevant unless code moves between repos. |
| Randomness | seeded mulberry32 throughout | none (fully deterministic) | If Re_Configure gains auto-layout, adopt the same seeded-PRNG idiom for reproducibility. |

### The honest overlaps (merging = choosing one)

- **Stair generation** — bottom-up: `straightStairTiles` (dog-leg in 2 lanes) +
  `generateStair` (wandering ribbon), heights in floor units, Z-up tiles.
  Re_Configure: `stairMesh` dogleg (the one scale-stretched element) + graph
  gating (ST1/ST2). *Same concept, different scales and life-cycles — keep
  both; don't unify.*
- **Circulation/reachability** — Dijkstra-to-core corridor routing vs
  door-gated BFS from entrances (`computeEntranceDepths`). Complementary
  scales, but if rules ever run at building scale, one graph layer should win
  (tekto's `Graph` is the natural substrate — Re_Configure's BFS is bespoke).
- **Boundary extraction** — `voxelFaces` (3D, void-aware) vs
  `exteriorEdges` + per-room `buildBoundaryWalls` + cluster shells (2D
  per-floor, window/door-aware). Re_Configure's is deeply wired into windows,
  doors, and cutaway; replacing it would be a rewrite for no current feature
  gain. *Choose: keep Re_Configure's; treat `voxelFaces` as reference.*
- **Facade/window assignment** — stable-hash 1.2 m panels with cross-bay
  merging vs rule-driven windows (glazing targets, corner wrap, north bias,
  W1). Re_Configure's is strictly richer at dwelling scale; bottom-up's
  merging idiom is the right cheap look at building scale. *No unification
  warranted.*
- **Catalog idiom** — `UnitType` and `ModuleDef` are near-isomorphic
  (`{id/type, name, color, cells}` + literally the same `rect`/`lShape` helper
  shapes) but describe different levels (apartments vs rooms). *Map, never
  merge — a shared type would conflate scales.*
- **Timber framing** — notable *internal* duplication on their side: the app's
  hand-rolled `renderTimber` (studs/plates/headers/cripples) re-implements what
  tekto's `bim/walls/holzrahmenbau.ts` already models. A Re_Configure
  integration should target the tekto BIM layer, not the app's renderer.

---

## Part 3 — Ranked merge proposals

Ranked by (value to the thesis) ÷ (integration cost). Anything requiring a
change to Re_Configure's core conventions (Y-up, 0.6 m cells, derived-not-stored,
single-dwelling model) is flagged **expensive** and avoided.

### 1. Unit-handoff bridge: building → flat ("design the flat you just packed")

**What:** In bottom-up, an "Export unit" action serializes a selected
`PlacedUnit` (footprint expanded to 0.6 m cells via the `fineXY = 1.2`
convention, storey count, and the corridor door edge). In Re_Configure, a "New
project from unit envelope" import creates a project whose grid blocks all
cells outside the polyomino (reusing the existing `Grid.setHoles` blocking
mechanism), pre-places the `Entrance` at the corridor edge, and lets the full
existing toolchain (rooms, doors + swing, derived windows, rules, furnishing)
run inside a real building context.
**Host:** small exporter on the bottom-up side (its first serialization);
importer in Re_Configure (`projectIO` gains one additive envelope field, or a
separate tiny format).
**Bridge:** one JSON schema; Y/Z swap and module→cell expansion in the importer.
**Size:** ~1–2 days each side. **Flag:** none — purely additive both sides.
**Why #1:** it's the thesis narrative in one feature — participatory
building-scale generation handing each resident a real, rule-checked flat
editor for *their* unit.

### 2. IFC export for Re_Configure via tekto

**What:** `src/io/ifcExport.ts` (new, isolated) mapping Re_Configure state →
tekto BIM types → `IfcWriter` STEP-21: floors → `IfcBuildingStorey` (elevations
from `recomputeStack`), room boundary runs → `Wall` + `WallOpening` (doors:
`head 2.1` — the defaults already agree; windows: sill/head from the panel
kit), rooms → `Space` (function = room type, feeding room schedules), stairs →
bim `Stair`; props skipped (or `IfcFurniture` later).
**Host:** Re_Configure; adds `tekto` as a dependency (its three peer-range
accepts ^0.169 — verified).
**Bridge:** the mapper itself; Y-up→Z-up inside it only.
**Size:** ~2–4 days. DXF plan export comes nearly free afterwards.
**Flag:** tekto is pinned to a moving GitHub branch — pin a commit.
**Why #2:** turns the configurator from a self-contained toy format into a tool
that emits industry-consumable BIM — high examiner-visible value, zero touch to
core conventions.

### 3. Furnishability-as-fitness (close the loop upward)

**What:** bottom-up's `fitness()` gains a term rewarding units that
Re_Configure certifies as furnishable. **Stage A (cheap, do first):** score
each of the 7 `UNIT_TYPES` once in Re_Configure (does a rule-clean room layout
exist at 2.4 m modules?) and ship a static per-type weight — one afternoon,
already changes what evolution packs. **Stage B (expensive, only if the thesis
needs it):** headless per-placement scoring, which requires extracting
Re_Configure's graph+rules core (`adjacencyGraph.ts`, `rules.ts` — already
pure of DOM/three, but they consume `Floor` objects) into a shared package.
**Host:** A: bottom-up only. B: a new shared package — **flagged expensive**
(build tooling + decoupling, and it couples two actively-moving repos).
**Size:** A: <1 day. B: ~1–2 weeks.

### 4. Building-scale advisory rules (pattern port)

**What:** Give bottom-up a Re_Configure-style tiered advisory report instead of
the bare `unreached : 5` counter: rules over the building graph (every unit
corridor-connected = F1 analogue; core on every floor = ST-analogue; corridor
area fraction = N1 analogue). Reuses tekto's `Graph` it already builds.
**Host:** bottom-up.
**Bridge:** none (pattern-level port of the `RULES`-as-data idiom).
**Size:** ~2–3 days. **Why ranked here:** good thesis symmetry ("the same
advisory-rules philosophy at both scales") but bottom-up is milestone-1 and
churning — coordinate with the chair before building on it.

### 5. Real solar for OR1 (`SunPosition`)

**What:** Copy tekto's self-contained `SunPosition` (date + lat/lon →
altitude/azimuth) into Re_Configure to upgrade OR1's binary north test into
actual sun-angle daylight scoring, plus optionally a sun-study light in the
viewport (bottom-up's Sun popover shows the UI pattern).
**Host:** Re_Configure. **Bridge:** none (north convention already exists in
`orientation.ts`; the compass dial provides the bearing).
**Size:** ~1 day. Lowest value of the five, but nearly free and visible.

### Explicitly not proposed

Adopting tekto's `Scene`/`ThreeRenderer`/Z-up inside Re_Configure's interactive
app, unifying the two grids/catalogs into shared types, or replacing
Re_Configure's wall/window geometry with `voxelFaces` — each would touch
Re_Configure's core conventions for no feature the thesis needs. All
conversions belong at the bridge boundary.

---

## Open uncertainties

- tekto is consumed from a **moving GitHub branch** at v0.2.0 — any proposal
  that adopts it should pin a commit; API churn is acknowledged in its own docs.
- Only the merge-relevant tekto modules were read in depth (`bim/*`, `io/*`,
  `core/geometry/walls`, `core/graph`); the rest of the library
  (~`core/algo`, react, sketch) was surveyed by structure only.
- bottom-up's main.ts header lists "**unit reconfiguration**" as a planned
  layer on their side — before building proposal #1, confirm with the chair
  that unit interiors are intended to live in Re_Configure rather than being
  duplicated natively in bottom-up.
- The screenshot tool could not capture this app's canvas (rAF starvation);
  the run description is from live DOM text + code reading, not pixels.
