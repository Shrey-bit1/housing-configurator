# PROJECT_STATE.md

Reference doc for reorienting after context loss. Reflects the actual code in
the working tree on `main` — the interior-doors feature (§2i) and rules batches
①/②/③ (§8) are committed here alongside this doc (baseline `30bf5dd` = mirroring
+ multi-select/group-ops). Reference-style, not prose. **Read the cited files to
confirm before relying on any detail.**

---

## 1. What the project is

A browser-based **3D flat / housing configurator** built with **TypeScript +
Three.js**, bundled with **Vite**. It is a thesis tool: the user places
modular rooms, furniture, and stairs on a 0.6 m grid across multiple floors,
viewed in an axonometric (isometric) or straight-down plan projection. Rooms
snap to the grid, can be rotated in 90° increments, mirrored (left/right flip,
so chiral L-shapes and the dogleg stair reach both handednesses), moved, and
deleted, singly or as a **multi-selection** (Shift-click, group move/delete —
see §2h); the
app renders rooms as hollow "dollhouse" shells with a camera-aware cutaway so
interiors are visible. The user authors **entrances** (exterior edges) and
**doors** (interior edges) — and **reachability is strictly door-based**:
two spaces are connected only when a door joins them (see §2i). A whole-dwelling
adjacency graph (rooms/clusters/stairs as nodes; physical TOUCH edges +
authored-door ACCESS edges) feeds an advisory, on-demand layout rules engine and
a toggleable bubble-diagram view. Projects save/load to JSON. It is a
work-in-progress research artifact, not a production app.

---

## 2. Core architecture — systems and the files that own them

| System | Owner file(s) | Notes |
|---|---|---|
| Grid + occupancy + coordinate conversion | `src/core/grid.ts` | `Grid` class: dims, occupancy `Map<"cx,cz", instanceId>`, `holeCells` (stairwell voids), `gridToWorld`/`worldToGrid` (grid centred on world origin), `canPlace(cells, exclude?: string \| Set<string>)` (a Set excludes every id in it at once — the group-move self-exclusion primitive, §2h), `plateAvailable`/`occupy`/`free`/`setHoles`/`ownerAt`/`inBounds`/`resize`. `CELL_SIZE = 0.6`. |
| Room / module / stair definitions + **THE central footprint transform** | `src/core/modules.ts` | `MODULE_DEFS` registry, `ModuleDef` (`category: "module" \| "room" \| "stair"`), `lShape()`/`rect()` footprint helpers, `ROOM_HEIGHT = 4`. Transform: `rotateCell`/`mirrorCell`/**`transformCell`**/`rotatedCells`/`occupiedCells` — **mirror THEN rotate**, see §2g. `MODULE_LIST` (furniture), `ROOM_LIST`, `STAIR_LIST`. |
| Placed-instance store (place/move/rotate/**mirror**/delete, **group ops**) | `src/core/store.ts` | `ModuleStore`: single source mutating occupancy + scene together. `instances: Map<id, ModuleInstance>` (each carries `mirrored: boolean`), `onChange` hook, `extraPlacementCheck?` (cross-floor stair rule, set by FloorManager), `canPlaceInstance(def, cells, excludeId?: string \| Set<string>)`, `place(type,origin,rotation,mirrored)`, `move(id,origin,rotation,mirrored?)` (rebuilds the mesh when rotation OR mirror changes), `rotate(id)`/`mirror(id)` (both pivot on the origin cell, both collision-checked), `reconcileAfterResize`, `maxRoomHeightCells`. **Group ops** (§2h): `moveMany(moves)` (atomic rigid move, all-or-nothing, self-exclusion via a Set, never rebuilds meshes since rotation/mirror are untouched), `removeMany(ids)` (single `onChange`), `placeMany(items)` (atomic batch place — new ids, no exclusion needed — used by group duplicate). |
| Mesh building: solid cubes, **room shells**, connector tiles, **concave-corner wall logic**, **window panel-kit + glazing** | `src/scene/moduleMesh.ts` | `buildModuleMesh()` routes: `category==="stair"` → `buildStairGroup` (stairMesh.ts); connector → tile; room → `buildRoomShell` (hollow open-top shell, walls built directly at the floor's true height — see §2b); else solid cubes. `buildBoundaryWalls()` is the shared clean-corner wall generator (exported; reused by clusters), and — given a per-edge `windows` map — replaces a windowed edge's solid segment with sill/lintel panels + a glazing pane (see §2d), and — given a `doors` edge-key set — cuts a fixed 0→`DOOR_OPENING_H` opening with a solid header above (see §2i). `rebuildRoomWalls()` rebuilds just a room's wall+glazing meshes in place when height, windows, or doors change. `makeGlassMaterial()`, `setSelected()`, `setHovered(group, hovered, selected)` (subtler emissive intensity 0.15 vs selection's 0.35; no-ops when `selected` or when a rules-violation tint owns the material — §2h). `WALL_T = 0.1`, `FLOOR_H = 0.15`. |
| **Rule-driven window generator** (derived, per room) | `src/core/windows.ts` | `computeWindows(cells, roomTypeId, floorHeight, occupied, entranceEdgeKeys, northAngle=0) → WindowPlan`. Pure computation (no Three.js). `WINDOW_CONFIG` per-type table (target ratio + variant). Seed runs sorted by SOUTHERNNESS under `northAngle` (§2d, §2k). The plan's `GlazingStat` carries `sectors`/`northLit` (derived orientation). See §2d. |
| **North / orientation** (compass convention + bearings) | `src/core/orientation.ts` | THE one place the north concept lives: convention (north = world −Z rotated CW-from-above by `northAngle`), `normalBearing`/`sideBearing` (normal→compass bearing), `bearingSector` (8-wind), `southDistance` (south-bias score), `isNorthLit`/`NORTH_SECTOR_HALF_WIDTH` (OR1), `worldNorthDir` (arrow projection). Pure, no Three.js. See §2k. |
| **Compass dial** (north-setting control) | `src/ui/compassDial.ts` | `createCompassDial({onInput,onCommit})` — draggable SVG dial (top-down frame, N-marked needle); `onInput` live during drag, `onCommit` on release (commit-on-release). `setAngle` syncs display after load/undo. See §2k. |
| **Stair geometry** (180° dogleg, two floors) | `src/scene/stairMesh.ts` | `buildStairGroup(def, rotation, ghost, mirrored)`. See §2a; mirroring negates the lane x-centres only (winding-safe, §2g). |
| Dynamic dollhouse **cutaway** | `src/scene/cutaway.ts` | `updateCutaway()` hides wall meshes whose `userData.wallNormal · viewDir > THRESHOLD (0.12)`; throttled (recompute on camera move or `markCutawayDirty()`). `setCutawayEnabled(on)` toggles the whole pass — OFF shows every wall (solid exterior; the "Cutaway" view control, §2k). Unaffected by the §2b wall-height mechanism (walls are rebuilt, not scaled — `wallNormal` tags are untouched either way) or the top view (a straight-down `viewDir` dots to ~0 against every wall normal, which are always in the XZ plane — every wall stays visible, reading correctly as a plan). |
| **Multi-floor** support, stacking, **wall/stair height reconciliation**, **window generation**, **floor visibility**, **zoom-to-extent box** | `src/core/floor.ts`, `src/core/floorManager.ts` | See §2b (height), §2d (windows), §5 (visibility/framing). `Floor` = own grid + `ModuleStore` + `GridView` + `HoleView` + `EntranceView` + `entrances[]` + `windowStats` + `clusterGroup`, all under one `group`. `FloorManager`: stack, active floor, vertical stacking offsets, dim inactive floors, stairwell holes, `rebuildAllShells()` (all floors' room walls + windows + DOOR OPENINGS + merged cluster shells), `pruneStaleDoors()` (auto-remove doors a mutation stranded, inside the same undo snapshot), `doorTargets()`/`isDoorValid()` (door placement/validity), floor visibility, content bounding box. `DEFAULT_FLOOR_CELLS = 4`, `CLEARANCE_CELLS = 1`. |
| Grid dots / floor visual | `src/scene/gridView.ts` | Intersection dots + border; `setDimmed`. |
| Stairwell **hole** rendering | `src/scene/holeView.ts` | `HoleView`: recessed dark panel + outline per stairwell opening (merged per connected component). Purely visual; occupancy blocking is `Grid.holeCells`. |
| Ground-floor **entrance** marker rendering | `src/scene/entranceView.ts` | `EntranceView`: renders `Floor.entrances` as door markers on exterior edges; meshes tagged `userData.entranceId` for highlight lookup. |
| **Entrance placement** interaction | `src/interaction/entranceController.ts`, `src/core/entrance.ts` | `EntranceController`: ghost preview + click-to-place (ground floor only). `isActive` getter + public `cancel()` — Escape is arbitrated centrally by main.ts (§2h), not handled internally here. `Entrance { id, cell, side }`. Entrances are also SELECTABLE/DELETABLE (via `SelectionController`, see §2f) but explicitly EXCLUDED from multi-select/group ops (§2h): click a marker to select, Delete to remove. `Floor.removeEntrance(id)`; `EntranceView.markers`/`setSelectedId`. |
| **Interior door** model + validity + space-target resolver | `src/core/door.ts` | `Door { id, cell, side }` (2-edge span, edge-key bound); `DOOR_SPAN=2`, `DOOR_OPENING_H=2.1`, `BELOW_PREFIX`; `doorId`/`doorEdges`; **`resolveDoorSpaces(door, targetAt)`** (the one definition of door validity + connectivity — both edges must join the SAME two distinct spaces); **`buildSpaceTargets(floor, floorBelow?)`** (cell → space token: room/stair id, cluster node id, or `^stair` for a hole projected up from below — shared by placement, pruning, and the graph); `doorWallCuts` (per-door room-local + cluster-absolute opening edge sets). See §2i. |
| Interior-door **marker rendering** | `src/scene/doorView.ts` | `DoorView` + `makeDoorMesh`: a violet floor-threshold strip across each door's opening (reads in plan view; the door's click target, `userData.doorId`). Renders `Floor.doors` on ANY floor. |
| **Door placement** interaction | `src/interaction/doorController.ts` | `DoorController`: hover a shared interior boundary → a 2-edge ghost slides along the nearest wall, green/red per `FloorManager.isDoorValid`; click commits. `isActive`/public `cancel()`, Escape arbitrated centrally (§2h). Doors are SELECTABLE/DELETABLE via `SelectionController` (§2f, its second `MarkerSelectionAdapter`), on any floor. |
| **Undo / redo history** (snapshot-based) | `src/core/history.ts` | `History`: undo/redo stacks of serialized-project snapshots (cap 20), commit-after-action model, restore via the import rebuild path. See §2f. |
| **Exterior-edge detection** (reusable) | `src/core/exteriorEdges.ts` | `exteriorEdges(cells, occupied) → BoundaryEdge[]`. Standalone/generic: consumed by entrance placement/validity, the daylight rules (D1/D2 via `GraphNode.hasExteriorEdge`), and reserved for a future facade/window task. |
| **Circulation / Outdoor cluster merging** | `src/scene/clusterShells.ts` (+ `src/core/cluster.ts`) | `rebuildClusterShells(floor, grid, wallHeight, doors?)` groups connector cells by `def.cluster`, flood-fills connected components (`connectedComponents`), draws ONE merged boundary shell per cluster (outer walls only) via `buildBoundaryWalls` — cutting any door openings (ABSOLUTE edge keys) on the cluster side of a room↔cluster / cluster↔cluster boundary. |
| **Voxel furniture prop** system | `src/scene/props/*` | `voxelProp.ts` (format + `PROP_LIBRARY`, now auto-loaded from `data/*.json` via `import.meta.glob` — drop a JSON in, no code change), `place.ts` (transform/tiling/clip/wall-clip + merged `InstancedMesh`; `buildPropsMesh(..., mirror)` negates emitted voxel x + mirrors the clip footprint, §2g), `kitchen.ts` (Kitchen layout), `rooms.ts` (Bathroom/Bedroom/Living/Recreation layouts, §2l), `index.ts` (`PROP_BUILDERS: Record<string, (mirrored) => Group>` — kitchen + the 6 room-type builders). Data in `src/scene/props/data/*.json` (19 props). |
| **Whole-dwelling adjacency graph** (rules + bubble-diagram data) | `src/core/adjacencyGraph.ts` | `computeDwellingGraph(floors) → DwellingGraph`. See §2c. |
| **Layout rules engine** (advisory, on-demand) | `src/core/rules.ts` | `RULES: Rule[]`, `validate(graph)`, `computeEntranceDepths(graph)`. See §8 for the full current rule table. |
| Rules-violation **3D highlighting** | `src/scene/highlight.ts` | `applyRoomHighlights(floors, violations)` / `clearRoomHighlights(floors)`: emissive tint on implicated room/cluster/stair shells + entrance markers, across ALL floors, resolved via `parseDwellingNodeId`. Plus `setHoverEmphasis`/`clearHoverEmphasis`: an intensity-only boost on top of an active tint, for report-card hover — see §2j. |
| Bubble-diagram **view** | `src/ui/graphView.ts` | Toggleable full-screen 2D force-directed diagram of the WHOLE dwelling at once — one column per floor, stairs straddling their floor-pair boundary, draggable/pinnable nodes. See §2j. |
| Validation report panel | `src/ui/validationPanel.ts` | `renderValidationPanel()`: grouped hard/soft/note issue list + the entrance-depth metric summary. Cards with a resolvable target fire `onHoverViolation` on mouseenter/leave (orchestrated in main.ts — see §2j); dwelling-level cards don't. |
| **Project save / load** | `src/core/projectIO.ts` | `serializeProject(floors) → ProjectFile`, `parseProject(text) → ParsedProject` (tolerant/versioned). Per-floor `entrances` AND `doors` are additive edge-bound lists (`normalizeEdgeBound` serves both). See §3. Camera state and floor visibility are deliberately excluded (view state, not design state). |
| Sidebar palette / grid-size / floor tabs / floor-visibility toggles | `src/ui/palette.ts` | Rebuilt on floor-state change. |
| Scene/camera/lights, **zoom-to-extent framing** | `src/scene/sceneSetup.ts` | Orthographic camera, `frameBox(box, direction)`. See §5. |
| Interaction | `src/interaction/picker.ts`, `dragDrop.ts`, `selection.ts` | Raycast picking (`cellAt`/`groupAt`/`groundPoint`, scoped to the ACTIVE floor's store — this is also why floor visibility needs no picker-side filtering, see §5), palette→canvas placement, select/**multi-select**/move/**group-move**/rotate/**mirror**/delete/**group-delete**/**Shift+D-duplicate** (any count) of modules, plus entrance AND door select/delete (two `MarkerSelectionAdapter`s — mutually exclusive singletons, excluded from multi-select). `R`/`M` work on the palette ghost, the move ghost, the duplicate ghost, and a SINGLE selected instance — no-op on 2+ (§2h). `dragDrop.cancelPlacement()`/`selection.cancelDuplicate()`/`entranceController.cancel()` are public, no-argument, and NOT wired to their own Escape listeners — Escape is arbitrated centrally by main.ts (§2h). `dragDrop`/`selection` take an `onAfterAction` callback (fires after a committed mutation → undo snapshot, see §2f); `selection` also takes `onSelectionChange`/`onNoopHint` callbacks and an `EntranceSelectionAdapter`. |
| **Group-move ghost** | `src/scene/groupGhostPreview.ts` | `GroupGhostPreview`: one translucent ghost mesh per selected member, positioned by its cell offset from the grabbed member's target origin, tinted green/red as ONE unit (mirrors `GhostPreview`'s shape/API). See §2h. |
| Wiring / render loop / view-mode orchestration | `src/main.ts` | Constructs everything; `animate()` renders 3D or drives the graph view; owns Reset View, plan-mode, diagram-mode toggle logic (mutually exclusive, see §5), the undo/redo history wiring (§2f), the central Escape-priority handler, and the selection-readout/shortcuts-legend wiring (§2h). Default grid 16×16. |

**Concave-corner wall logic** (part of `buildBoundaryWalls`): walls are inset to
the INTERIOR side of their boundary line (no protrusion). N/S walls (run in x)
take full length and "own" corner squares; E/W walls (run in z) are trimmed by
one wall thickness at any end where the same cell also has a perpendicular
boundary (convex corner). At concave corners the two walls belong to different
cells and meet edge-to-edge with no overlap. Walls are grouped into ≤4 merged
meshes by outward normal (±x, ±z), each tagged `userData.wallNormal` for
cutaway. Unaffected by which height value the caller passes in (§2b) — the
XZ tracing/corner math is independent of `fullH`.

### 2a. Stair geometry (`stairMesh.ts`)

180° dogleg: two 1-cell-wide flights (lane A / lane B) run side by side in
opposite directions, joined by a full-width half-landing at the far end.
Footprint 2×6 cells (1.2 m × 3.6 m). 20 risers @ 150 mm total rise (3.0 m),
split 10 + 10 by the landing at 1.5 m; 9 goings @ 300 mm per flight (2.7 m
run). All three pieces (flight 1, flight 2, landing) are solid down to the
ground (not a thin folded plate), so the upper flight reads as grounded.
Each piece is an extruded 2D profile (`profileGeometry()`, via
`THREE.ExtrudeGeometry`) merged into one mesh.

Built at a fixed `REFERENCE_STAIR_RISE = 3.0 m`; `FloorManager` rescales
`group.scale.y` per instance to the floor's real height (`updateStairScales()`).
Unlike walls (§2b, which now build directly at true height), a stair's
scale-driven rise is semantically intended — a taller floor genuinely means
taller risers, not a build-height bug — so it deliberately stays a runtime
rescale. The landing sits at exactly half the reference rise, so uniform
y-scaling keeps it at true mid-height for any floor height.

**Winding fix (this session):** flight 1's point list traced its profile
CLOCKWISE while flight 2 and the landing traced theirs COUNTER-CLOCKWISE
(`ExtrudeGeometry` treats CCW as "outward"), so flight 1's normals came out
inverted — masked from disappearing only by a `DoubleSide` material hack, but
lit backwards, which read as a shaded wedge/ramp artifact at the flight-1-to-
landing seam. Fixed by reversing flight 1's point order (`f1.reverse()`, same
boundary, opposite traversal) to match the other two pieces; the `DoubleSide`
workaround was removed (material is now default `FrontSide`). Verified via
riser-normal sampling (`(0,0,-1)` on flight 1, `(0,0,+1)` on flight 2, both
physically correct for their climb direction) and a downward-raycast
watertightness sweep (no culling holes beyond the intentional `STEP_INSET`
lane gaps).

### 2b. Wall / floor-to-floor height

`FloorManager.floorHeight(floor)` (private) = `(max(DEFAULT_FLOOR_CELLS,
floor.store.maxRoomHeightCells) + CLEARANCE_CELLS) * CELL_SIZE` — the vertical
floor-to-floor spacing used both for stacking (`recomputeStack()`) and for
wall height.

**Walls are built directly at their floor's true height — no scale hack.**
(An earlier version of this fix tagged wall meshes with `userData.
wallBaseHeight` and rescaled `scale.y` in a FloorManager pass; that was
replaced this session with true-height geometry, since a hidden scale factor
would have complicated the upcoming window/door band-slicing feature and
distorted any future wall texture.) `buildBoundaryWalls()` (moduleMesh.ts)
still takes an explicit `fullH` param — nothing about its XZ boundary-tracing/
concave-corner logic changed — but every CALLER now passes the floor's real
`floorHeight(floor)` instead of a fixed reference constant:
- `ModuleStore.wallHeightProvider?: () => number` (set by `FloorManager.
  createFloor()` to `() => this.floorHeight(floor)`, same pattern as the
  existing `extraPlacementCheck`) — `buildModuleMesh()`/`buildRoomShell()`
  build a NEW or ROTATED room's walls at the correct height from the start.
- `rebuildClusterShells(floor, grid, wallHeight)` — takes an explicit height
  param (was the fixed `FULL_H = ROOM_HEIGHT * CELL_SIZE` constant); fed
  `floorHeight(floor)` from `store.onChange`. Cluster shells already fully
  rebuild from occupancy on every change, so this needed no new rebuild
  trigger, just the correct height value.
- `FloorManager.rebuildWalls()` (private, replaces the old
  `updateWallHeights()`; called from `syncStairsAndHoles()` right after
  `updateStairScales()` — same trigger, same frequency, on every place/move/
  rotate/delete/resize) walks every ROOM instance (`category==="room"`, not a
  connector) on each floor and calls `rebuildRoomWalls(inst.group, inst.def,
  inst.rotation, floorHeight(floor))` (exported from moduleMesh.ts) —
  removes and disposes the group's existing `userData.isWall`-tagged
  children and rebuilds them via `buildBoundaryWalls()` at the target height.
  Floor slab and interior props are untouched; the room's existing shared
  `userData.material` is reused (verified: selection/dim tinting survives
  the rebuild, since it's the same material object, not a fresh one).
  Reconciles EVERY room on the floor unconditionally (not just the one just
  placed) — this is what makes an existing room's walls follow suit if some
  OTHER room's placement changes the floor's height. Stairs are excluded
  (their `group.scale.y` rise-scaling in `updateStairScales()` is
  semantically intended — a taller floor means taller risers — and stays
  untouched).

Verified: `scale.y === 1` on every wall mesh (room shells AND cluster
shells) after place/rotate/floor-add, wall tops still land exactly on the
next floor's slab start (zero gap, same bounding-box check as before),
selection tint survives an in-place rebuild.

**Implication for future work:** wall geometry is now correctly sized at
build time — a window/door band-slicing feature (or a future wall texture)
can compute against a wall mesh's actual dimensions directly, with no hidden
scale factor to account for.

### 2c. Whole-dwelling adjacency graph (`adjacencyGraph.ts`)

`computeDwellingGraph(floors: Floor[]) → DwellingGraph` spans ALL floors (not
just the active one). Node ids are namespaced `<floor>/<rawId>`
(`dwellingNodeId`/`parseDwellingNodeId`) since per-floor instance/cluster ids
collide across floors.

**Two edge kinds** (`GraphEdge.viaDoor`, see §2i and §3):
- **TOUCH** (`viaDoor: false`): footprints share a wall (orthogonal cells) —
  physical adjacency. Also a cross-floor `viaStair` touch where a stair
  physically underlies the floor above. Consumed ONLY by the proximity rules
  (H4/S3/S4/S5) and drawn faint/dashed in the diagram.
- **ACCESS** (`viaDoor: true`): an authored door binds the two spaces (§2i).
  The ONLY edges that confer reachability — every reachability/connectivity
  rule traverses these (see §2i, §8). Built by resolving each door to the two
  spaces its edges bind, via the shared `buildSpaceTargets` map.

**Stairs are graph nodes** (`kind: "stair"`), not a same-floor-to-next-floor
shortcut. A stair gets TOUCH edges from the generic pass (bottom-side same-floor
adjacency + a `viaStair` top-side touch to whatever overlies its footprint on the
floor above), but those confer NO reachability. A stair connects for reachability
ONLY where a door faces it: a door on the stair's own floor → a bottom ACCESS
edge; a door on the floor above facing the stair's hole projection → a top
`viaStair` ACCESS edge (the `^`-prefixed below-stair token in `buildSpaceTargets`).
So a room on floor N reaches a room on floor N+1 only through a DOORED stair at
both ends. The stair is inspectable via ST1 (door connections at top/bottom) and
ST2 (door-reachable from an entrance).

Entrances are floor-0-only, RE-VALIDATED on every graph build (not cached):
`EntranceStatus.blocked` is true if the host cell no longer resolves to a
room/cluster, or the edge is no longer exterior (via `exteriorEdges` against
the floor's full occupied-cell set) — so a room built later against an
existing entrance's edge correctly invalidates it. `entryIds` = every
non-blocked entrance's host node id (multiple entrances allowed; "any one
entrance reaches it" is sufficient for reachability, see rules.ts's doc
comment).

`GraphNode.hasExteriorEdge` is computed once per floor (post-pass) and consumed
by the daylight rules (D1/D2) rather than recomputed per-rule. Its occupied set
is the **`buildSpaceTargets(floor, floorBelow)` key set** — the SAME source the
door system uses — so it counts, beyond this floor's rooms/clusters/stairs, the
**stair-hole projections from the floor below**. An edge facing the stairwell
void (no sky) is therefore NOT exterior: without this, a floor-N+1 room bordering
the hole would falsely pass D1 and window onto the void (a live bug, fixed —
same-floor stairs were already covered as real occupants; the hole was the gap).

`GraphNode.glazing?: GlazingStat` (rooms only) carries the derived window
generator's achieved-vs-target glazing, read from `floor.windowStats` (§2d) —
consumed by the W1 rule rather than recomputing windows.

### 2d. Rule-driven windows (`windows.ts`, exterior edges only)

Windows are **DERIVED, never stored** — regenerated from room type + exterior
edges on every wall rebuild, exactly like cluster shells and stair holes.
Nothing new is serialized; export/import reproduces identical windows because
they're a pure function of placement (verified by round-trip). **Exterior
edges only** — interior openings are the separate, AUTHORED door system (§2i),
not derived here.

**Generator** (`computeWindows(cells, roomTypeId, floorHeight, occupied,
entranceEdgeKeys, northAngle=0) → WindowPlan`, pure, no Three.js — the plan is a
pure function of footprint + floorHeight + occupancy + entrances + **northAngle**,
so it reproduces identically on load/undo/rotate/mirror/dial):
- Per-type policy in `WINDOW_CONFIG` (tunable): Living/Recreation → ratio 1/6,
  full-height; Bedroom S/L → 1/10, framed; Kitchen → fixed one 2-edge band,
  framed; Bathroom/Circulation/Outdoor (absent from the table) → none.
- **SOUTH BIAS** (§2k): seed runs are chosen SOUTHERNMOST-first — each run's
  compass bearing under `northAngle` (via `sideBearing`), nearest due south
  wins, `southDistance` ascending; length is the tie-break; a final stable
  `runKey` breaks a genuine tie (north pointing exactly inter-cardinal makes two
  faces equidistant from south). The 2-edge-minimum seed check, band growth, and
  corner-wrapping (below) are all UNCHANGED — only the run ORDER changed, so
  glazing migrates to the sunny faces (`northAngle=0` = grid-south = due south =
  the pre-north behaviour exactly). Verified: rotating north 180° jumps a
  bedroom's band from its grid-south to its grid-north face; every other angle
  lands it on whichever face is then most-southern (§6).
- **Orientation** (OR1 + report): after placement, each windowed edge's side →
  bearing under `northAngle` → sector; the plan's `GlazingStat.sectors` is the
  distinct set (south-first), and `northLit` is true iff there IS glazing and
  every windowed edge is within `NORTH_SECTOR_HALF_WIDTH` of due north.
- Targets a glazing-AREA ratio of the room's floor area (floorArea =
  cellCount × 0.36 m²). Per-edge glazing = 0.6 × (floorHeight − 0.9)
  full-height, or 0.6 × (floorHeight − 1.8) framed. `edgesNeeded =
  ceil(area × ratio ÷ perEdge)`.
- **2-edge minimum (1200 mm), enforced — no 1-edge windows ever**: a computed
  1 rounds up to 2; a "need exactly 1 more" is absorbed by extending/overshoot
  so a 1-edge band is never emitted.
- **Edge selection**: exterior edges (`exteriorEdges`, minus any coinciding
  with an entrance — a door wins that edge) grouped into continuous straight
  same-side runs (`buildRuns` — a run itself never turns a corner; see corner
  wrapping below for how a BAND still can). Longest run first; if the run
  alone covers the remaining need, the ORIGINAL centred-slice placement
  (unchanged): band centred on the run, grown to the remaining need (still
  ≥2). Otherwise the WHOLE run is used and the shortfall is sought via corner
  wrapping before falling back to a separate band on the next-longest run.
  Insufficient exterior supply → glaze what's possible; the shortfall is
  flagged by W1, not forced.
- **Corner wrapping**: when a band exhausts its seed run before the target is
  met, it continues around a CONVEX exterior corner onto the adjoining run —
  an L in plan, or (falling out naturally, not special-cased) a U if both ends
  of the seed run wrap. `Arm`/`stepArm`/`cornerCheckSide`/`wrapDirection`
  implement a two-ended walk outward from the seed run's own two ends,
  alternating the low/high arm one edge at a time (so a U grows evenly rather
  than exhausting one side first). Each step either continues straight along
  the current run, or — at a run's end — tests whether THIS SAME CELL also has
  an exterior, not-yet-used edge on the perpendicular face pointing the way
  the arm is heading. That same-cell test can only ever be true at a CONVEX
  corner: a concave/notch corner's two edges belong to two DIFFERENT diagonal
  cells, which a same-cell test structurally never examines — no separate
  concave exclusion is needed, verified both by construction and by an
  extreme-ratio test that saturates a whole L-room's perimeter without ever
  bridging its own notch (§6). An entrance edge is already absent from the
  exterior-edge set the walk reads, so wrapping stops there exactly like a
  straight run does — verified the algorithm reroutes the shortfall to
  whichever end IS open rather than forcing it (§6). **Assumption** (choose
  sensibly / ambiguity noted per the task spec): only a run whose OWN length
  is already ≥2 is ever chosen as a SEED — a run shorter than 2 is skipped
  even if wrapping could reach the minimum some other way; a WRAP segment
  itself can be as short as 1 edge once attached to an already-≥2 seed (the
  band as a whole is what the 2-edge minimum applies to). A run already
  touched by an earlier band's wrap is never re-picked as an independent
  seed — distinct runs are otherwise edge-disjoint by construction, so this
  only ever trips for a wrap-consumed run. Wrapped edges are ordinary entries
  in the same `edges` map (a corner cell can carry two entries, one per side)
  and count toward `achievedRatio` identically to straight ones — **W1's math
  is unchanged**. Deterministic/pure like the rest of `computeWindows` — same
  tie-break discipline, verified across all 4 rotations × mirror (§6).
- Output `WindowPlan`: `edges: Map<absoluteEdgeKey, WindowVariant>` +
  `GlazingStat { targetRatio, achievedRatio, belowTarget }`.

**Panel kit** (built in `buildBoundaryWalls`, moduleMesh.ts): a windowed edge's
full-height solid segment is replaced by a **sill** panel (0→900 mm, always), an
optional **lintel** panel (framed variant: top 900 mm; full-height variant omits
it and the floor slab above acts as lintel), and a translucent **glazing** pane
filling the gap. Panel heights are ABSOLUTE (stay 900 mm on taller floors; the
glazing gap absorbs extra height) — this is why walls are now true-height
geometry (§2b), so the bands are computed against real dimensions. Sill/lintel
are still SOLID wall (same shared room material, merged into the same per-normal
wall mesh → they tint/dim/cutaway exactly like wall); glazing uses a per-room
`makeGlassMaterial()` (translucent, `depthWrite:false`, `renderOrder:1`,
`baseColor` so dimming fades it). Glass meshes carry the SAME
`userData.wallNormal` tag as solid walls, so the cutaway hides panels + glass
together with their face (verified).

**Corner glazing — glass-to-glass, no post** (same `buildBoundaryWalls`). Sill
and lintel need NO wrap-specific handling: both are solid boxes using the exact
same `(xMin,xMax,zMin,zMax)` footprint a plain wall segment would, so they
already close at a corner via the pre-existing corner-ownership trim (N/S owns
the square, E/W is trimmed away from it) — the same mechanism already verified
for plain walls. Only the GLAZING pane needed a fix: it's a thin `GLASS_T`
sliver INSET from that trim boundary, so two independently-wrapped panes would
each fall short of the true corner by about half a wall thickness, leaving a
gap. Fix, deliberately ASYMMETRIC: when a cell's own perpendicular edge is ALSO
windowed (the same same-cell convex-corner test windows.ts uses), the E/W
pane's glazing extends PAST its usual trim to the TRUE corner; the N/S pane is
left completely UNCHANGED (it already spans the corner untrimmed, same as a
plain wall — never needs adjustment). The two panes now overlap by about a
`GLASS_T` at the seam instead of falling short — no gap, no corner post,
imperceptible at that scale (verified via pixel sampling across the full window
height, not just one point — §6). Chosen over a symmetric split-at-the-
centreline specifically for the cutaway case below: since the N/S pane is
NEVER shrunk, it still fully covers its own face by itself if the E/W leg is
the one hidden by cutaway — and vice versa, since the E/W extension doesn't
depend on N/S being present either. **Cutaway**: both legs keep their own
face's `userData.wallNormal` tag unchanged (untouched by wrapping), so cutaway
hides one leg while the other remains — correct for a corner window, and (per
the asymmetric design above) verified to leave no seam artifact either way
(§6).

**Integration**: `FloorManager.rebuildAllShells()` computes the floor's occupied
set as the **`buildSpaceTargets(floor, floorBelow)` key set** (rooms + clusters +
this-floor stairs + stair-HOLE PROJECTIONS from the floor below — one source of
truth with the door system and `hasExteriorEdge`, so a room never windows onto
the stairwell void) plus floor-0 entrance edges, then per room calls
`computeWindows(..., this.northAngle)`, converts the ABSOLUTE windowed edges →
LOCAL edge keys (abs − origin; side unchanged since the room group isn't
rotated), and passes them into `rebuildRoomWalls(..., localWindows)`. The
`GlazingStat` (achieved-vs-target PLUS the derived `sectors`/`northLit`
orientation, §2k) is stashed on `floor.windowStats` (instanceId → stat) — read
by W1 (`belowTarget`) and OR1 (`northLit`) and the report's orientation line
(`sectors`), carried onto the room node via `node.glazing`. Windows ride the
existing wall-rebuild pass, so move/rotate/delete of any room — OR a north-dial
change (`FloorManager.setNorthAngle` → `refreshWalls`, §2k) — regenerates them
automatically. Entrance placement doesn't go through `store.onChange`, so it
calls `FloorManager.refreshWalls()` (public) to re-skip the door's edge. Cluster
shells (Circulation/Outdoor) never get windows.

### 2e. Undo / redo (snapshot history, `history.ts`)

Snapshot-based, leveraging that all DESIGN state is tiny serializable
source-of-truth (`projectIO`) and all DERIVED state rebuilds from it through the
same code paths as manual building. A snapshot is a serialized-project JSON
string; a restore is the project-import rebuild path.

`History` (core/history.ts) holds `undoStack`/`redoStack` of snapshot strings
(cap **20**) plus `lastState` (the serialized state as of the last commit).
Constructed with `serialize`, `restore`, `onChange` callbacks.
- **commit()** — called AFTER each mutating user action. Serializes current; if
  unchanged from `lastState` it's a NO-OP (so failed placements, invalid moves,
  same-cell drops, collision-blocked rotates record nothing); otherwise pushes
  the previous `lastState` onto undo, adopts the new one, and clears redo.
- **undo()/redo()** — swap states between the stacks and re-apply via `restore`
  (guarded so restore never re-enters commit).

**Commit hook points** (each = one snapshot): module place (`DragDropController.
onUp`), move/rotate/**mirror**/delete + entrance delete (`SelectionController`,
via its `onAfterAction` callback), entrance place (the
`EntranceController.onPlaced` callback in main), floor add/delete, grid resize,
project import — all wired in main to `commitHistory = () => history.commit()`.
A multi-step drag is ONE action: `store.move` and the commit fire only in
`onPointerUp`, never per `pointermove`, so a whole gesture is a single snapshot
(and an invalid drop commits nothing). A collision-blocked rotate OR mirror
likewise records nothing (serialized state unchanged).

**Restore** (`restoreState` in main): `JSON.parse` → `floors.loadProject(data)`
(the exact import rebuild path — floors recreated, instances re-placed via
`store.place`, all derived state rebuilt), then re-apply VIEW state that the
snapshot doesn't carry: keep the active floor (clamped if the stack shrank) and
per-floor visibility (by index). Clears selection + any stale validation.
Camera is untouched (loadProject doesn't move it). Plan mode is exited only if
the floor-stack shape changed (its per-index bookkeeping would otherwise be
stale — matches `onStructureChange`).

**Explicitly OUTSIDE history** (never snapshotted, never changed by undo):
camera, Reset View, plan-mode toggle, floor visibility, active-floor switch,
selection, diagram toggle, Check Layout — all VIEW state.

**Controls**: Ctrl/Cmd+Z undo; Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y redo (main's
window keydown, ignored while typing in sidebar inputs); plus `#undo-btn` /
`#redo-btn` in the viewport (bottom-left), enabled/disabled from
`history.canUndo`/`canRedo`.

### 2f. Entrance selection / deletion (`selection.ts` + `EntranceView`)

Entrances are first-class selectable objects, handled by `SelectionController`
alongside modules (mutually exclusive selection, shared Delete/Escape). An
injected `EntranceSelectionAdapter` (built in main) does the entrance-specific
work: `pick(x,y)` (raycasts `Floor.entranceMarkers`, gated to when floor 0 is
active), `setSelected(id)` (marker emissive highlight via
`EntranceView.setSelectedId`), `remove(id)` (`Floor.removeEntrance` +
`FloorManager.refreshWalls` so the freed edge may regain a window +
`clearValidation`). Clicking a marker selects it (deselecting anything else);
Delete removes it; Escape deselects. Both place and delete are undoable (§2e).
Deleting the last entrance empties `entryIds`, returning validation to the E1
"place an entrance" gate with no stale highlight/report.

### 2g. Mirroring (all placeables — rooms, furniture, connectors, stairs)

Every `ModuleInstance` carries `mirrored: boolean` (default false) beside its
`rotation`. Chiral footprints (the L-rooms, the dogleg stair) can therefore reach
all **8 orientations** (4 rotations × 2 mirror states) — verified distinct for
`living`/`kitchen`/`bedroom_large`/`recreation`.

**THE transform order — mirror FIRST, then rotate** (`transformCell` in
modules.ts, the single source of truth):
```ts
mirrorCell({cx,cz})            = {cx: -cx, cz}        // reflect across local X (negate cx)
transformCell(c, rot, mirrored) = rotateCell(mirrored ? mirrorCell(c) : c, rot)
rotatedCells(def, rot, mirrored)          // relative cells
occupiedCells(def, origin, rot, mirrored) // absolute cells
```
Mirror-then-rotate ≠ rotate-then-mirror (`M·R = R⁻¹·M`) — verified they differ
for every L-room, so the order is load-bearing and every consumer must use
`transformCell`/`rotatedCells`/`occupiedCells` rather than rolling its own.

**Consumers all route through it** (each passes `inst.mirrored`): ghost preview
(`ghostPreview.update`, `setMirror`), occupancy/collision (`store.place`/`move`/
`canPlaceInstance`/`reconcileAfterResize`), mesh building (`buildModuleMesh` →
room shell / connector tile / cube path / `rebuildRoomWalls`), prop placement,
stair geometry, `floorManager` (stair cells, occupied set, window generation,
wall rebuild), `adjacencyGraph` (3 sites), `clusterShells`. Exterior edges,
windows, clusters, stairwell holes, and the graph are all pure functions of the
transformed cells, so they follow automatically — **verified**, not assumed
(§6).

**Pivot: the instance's ORIGIN cell** — the same pivot `rotate` uses (local
(0,0)). A symmetric footprint keeps its shape but, like rotation, may translate
(a 3×3 rect mirrored about its origin extends −x instead of +x); a 1×1 is a true
geometric no-op. Both are allowed and harmless.

**Geometry: NEVER negative scale.** `scale.x = -1` inverts triangle winding and
normals — the exact bug class behind the stair-wedge fix (§2a). Mirroring is
always done by **mirroring the data and rebuilding the geometry**:
- *Rooms/walls*: mirrored cells → the existing `buildBoundaryWalls` tracing.
  Verified reflection-equivariant: for every L-room the mirrored wall vertex set
  is the **exact x-reflection** of the unmirrored one (identical vertex counts,
  identical ±x/±z normal set) — concave corners mirror cleanly, nothing to fix.
- *Props*: `buildPropsMesh(placements, footprint, mirror)` negates each emitted
  voxel's local x (`emit`) and mirrors the wall-clip footprint, rebuilding the
  merged `InstancedMesh`. The prop group's `rotation.y` is applied after, so
  props compose as rotate ∘ mirror, matching the cells. Verified: mirrored
  Kitchen props are the exact x-reflection, same 19,195 voxels (wall-clip found
  the reflected walls), all instance matrices +determinant.
- *Stairs*: `buildStairGroup(def, rot, ghost, mirrored)` negates only the three
  lane x-centres (`laneAx`/`laneBx`/`fullCx`). Each piece is a **constant-
  cross-section prism extruded along x**, so reflecting it across x = 0 is
  identical to re-extruding the same CCW profile at the mirrored centre `−cx` —
  a pure translation of a symmetric prism. Profile point lists and extrusion
  width are untouched, so **no winding reversal is needed**: every face keeps
  its CCW-outward winding, material stays default `FrontSide`. Handedness flips
  because lane B swaps sides (which lane the 180° turn goes to). Verified: the
  mirrored stair's (position, outward-normal) pairs are the **exact reflection**
  of the unmirrored one (516 verts, 0 mismatches; x-extent [−0.27,0.87] →
  [−0.87,0.27]); riser normals stay (0,0,−1) on flight 1 and (0,0,+1) on flight
  2 (correct for each flight's climb, unchanged since an x-reflection never
  touches z); the stairwell hole above matches the mirrored footprint.

A whole-scene audit confirms **zero objects with a negative scale component and
zero meshes with a non-positive `matrixWorld` determinant** (with mirrored
rooms, props, and stairs present).

**Serialization is ADDITIVE** — `InstanceData.mirrored?: boolean`. The tolerant
`normalizeInstance` defaults it (`o.mirrored === true`), so pre-feature files
load unchanged with `mirrored=false`. **No format version bump, no migration**
(`APP_PROJECT_VERSION` stays 1). Verified: mirrored round-trips byte-identical
(and rebuilds byte-identical derived state — walls, glazing, props, clusters,
holes); an old file with the field stripped loads all-unmirrored.

**Interaction — `M` toggles mirror:**
- *During ghost placement* (`DragDropController`): rebuilds the preview mesh live
  and re-tints valid/invalid against the mirrored footprint. Reset to false on
  each new palette grab and on cancel.
- *During a move-drag* (`SelectionController.moveMirrored`): flips the in-flight
  ghost; committed with the drop (still ONE snapshot for the gesture).
- *On a selected placed instance*: `store.mirror(id)` → `move(origin, rotation,
  !mirrored)`, collision-checked. If the flipped footprint doesn't fit, `move`
  returns false, the instance is left untouched, and the history commit is a
  no-op (serialized state unchanged) — verified 0 snapshots added.
- Mirroring a placed instance is a mutating action → exactly **one** undo
  snapshot (§2e); undo/redo restore the flag symmetrically. `M` is ignored while
  typing in sidebar inputs. Selection highlight survives the mesh rebuild
  (shared `userData.material`).

**Note (window band centring, benign):** on `living`/`kitchen` the mirrored room's
glazing lands on the opposite side of an **odd-length** exterior run's centre
(a 2-edge band has no exact centre; the tie-break flips under reflection), so
one of the two glazed edges differs from a pure reflection. Edge count, variant,
`achievedRatio`, and `belowTarget` are identical. This is correct by design:
`computeWindows` is a pure function of the *resulting footprint* and knows
nothing about how that footprint was produced (derive-don't-store), so it emits
the canonical plan for that footprint. Walls themselves mirror exactly.

### 2h. Multi-select, group move/delete, hover, duplicate, Escape arbitration, UI polish

**Selection state** (`SelectionController`, `selection.ts`): `selectedIds: Set<string>`
— module instance ids on the ACTIVE FLOOR only (reassigned with `store` on
floor switch, so a stale cross-floor id can never leak in — see the ordering
note below). `selectedEntranceId: string | null` stays a singleton, mutually
exclusive with `selectedIds` (selecting either clears the other). Entrances are
**excluded from multi-select and group ops entirely** — no shift-click
toggling, no group-move participation — because moving them with rooms could
invalidate their bound exterior edge; they remain singly selectable/deletable
exactly as before (§2f).

- **Plain click** on an instance → `setSelection([id])`: replaces the whole set.
- **Shift-click** → `toggleModuleSelection(id)`: adds/removes just that id, a
  pure selection edit with no drag/move initiated (resolved entirely inside
  `onPointerDown`, no pointerup involvement).
- Clicking a MEMBER of an existing multi-selection (no shift) sets up a
  **group-move drag candidate** (`dragIds = new Set(selectedIds)`) but a
  release with NO drag still collapses the selection to just that one instance
  (matches a plain click) — the drag/click distinction is the same
  `DRAG_THRESHOLD_PX` (4px) test used for single-instance moves.
- **`hasSelection`** / **`selectedInstances`** / **`selectedEntranceIdValue`**
  getters expose read-only state to main.ts (readout, Escape arbitration).

**Group move**: dragging any selected member moves the WHOLE set rigidly.
`onPointerMove` snapshots each member's `relOffset` (cell delta from the
grabbed member's origin) once, builds a `GroupGhostPreview` (one ghost mesh per
member, `scene/groupGhostPreview.ts` — mirrors `GhostPreview`'s shape), and on
every move recomputes each member's target cells (`grabbedOrigin +
relOffset`) and validity via `store.canPlaceInstance(def, cells, dragIds)` —
**the whole moving-id Set is excluded from occupancy** (`Grid.canPlace`/
`ModuleStore.canPlaceInstance` were widened to accept `string | Set<string>`),
so members can shuffle into each other's about-to-be-vacated cells (verified:
selecting two adjacent rooms and dragging one so its target lands on the
OTHER's current cells succeeds, while the other member's own target — offset
by the same rigid delta — is validated simultaneously). The group is valid or
invalid as ONE unit (`GroupGhostPreview.setValidity`) — no partial commits.
Commit is `ModuleStore.moveMany(moves)`: validates every member first
(all-or-nothing — if any target is invalid, NOTHING moves), then frees every
member's CURRENT footprint before occupying any NEW footprint (so the two
passes never race regardless of how positions overlap), and — since group move
never touches rotation/mirror — is always a cheap position update, never a
mesh rebuild. One `onAfterAction` call → ONE undo snapshot for the whole
gesture (verified: a mixed rooms+stair+connector group move undoes/redoes as
one step). An invalid drop restores every member's visibility and leaves
everything exactly where it was (verified: 0 snapshots added).

**Group delete**: Del/Backspace with 2+ selected calls `store.removeMany(ids)`
(single `onChange`, so downstream rebuilds run once) — this SUBSUMES the
single-delete path too (removeMany handles 1 or many uniformly; the old
separate single/group branches were unified). One `onAfterAction` call → one
undo snapshot restoring every deleted instance.

**R/M single-selection-only**: rotate/mirror read `selectedIds.size === 1`
before acting; a multi-selection no-ops and fires `onNoopHint?.(message)`
(wired to `showToast("info", …)` in main.ts) rather than silently doing
nothing. Group re-pose (rotating/mirroring a whole selection about a common
centre) is explicitly OUT OF SCOPE for v1 — noted as future work (§7). The
same single-only gating applies to the in-flight move-ghost's R/M (rotating
the ghost mid-drag): a group move-drag silently ignores R/M (no hint — the
key is legitimately meaningless mid-gesture, unlike the idle-selection case).

**Duplicate (Ctrl/Cmd+D OR Shift+D)**: clones the WHOLE current selection —
one instance or many — into a fresh placement ghost that follows the cursor.
Both key combos route into the same `startDuplicate` (see the key handler note
below and the §2h Ctrl/Cmd+D update).
Lives entirely in `SelectionController` (own `duplicating`/`duplicateTemplates`/
`lastDuplicateCell` fields), NOT `DragDropController` — an earlier version
routed a single-instance duplicate through `dragDrop.startPlacementFrom` and
left multi-selection duplicate silently unimplemented (Shift+D was a no-op
with zero feedback whenever 2+ were selected — reported by manual testing,
since automated tests only happened to exercise the single-selection case).
Unified onto the SAME machinery group-move already uses:
- `startDuplicate(insts)`: builds one `GroupGhostMember` template per instance
  (its own def/rotation/mirrored + cell offset from the FIRST instance, the
  anchor), `deselect()`s the real selection, and calls `groupGhost.begin(...)`.
- `onPointerMove` (while `duplicating`) calls `refreshDuplicateGhost(cell)` —
  `picker.cellAt(...)` directly, no grab-offset (unlike group MOVE, there's no
  "pressed" instance to offset from — the ghost just snaps to whatever cell is
  under the cursor). This is what makes it track the cursor freely with **no
  button held** ("pick up, move freely, click to drop", not a press-and-hold
  drag) — `pointermove` fires regardless of button state.
- `onPointerUp` (while `duplicating`) calls `commitDuplicate()`: builds one
  `store.placeMany(items)` call from every template's `(cell + relOffset)` —
  all-or-nothing, single `onChange` — then selects the freshly placed set.
  `onPointerDown` is a no-op while duplicating (commit waits for release), so
  a plain click (down+up, no drag) is what places it.
- R/M rotate/mirror the ghost only when duplicating a SINGLE instance
  (`duplicateTemplates.length === 1`) — rebuilds via `groupGhost.begin(...)`
  then re-runs `refreshDuplicateGhost` to reposition/retint at the last known
  cell. A multi-template duplicate no-ops R/M with a hint (group re-pose is
  out of scope, same rule as elsewhere).
- `cancelDuplicate()` (public) resets everything and is called directly by the
  central Escape arbitrator (`selection.isDuplicating` — checked at the same
  priority tier as `dragDrop.isDragging`, since it's also an active gesture).

`ModuleStore.placeMany` (mirrors `moveMany`/`removeMany`'s shape): validates
every target's cells first — no exclusion needed, these are all brand-new ids
— and if ANY is invalid, NOTHING is placed. A rigid translation of an
already-non-overlapping template set can never introduce a NEW overlap
between the batch's own members, so only EXISTING occupancy needs checking.
`onChange` is suppressed during the placement loop and fired once at the end.

**Key binding: Ctrl/Cmd+D AND Shift+D** (`SelectionController.onKeyDown` 'd'
branch — `if (!(e.ctrlKey || e.metaKey || e.shiftKey)) return; e.preventDefault();`).
Both trigger duplicate; a bare 'd' does nothing.
- **Ctrl/Cmd+D** is the primary binding. It IS interceptable — Ctrl+D (the
  bookmark shortcut) fires a keydown that reaches page JS and `preventDefault()`
  DOES suppress the bookmark in Chrome/Firefox/Edge (unlike the OS-level
  Ctrl+T/N/W, which the browser handles before the page — those genuinely can't
  be overridden). An EARLIER note here claimed Ctrl+D was un-preventable and
  switched to Shift+D; that was over-cautious (it conflated Ctrl+D with the
  OS-level combos). The verification sweep (§6) re-tested and confirmed the
  handler's `preventDefault` fires on a Ctrl+D keydown.
- **Shift+D** is retained as a guaranteed-reliable fallback (matches Blender's
  duplicate convention and this app's R/M single-key style) for any environment
  that does swallow Ctrl+D before the page.
- **Verification caveat (§6):** the browser-automation `key` tool in this dev
  environment cannot emit a MODIFIED keydown at all (Ctrl/Shift both arrive as
  `false`), so the physical bookmark-suppression couldn't be observed through
  automation. It was verified by (a) a faithful synthetic `keydown{ctrlKey:true}`
  whose `preventDefault` fired (dispatchEvent returned cancelled), and (b) the
  full flow — ghost follows the cursor, click places the clone, one undo reverts
  — driven by real mouse + the real Undo button. Real-Ctrl+D + no-bookmark is a
  manual-check item.

**Hover** (`moduleMesh.setHovered`, subtler emissive intensity 0.15 vs
selection's 0.35): `SelectionController.onPointerMove` raycasts
`store.groups` whenever nothing is pressed/dragging and `!dragDrop.isDragging`
(ghost placement owns the cursor's visual feedback while active).
`setHovered(group, hovered, selected)` is a no-op when `selected` is true
(selection's own glow already reads as "in focus" — hover must never
downgrade it) or when `userData.hiPrev !== undefined` (a rules-violation tint,
`highlight.ts`, owns the material — rarer/more important than a passing
mouseover). A `pointerleave` listener clears hover when the cursor exits the
canvas. Hover-clearing is folded into `deselect()` (not a separate path) so it
inherits the SAME floor-switch-safety ordering selection already had:
`FloorManager.setActive()` calls `selection.deselect()` BEFORE reassigning
`.store` to the new floor, so hover/selection cleanup always resolves ids
against the correct (about-to-be-inactive) floor's `instances` map — this
matters because instance ids are per-`ModuleStore` counters, so the SAME id
string can legitimately refer to different instances on different floors.

**Escape — single central arbitrator** (main.ts's keydown listener, extended
from the existing undo/redo handler): exactly this priority order, one thing
happens per keypress —
```
dragDrop.isDragging         → dragDrop.cancelPlacement()   // palette placement
selection.isDuplicating     → selection.cancelDuplicate()  // Shift+D ghost (own flag, not dragDrop's)
entranceController.isActive → entranceController.cancel()
doorController.isActive     → doorController.cancel()       // door-placement mode
selection.hasSelection      → selection.deselect()
planMode                    → exitPlanMode()
```
`dragDrop`/`selection`/`entranceController` no longer listen for Escape
themselves (`cancelPlacement()`/`cancelDuplicate()`/`cancel()` are public
no-arg methods called directly) — previously each had its own independent
Escape branch, which could
all fire for the SAME keypress with no ordering guarantee. Centralizing was
necessary, not cosmetic: the naive fix (keep three listeners, have a fourth
check "did selection already act?" reactively) races, because listeners on the
same `window` node all fire in registration order in the SAME dispatch — by
the time a later listener inspects state, an earlier one may have already
mutated it. One arbitrator, checked top-to-bottom, has no such race.

**Selection readout** (`#selection-readout`, bottom-centre above `#hint`):
`updateSelectionReadout()` in main.ts, driven by `SelectionController`'s
`onSelectionChange` callback. Empty when nothing is selected (hidden via a
`.visible` CSS class toggle — NOT `style.display = ""`, which would fall back
to the stylesheet's `display: none` and stay hidden; this exact bug was caught
during verification). Single module → `"{def.name} · Floor {i} · {w}×{h}"`
where the footprint size is the CURRENT rotated+mirrored bounding box
(`rotatedCells(def, rotation, mirrored)`), not the def's nominal rotation-0
size — verified a 7×6 room reads "6×7" once rotated 90°. Multiple → `"{n}
selected"`. A selected entrance → `"Entrance · Floor 0"` (an extension beyond
the spec's literal examples, added for consistency — every selection state
shows something). Floor label uses the same `Floor {i}` (0-indexed) convention
as the sidebar tabs.

**Shortcuts legend** (`#shortcuts-btn`/`#shortcuts-panel`, top-right below
Reset View): static HTML content in index.html (no dynamic data — nothing to
rebuild), reusing `.vp-header`/`.vp-title`/`.vp-close` styles from the
validation panel. A `.open` class toggle shows/hides it; lists every shortcut
(R, M, Del, Shift+Click, Shift+D, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Esc) plus a
note that Reset View/Top View are buttons only.

**Marquee selection: considered, SKIPPED** — plain left-drag on empty ground is
already the camera-orbit gesture (OrbitControls default), and the spec's
literal wording ("click-drag on empty ground rubber-bands a rectangle") would
have overridden that core navigation entirely, which the spec explicitly
permitted skipping if it "fights the interaction model." Shift-click covers
multi-select instead. (A Shift+drag-on-empty-ground variant would sidestep the
conflict — shift+drag is currently unbound — and is a reasonable future
extension; not implemented for v1, see §7.)

### 2i. Interior doors — authored access, door-based reachability

Doors are **authored, stored objects** (the OPPOSITE of derived windows; the
SAME family as entrances). The user places them on shared interior edges, and
**reachability is strictly door-based**: physical touch without a door is not a
connection (the deliberate cutover — old/doorless layouts flag red until doored,
explained by the DR1 note, §8).

**Data model** (`core/door.ts`). `Door { id, cell, side }` — a marker bound to a
shared interior edge, spanning EXACTLY 2 consecutive edges (1200 mm, fixed at 2
for v1); the second edge is implied by the side's run (+x for north/south, +z for
east/west). Stored per floor (`Floor.doors`, ANY floor — unlike floor-0-only
entrances), rebuilt into markers via `DoorView`. `id` = the anchor `edgeKey`.
- **`resolveDoorSpaces(door, targetAt)`** is the ONE definition of door validity
  + connectivity: both of the door's edges must join the SAME two DISTINCT
  spaces (else null → invalid). Caller supplies the token space, so the same
  function serves placement validity and graph access edges.
- **`buildSpaceTargets(floor, floorBelow?)`** maps each cell → an opaque space
  token: a room/stair instance id, a cluster's `clusterNodeId` (all pieces of one
  cluster read as ONE space), or `^`+id for a stair on the floor below projected
  up onto this floor's stairwell hole (how an upper room doors onto the stair
  arrival). Shared by placement validity, stale-door pruning, and the graph.
- **Valid hosts**: room↔room, room↔cluster, cluster↔cluster, and room/cluster↔
  stair (bottom, on the stair's floor; top, on the floor above via the hole
  projection). NOT exterior edges (the entrance's job), interior-to-one-space, or
  edges facing nothing (all verified rejected).

**Geometry — the opening (`moduleMesh.buildBoundaryWalls`, `door.ts`
`DOOR_OPENING_H = 2.1`).** A doored edge gets an OPENING 0→2100 mm with a SOLID
header panel 2100→floorHeight above it. **The deliberate INVERSE of a window**:
a window's sill/lintel panels are FIXED (900 mm) and the glazing GAP absorbs extra
floor height; a door's OPENING is FIXED (2100 mm ergonomic constant) and the
HEADER grows on taller floors. On a 3.0 m floor they coincide (2100 = 3000 − 900)
— do NOT conflate them (verified: at a forced 4.0 m floor the opening stays 2.1 m
and the header grows to fill 2.1→4.0). No sill, no glazing; doors are checked
before windows in `emit` (the two never coincide — windows are exterior-only,
doors interior-only).

**Both wall segments cut.** A shared interior boundary carries TWO wall segments
(each adjacent space builds its own, inset to its side — the concave-corner
architecture). A door must cut BOTH: `FloorManager.doorWallSets` (via
`door.doorWallCuts`) resolves each door edge's two sides through live grid
occupancy and produces a per-room LOCAL opening-edge set (fed to
`rebuildRoomWalls`) AND a cluster-wide ABSOLUTE opening-edge set (fed to
`rebuildClusterShells`). A door onto a stair cuts only the room/cluster side (a
stair/void owner is classified "other" → no shell wall) — verified openings cut
in both a room↔room boundary AND the cluster side of a room↔cluster boundary.

**Marker** (`DoorView`/`makeDoorMesh`). A violet floor-threshold strip across the
opening (distinct from the entrance's magenta), sitting on the slab top so it
reads unambiguously in **plan/top view** where the wall opening is invisible. It
IS the door's click target (`userData.doorId`). Openings/headers inherit the
`wallNormal` tag from the shared wall pass, so cutaway hides them with their face
(same path as windows).

**One door per physical boundary** (`door.doorOverlaps`, `Floor.addDoor`). A door
is rejected if it shares ANY physical boundary edge with an existing door.
`physEdgeKey` keys a unit edge by the unordered pair of cells it separates, so the
TWO (cell, side) representations of one boundary (a door placed from either
adjacent space) map to the same edges — this catches both an opposite-side
duplicate AND two collinear doors overlapping on a shared middle edge (which would
otherwise merge into an illegal 1800 mm opening). `addDoor` returns false on
rejection; the `DoorController` also folds the overlap test into its green/red
validity, so an already-doored boundary shows red and won't commit.

**Placement + selection** (`DoorController`, `selection.ts`). A Door tool (palette
"+ Door", Access panel) enters placement mode; hovering snaps a 2-edge ghost to
the wall nearest the cursor (`picker.groundPoint` → nearest side → span extended
toward the cursor), tinted green (valid) / red (exterior, off-boundary, or an
already-doored boundary); click commits on the ACTIVE floor. Doors are
selectable/deletable exactly like entrances — a second `MarkerSelectionAdapter`
on `SelectionController` (`selectedDoorId`, mutually exclusive with modules +
entrance, EXCLUDED from multi-select); marker click → highlight → Del. Escape
folds into the central arbitrator (§2h). Place, delete, and auto-removal are all
undo-covered. Two interaction-lifecycle guards make this robust:
- **Markers picked before modules** (`selection.onPointerDown`): a door marker is
  a low threshold strip sitting ON TOP of the room/cluster slabs it straddles, so
  a module is always under the cursor too. The entrance/door marker picks run
  FIRST (the marker IS the intended click target), else the underlying room would
  always win and doors could never be selected/deleted.
- **One armed placement mode at a time** (`isToolActive` guard + `main`'s
  `cancelPlacementModes`): while an entrance/door tool is armed, `SelectionController`
  no-ops entirely (its pointer handlers early-return) so a door click never also
  grabs/moves the room under it; and every placement entry point (palette grab,
  +Entrance, +Door) disarms all the others first, so a single pointer release can
  never drive two window-level placement handlers at once.

**Auto-removal of stale doors** (`FloorManager.pruneStaleDoors`, inside
`syncStairsAndHoles` → the store-change pass). Whenever a layout change makes a
door's edges no longer bind two distinct spaces (either side moved/deleted/
changed, or the edge went exterior), the door is removed automatically — in the
SAME synchronous mutation, BEFORE the action's history commit, so ONE Ctrl+Z
restores both the move and the door (verified: moving a room away drops its door
in one snapshot; undo brings back move + door). Doors do NOT travel with rooms —
they are absolute edge-bound and simply vanish when stranded.

**Serialization** — additive per-floor `doors` list (`DoorData`, same wire shape
as `EntranceData`; `normalizeEdgeBound` serves both). Tolerant loader → old files
load doorless; no version bump (`APP_PROJECT_VERSION` stays 1). Round-trip
verified. `loadProject` restores doors after all instances + entrances, then runs
one `syncStairsAndHoles()` to cut the openings.

**`connectionEdges` retired.** The dormant per-room-type `ConnectionEdge`
scaffolding on `ModuleDef` (with its unresolved rotation/mirror semantics) is
SUPERSEDED by authored doors — a user-placed door IS the access specification it
was a proxy for — and was removed from `modules.ts` (reduced to a one-line
historical note). `GraphEdge.viaDoor` is now live, not reserved.

### 2j. Bubble-diagram view — whole-dwelling columns, draggable nodes (`graphView.ts`)

Redesigned from a per-floor view (switched by the active floor) to a single
WHOLE-DWELLING view: one column per floor, left→right ascending, all floors'
nodes force-laid-out in the SAME simulation simultaneously. Pure rendering/
interaction — reads `DwellingGraph` exactly as before; no graph/rules/
serialization changes. Title is static ("Adjacency diagram"); switching the
active floor no longer changes what the diagram shows (only gives the active
column's header a cheap accent-colour emphasis in `drawColumns()` — a `getActiveFloor`
callback is kept for exactly this, nothing else keys off "active" any more).
Column headers sit at the BOTTOM of each column (`drawColumns()`; moved off
the top in the polish pass below — same active-floor emphasis, just
repositioned, `h - HEADER_H/2 - 4`).

**Column geometry** (`columnX0`/`columnCenterX`/`columnBand`/`stairBoundaryX`,
one source of truth reused by layout, drawing, AND pointer handlers so a drag
clamps to exactly the band a node is drawn in): `colWidth = canvasWidth /
floorCount`, recomputed every `frame()`. A room/cluster node's inner keep-out
band is `[floor*colWidth + pad, (floor+1)*colWidth - pad]` (`COL_PAD = 60`,
shrunk adaptively — `clamp(COL_PAD, 4, colWidth/2)` — so a very narrow window
degrades to "pinned at the column's left edge" instead of an inverted/broken
band).

**Stairs straddle the boundary, not a column.** A stair on floor N always has
a floor N+1 (FloorManager guarantees this — placing a stair auto-creates a
floor above if needed, and floor deletion re-creates one if a stair would
otherwise lose it), so `stairBoundaryX(floor) = (floor+1) * colWidth` is always
valid — no "no floor above" fallback needed in practice (not hit in testing).
Multiple stairs on the same floor pair land on the same x at different y
(free vertical placement, same as any node's y). Cross-floor edges (both the
`viaStair` TOUCH pass and the door-gated ACCESS pass — see `adjacencyGraph.ts`
§2c) need NO special routing: every cross-floor edge has exactly one stair
endpoint by construction, so a plain line between two normally-positioned
nodes automatically reaches left into the lower floor's column (the stair's
bottom/same-floor neighbours) and right into the upper floor's column (its
`viaStair` neighbours). **This replaces the old "↑/↓ F‹n›" stub system
entirely** — `StairStub`/`stairStubs()`/`drawStubs()` are deleted, along with
the `DOOR_STAIR`/`STAIR` stub-only colour constants (a stair now just uses its
own `GraphNode.color`, like any other node).

**Force simulation vs. the column constraint.** Repulsion and spring forces
are computed identically for every node regardless of kind or column — the
column system only changes the FINAL "integrate velocity into position" step
in `step()`: a non-stair node's gravity target changes from the old whole-
canvas centre to its OWN column's centre-x (`columnCenterX(node.floor)`, so
floors don't all collapse toward one shared centre), then its x is clamped
into its column band; a stair node never accumulates or applies x-velocity at
all — its x is hard-set to `stairBoundaryX` every frame — so horizontal
repulsion FROM a stair still pushes its neighbours away (the stair acts as a
fixed anchor, using its real boundary position), but nothing ever moves the
stair horizontally. The x-clamp (or x-snap, for stairs) and the y-margin clamp
(`MARGIN_Y = 60`) run every frame regardless of pinned state or column-width
changes, so a resize or a floor being added/removed re-snaps every node into
its (possibly now-different) valid region immediately, with no drift period.

**Dragging (pin-on-drag).** `pointerdown` hit-tests (`hitTest`, latest-drawn-
first so overlapping circles resolve to the topmost) against the graph's
actual node circles; a hit adds the node's id to a `pinned: Set<string>` and
starts tracking `dragId`. `pointermove`/`pointerup` are bound on `window` (not
the canvas) so a drag survives the pointer leaving canvas bounds — both are
inert no-ops whenever `dragId` is null, which is always true while the diagram
isn't visible (a hidden canvas never receives the `pointerdown` that would set
it). A pinned node's position is set directly from the (clamped) pointer
location, bypassing velocity entirely, and its `vx`/`vy` are zeroed every frame
in `step()` so an unpin (double-click a single node, or "Re-layout" — clears
the whole `pinned` set) resumes from rest rather than flinging off with stale
accumulated force. Pinned nodes still fully participate in repulsion/spring
force GENERATION (as fixed anchors), which is what makes an unpinned
neighbour's spring visibly pull toward/relax around a node while it's being
dragged. Room/cluster drag is free within its column band; stair drag ignores
the pointer's x entirely (vertical-only, locked to the boundary) — same clamp
functions as the simulation, so a drag can never place a node somewhere the
sim itself wouldn't allow.

**Toggles + legend** (now a DOM panel, `#graph-legend`, bottom-right over the
canvas — was canvas-drawn text before; converted so the two checkboxes could
be real, accessible controls rather than fake canvas buttons). `showTouch`
(default OFF) and `showDepth` (default ON) are plain instance booleans flipped
by `<input type="checkbox">` `change` listeners wired in the constructor.
Touch-edge visibility: hidden unless `showTouch` OR the edge itself carries a
violation (a flagged touch edge — e.g. S6's shared-wet-wall note, or an S3/AC1
touch violation — must stay visible regardless of the toggle, since it's
carrying actionable information); a touch edge whose pair ALSO has an access
edge stays suppressed either way (the solid line already represents that pair)
unless the touch edge itself is flagged. This one rule (already present
pre-redesign for the access/touch dedup) now also covers what the old stub
toggle would have needed — a cross-floor touch-only edge is just a `viaDoor:
false` edge like any other, so it needs no separate handling. Depth badges
gate on `showDepth` alone (no interaction with severity — see below). "Re-layout"
(`#graph-relayout`, next to the Diagram/Top-View toggles, hidden outside
diagram mode) clears `pinned` — the sim's own forces do the resettling, no
position re-randomization needed. Legend still covers access-vs-touch swatches,
hard/soft/note tier dots, and the entry marker (all static, canvas-equivalent
info, just DOM now).

**Re-layout button visibility — the show/hide (verification-sweep fix, §6).**
`GraphView.show()` sets `relayoutBtn.style.display = "inline-block"` (NOT `""`).
The button's stylesheet default is `#graph-relayout { display: none }` (hidden
outside diagram mode), so clearing the inline style would fall back to that
`none` and the button would never appear — the exact inline-vs-stylesheet-
default pitfall already flagged for `#selection-readout` (§2h). An explicit
value overrides it. (Root cause of a long-standing "Re-layout button absent"
report: `show()` previously set `""`.)

**Depth-badge data — self-computed, no Check-Layout prerequisite (fix, §6).**
`GraphView.frame()` computes `this.depths = computeEntranceDepths(graph)` itself
each frame whenever `showDepth` is on — the diagram OWNS its depth metric now.
Previously depths only arrived via Check Layout's `graphView.setDepths(...)`
(now removed), so opening the diagram and toggling depth on showed NO badges
until you ALSO ran Check Layout — a silent hidden prerequisite (root cause of a
"depth badges render nothing with the toggle on" report; it was NOT a
node-id key mismatch — the namespaced ids always matched). The graph is already
recomputed every frame, so the extra BFS is negligible, and badges are now LIVE
as the layout changes. An empty entrance set → empty map → no badges (reads
correctly as "nothing to measure depth from yet").

**Depth badges — a chip, not a bare numeral.** The original design drew the
hop-count directly on the node's own edge in a small grey fill, which read as
near-invisible on light node colours (the cream bathroom, near-white walls)
and was half-clipped by the node's own circle. Replaced with a small solid
chip: fixed colours independent of the node's fill (`BADGE_BG = "#1e1e1e"`
charcoal, `BADGE_TEXT = "#ffffff"` white numeral, `BADGE_BORDER = "#f4f1ea"`
hairline light stroke), so legibility never depends on what's underneath.
Centred ON the node's rim at 45° (bottom-right): `bx = p.x + r*Math.SQRT1_2`,
`by = p.y + r*Math.SQRT1_2` — i.e. exactly the rim point in that direction, so
the chip (radius `clamp(r*0.32, 9, 13)`) overlaps the node by about half its
own area rather than floating free or sitting fully outside it. Drawn AFTER
the severity glow/border and the hover ring (below), so it's never buried
under either on a flagged/hovered node. `nodeRadius()`'s existing sqrt-of-
cell-count scaling (unchanged) already handled Small-vs-Large legibility by
size; only the badge's OWN rendering changed here.

**Report-card hover emphasis.** Hovering a violation card in the Layout Check
panel (`validationPanel.ts`) emphasizes that violation's target(s) in both the
diagram and the 3D view, layered on top of — never replacing — the normal
post-check tier highlighting; unhover reverts to exactly that normal state.
Orchestration lives in `main.ts` (`onHoverViolation`), matching the file's
existing "panel is pure DOM, main.ts wires highlighting" split:
`validationPanel.ts` only fires the callback on `mouseenter`/`mouseleave`,
gated to cards that actually have something to point at (`v.nodeIds.length >
0 || v.edge` — a dwelling-level card like G1 or a P-rule gets no `.hoverable`
class, no listeners, and no hover-affordance CSS, so it never implies an
interaction that would emphasize nothing).
- **Diagram side** (`GraphView.setHover(v)`): stores `hoverIds =
  new Set(v.nodeIds)` and `hoverEdge = v.edge ?? null`, purely additive draw-
  time state — never mutates `nodeHi`/`edgeHi`. In `draw()`, a hovered node
  gets an extra outlined ring (`HOVER_OUTLINE` black + `HOVER_RING` white,
  drawn at `r+9`, layered after the severity ring/entry marker) and a hovered
  edge gets the same outlined treatment as an overlay stroke on the identical
  path, drawn right after the edge's normal stroke in the SAME loop iteration
  — so it inherits whatever visibility that edge already had (a flagged touch
  edge is always visible regardless of the touch toggle, so its hover overlay
  is too). Cross-floor edges need no special handling here either: the
  overlay is just another `moveTo`/`lineTo` on the same two (already
  correctly positioned) node coordinates.
- **3D side** (`setHoverEmphasis`/`clearHoverEmphasis`, new in `highlight.ts`):
  resolves the SAME dwelling ids `applyRoomHighlights` already knows how to
  resolve — the resolution logic was factored out into
  `resolveNodeMaterials`/`resolveEntranceMaterials` (shared by both highlight
  and hover paths, so they can never disagree about what a given id points
  to) — and bumps ONLY `emissiveIntensity` (0.55 → `HOVER_EMPHASIS_INTENSITY
  = 1.0`) on materials that are already tinted (`mat.userData.hiPrev !==
  undefined`); it never touches `.emissive` (the colour), so it can't fight
  the tier colour or `hiPrev`'s bookkeeping. A small tracked list
  (`hoverMats`) is what `clearHoverEmphasis` walks to reset back to 0.55 —
  explicit reset rather than relying on a later `clearRoomHighlights`, so a
  stray hover-clear after the report's already been dismissed (whose
  `restore()` already reset the material) can't re-introduce a stale
  intensity. `main.ts` calls `clearHoverEmphasis()` from both `clearValidation()`
  and the top of `runCheck()`, so a hover can never survive past the report
  it belonged to.

**Labels + node size.** `shortLabel()` strips a trailing `— Variant` or
`(variant)` suffix (`"Bedroom — Large"` → `"Bedroom"`, `"Stair (dogleg)"` →
`"Stair"`) via one regex — no hardcoded room-type list, so it's automatically
correct for any current or future def whose `name` follows that convention,
and a no-suffix label (`"Kitchen"`, `"Circulation"` — cluster labels come from
`def.group`, which was already suffix-free) passes through unchanged.
`nodeRadius()` (sqrt-of-cell-count, clamped `[18,46]`) was ALREADY the
mechanism distinguishing Small/Large by size before this redesign — reused
as-is, not new.

**View state, not design state.** All of this feature's state (`positions`,
`pinned`, `showTouch`, `showDepth`, and the hover-emphasis pass's `hoverIds`/
`hoverEdge` + `highlight.ts`'s `hoverMats`) lives entirely inside `GraphView`
or `highlight.ts` module state, exactly like the pre-existing `positions`/
`nodeHi`/`edgeHi`/`depths` — `serializeProject()` (`projectIO.ts`) only ever
reads `Floor`/`FloorManager`, which neither of these ever writes to, so there
is no code path by which any of this could reach project JSON (confirmed:
zero references to position/pinned/diagram/graphView/hover-related terms
anywhere in `projectIO.ts`).

### 2k. North compass + orientation-aware windows (`orientation.ts`, dial, cutaway toggle)

A project-level **`northAngle`** (degrees, on `FloorManager`, default 0)
introduces a north direction. `core/orientation.ts` is the ONE place the
convention lives and everything else consumes it — no consumer re-derives a
bearing.

**The convention (precise, stated once):** the geographic **north vector is
world −Z rotated CLOCKWISE (viewed from above, looking down −Y) by
`northAngle`**. At 0, north = world −Z = grid "north" (the −z side); increasing
it swings north toward world +X (east), since east is 90° CW of north. A wall's
**compass bearing** = the CW-from-north angle of its outward normal, `[0,360)`
(0 N, 90 E, 180 S, 270 W). Implementation: `normalBearing(nx,nz,a) =
norm360(atan2(nx,−nz)·deg − a)` — `atan2(nx,−nz)` is the CW-from-world-−Z angle;
subtracting `a` re-references it to true north. `sideBearing(side,a)` wraps it
for a grid Side; `bearingSector` snaps to the 8-wind rose; `southDistance`
(distance to 180) is the seed-bias score; `isNorthLit`/`NORTH_SECTOR_HALF_WIDTH
= 45°` is OR1's test; `worldNorthDir(a) = (sin,−cos)` is the arrow's world
vector. (Rooms carry no absolute rotation — the mirror/rotation is baked into
cells and the room group is unrotated — so a grid Side IS a world side, which is
why one side→bearing map serves both the generator's runs and the 3D walls.)

**South-biased generation** (§2d): `computeWindows` gains `northAngle` and sorts
seed runs southernmost-first; everything else (2-edge min, growth, corner-wrap)
is unchanged. Pure function of (footprint, floorHeight, occupancy, entrances,
northAngle) — deterministic, derive-don't-store, reproduced on load/undo/rotate/
mirror/dial. **Assumption noted:** default room glazing targets only ever need 2
edges, so at default ratios a room simply glazes its single most-southern
qualifying run (wrapping/multi-band, hence a two-sector "S + E" mix, only occurs
when a face is too short — rare at default ratios, exercised via a forced ratio
in testing, §6).

**Orientation is derived into `GlazingStat`** (`sectors`, `northLit`) inside
`computeWindows` (it now has `northAngle`), stashed on `floor.windowStats`,
carried onto `node.glazing`. So **no new graph-node fields** — OR1 reads
`node.glazing.northLit`, the report's "Glazing orientation" line reads
`node.glazing.sectors` (`validationPanel.appendOrientation`), both already
flowing through the existing `node.glazing` pipe.

**OR1** (soft, §8): habitable-or-kitchen room whose glazing is all north-facing.
Reads `glazing.northLit`, which is TRUE only when glazing EXISTS and every
windowed edge is within 45° of north — so a room with NO glazing can't trip OR1
(D1/W1 own that), no double-fire.

**Serialization** (`projectIO.ts`): `ProjectFile.northAngle?: number` —
ADDITIVE, tolerant (absent/garbage → 0, wrapped to `[0,360)` in `normalize`),
NO version bump. `serializeProject(floors, northAngle)`; `loadProject` restores
`this.northAngle` BEFORE the rebuild so windows re-derive against it. It is
DESIGN state (it moves windows), so it round-trips and is UNDOABLE — one
snapshot per dial gesture.

**Dial + arrow + toggle** (`main.ts` + `ui/compassDial.ts`, styled Bauhaus in
index.html/style.css):
- **Compass dial** (bottom-right control): a draggable SVG dial in a TOP-DOWN
  frame (screen-up = grid north), so the needle's CW-from-up screen angle IS
  `northAngle`. `onInput` fires live during a drag (updates only the live
  display angle — windows do NOT rebuild mid-drag); `onCommit` fires on release
  → `FloorManager.setNorthAngle` (re-derives windows) + `clearValidation` + one
  `commitHistory` (commit-on-release, per CLAUDE.md). `setAngle` re-syncs the
  dial after load/undo (`syncNorthUI` in main).
- **North arrow badge** (bottom-left, camera-aware, read-only): each frame,
  `main.updateNorthBadge` projects `worldNorthDir(displayNorthAngle)` through the
  camera and rotates the badge to true on-screen north — correct in BOTH axo and
  plan (the projection carries the view; plan is north-up so at north 0 it points
  straight up). Reads `displayNorthAngle` (the live drag angle), so it tracks a
  drag continuously while the windows wait for release. Hidden in diagram mode.
- **Cutaway toggle** ("Cutaway" button, default ON): flips
  `setCutawayEnabled(cutaway.ts)`. OFF renders every wall regardless of camera —
  the building reads as a solid exterior object so its facades/windows (incl.
  corner windows) are visible from outside. Pure session VIEW state — a plain
  `main.ts` boolean, NEVER serialized, untouched by undo/load, independent of
  plan view and per-floor visibility/dimming (the pass only flips
  `wallNormal`-tagged `.visible`).

**View state, not design state (the split here).** `northAngle` IS design state
(serialized, undoable) — it changes the derived windows. The dial's live drag
angle (`displayNorthAngle`), the cutaway on/off, and the badge rotation are pure
VIEW state (never serialized). This is the deliberate line: north the *value* is
design; the *widgets and camera-aware arrow* are view.

### 2l. Baseline furnishing — all room types (`props/rooms.ts`, `props/data/*.json`)

The Kitchen prop pipeline (§2 props row, §3 voxel format) is now extended to
every furnished room type — same machinery, no new abstractions: each layout is
a list of fixture `Placement`s fed to `buildPropsMesh` (merged `InstancedMesh`,
per-voxel wall-clip, room-local frame, mirror + rotation for free). Builders in
`rooms.ts`, registered in `index.ts` `PROP_BUILDERS`:

- **Bathroom** (`bathroom_small` 3×3 / `bathroom_large` 4×4 — separate types,
  separate layouts): small = `toilet` + `basin` + `shower`, one per wall, centre
  clear; large adds `bathtub` on the south wall. Props: `toilet`, `basin` (mirror
  block folded in), `shower`, `bathtub`.
- **Bedroom** (`bedroom_small` 5×4 rect / `bedroom_large` 6×6 L): `bed_single`/
  `bed_double` head against a wall, `nightstand`(s) beside the head, `wardrobe` on
  another wall. Large's fixtures sit on the south/east SOLID walls, clear of the
  NE notch.
- **Living** (7×6 L): `sofa` on the south long wall, `sideboard` (+ thin dark TV
  slab) on the north solid wall, `coffee_table` between, `shelving` on the east.
- **Recreation** (6×5 L): central `games_table`, two `lounge_chair`s toward the
  south corners, `shelving` reused on the north wall.

**14 new props** authored as `data/*.json` in the SAME format as the kitchen's
(box-composed 5 cm voxels) so any single prop is swappable with no code change;
`voxelProp.ts` now globs `data/*.json` so a dropped-in JSON registers itself.
Kitchen files/layout are BYTE-UNCHANGED.

**Simplifications (ponytail):** shower glass panels use a solid glass-tint colour
(`#9fb8c8`), NOT the translucent glazing material — the prop system is one opaque
`InstancedMesh`; a translucent prop layer is a future add. Big props (`bed_double`
~17k, `wardrobe` ~11.5k voxels) are solid boxes, heavier than a shell but still
one draw call each (the "merged geometry per instance" requirement); fine for
re-authorable baselines.

**Known limitation (recorded, not solved — §7):** props are static baselines
placed before doors; one may sit in front of a later-placed door. Door-aware
placement is future-gated.

**Verification (Track A):** the SCREENSHOT TOOL WAS DOWN this session (timed out
on every attempt, incl. the empty app after a full server restart), so the
required VISUAL confirmation — silhouettes read, colours within palette, cutaway
interiors — was NOT done and needs a human eyeball (manual steps in the session
report). What WAS verified objectively (no visual claim): a standalone port of
`place.ts`'s exact `emit`+wall-clip math confirmed EVERY prop voxel lands in a
FOOTPRINT cell for all 6 furnished types, un-mirrored AND mirrored (0 out-of-
footprint) — so nothing pokes through an exterior wall or into an L-notch;
rotations are covered by the rigid-rotation argument (moduleMesh rotates the
props group and `rotatedCells` by the same angle). Props build with zero console
errors; kitchen untouched; `tsc`/build clean.

---

## 3. Key data structures / formats (written out)

### Cell (`grid.ts`)
```ts
interface Cell { cx: number; cz: number }   // integer grid coords
const CELL_SIZE = 0.6;                       // metres per cell
// gridToWorld: world centre of a cell; grid is centred on world origin.
```

### Room / module / stair definition (`modules.ts`)
```ts
type ModuleType = string;                       // id; rooms/furniture/stairs share one type-space
type Category = "module" | "room" | "stair";

// (ConnectionEdge scaffolding removed — superseded by authored doors, §2i.)

interface ModuleDef {
  type: ModuleType;
  name: string;
  description: string;
  category: Category;
  group?: string;          // UI grouping label, e.g. "Circulation"
  color: number;           // hex int (also used as room-type colour everywhere)
  cells: Cell[];           // footprint relative to origin (0,0) at rotation 0
  height: number;          // in cells: furniture = 1, rooms = ROOM_HEIGHT (4), stair = 1 (nominal — see §2a)
  cluster?: string;        // "circulation" | "outdoor" for connector merging
}
// ROOM_HEIGHT = 4 cells = 2.4 m — the def's OWN nominal height, used as the
// fallback when no floor height is supplied. Built walls actually reach the
// floor's true floor-to-floor height (see §2b), which is >= this.
```
Registry: `MODULE_DEFS`; lists `MODULE_LIST` (furniture), `ROOM_LIST`,
`STAIR_LIST` (currently one entry: the dogleg). Transform (§2g):
`rotateCell((x,z)) -> (-z,x)` (90° CW); `mirrorCell((x,z)) -> (-x,z)`;
`transformCell(c, rot, mirrored)` = **mirror first, then rotate**;
`occupiedCells(def, origin, rotation, mirrored)` = absolute cells.

### Placed instance (`store.ts`)
```ts
interface ModuleInstance {
  id; def: ModuleDef; origin: Cell; rotation: number;
  mirrored: boolean;      // left/right flip, applied BEFORE rotation (§2g)
  group: THREE.Group;
}
// ModuleStore.onChange?: () => void  — fires on place/move/rotate/mirror/remove/reconcile.
// ModuleStore.extraPlacementCheck?: (def, cells) => boolean — set by FloorManager
//   for the stair "plate must be clear on the floor above" rule.
// ModuleStore.mirror(id) — in-place flip about the origin cell, collision-checked.
```

### Entrance (`entrance.ts`, `exteriorEdges.ts`)
```ts
type Side = "north" | "south" | "east" | "west";
interface BoundaryEdge { cx: number; cz: number; side: Side }
function exteriorEdges(cells: Cell[], occupied: Set<string>): BoundaryEdge[];
function edgeKey(cx, cz, side): string;  parseEdgeKey(key): BoundaryEdge;

interface Entrance { id: string; cell: Cell; side: Side }  // floor 0 only
```

### Door (`door.ts`) — authored interior access, see §2i
```ts
interface Door { id: string; cell: Cell; side: Side }  // ANY floor; id = anchor edgeKey
const DOOR_SPAN = 2;            // consecutive edges (fixed at 2 for v1)
const DOOR_OPENING_H = 2.1;     // FIXED opening height; header above grows on taller floors
const BELOW_PREFIX = "^";       // space token: a stair on the floor below (hole projection)
function doorEdges(door): [BoundaryEdge, BoundaryEdge];  // the 2 edges (run +x for N/S, +z for E/W)
function resolveDoorSpaces(door, targetAt): { a; b } | null;   // the one validity+connectivity check
function buildSpaceTargets(floor, floorBelow?): Map<cellKey, token>;  // cell → space token
function doorWallCuts(doors, ownerAt, resolveOwner): { rooms: Map<id,Set<localKey>>; clusters: Set<absKey> };
```

### Windows (`windows.ts`) — derived, see §2d/§2k
```ts
type WindowVariant = "framed" | "full-height";
interface GlazingStat {
  targetRatio: number; achievedRatio: number; belowTarget: boolean; // W1
  sectors: CompassSector[];  // distinct glazing sectors, south-first (report line); [] if no glazing
  northLit: boolean;         // has glazing AND all of it within 45° of north (OR1)
}
interface WindowPlan extends GlazingStat {
  edges: Map<string, WindowVariant>;  // ABSOLUTE windowed edge keys → variant
  variant: WindowVariant | null;
}
function computeWindows(cells, roomTypeId, floorHeight, occupied, entranceEdgeKeys, northAngle=0): WindowPlan;
const WINDOW_CONFIG: Record<roomTypeId, { targetRatio; variant; fixedEdges? }>;
// SILL_H = 0.9, LINTEL_H = 0.9, MIN_WINDOW_EDGES = 2 (all absolute metres/edges).
```

### North / orientation (`orientation.ts`) — see §2k
```ts
const COMPASS_SECTORS = ["N","NE","E","SE","S","SW","W","NW"]; type CompassSector = …;
const NORTH_SECTOR_HALF_WIDTH = 45; // OR1's north arc half-width (degrees)
// Convention: north = world −Z rotated CLOCKWISE (viewed from above) by northAngle.
function normalBearing(nx, nz, northAngle): number;   // outward normal → compass bearing [0,360)
function sideBearing(side, northAngle): number;        // grid Side → bearing
function bearingSector(bearing): CompassSector;        // nearest 8-wind sector
function southDistance(bearing): number;               // [0,180], seed south-bias score
function isNorthLit(bearing): boolean;                 // within NORTH_SECTOR_HALF_WIDTH of north
function sortSectorsBySouth(sectors): CompassSector[]; // most-southern first (report order)
function worldNorthDir(northAngle): { x; z };          // world XZ unit vector of north (arrow)
```

### Whole-dwelling adjacency graph (`adjacencyGraph.ts`)
```ts
interface GraphNode {
  id: string;             // dwelling-unique: `${floor}/${rawId}`
  rawId: string;          // room/stair instance id, or `cluster:<key>:<min-cell>`
  floor: number;
  roomTypeId: string;     // def.type, cluster key ("circulation"/"outdoor"), or "stair"
  label: string;
  color: number;
  kind: "room" | "cluster" | "stair";
  cells: Cell[];          // footprint (absolute, on its floor)
  isEntry?: boolean;      // true when a NON-BLOCKED entrance attaches here
  hasExteriorEdge: boolean;
  glazing?: GlazingStat;  // rooms only, from floor.windowStats (§2d) — W1 consumes it
}
interface GraphEdge {
  a: string; b: string;
  viaDoor: boolean;       // false = physical TOUCH edge; true = authored-door ACCESS edge (§2c/§2i)
  viaStair?: boolean;     // a cross-floor link made by a stair, vs. a same-floor wall touch
}
interface EntranceStatus {
  id: string;              // `${floor}/${entrance.id}`
  floor: number;
  hostId: string | null;
  blocked: boolean;        // re-derived every graph build, see §2c
}
interface DwellingGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];      // both TOUCH (viaDoor:false) and ACCESS (viaDoor:true) edges
  entryIds: string[];      // non-blocked entrance host node ids
  entrances: EntranceStatus[];
  floorCount: number;
  doorCount: number;       // total authored doors (drives the DR1 cutover note)
}
```

### Layout rules (`rules.ts`)
```ts
type Severity = "hard" | "soft" | "note";
interface Violation {
  ruleId: string; severity: Severity; description: string;
  nodeIds: string[];             // highlighted in diagram + 3D
  edge?: [string, string];       // edge-based rules
  entranceIds?: string[];        // entrance-marker highlight
  layout?: boolean;              // dwelling-level, not tied to particular nodes
}
interface Rule {
  id: string; severity: Severity; description: string;
  check: (graph: DwellingGraph, ctx: RuleContext) => Violation[];
}
function validate(graph: DwellingGraph): Violation[];
function accessDepths(graph, seeds): Map<string, number>;  // 0-1 BFS w/ stair-hop weighting, seed-parameterized
function computeEntranceDepths(graph): Map<string, number>; // = accessDepths(graph, entryIds); standalone metric, §8
const DEEP_ROOM_THRESHOLD_HOPS = 5;   // DP1: deep-from-entrance ceiling
const ESCAPE_DEPTH_MAX = 4;           // F1: far-from-exit ceiling (entrance+stair seeds)
```
`RuleContext` (built once per `validate()` call, `buildContext()`): node/edge
lookups, `degree()`, `is.{circulation,outdoor,bathroom,bedroom,kitchen,living,
recreation,room,stair,roomOrStair,public,habitable}` type predicates,
`entryIds`, `hasEntrance`, `reachableFrom(seeds, blocked?)` (multi-source BFS,
the reachability primitive every H*/G*/ST* rule uses). **`adj`/`viaStairAdj`/
`degree`/`reachableFrom` traverse ONLY ACCESS (door) edges** (`viaDoor:true`) —
reachability + connectivity are door-based; the proximity rules read TOUCH edges
straight off `graph.edges` via `edgeViolations` (which skips `viaDoor` edges).

### Project file (`projectIO.ts`)
```ts
interface InstanceData { type: string; cx: number; cz: number; rotation: number; mirrored?: boolean }
interface EntranceData { cx: number; cz: number; side: Side }
interface DoorData { cx: number; cz: number; side: Side }   // additive; same shape as EntranceData
interface FloorData { cols; rows; instances: InstanceData[]; entrances: EntranceData[]; doors: DoorData[] }
interface ProjectFile {
  format: string; version: number; floors: FloorData[];
  northAngle?: number;  // ADDITIVE (v1): absent → 0 via normalize; project-level design state (§2k)
}
```
`PROJECT_FORMAT = "flat-configurator-project"`, `APP_PROJECT_VERSION = 1`.
Tolerant/versioned load (`parseProject`); NOT serialized: camera state, active
floor, per-floor visibility, cutaway on/off, dial widget state (all view state —
see §5/§2k) — a load always starts all floors visible at the default axo extent
with cutaway ON. `mirrored` (§2g) and `northAngle` (§2k) are both **additive** v1
fields: absent → `false` / `0` via `normalize`, so pre-feature files load
unchanged — no version bump, no migration step. (`northAngle` IS design state,
unlike the view-state exclusions above — it moves the derived windows, so it
serializes and is undoable.)

### Voxel prop JSON format (`voxelProp.ts`, `data/*.json`)
```jsonc
{
  "format": "voxel-prop",
  "version": 1,
  "name": "counter_run",        // reliable id (counter_run, overhead_cabinet, stove, sink, fridge)
  "size": [width, height, depth],
  "voxels": [ { "x": -12, "y": 0, "z": -5, "color": "#6e4a2a" }, ... ]
}
```
- Integers in **5 cm units**; **12 voxels = one 0.6 m cell** (`VOXELS_PER_CELL = 12`, `VOXEL_SIZE = 0.05`).
- Integer = voxel **min corner** (occupies `[c, c+1]`).
- **x, z centred on 0**; **y floor-anchored** (y=0 ground, up positive). High-y is baked in (overhead cabinet y≈30–41).
- Parsed to `VoxelProp { name, size, voxels:[{x,y,z,color:number}], maxZ }`; library `PROP_LIBRARY: Record<name, VoxelProp>`.

---

## 4. Conventions & decisions

- **0.6 m structural cell = 12 voxels @ 5 cm.** Structural grid uses `CELL_SIZE = 0.6`; authored props use `VOXEL_SIZE = 0.05`, so `VOXELS_PER_CELL = 12`.
- **One shared occupancy map per floor** for rooms, furniture modules, AND stairs — collision is checked uniformly. Owned by `Grid`; mutated only via `ModuleStore`. A stair's footprint additionally reserves a matching hole (`Grid.holeCells`) on the floor directly above.
- **One central footprint transform: MIRROR FIRST, THEN ROTATE** (§2g). `transformCell`/`rotatedCells`/`occupiedCells` in `modules.ts` are the only place a `(rotation, mirrored)` pose becomes cells. Mirror-then-rotate ≠ rotate-then-mirror, so no consumer may reimplement it. Everything downstream (exterior edges, windows, clusters, holes, graph, props, stair geometry) derives from the transformed cells.
- **Mirroring NEVER uses negative scale** (§2g). `scale.x = -1` inverts triangle winding and normals (the stair-wedge bug class, §2a). Mirror the DATA and rebuild the geometry: mirrored cells for walls, negated voxel x for props, negated lane centres for the stair. Verified scene-wide: no negative scale, no non-positive `matrixWorld` determinant. Stairs remain the only scale-stretched element — and only in **y** (rise).
- **Clusters: full rebuild from occupancy.** Circulation/Outdoor cluster shells (and the adjacency graph) are recomputed from scratch on every change (`store.onChange`), not incrementally. Same-type only, orthogonal (4-neighbour) adjacency; corner-only contact does not connect (`connectedComponents` in `core/cluster.ts` is the single definition, shared by clusters and the graph).
- **Reachability is DOOR-based; adjacency has two edge kinds** (§2c/§2i). The graph emits TOUCH edges (`viaDoor:false`, physical shared-wall adjacency) AND ACCESS edges (`viaDoor:true`, an authored door). All reachability/connectivity rules (H1/H2/H3/H6/G1/ST1/ST2/C1/C2/DP1, entrance-rooted) traverse ONLY access edges — physical touch without a door is not a connection. Only the proximity rules (H4/S3/S4/S5) read touch edges. Stair links (bottom + top) are door-gated too. This was a deliberate CUTOVER: old/doorless layouts flag red until doored (DR1 note explains it).
- **Windows: derived, not stored** (§2d). Regenerated from room type + exterior edges + project north on every wall rebuild (they ride the wall pass), on EXTERIOR edges only. Nothing about the windows is serialized — export/import reproduces identical windows (from the stored `northAngle` + placement). Seed runs are picked SOUTHERNMOST-first under `northAngle` (§2k); panel/glazing heights are absolute (fixed on taller floors), which is why walls must be true-height geometry (§2b). Where an entrance coincides with a windowed edge the door wins (that edge is skipped).
- **North lives in ONE place** (§2k) — `orientation.ts` defines the convention (north = world −Z rotated CW-from-above by `northAngle`) and the single normal→bearing map; the generator's south-bias, OR1, the report's orientation line, and the on-screen north arrow ALL consume it, never re-deriving a bearing. `northAngle` is project-level DESIGN state (serialized, undoable — it moves windows); the dial widget/cutaway-toggle/badge are VIEW state (never serialized).
- **Doors: authored, STORED — the inverse of windows** (§2i). User-placed on interior edges, serialized (additive per-floor list), and NEVER derived. They ride the same wall-rebuild pass (cutting a fixed 2100 mm opening in BOTH adjacent wall segments), but a door's opening is FIXED and its header GROWS on taller floors (inverse of a window, whose panels are fixed and gap grows). Stale doors auto-remove inside the stranding mutation's undo snapshot; doors do not travel with rooms.
- **`connectionEdges` scaffolding removed** (§2i) — superseded by authored doors. Do not reintroduce a per-def access-metadata field; author a door instead.
- **The adjacency graph spans the whole dwelling** (all floors), not just the active one — cross-floor reachability is carried by `viaStair` edges (§2c). Entrances are floor-0-only and re-validated every build (never cached/stale).
- **Graph view recomputes per-frame while open** (cheap at this scale) → live updates; node positions persist by id across recomputes.
- **Rule validation is on-demand and advisory** (never blocks placement) — click "Check Layout" to run `validate()`; results surface in the text panel, the bubble diagram, and 3D shell tinting simultaneously. Any layout change drops the (now possibly stale) report (`floors.onLayoutChange`).
- **Wall height is real, true-height geometry; stair height is a runtime rescale** — deliberately different, see §2a/§2b. Walls are rebuilt (`rebuildRoomWalls()`/`rebuildClusterShells()`) directly at `floorHeight(floor)` on every layout change, so `scale.y === 1` always. Stairs stay built at `REFERENCE_STAIR_RISE` and rescaled via `group.scale.y` (`updateStairScales()`) — a taller floor genuinely means taller risers, so scaling is the correct model there, not a workaround.
- **Floor visibility is pure VIEW state, not design state** — never serialized (mirrors the pre-existing exclusion of camera state). Independent of the active-floor dim concept: dimming still draws a floor (colour-faded); hiding skips it entirely (`group.visible = false`). The active floor CAN be hidden (not force-switched) since interaction is scoped to the active floor's store regardless of what's drawn.
- **Undo/redo is snapshot-based, not command-based** (§2e) — this works precisely BECAUSE design state is tiny/serializable and derived state rebuilds from it (the same reasons cluster shells / windows are derived). A snapshot is a serialized project; a restore is the import rebuild path. VIEW state (camera, active floor, visibility, plan mode, selection) is deliberately outside history and preserved across restores. A commit is a no-op when the serialized state didn't change, so failed/degenerate actions cost nothing.
- **Prop seating:** prop voxels that fall inside a wall strip are clipped (`insideWall` in `place.ts`), so furniture sits flush against wall inner faces, never through walls.
- **Inactive floors:** rendered dimmed via opaque colour-fade toward the background (NOT alpha transparency — avoids depth-sort "slicing" artifacts) and are non-interactive (picker only ever raycasts the ACTIVE floor's store). Multi-colour voxel props are flagged `noDim` (not faded).
- **Multi-select is a Set, scoped to the active floor, entrances excluded** (§2h). Group move/delete are ONE undo action each (`moveMany`/`removeMany`, single `onChange`/commit). Group RE-POSE (rotate/mirror a whole selection) is out of scope for v1 — R/M require exactly one selected instance and no-op (with a hint) otherwise.
- **Escape has exactly one handler** (§2h, main.ts) — `dragDrop`/`entranceController`/`selection` expose public `cancelPlacement()`/`cancel()`/`deselect()` but do NOT listen for Escape themselves. Priority: active gesture (ghost placement, including Shift+D's duplicate ghost, or entrance-placement mode) → selection → plan mode. Never add a second Escape listener elsewhere — route through this arbitrator instead, or the priority ordering silently breaks (see §2h's note on why reactive post-hoc checks race).
- **Distinguish OS-level browser combos (Ctrl/Cmd+N/T/W) from page-interceptable ones (Ctrl/Cmd+D).** The former are handled by the browser BEFORE the keydown reaches page JS — `preventDefault()` is powerless and a synthetic-`dispatchEvent` test falsely passes (it bypasses native chrome). NEVER bind those. **Ctrl/Cmd+D (bookmark) is DIFFERENT** — its keydown DOES reach the page and `preventDefault()` DOES suppress the bookmark in Chrome/Firefox/Edge, so it's a legitimate binding (duplicate uses it — §2h — with Shift+D as a fallback). Still verify any modified-key binding on a REAL keypress: note that some browser-automation key tools can't emit modifiers at all, so a green automation run proves the HANDLER but not the physical browser default (§6).
- **Toggling element visibility via inline styles must use a class, not `style.display = ""`** — clearing an inline style falls back to the stylesheet's rule (which may itself be `display: none`), not to "visible" (caught during verification on `#selection-readout`; `#drop-overlay`'s pre-existing `.active` class toggle was already doing this correctly — follow that pattern, not a raw `style.display` write).

---

## 5. View / navigation (zoom-to-extent, floor visibility, plan view)

Added this session; all three interlock (floor visibility feeds the extent
box; the extent box feeds both axo and plan framing; plan mode drives floor
visibility). See `main.ts`'s "Camera framing" / "Plan (top) view" / "Bubble-
diagram" sections for the concrete wiring — the three toggle points (Reset
View, Top View, Diagram) are all mutually aware of each other's state.

- **Zoom-to-extent.** `FloorManager.contentBox(): THREE.Box3` unions the
  world-space bounding box of every placed instance's group + each visible
  floor's non-empty `clusterGroup`, across floors where `f.visible` is true.
  Falls back to those floors' grid footprints if nothing is placed, and
  further to a small box at the origin if no floor is visible at all. Forces
  `scene.updateMatrixWorld(true)` first — `Box3.setFromObject` reads
  `matrixWorld` directly, which can be stale if read in the same synchronous
  tick as a floor reposition (matrixWorld otherwise only refreshes on the next
  render pass; discovered and fixed this session).
- **Framing.** `sceneSetup.ts`'s `frameBox(box, direction)` (`ViewDirection =
  "axo" | "top"`) replaced the old fixed-position `resetView()`. Projects the
  box's 8 corners onto the chosen view's right/up axes (handles the axo case,
  where the box is seen at an angle, not just face-on) to find the required
  frustum half-extents, sets `viewSize`/position/target with a 15% margin
  (`FRAME_MARGIN`), and always resets `camera.zoom` to 1. For `"top"`,
  `camera.up` is swapped to world `-Z` (north-up) instead of `(0,1,0)` —
  looking straight down with an up vector parallel to the look direction is a
  singularity for OrbitControls' spherical math.
- **Reset View** (`main.ts`'s `resetToExtent()`) always lands at the default
  axo extent framing — including from plan/diagram mode, which it exits first
  (`exitPlanMode()` already re-frames axo). One button, one destination.
- **Floor visibility.** `Floor.visible` / `Floor.setVisible()` (getter/setter
  over `group.visible`); `FloorManager.setFloorVisible(i, v)` /
  `isFloorVisible(i)`. An eye-icon toggle sits next to each floor tab in
  `palette.ts` (`FloorState.floors[i].visible`,
  `PaletteCallbacks.onToggleFloorVisibility`). Default visible; not
  serialized (§3).
- **Plan (top) view.** `main.ts` state: `planMode: boolean`,
  `prePlanVisibility: boolean[]` (snapshotted on entry). `enterPlanMode()`
  exits diagram mode first, snapshots current visibility, hides every floor
  ABOVE the active one (`applyPlanVisibility()`), sets
  `controls.enableRotate = false` (pan/zoom stay live — rotation is locked so
  the plan reading can't be orbited into an oblique half-plan view), and
  frames top-down. `exitPlanMode()` restores the snapshot, unlocks rotate, and
  re-frames axo. Switching the active floor while in plan mode re-derives the
  hidden set live (`onSwitchFloor` calls `applyPlanVisibility()`); manually
  toggling a floor's eye icon while in plan mode updates the snapshot too (so
  exiting doesn't discard it). Mutually exclusive with the bubble-diagram view
  in both directions (each entry point exits the other first).
- **Cutaway needed no changes for plan mode**: wall normals are always in the
  XZ plane, so their dot product with a straight-down view direction is
  always ~0 (never exceeds the hide threshold) — every wall stays visible,
  which already reads correctly as a plan (walls seen edge-on, floor slabs
  filling the middle).
- **Cutaway toggle** (§2k): a "Cutaway" view button (default ON) flips
  `setCutawayEnabled` — OFF renders every wall so the building reads as a solid
  exterior object (facades/windows visible from outside). Session VIEW state
  only (never serialized, untouched by undo/load); coexists with plan view and
  per-floor visibility/dimming (the pass only ever flips `wallNormal`-tagged
  `.visible`). Lives in the bottom-right `#view-controls` group with the compass
  dial; both hide in diagram mode.

---

## 6. Current state — built/verified vs. not

**Built & verified across recent sessions (quantitatively, via temporary debug
hooks — screenshot tooling was unreliable in this dev environment, so
verification leaned on exact geometry/state dumps rather than visual
screenshots):**
- **Verification sweep — diagram Re-layout / depth badges / node sizing /
  Ctrl+D (Track C):** each item audited against the RUNNING app through the
  real UI (scene loaded via the real drag-drop IMPORT path — a genuine `drop`
  of a crafted `.json` → `parseProject`/`loadProject`, not a state hook — then
  all visual claims from real screenshots + real control clicks). Screenshot
  tooling was flaky (timed out ≥ ~1100px viewport; kept ≤ 800px) but usable.
  - **Re-layout button:** was ABSENT (root cause: `show()` set inline
    `display:""`, overridden by the stylesheet's `#graph-relayout{display:none}`
    → computed `none`; confirmed via `getComputedStyle`). FIXED (explicit
    `inline-block`, §2j). Verified: button now visible + labelled "Re-layout";
    dragging the Bedroom node pinned it (moved + stayed), clicking Re-layout
    unpinned it and the sim resettled it toward its neighbour — all in
    screenshots.
  - **Depth badges:** RENDER correctly (the chip design was fine) but ONLY
    after Check Layout — a silent data prerequisite (root cause: depths came
    solely from Check Layout's `setDepths`; NOT the suspected node-id key
    mismatch — ids matched). FIXED (diagram self-computes depths in `frame()`
    when `showDepth` is on, §2j). Verified: after importing a scene with an
    entrance + one door and opening the diagram WITHOUT Check Layout, the entry
    (Living) node showed a "0" chip and the doored Bedroom a "1" chip, from the
    default-on depth toggle alone (screenshot).
  - **Node sizing + labels:** already SHIPPED and working — labels read
    "Bathroom"/"Bedroom"/"Kitchen" (variant suffix stripped by `shortLabel`),
    radius scales by √(cell count) so the 36-cell Living node is visibly the
    largest (screenshot). No change needed.
  - **Ctrl/Cmd+D duplicate:** was NOT wired (only Shift+D; Ctrl+D returned
    early with no `preventDefault` → browser bookmark, no clone). FIXED (§2h) —
    Ctrl/Cmd+D + Shift+D both route to `startDuplicate`, `preventDefault`
    called. Verified: handler's `preventDefault` fires on a Ctrl+D keydown
    (dispatchEvent returned cancelled); the duplicate ghost followed the cursor
    unpressed (screenshots), a click placed the clone (bedroom_small, matching
    source, auto-selected), one Undo reverted it. AUTOMATION LIMITATION: this
    env's `key` tool can't emit modified keydowns (Ctrl/Shift arrive `false`),
    so the physical bookmark-suppression is a manual-check item — the flow was
    triggered by a faithful synthetic `keydown{ctrlKey:true}` and completed with
    real mouse + real Undo button.
  - `tsc`/build clean; the temporary import-`confirm` stub + keydown probe were
    page-runtime only (cleared on reload; nothing added to source).
- **North compass + orientation-aware windows + cutaway toggle (§2k, §8):**
  verified with REAL browser interaction (screenshot tooling worked reliably
  this session) plus exact state dumps, and a standalone Node port of the
  south-bias + orientation math for exhaustive coverage.
  - **South bias**: an isolated bedroom's window always lands on the face
    pointing due south — grid-south at north 0, grid-west at north 90,
    grid-north at north 180, grid-east at north 270 (the band jumps to the
    OPPOSITE face on a 180° flip); a REAL dial-drag to ~130° landed it on
    grid-west (the sunniest face then), confirmed on screen. `sectors`/
    `northLit` track it (always "S"/false for a south-lit room).
  - **Dial (real drag + synthetic)**: dragging the needle updated
    `displayNorthAngle` + the badge LIVE while `floors.northAngle` stayed put
    (windows did NOT rebuild mid-drag); on RELEASE `floors.northAngle` took the
    value, windows re-derived, and exactly ONE undo snapshot was pushed. One
    Ctrl+Z reverted the whole gesture — north 180→0, glass north→south, dial
    re-synced to "North 0°", the room preserved (undo goes through
    serialize→JSON→parse→loadProject, which also PROVES the northAngle JSON
    round-trip).
  - **North badge**: camera-aware — `rotate(0…)` (straight up) in plan at north
    0, `rotate(90…)` (east/right) at north 90; hides in diagram mode with the
    dial (both `display:none`), returns in 3D/plan.
  - **OR1**: a bedroom walled on S/E/W (exterior only on grid-north) glazes
    north → `northLit=true` → OR1 fires ("lit only from the north"); opening its
    south face (removing the south flanker) moves glazing to south → `northLit`
    false → OR1 gone. A bathroom (no glazing) never appears — no double-fire.
  - **Orientation report line**: "Bedroom — Small: glazing N/S" per room, bathroom
    excluded; a forced-ratio living room's wrapped U-band correctly read
    "Living Room: glazing S + E + W" (a corner-wrapped band carries all its legs'
    sectors). All 8 orientations agreed on edge-count/achieved/contiguity in the
    standalone sweep.
  - **Serialization**: load with `northAngle:137`→137, `400`→40 (wrapped),
    MISSING→0 (old file, no complaint), garbage string→0.
  - **Cutaway toggle**: OFF renders the solid building with its south window
    visible from outside (confirmed on screen); ON restores dollhouse hiding.
    Plain `main.ts` boolean, never in `serializeProject` — not serialized.
  - `tsc`/build clean; the temporary `__dbg` hook removed (grep-confirmed).
- **Corner windows + per-floor N1 rider (§2d, §8) — L/U-shaped window wrapping,
  glass-to-glass corners, per-floor circulation flag:** verified with real
  browser interaction throughout (screenshot/computer-tool interaction was
  reliable this session) plus exact numeric/pixel verification for the
  sub-millimetre geometry a screenshot alone can't resolve, and a standalone
  Node reimplementation of the algorithm (types stripped, ported line-for-line
  from the shipped `windows.ts`) for exhaustive coverage no single browser
  session could practically click through.
  - **Algorithm** (standalone; cross-checked against the real app's
    `computeWindows`/`windowStats` wherever they overlap): a forced-high-ratio
    Living Room (L-shape, 36 cells) wrapped a 7-edge south run into a U — 2
    edges onto the west run at the SW corner, 1 edge onto the east run at the
    SE corner, 10 total — `achievedRatio` matching the hand-computed value to
    6 decimal places in BOTH the standalone port and the real running app. All
    8 orientations (4 rotations × 2 mirror states) at the same forced ratio
    produced IDENTICAL edge counts/achieved ratios/band-contiguity in the
    standalone sweep; 2 spot-checked directly in the real app (rotation 0
    unmirrored, rotation 3 mirrored — the two whose 7×6 footprint happened to
    fit the test grid from the origin) matched that standalone result exactly.
    An entrance placed directly on a wrap-target edge — tested BOTH in the
    standalone port and, separately, through the real entrance/`FloorManager`
    wiring in the live app — blocked only that arm; the algorithm rerouted the
    shortfall to the still-open arm, with total edge count and `achievedRatio`
    unchanged (confirming W1's math doesn't care which specific edges got
    picked). An extreme ratio (5×, saturating the whole 26-edge perimeter)
    produced `belowTarget=true` once supply was genuinely exhausted, and
    confirmed by direct inspection that the L-room's own concave notch corner
    is structurally unreachable — neither flanking cell has an exterior edge
    on the face that points into the notch, so the same-cell wrap test simply
    has nothing to match there, at any ratio.
  - **Geometry**: real-browser bounding-box inspection (`geometry.
    computeBoundingBox()` on each merged wall/glass mesh) confirmed both
    wrapped corners of the forced-ratio Living Room close exactly as designed
    — the N/S pane's glazing unchanged at its full untrimmed width, the E/W
    pane's glazing extended to the true corner — matching hand-derived
    coordinates to 3 decimal places at both the SW corner and, on a second
    room (`bedroom_large`, framed variant), a NW corner too. Pixel-sampled the
    rendered WebGL canvas (via an explicit `renderer.render()` immediately
    before a canvas-to-2D-context `drawImage` readback — a canvas without
    `preserveDrawingBuffer` reads back blank otherwise) across the full
    visible window height at 5 different Y positions: continuous glass-family
    colour throughout, zero background/gap pixels, a visibly DARKER band
    exactly at the seam — the expected small deliberate overlap of two
    30%-opacity panes, not a defect.
  - **Framed variant / mitred lintel**: a forced-ratio `bedroom_large` (a
    different L-shape/notch than the Living Room) wrapped at BOTH a SW and a
    NW corner simultaneously (the west run wrapped at both its own ends) —
    bounding boxes confirmed the glazing GAP (0.9–2.1, sill below + lintel
    above both present) extends to the true corner at each, and that the
    corner cell's id correctly carries both meeting legs. Sill and lintel
    themselves needed, and received, no wrap-specific code at all, per the
    glass-to-glass design note below — this is the case that design choice
    depends on.
  - **Cutaway**: read `child.visible` directly on the merged per-normal
    wall/glass meshes (not just screenshots) while orbiting — confirmed
    cutaway hides exactly the camera-facing leg's solid+glass while the other
    leg's geometry (never shrunk OR dependent on the first leg's presence, by
    the asymmetric design below) stays fully intact with no gap, verified in
    both directions (west-hidden/south-shown and south-hidden/west-shown).
  - **N1 rider**: a real two-floor dwelling (Floor 0: stair + 6 circulation
    singles + bedroom + bathroom, 47 cells, 18 circulation/stair; Floor 1:
    living + kitchen, 52 cells, 0 circulation), driven through the ACTUAL
    Check Layout button and rendered report, reproduced exactly the scenario
    the rider targets: Floor 0 alone (38%) correctly flagged ("Floor 0 is
    circulation-heavy (38% of interior area)") while the whole-dwelling figure
    (18%, diluted by Floor 1's 0%) correctly stayed silent — a circulation-
    heavy storey no longer hides behind efficient ones. A follow-up scene with
    BOTH floors heavy (26% and 100%) fired all three — whole-dwelling (41%)
    and both per-floor flags — simultaneously, confirming "both can fire,
    different granularity." A single-floor dwelling at 26% (would flag if it
    were per-floor-eligible) showed ONLY the whole-dwelling flag and info
    line, no "Floor 0: …" line or per-floor violation at all — confirming the
    `floorCount > 1` suppression on both the rule and the report line. The
    report's per-floor line format ("Floor 0: 38% · Floor 1: 0%") matches the
    task's own example exactly.
  - `tsc`/build clean throughout; the temporary `(window as any).__dbg` hook
    (floors/camera/controls/scene/renderer, for scripted scene construction
    and precise camera framing — the same pattern prior sessions' debug hooks
    used) was removed before finishing; confirmed via `grep -rn "__dbg" src/`
    returning nothing.
- **Diagram polish (§2j) — depth-badge chip, bottom headers, report hover:**
  UNLIKE prior sessions, screenshot/computer-tool interaction worked reliably
  this time (real clicks, real hovers, real screenshots — the environment's
  earlier unreliability wasn't reproduced), so this was verified with actual
  browser interaction as the task required, with a few pixel-level reads
  (`ctx.getImageData`, THREE.js material properties) used to confirm exact
  detail a compressed screenshot couldn't resolve (see below). Test dwelling
  built via `store.place`/`addEntrance`/`addDoor` (bypassing the UI, same
  shortcut as before) — 2 floors, an entrance, a living/kitchen/bathroom on
  floor 0, a stair, a bedroom on floor 1 — then all verification (Check
  Layout, the diagram/3D toggle, hovering report cards, toggling checkboxes)
  through the real buttons/checkboxes/pointer.
  - **Depth badge**: initial pixel probes read the node's own dark border
    stroke (`#1a1a1a`) and mistook it for the badge (`#1e1e1e` — nearly the
    same near-black colour, not reliably distinguishable by fill-colour alone).
    Switched to scanning for the badge's WHITE numeral text and light border
    stroke specifically (colours nothing else nearby uses) and got a clean
    signal: 77 white pixels present with the depth toggle on, 0 with it off,
    on Kitchen (depth 1). Confirmed on 3 different node colours — Living Room
    (red), Kitchen (yellow), and the Bathroom once doored into reachability
    (cream, `#ede7da` — the exact low-contrast case the redesign targeted) —
    all three showed the badge's white text correctly.
  - **Column headers**: confirmed visually via screenshot — "Floor 0" renders
    at the BOTTOM of its column in the active-floor accent colour.
  - **Hover emphasis**: hovering the AC1 card (stair↔upper-floor-bedroom, the
    cross-floor case) visibly put a white outlined ring on BOTH the stair and
    the bedroom nodes simultaneously, plus a white overlay on the connecting
    edge, all on top of their existing severity rings/colour — confirmed via
    screenshot. Unhover reverted cleanly (rings/overlay gone, plain severity
    rings remained). A same-floor edge card (S6, kitchen↔bathroom) hovered
    correctly too (`hoverIds`/`hoverEdge` matched exactly). Hovering the
    dwelling-level G1 card ("Whole dwelling", no nodeIds/edge) produced no
    diagram change and its DOM row correctly lacked the `.hoverable` class —
    confirmed by querying every `.vp-item`'s class list against its rule id.
    In the 3D view (report panel open over the 3D scene, not the diagram):
    hovering S6 read the actual THREE.js materials directly — both Kitchen's
    and Bathroom's `emissiveIntensity` were exactly `1.0`
    (`HOVER_EMPHASIS_INTENSITY`) while hovered and their emissive COLOUR was
    untouched (still their severity tint), then exactly `0.55`
    (`EMISSIVE_INTENSITY`, the normal tier intensity) after moving the mouse
    away — confirming the boost-and-revert never touches colour/`hiPrev` and
    can't desync from the normal tier highlight.
  - `tsc`/build clean; debug hook removed; confirmed no `__dbg` references
    remain in `src/`.
- **Bubble-diagram redesign (§2j) — all floors, draggable nodes, cleanup:**
  screenshot/computer-tool timed out again this session (same class of issue
  as prior sessions); verified entirely via a hand-built 2-floor test dwelling
  (placed directly through `store.place`/`floor.addEntrance`/`floor.addDoor`,
  bypassing the UI) plus direct `graphView.frame()` calls (since
  `requestAnimationFrame` did not appear to tick in this headless context —
  called `frame()` manually, which is all `animate()`'s diagram branch does
  per real tick anyway) and synthetic `PointerEvent`s dispatched at the
  canvas. Confirmed: two stairs on the same floor pair both land exactly on
  `stairBoundaryX` (same x, different y); a 3rd floor's stair correctly lands
  on the floor-1/2 boundary (different x, `colWidth` recomputed for 3
  columns); every room/cluster node's x stays within its own column's band
  after 60+ simulation steps. Dragging: a room dragged toward another column
  clamps at the column edge (never crosses); a stair dragged toward its own
  floor's interior stays locked to its boundary x while y moves freely;
  released nodes stay pinned (position frozen across 60 more steps) while
  their doored neighbours (same-floor AND cross-floor) visibly relax toward
  the new pinned position, confirming forces still propagate from a pinned
  node as a fixed anchor. Double-click unpinned exactly the clicked node
  (a separately-pinned node stayed pinned); Re-layout cleared the whole
  pinned set. Resizing the viewport to 328×500 (from 1008×720) re-clamped
  ALL 9 nodes across 3 floors back into valid bands/boundaries with zero
  errors. Touch-edge toggle: verified off-by-default; a flagged touch edge
  (an S6 shared-wet-wall note on an undoored kitchen/bathroom pair) rendered
  in BOTH toggle states, while an unflagged touch edge (living/bathroom,
  physically touching, no rule interested in it) rendered ONLY when the
  toggle was on — confirmed by replicating the exact `draw()` visibility
  decision against the live edge/severity data. Check Layout produced 8
  violations spanning both floors and hard/soft/note tiers (H1 orphaned
  rooms, note-tier S6, soft-tier access-edge flags); dragging a hard-flagged
  node preserved its highlight tier across the move and kept it within its
  column band. Confirmed by static analysis (and by construction — `GraphView`
  only ever reads `computeDwellingGraph()`, never writes to `Floor`/
  `FloorManager`) that no view-state here can reach `serializeProject()`'s
  output; `projectIO.ts` has zero references to any of it.
- Wall height (§2b): walls build directly at the true floor-to-floor height
  on every layout change, room shells AND cluster shells — no `scale.y`
  hack (an earlier version of the fix used a rescale pass; superseded this
  session by true-height geometry). Verified `scale.y === 1` on every wall
  mesh, zero gap to the plate above, concave corners unaffected, cutaway
  unaffected, selection/dim tinting survives an in-place wall rebuild.
- Stair top-wedge fix (§2a): flight-1 winding corrected; verified via riser
  normal direction and a watertightness raycast sweep.
- Zoom-to-extent, Reset View, floor visibility, plan/top view (§5): verified
  content-box framing changes with placed content and floor visibility,
  plan-mode auto-hide/restore across floor switches, mutual exclusivity with
  diagram mode, and that visibility never survives a save/load round-trip.
- Rule-driven windows (§2d, W1): verified per-type generation (living
  full-height, bedroom framed, kitchen fixed 2-edge, bathroom none); the
  2-edge minimum (computed-1 rounds to 2, no single-edge windows); bands
  centred on the longest run, no corner wrap; move/rotate regenerates windows
  on the new exterior edges; cutaway hides panels + glass together with their
  face; entrance-coincident edge skipped (door wins); W1 fires on
  insufficient supply (and independently of D1); export/import reproduces
  identical windows; selection tints panels (shared material) while glass
  stays separate, glass dims with its floor.
- Mirroring, all placeables (§2g): verified all 8 orientations (4 rotations × 2
  mirror states) of every L-room are distinct and place correctly, with grid
  occupancy, ghost validity, walls, and glazing all agreeing with
  `occupiedCells(..., mirrored)`; mirror-then-rotate ≠ rotate-then-mirror for
  every L-room (order is load-bearing); `buildBoundaryWalls` is exactly
  reflection-equivariant (mirrored wall vertex set = x-reflection of the
  unmirrored one, same counts/normals → concave corners mirror cleanly);
  collision follows the mirror (mirrored footprint blocked, mirrored notch free
  and placeable, unmirrored-only cells freed); Kitchen props are the exact
  x-reflection at the same 19,195 voxels (wall-clip resolves the reflected
  walls); the mirrored dogleg's (position, outward-normal) pairs are the exact
  reflection of the unmirrored one (516 verts, 0 mismatches, `FrontSide`), riser
  normals (0,0,−1)/(0,0,+1) per flight, handedness flipped, stairwell hole above
  matches; **scene-wide: no negative scale, no non-positive `matrixWorld`
  determinant, no bad instance matrices**; mirrored projects round-trip
  byte-identical (and rebuild identical derived state), old files without the
  field load all-unmirrored; `M` mirrors the palette ghost (re-tinting validity),
  the move ghost, and a selected instance (exactly one undo snapshot, symmetric
  undo/redo); a collision-blocked mirror changes nothing and records no snapshot;
  `M` ignored while typing; selection highlight survives the mirror rebuild;
  the adjacency graph reads the mirrored footprint (and provably not the
  unmirrored one); move/rotate preserve the flip.
- Undo/redo + entrance deletion (§2e/§2f): verified a 15+ mixed-action
  sequence undoes to the empty baseline and redoes to the exact original final
  (incl. derived walls/glass/clusters and floor/stair reconstruction);
  undo/redo are symmetric; a new action after undo clears redo; camera, active
  floor, and per-floor visibility are untouched by undo; a real drag commits
  exactly once (no per-frame snapshots; an invalid drop commits nothing); a
  collision-blocked rotate correctly records nothing; entrance select (real
  projected click → highlight) + Delete removes it and is undoable; deleting
  the last entrance empties `entryIds` and restores the E1 gate with no stale
  report; Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y + buttons all track stack state.
- Multi-select / group ops / UI polish (§2h): verified shift-click assembling a
  mixed selection (room + room + stair + connector), including toggle-off/
  toggle-back-on and plain-click collapsing a multi-selection to one; group
  move of two adjacent rooms preserves the rigid offset AND lets one member's
  target land on the other's currently-occupied cells (self-exclusion) while
  the whole group ghost tints as one valid/invalid unit; one Ctrl+Z reverts
  the WHOLE group move, one Ctrl+Shift+Z redoes it; an invalid group drop
  restores every member's position/visibility with zero snapshots added;
  group delete of 3 mixed instances is one snapshot, one undo restores all 3;
  R/M correctly no-op (with a toast hint) on a 2-instance selection with zero
  state change and zero snapshots, then work normally again once collapsed to
  a single selection; the Escape priority chain (gesture → entrance mode →
  selection → plan mode) checked exhaustively — each state consumes Escape
  alone, never cascading into the next; hover applies a distinct
  lower-intensity tint that never overwrites a selection glow and correctly
  follows the cursor between instances, clearing on `pointerleave`; the
  shortcuts panel opens/closes and lists every shortcut; the selection
  readout is correct for 0 (hidden text, fails safe — this exact class of
  bug, an inline `style.display=""` falling back to a stylesheet
  `display:none`, was caught and fixed here), 1 (type · floor · CURRENT
  rotated bounding box, e.g. a 7×6 room reads "6×7" at 90°), and N
  (`"{n} selected"`) selections, plus a selected entrance
  ("Entrance · Floor 0"); plain left-drag on empty ground still orbits the
  camera unobstructed (`controls.enabled` never drops for it) — confirming
  marquee-select was correctly NOT wired in on top of that gesture.
- **Shift+D duplicate bug fix** (§2h): manual testing found duplicate silently
  did nothing on a multi-selection (e.g. several circulation blocks) — the
  first implementation routed ONLY through `dragDrop.startPlacementFrom`
  (single-instance), so 2+ selected just fell through with zero feedback;
  automated testing hadn't caught it because it happened to only exercise the
  single-selection path. Rebuilt on `GroupGhostPreview`/`store.placeMany` (see
  above) and reverified end-to-end: 3 mixed circulation pieces (2×
  `circulation_single` + 1× `circulation_double`) duplicate together,
  preserving their exact relative arrangement at the drop point; the ghost
  tracks the cursor on plain `pointermove` with **zero mouse buttons held**
  (confirmed: no `pointerdown` fired before the tracking move) and commits on
  a plain click; one undo removes all 3 duplicates, one redo restores them;
  Escape cancels the whole ghost with zero instances created and zero
  snapshots; R/M correctly no-op (with a hint) while duplicating 2+, and
  still rotate/mirror correctly while duplicating exactly 1 (verified the
  final placed instance's `rotation`/`mirrored` match the ghost's rotated/
  mirrored pose exactly, not just the ghost's transient state).

- **Interior doors + door-based reachability (§2i):** verified (via state/geometry
  dumps — screenshot tooling stayed unreliable in this env) that two adjacent
  rooms produce a TOUCH edge with no door and gain an ACCESS edge only when
  doored; an entrance-rooted room reaches green through a door while a touching-
  but-undoored neighbour flags H1, and the DR1 note appears on a doorless
  dwelling; the opening is cut in BOTH wall segments (room↔room, and the cluster
  side of a room↔cluster boundary — min-Y 2.1 at doored cells, full-height
  elsewhere); the opening stays fixed at 2100 mm while the header grows on a
  forced 4.0 m floor (window inversion, distinct from windows); a stair with
  doors at BOTH ends carries an upper room to green (bottom + top `viaStair`
  access edges), and removing the top door orphans the upper room (H1) and flags
  ST1; a corridor's C1/C2 degree counts DOOR connections (undoored → C1 orphaned,
  one door → C2); H4 fires on touch regardless of doors; 2-edge minimum + exterior
  rejection enforced by `resolveDoorSpaces`; a rotated+mirrored room hosts doors
  (absolute edge-bound); moving a room away auto-removes its door in the same
  snapshot and one undo restores move + door; markers render violet on the slab
  (plan-readable, pickable) and deleting a door re-closes exactly its own opening;
  round-trip with doors is faithful and an old doorless file loads doorless.
- **Doors — adversarial review + interaction fixes (§2i):** a multi-agent review
  caught 5 confirmed INTERACTION-layer defects the API-level tests missed (they
  exercise the store/graph, not real pointer events): (1) a boundary could hold
  two doors placed from opposite sides, and (2) two collinear doors could merge
  into an 1800 mm opening — both now rejected by `doorOverlaps` (physical-edge
  dedup; verified opposite-side + collinear + disjoint cases via `addDoor`); (3)
  door markers were unselectable because module picking ran first — fixed by
  picking markers before modules (verified: door selected with a module under the
  cursor); (4) `SelectionController` acted during door/entrance placement, grabbing
  the room under a door click — fixed with an `isToolActive` guard (verified: no
  module selected while the tool is armed); (5) two placement modes could be armed
  at once so one release drove both — fixed with `cancelPlacementModes` (verified
  it disarms door + entrance). The pointer-flow fixes were verified by stubbing the
  private pick sources, since this headless preview's canvas has zero size and
  can't raycast real screen coordinates.
- **`connectionEdges` retired (§2i):** removed from `modules.ts` (one-line
  historical note kept); `tsc`/build clean with it gone.
- **Rules batch ④ — accessibility width + escape distance (post-doors, §8):**
  verified via synthetic-graph dumps through `validate`/`accessDepths` (canvas is
  0×0, so real raycasting stays unavailable). **A1** (accessible width, 2×2
  morphological test per circulation cluster): a straight 1-wide 4-cell corridor
  flags all 4 cells; a 2×4 corridor passes (0 narrow); a **1-wide L flags all 5
  cells including the corner** (neighboured on two axes but never in a full 2×2
  square); a 2×3 hall with a 1-wide spur flags **only the 2 spur cells**. **F1**
  (far from exit, seeds = entrances + stairs, `ESCAPE_DEPTH_MAX = 4`): on a
  r0(entry)…r6 chain with no stair, r5/r6 (entrance-depth 5/6) flag; doring a
  stair near the deep end drops their exit-distance to 0 and clears F1 (stairs ARE
  seeds); a room **6 hops from the entrance but 2 from a stair stays silent**
  (the spec's divergence case); F1 is gated off with no entrance; no crash with no
  circulation or no stairs. `accessDepths` factored out of `computeEntranceDepths`
  (identical entrance-depth behaviour preserved). Rule count 33 → 35.
- **Rules-additions batch ③ (post-doors, §8):** verified via state dumps —
  **N1** circulation fraction reads 4.3% on a normal layout (unchanged when an
  outdoor balcony is added — excluded both sides) and 64% on a corridor-palace,
  firing the soft flag past 25% (percentages sanity-checked: 2/47, 16/25); **PG1**
  fires on an inverted layout (public mean depth 2 > bedroom 1) and stays silent
  on the standard genotype (public 0 ≤ bedroom 2); **MB1** flags a sleeping floor
  with no bathroom, clears when one is added, and stays silent (no double-fire)
  when P1 already owns a bathroom-less flat; **DR2** notes a bedroom at 3 doors
  (silent at 2); **C1 is now soft** (amber, matching O1). Both report info-lines
  render ("Circulation: 5% of interior area", "Public mean depth 2.0 · Bedroom
  mean depth 1.0"). Rule count 29 → 33.
- **Rules-recalibration batch ② (post-doors, §8):** verified via state dumps —
  (1) **H4 is now ACCESS-based** (a DOOR between bathroom↔kitchen fires H4/hard);
  a shared WALL with no door fires the new **S6** (note, efficient services) —
  both directions confirmed, and the two never co-fire on one boundary. (2) **DP1
  stair-hop weighting**: room→stair→room now costs ONE hop (verified stair depth 1,
  upper room depth 1, was 2). (3) **S4 removed** (two touching bedrooms no longer
  flagged); new **AC1** (soft) fires on a bedroom↔stair touch (SIA 181). (5)
  **H3 en-suite exemption**: two en-suites + no guest bath → 2× **S7** (note) + G1
  (soft), ZERO H3; adding a guest bathroom doored to circulation clears G1 and
  leaves S7 only on the en-suites. Rule count 27 → 29. (4) Tier taxonomy added to
  `rules.ts`; consistency-pass finding (C1-vs-O1 tier mismatch) recorded in §8.
- **Rules-correctness batch ① (post-doors, §8):** verified via state dumps —
  (1) **edge classification**: a floor-above room whose only open side faces the
  stairwell hole now has `hasExteriorEdge=false` (was true), D1 flags it, no glass
  generates onto the void, and W1 does NOT double-fire (gated on `hasExteriorEdge`);
  same-floor stair-facing edges were already correct; an entrance can no longer be
  placed on a stair cell and a stair-facing entrance flags E2. Both the window and
  graph occupied sets now source from `buildSpaceTargets`. (2) **blocked-seed**: a
  studio flat with the entrance ON the bedroom fires only G2 (soft) — H3 no longer
  detonates every room (seed exempt from blocking). (3/4) **S1/O1**: an undoored
  outdoor cluster flags O1 (unreachable), clears at 1 door, and flags S1 at >2
  doors — both on access degree, distinct. (5) **S5**: fires only on a DOORED
  kitchen↔living pair, not a sealed touching wall.

**Also built (from earlier sessions, still current):**
- Grid, occupancy, placement, rotate, **mirror**, move, delete; grid resize with reconcile.
- All room presets render as clean hollow shells; concave corners z-fight-free.
- Dynamic cutaway hides camera-facing walls reactively (rooms + clusters).
- Multi-floor stacking, floor tabs, add/delete, per-floor grid size,
  dim/non-interactive inactive floors.
- Circulation & Outdoor merged cluster shells (outer walls only; same-type
  only; split on deletion).
- Kitchen voxel props (counter_run, overhead_cabinet, stove, sink, fridge).
- **Stairs**: 180° dogleg, footprint 2×6, cuts/restores a matching stairwell
  hole in the floor above, auto-creates a floor above when placed on the
  topmost floor, blocked if the floor above has no clear plate.
- **Entrances**: ground-floor door markers bound to an exterior edge,
  re-validated every graph build, root reachability. Selectable + deletable
  (§2f): click to select, Delete to remove; place + delete are undoable.
- **Undo / redo** (§2e): snapshot-based (cap 20), Ctrl+Z / Ctrl+Shift+Z /
  Ctrl+Y + bottom-left buttons; covers place/move/rotate/delete, entrance
  add/delete, floor add/delete, grid resize, import; view state excluded.
- **Whole-dwelling adjacency graph** (all floors; TOUCH + door ACCESS edges) +
  toggleable bubble-diagram view (§2j: all floors as columns, stairs straddling
  their boundary, draggable/pinnable nodes, entry rings, depth badges,
  highlight overlays; ACCESS edges solid vs TOUCH-only dashed, toggleable).
- **Interior doors** (§2i): authored, serialized, door-based reachability;
  2-edge openings cut in both wall segments; plan-view markers; auto-removal.
- **Layout rules engine**: 36 rules (see §8), advisory/on-demand, surfaced in
  a text report, the diagram, and 3D shell/marker tinting.
- **Rule-driven windows** (§2d): derived sill/lintel panels + glazing on
  exterior edges, per-type ratio targets, W1 shortfall rule.
- **Save / load**: whole-project JSON export/import, drag-and-drop, tolerant/
  versioned parsing.
- **Multi-select & group ops** (§2h): Shift-click multi-select (active floor
  only, entrances excluded), group move (self-exclusion, one snapshot), group
  delete (one snapshot), R/M single-selection-only with a no-op hint,
  Shift+D duplicate of the WHOLE selection (any count — `store.placeMany`),
  hover cue, a single Escape-priority arbitrator, a shortcuts legend, and a
  selection readout.

**Not built:**
- Furniture for rooms other than Kitchen — all other rooms are empty shells
  (Kitchen + Bathroom/Bedroom/Living/Recreation are furnished, §2l; Circulation/
  Outdoor connectors stay empty shells — no `PROP_BUILDERS` entry.)
- 1-edge (narrow) doors — v1 doors are fixed at a 2-edge (1200 mm) span.
- Group re-pose (rotate/mirror a multi-selection) — still out of scope (§7).

**Known minor issue (deferred):** connector pieces are selected by clicking
their floor tile; their merged cluster walls live in a shared `clusterGroup`
and are not individually pickable — clicking a cluster wall doesn't select a
specific piece.

**Committed in this change** (interior doors §2i + rules batches ①/②/③ §8): new
`src/core/door.ts`, `src/scene/doorView.ts`, `src/interaction/doorController.ts`;
modified `PROJECT_STATE.md`, `src/core/floor.ts`, `src/core/floorManager.ts`,
`src/core/modules.ts`, `src/core/projectIO.ts`, `src/core/adjacencyGraph.ts`,
`src/core/rules.ts`, `src/scene/moduleMesh.ts`, `src/scene/clusterShells.ts`,
`src/interaction/picker.ts`, `src/interaction/selection.ts`,
`src/interaction/entranceController.ts`, `src/ui/palette.ts`,
`src/ui/graphView.ts`, `src/ui/validationPanel.ts`, `src/style.css`,
`src/main.ts`. Run `git status`/`git log` to confirm.
(The mirroring + multi-select/group-ops/UI-polish features are committed as
`30bf5dd`.) Run `git status` to confirm before assuming this list is current.

---

## 7. Future extension points (scaffolding already in place)

- **Door-based adjacency: DONE** (§2i) — authored doors drive `GraphEdge.viaDoor`
  ACCESS edges; the `ConnectionEdge` scaffolding it was reserved for is removed.
  Remaining door extensions: variable-width (1-edge / wider) doors — v1 is fixed
  at a 2-edge span; and door swing/handedness metadata (doors are undirected
  openings now). Doors are absolute edge-bound, so they inherit mirror/rotation
  for free (they don't store per-side data on the def).
- **Facade/window placement:** reuse `exteriorEdges()` (already the shared
  primitive for entrance placement, entrance validity, and D1/D2) to place
  windows/doors on a room's exterior edges.
- **Furnishing rooms: DONE for all room types** (§2l) — Kitchen + Bathroom/
  Bedroom/Living/Recreation have `PROP_BUILDERS` layouts; only Circulation/
  Outdoor connectors are unfurnished (empty shells, by design). Remaining prop
  work: (a) **door-aware prop placement** — props are static baselines and a
  fixture may sit in front of a later-placed door (or a window); placement
  ignores authored doors/windows today. (b) A **translucent prop material layer**
  so glass fixtures (shower panels) can reuse the real glazing material instead
  of a solid glass-tint colour. (c) SIA 500 swing-clearance checks against props
  (see Track B's future note). (d) Slimming the solid baseline props (hollow
  shells) if instance count matters.
- **Cluster-wall selection friction** (see §6) — make cluster walls map back
  to a piece if desired.
- **Space-syntax depth metric** (`computeEntranceDepths`) is deliberately
  decoupled from the violation list — kept as a standalone reusable function
  in case future analysis wants the raw per-room hop counts.
- **Group re-pose** (§2h): rotating/mirroring a multi-selection as a rigid unit
  about a common centre was explicitly scoped OUT for v1 (R/M require exactly
  one selected instance). `ModuleStore.moveMany` only ever touches `origin` by
  design (never `rotation`/`mirrored`), so this would need a new method, not
  an extension of the existing one.
- **Marquee (rubber-band) selection** (§2h): skipped because plain left-drag on
  empty ground is already the camera-orbit gesture; a Shift+drag-on-empty-
  ground variant (shift is currently unbound for drags, only for clicks) would
  sidestep the conflict and is the natural next step if marquee is wanted.

**Future-gated rule / analysis proposals** (surfaced during the batch-④ review;
recorded so they survive context loss — NO code exists for these yet):
- **Orientation-dependent daylight: DONE** (§2k) — the north concept now exists
  (`orientation.ts` + project `northAngle`); OR1 flags north-only-lit rooms and
  the generator biases glazing south. Remaining orientation extensions: a fuller
  daylight-QUALITY model (per-sector solar-gain scoring, seasonal angles) beyond
  OR1's single north/not-north heuristic.
- **Full egress analysis** — F1 is honestly just topological hops; real fire
  egress wants a SECOND independent escape route per room and METRIC travel
  distance (~35 m class), not one BFS to the nearest exit.
- **SV1 — structural stacking** — flag upper-floor cells cantilevered beyond the
  floor below (no load path down); needs a cross-floor footprint-overlap check.

---

## 8. Layout rules — current table (`src/core/rules.ts`)

All rules are **advisory** (never block placement), run on-demand via
"Check Layout", and read the whole-dwelling graph (§2c/§3). This table must match
`RULES` in `rules.ts` exactly — if you add/remove/reword a rule, update this table
in the same change.

**Tier taxonomy** (the definitive meaning of each severity, at the top of
`rules.ts` — classify new rules by it): 🔴 **hard** = renders the dwelling
uninhabitable or violates near-universal code (expert failure modes, program
completeness, daylight physics, direct hygiene access); 🟡 **soft** = deviates
from empirical practice or comfort norms (House-GAN frequency data, SIA comfort/
acoustic practice); 🟢 **note** = characterization, not judgment (a recognised
typology — open-plan, en-suite, efficient services).

**Entrance validity**
| ID | Severity | Description |
|---|---|---|
| E1 | 🟢 note | Place an entrance to validate circulation/reachability. |
| E2 | 🔴 hard | Entrance is blocked — its edge no longer faces outside. |

**Doors (reachability prerequisite — the door-based cutover)**
| ID | Severity | Description |
|---|---|---|
| DR1 | 🟢 note | No doors placed — reachability requires doors. (Fires only when rooms exist but `doorCount === 0`; explains the H1 flood on a doorless dwelling, shown ALONGSIDE the real flags.) |
| DR2 | 🟢 note | Bedroom has ≥3 doors (access edges) — unusual for a private room (erodes furnishability/privacy). |

**Program completeness**
| ID | Severity | Description |
|---|---|---|
| P1 | 🔴 hard | A dwelling needs a bathroom. |
| P2 | 🔴 hard | A dwelling needs a kitchen. |
| P3 | 🟢 note | More than one kitchen — atypical, but not a problem. |
| MB1 | 🟡 soft | A floor has bedrooms but no bathroom (nighttime stair trip). GATED on P1 silent (a bathroom exists somewhere) — never double-fires with P1 on a bathroom-less flat. Per-floor. |

**Reachability** (entrance-rooted, whole dwelling, DOOR-BASED — traverses ACCESS/`viaDoor` edges only, across door-gated stairs; corridors NOT required). The blocked-BFS family (H2/H3/H6/G1) EXEMPTS the seed/root node from blocking — you enter *through* the host by definition, so an entrance ON a bedroom/bathroom/outdoor space doesn't detonate every room; G2 is the gentle signal for that typology.
| ID | Severity | Description |
|---|---|---|
| H1 | 🔴 hard | Orphaned room — no path of DOORS (including door-gated stairs) reaches an entrance. |
| H2 | 🔴 hard | A room or stair reachable from an entrance only by passing through a bathroom (host bathroom exempt). |
| H3 | 🔴 hard | A room or stair reachable from an entrance only by passing through a bedroom (host bedroom exempt). BATHROOM targets are ALSO exempt — that's the en-suite typology → S7, not a failure; H3 still fires for other rooms + stairs. |
| H6 | 🔴 hard | A room or stair reachable from an entrance only by passing through an outdoor space (host exempt). |
| ST2 | 🔴 hard | Stair not reachable from any entrance (via doors). |

*(H5 does not exist — ids are not contiguous; do not add one without a reason.)*

**Adjacency / privacy** (H4 reads the door ACCESS edge — hygiene is about access, not masonry; S3 reads PHYSICAL touch; S5/S6/S7 are typology NOTES; G1 door-based reachability; G2 entrance-host)
| ID | Severity | Description |
|---|---|---|
| H4 | 🔴 hard | Direct DOOR between a bathroom and a kitchen — food prep opening onto a toilet. (Was touch-based; a shared WALL is now the positive S6.) |
| S6 | 🟢 note | Shared wet wall between kitchen and bathroom (touch, no door) — efficient services / stacked plumbing. Excludes any H4-doored pair. |
| S3 | 🟡 soft | Bedroom directly adjacent to a kitchen, living room, or recreation room (physical touch). |
| S5 | 🟢 note | Kitchen and living room connected by a DOOR — open-plan; noted, not a problem. (A sealed touching wall earns no note.) |
| S7 | 🟢 note | En-suite bathroom (accessed via bedroom) — the typology H3 exempts; acknowledged, not flagged. |
| G1 | 🟡 soft | No bathroom is reachable without passing through a bedroom (guest access). |
| G2 | 🟡 soft | Entrance opens directly into a private room (bedroom or bathroom). |
| AC1 | 🟡 soft | Bedroom shares a wall (touch) with a stair — stair noise against a sleeping room (SIA 181). Scoped to stairs only (bedroom↔public is S3). Replaces the old ungrounded S4 (two bedrooms touching). |

**Corridor justification** (circulation clusters; degree counts DOOR connections)
| ID | Severity | Description |
|---|---|---|
| C1 | 🟡 soft | Orphaned corridor — connects to nothing via doors (dead space). SOFT (was hard) — matches O1, the identical degree-0-cluster condition; dead space is a design flaw, not uninhabitability. |
| C2 | 🟡 soft | Under-used corridor — reached by only one door, so it doesn't circulate. |
| A1 | 🟡 soft | Circulation narrower than 1.2 m (below accessible width, SIA 500). Per circulation cluster: a cell is accessible-width iff it lies in ≥1 **2×2 block of cells fully inside the same cluster** (`narrowWidthCells`); a cluster with ≥1 narrow cell flags (message includes the narrow-cell count). A 1-wide corridor flags every cell (L-corners included — neighboured on two axes but never in a full 2×2 square); a 2-wide corridor passes; a wide hall with a 1-wide spur flags only the spur. Resolves the doors-are-1200mm-but-corridors-could-be-600mm contradiction. Circulation clusters only. |

**Stairs**
| ID | Severity | Description |
|---|---|---|
| ST1 | 🟡 soft | Stair has no DOOR connection on one or both floors it should link (top/bottom). |
| ST2 | 🔴 hard | (see Reachability above) |

**Daylight / ventilation / glazing / orientation** (D1/D2 reuse `GraphNode.hasExteriorEdge`, §2c; W1/OR1 reuse `GraphNode.glazing`, §2d/§2k)
| ID | Severity | Description |
|---|---|---|
| D1 | 🔴 hard | Habitable room (bedroom, living room, or recreation room) has no exterior wall. |
| D2 | 🟡 soft | Kitchen has no exterior wall. |
| W1 | 🟡 soft | Room's glazing is below its daylight target (too little glazing on the exterior walls it HAS). GATED on `hasExteriorEdge` — a room with no exterior wall is D1/D2's (avoids a double-flag on the same void-facing room). |
| OR1 | 🟡 soft | Habitable room or kitchen is lit ONLY from the north (every windowed edge within `NORTH_SECTOR_HALF_WIDTH` = 45° of due north under the project north). Reads `glazing.northLit`, TRUE only when glazing EXISTS and is all-north — so a NO-glazing room can't fire it (D1/W1 own that; no double-fire). Heuristic (solar-access practice at this latitude), not code. §2k. |

**Room-count / connectivity balance** (S1/S2 count ACCESS/door degree — a *connected* hub; House-GAN anchors were proximity-based, so approximate under door semantics)
| ID | Severity | Description |
|---|---|---|
| S1 | 🟡 soft | Outdoor/balcony over-connected (>2 doors) — usually a leaf space. |
| S2 | 🟡 soft | Living room under-connected (≤1 door) — typically a social hub. |
| O1 | 🟡 soft | Outdoor space is unreachable — no door connects it to the dwelling (the outdoor analogue of C1; distinct from S1's over-connection). |

**Space-syntax depth + efficiency metrics** (informational lines in the report; `computeEntranceDepths` / `computeCirculationFraction` / `computeCirculationFractionByFloor` / `publicVsBedroomDepth` in rules.ts, §3)
| ID | Severity | Description |
|---|---|---|
| DP1 | 🟡 soft | Room is unusually deep in the layout (≥`DEEP_ROOM_THRESHOLD_HOPS` = 5 hops from the entrance). |
| N1 | 🟡 soft | Circulation-heavy layout — circulation fraction > `CIRCULATION_FRACTION_MAX` = 0.25, checked WHOLE-DWELLING and, independently, PER FLOOR on a multi-floor dwelling (different granularity — a floor can trip its own flag while diluted under the whole-dwelling average, or vice versa; both may fire together). Fraction = (circulation-cluster + stair-footprint cells) ÷ all occupied cells, OUTDOOR excluded from BOTH sides. Per-floor is SUPPRESSED on a single-floor dwelling (would duplicate the whole-dwelling figure). The %(s) are ALSO surfaced as always-on report lines ("Circulation: N% of interior area", plus "Floor 0: N% · Floor 1: N%" once there's more than one floor). |
| PG1 | 🟡 soft | Inverted privacy gradient — mean depth of PUBLIC rooms (Living/Recreation) exceeds mean depth of BEDROOMS (bedrooms shallower than social rooms). Silent if either set is empty; gated on an entrance. Both means are surfaced as a report line ("Public mean depth X · Bedroom mean depth Y"). Hillier & Hanson genotype. |

**Egress — travel distance to an exit**
| ID | Severity | Description |
|---|---|---|
| F1 | 🟡 soft | Room is far from any exit (> `ESCAPE_DEPTH_MAX` = 4 hops from the nearest entrance OR stair). Multi-source 0-1 BFS over ACCESS edges (`accessDepths`), seeded at every entrance host AND every stair (a stair is vertical egress), reusing the shared stair-hop weighting; gated on an entrance. HONESTLY SIMPLIFIED — a topological hop count, NOT metric distance; full egress (second escape routes, ~35 m travel distance) is future-gated (§7). OVERLAPS DP1 deliberately: same numeric ceiling, different seed sets (F1 = entrances+stairs/egress; DP1 = entrances only/livability) — they correlate on single-floor dwellings and diverge on multi-floor (an upper room is deep from the entrance yet near its stair), which is F1's value. |

**Depth STAIR-HOP weighting** (`accessDepths`, which `computeEntranceDepths` now
wraps by seeding at the entrance set — F1 wraps it seeding at entrances + stairs):
a stair is a graph NODE, so a naïve BFS makes a floor transition room→stair→room
cost TWO hops and drifts upper rooms toward the DP1/F1 thresholds by merely
existing. A floor transition should cost ONE hop, so ENTERING a stair costs 1 and
LEAVING one costs 0 — a 0-1 BFS over a deque (0-cost relaxations to the front).
`DEEP_ROOM_THRESHOLD_HOPS = 5` / `ESCAPE_DEPTH_MAX = 4` are UNCHANGED; this
restores their single-floor meaning across floors. Verified: room→stair→room = +1
hop (was +2); depth badges / the report's depth section shift on multi-floor
layouts, intended.

Recreation Room is classified as **public/social** (`ctx.is.public`, same
category as Living Room) for the privacy rules, and as **habitable**
(`ctx.is.habitable`, same category as Bedroom + Living Room) for D1.

**Consistency-pass finding — RESOLVED (batch ③):** C1 (orphaned corridor) was
🔴 hard while O1 (unreachable outdoor) is 🟡 soft, though both flag the identical
degree-0-cluster condition. **C1 is now 🟡 soft** — dead space is a design flaw,
not uninhabitability — so the two are consistent.

**Report info-lines** (`validationPanel.ts`, computed from the graph like the
depth summary, always shown when available): "Circulation: N% of interior area"
(N1's metric, `.vp-metric`), immediately followed by a per-floor breakdown line
("Floor 0: N% · Floor 1: N%", `computeCirculationFractionByFloor` — see §2d's
N1 rider) once the dwelling has more than one floor; a "Glazing orientation"
section listing each windowed room's compass sectors ("Living Room: glazing S +
E", `appendOrientation`, from `node.glazing.sectors` under the project north —
OR1 reads the same data, §2k); and "Public mean depth X · Bedroom mean depth Y"
(PG1's metric, in the depth section). All surface the raw figure whether or not
the corresponding soft rule fires.
