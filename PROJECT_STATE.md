# PROJECT_STATE.md

Reference doc for reorienting after context loss. Reflects the actual code in
the working tree on `main` (last commit `d191020`, plus this session's
uncommitted mirroring feature and multi-select/group-ops/UI-polish feature —
see §6 for the running list of what's still uncommitted). Reference-style, not
prose. **Read the cited files to confirm before relying on any detail.**

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
interiors are visible. A whole-dwelling adjacency graph (rooms/clusters/stairs
as nodes, touch + cross-floor stair edges) feeds an advisory, on-demand layout
rules engine and a toggleable bubble-diagram view. Projects save/load to JSON.
It is a work-in-progress research artifact, not a production app.

---

## 2. Core architecture — systems and the files that own them

| System | Owner file(s) | Notes |
|---|---|---|
| Grid + occupancy + coordinate conversion | `src/core/grid.ts` | `Grid` class: dims, occupancy `Map<"cx,cz", instanceId>`, `holeCells` (stairwell voids), `gridToWorld`/`worldToGrid` (grid centred on world origin), `canPlace(cells, exclude?: string \| Set<string>)` (a Set excludes every id in it at once — the group-move self-exclusion primitive, §2h), `plateAvailable`/`occupy`/`free`/`setHoles`/`ownerAt`/`inBounds`/`resize`. `CELL_SIZE = 0.6`. |
| Room / module / stair definitions + **THE central footprint transform** | `src/core/modules.ts` | `MODULE_DEFS` registry, `ModuleDef` (`category: "module" \| "room" \| "stair"`), `lShape()`/`rect()` footprint helpers, `ROOM_HEIGHT = 4`. Transform: `rotateCell`/`mirrorCell`/**`transformCell`**/`rotatedCells`/`occupiedCells` — **mirror THEN rotate**, see §2g. `MODULE_LIST` (furniture), `ROOM_LIST`, `STAIR_LIST`. |
| Placed-instance store (place/move/rotate/**mirror**/delete, **group ops**) | `src/core/store.ts` | `ModuleStore`: single source mutating occupancy + scene together. `instances: Map<id, ModuleInstance>` (each carries `mirrored: boolean`), `onChange` hook, `extraPlacementCheck?` (cross-floor stair rule, set by FloorManager), `canPlaceInstance(def, cells, excludeId?: string \| Set<string>)`, `place(type,origin,rotation,mirrored)`, `move(id,origin,rotation,mirrored?)` (rebuilds the mesh when rotation OR mirror changes), `rotate(id)`/`mirror(id)` (both pivot on the origin cell, both collision-checked), `reconcileAfterResize`, `maxRoomHeightCells`. **Group ops** (§2h): `moveMany(moves)` (atomic rigid move, all-or-nothing, self-exclusion via a Set, never rebuilds meshes since rotation/mirror are untouched), `removeMany(ids)` (single `onChange`), `placeMany(items)` (atomic batch place — new ids, no exclusion needed — used by group duplicate). |
| Mesh building: solid cubes, **room shells**, connector tiles, **concave-corner wall logic**, **window panel-kit + glazing** | `src/scene/moduleMesh.ts` | `buildModuleMesh()` routes: `category==="stair"` → `buildStairGroup` (stairMesh.ts); connector → tile; room → `buildRoomShell` (hollow open-top shell, walls built directly at the floor's true height — see §2b); else solid cubes. `buildBoundaryWalls()` is the shared clean-corner wall generator (exported; reused by clusters), and — given a per-edge `windows` map — replaces a windowed edge's solid segment with sill/lintel panels + a glazing pane (see §2d). `rebuildRoomWalls()` rebuilds just a room's wall+glazing meshes in place when height or windows change. `makeGlassMaterial()`, `setSelected()`, `setHovered(group, hovered, selected)` (subtler emissive intensity 0.15 vs selection's 0.35; no-ops when `selected` or when a rules-violation tint owns the material — §2h). `WALL_T = 0.1`, `FLOOR_H = 0.15`. |
| **Rule-driven window generator** (derived, per room) | `src/core/windows.ts` | `computeWindows(cells, roomTypeId, floorHeight, occupied, entranceEdgeKeys) → WindowPlan`. Pure computation (no Three.js). `WINDOW_CONFIG` per-type table (target ratio + variant). See §2d. |
| **Stair geometry** (180° dogleg, two floors) | `src/scene/stairMesh.ts` | `buildStairGroup(def, rotation, ghost, mirrored)`. See §2a; mirroring negates the lane x-centres only (winding-safe, §2g). |
| Dynamic dollhouse **cutaway** | `src/scene/cutaway.ts` | `updateCutaway()` hides wall meshes whose `userData.wallNormal · viewDir > THRESHOLD (0.12)`; throttled (recompute on camera move or `markCutawayDirty()`). Unaffected by the §2b wall-height mechanism (walls are rebuilt, not scaled — `wallNormal` tags are untouched either way) or the top view (a straight-down `viewDir` dots to ~0 against every wall normal, which are always in the XZ plane — every wall stays visible, reading correctly as a plan). |
| **Multi-floor** support, stacking, **wall/stair height reconciliation**, **window generation**, **floor visibility**, **zoom-to-extent box** | `src/core/floor.ts`, `src/core/floorManager.ts` | See §2b (height), §2d (windows), §5 (visibility/framing). `Floor` = own grid + `ModuleStore` + `GridView` + `HoleView` + `EntranceView` + `entrances[]` + `windowStats` + `clusterGroup`, all under one `group`. `FloorManager`: stack, active floor, vertical stacking offsets, dim inactive floors, stairwell holes, `rebuildWalls()` (walls + windows), floor visibility, content bounding box. `DEFAULT_FLOOR_CELLS = 4`, `CLEARANCE_CELLS = 1`. |
| Grid dots / floor visual | `src/scene/gridView.ts` | Intersection dots + border; `setDimmed`. |
| Stairwell **hole** rendering | `src/scene/holeView.ts` | `HoleView`: recessed dark panel + outline per stairwell opening (merged per connected component). Purely visual; occupancy blocking is `Grid.holeCells`. |
| Ground-floor **entrance** marker rendering | `src/scene/entranceView.ts` | `EntranceView`: renders `Floor.entrances` as door markers on exterior edges; meshes tagged `userData.entranceId` for highlight lookup. |
| **Entrance placement** interaction | `src/interaction/entranceController.ts`, `src/core/entrance.ts` | `EntranceController`: ghost preview + click-to-place (ground floor only). `isActive` getter + public `cancel()` — Escape is arbitrated centrally by main.ts (§2h), not handled internally here. `Entrance { id, cell, side }`. Entrances are also SELECTABLE/DELETABLE (via `SelectionController`, see §2f) but explicitly EXCLUDED from multi-select/group ops (§2h): click a marker to select, Delete to remove. `Floor.removeEntrance(id)`; `EntranceView.markers`/`setSelectedId`. |
| **Undo / redo history** (snapshot-based) | `src/core/history.ts` | `History`: undo/redo stacks of serialized-project snapshots (cap 20), commit-after-action model, restore via the import rebuild path. See §2f. |
| **Exterior-edge detection** (reusable) | `src/core/exteriorEdges.ts` | `exteriorEdges(cells, occupied) → BoundaryEdge[]`. Standalone/generic: consumed by entrance placement/validity, the daylight rules (D1/D2 via `GraphNode.hasExteriorEdge`), and reserved for a future facade/window task. |
| **Circulation / Outdoor cluster merging** | `src/scene/clusterShells.ts` (+ `src/core/cluster.ts`) | `rebuildClusterShells()` groups connector cells by `def.cluster`, flood-fills connected components (`connectedComponents`), draws ONE merged boundary shell per cluster (outer walls only) via `buildBoundaryWalls`. |
| **Voxel furniture prop** system | `src/scene/props/*` | `voxelProp.ts` (format + library), `place.ts` (transform/tiling/clip/wall-clip + merged `InstancedMesh`; `buildPropsMesh(..., mirror)` negates emitted voxel x + mirrors the clip footprint, §2g), `kitchen.ts` (Kitchen layout, takes `mirrored`), `index.ts` (`PROP_BUILDERS: Record<string, (mirrored: boolean) => Group>`). Data in `src/scene/props/data/*.json`. |
| **Whole-dwelling adjacency graph** (rules + bubble-diagram data) | `src/core/adjacencyGraph.ts` | `computeDwellingGraph(floors) → DwellingGraph`. See §2c. |
| **Layout rules engine** (advisory, on-demand) | `src/core/rules.ts` | `RULES: Rule[]`, `validate(graph)`, `computeEntranceDepths(graph)`. See §8 for the full current rule table. |
| Rules-violation **3D highlighting** | `src/scene/highlight.ts` | `applyRoomHighlights(floors, violations)` / `clearRoomHighlights(floors)`: emissive tint on implicated room/cluster/stair shells + entrance markers, across ALL floors, resolved via `parseDwellingNodeId`. |
| Bubble-diagram **view** | `src/ui/graphView.ts` | Toggleable full-screen 2D force-directed node-edge diagram of the DwellingGraph; entry-node rings, cross-floor stair stubs, depth badges, highlight/depth overlays. |
| Validation report panel | `src/ui/validationPanel.ts` | `renderValidationPanel()`: grouped hard/soft/note issue list + the entrance-depth metric summary. |
| **Project save / load** | `src/core/projectIO.ts` | `serializeProject(floors) → ProjectFile`, `parseProject(text) → ParsedProject` (tolerant/versioned). See §3. Camera state and floor visibility are deliberately excluded (view state, not design state). |
| Sidebar palette / grid-size / floor tabs / floor-visibility toggles | `src/ui/palette.ts` | Rebuilt on floor-state change. |
| Scene/camera/lights, **zoom-to-extent framing** | `src/scene/sceneSetup.ts` | Orthographic camera, `frameBox(box, direction)`. See §5. |
| Interaction | `src/interaction/picker.ts`, `dragDrop.ts`, `selection.ts` | Raycast picking (scoped to the ACTIVE floor's store only — this is also why floor visibility needs no picker-side filtering, see §5), palette→canvas placement, select/**multi-select**/move/**group-move**/rotate/**mirror**/delete/**group-delete**/**Shift+D-duplicate** (any count) of modules, plus entrance select/delete. `R`/`M` work on the palette ghost, the move ghost, the duplicate ghost, and a SINGLE selected instance — no-op on 2+ (§2h). `dragDrop.cancelPlacement()`/`selection.cancelDuplicate()`/`entranceController.cancel()` are public, no-argument, and NOT wired to their own Escape listeners — Escape is arbitrated centrally by main.ts (§2h). `dragDrop`/`selection` take an `onAfterAction` callback (fires after a committed mutation → undo snapshot, see §2f); `selection` also takes `onSelectionChange`/`onNoopHint` callbacks and an `EntranceSelectionAdapter`. |
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

**Stairs are graph nodes** (`kind: "stair"`), not a same-floor-to-next-floor
shortcut: a stair gets ordinary same-floor ("bottom") edges from the generic
touch-edge pass (whatever touches its footprint on its own floor) PLUS
`viaStair: true` ("top") edges to whatever touches its footprint projected
onto the floor above. A room on floor N reaching a room on floor N+1 routes
THROUGH the stair node (one extra hop vs. the old direct-shortcut model) —
same reachable set, but the stair itself becomes inspectable (ST1/ST2).

Entrances are floor-0-only, RE-VALIDATED on every graph build (not cached):
`EntranceStatus.blocked` is true if the host cell no longer resolves to a
room/cluster, or the edge is no longer exterior (via `exteriorEdges` against
the floor's full occupied-cell set) — so a room built later against an
existing entrance's edge correctly invalidates it. `entryIds` = every
non-blocked entrance's host node id (multiple entrances allowed; "any one
entrance reaches it" is sufficient for reachability, see rules.ts's doc
comment).

`GraphNode.hasExteriorEdge` is computed once per floor (post-pass, reusing
`exteriorEdges` against the floor's full occupied set) and consumed by the
daylight rules (D1/D2) rather than recomputed per-rule.

`GraphNode.glazing?: GlazingStat` (rooms only) carries the derived window
generator's achieved-vs-target glazing, read from `floor.windowStats` (§2d) —
consumed by the W1 rule rather than recomputing windows.

### 2d. Rule-driven windows (`windows.ts`, exterior edges only)

Windows are **DERIVED, never stored** — regenerated from room type + exterior
edges on every wall rebuild, exactly like cluster shells and stair holes.
Nothing new is serialized; export/import reproduces identical windows because
they're a pure function of placement (verified by round-trip). **Exterior
edges only** — interior walls stay full solid; doors / interior openings are a
deliberate LATER task.

**Generator** (`computeWindows(cells, roomTypeId, floorHeight, occupied,
entranceEdgeKeys) → WindowPlan`, pure, no Three.js):
- Per-type policy in `WINDOW_CONFIG` (tunable): Living/Recreation → ratio 1/6,
  full-height; Bedroom S/L → 1/10, framed; Kitchen → fixed one 2-edge band,
  framed; Bathroom/Circulation/Outdoor (absent from the table) → none.
- Targets a glazing-AREA ratio of the room's floor area (floorArea =
  cellCount × 0.36 m²). Per-edge glazing = 0.6 × (floorHeight − 0.9)
  full-height, or 0.6 × (floorHeight − 1.8) framed. `edgesNeeded =
  ceil(area × ratio ÷ perEdge)`.
- **2-edge minimum (1200 mm), enforced — no 1-edge windows ever**: a computed
  1 rounds up to 2; a "need exactly 1 more" is absorbed by extending/overshoot
  so a 1-edge band is never emitted.
- **Edge selection**: exterior edges (`exteriorEdges`, minus any coinciding
  with an entrance — a door wins that edge) grouped into continuous straight
  same-side runs (`buildRuns` — a run never turns a corner, so bands don't
  wrap corners). Longest run first; band centred on the run and grown to the
  remaining need (still ≥2), then the next-longest run. Insufficient exterior
  supply → glaze what's possible; the shortfall is flagged by W1, not forced.
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

**Integration**: `FloorManager.rebuildWalls()` computes the floor's occupied set
(rooms + clusters + stairs) and floor-0 entrance edges, then per room calls
`computeWindows`, converts the ABSOLUTE windowed edges → LOCAL edge keys (abs −
origin; side unchanged since the room group isn't rotated), and passes them into
`rebuildRoomWalls(..., localWindows)`. The achieved-vs-target `GlazingStat` is
stashed on `floor.windowStats` (instanceId → stat) for W1. Windows ride the
existing wall-rebuild pass, so move/rotate/delete of any room regenerates them
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

**Duplicate (Shift+D — NOT Ctrl/Cmd+D)**: clones the WHOLE current selection —
one instance or many — into a fresh placement ghost that follows the cursor.
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

**Deliberately NOT Ctrl/Cmd+D**: that combo is reserved by the browser for
bookmarking on most platforms — the keydown frequently never reaches page JS
at all, so `preventDefault()` cannot override it (confirmed the hard way: it
verified clean under synthetic `dispatchEvent`-based testing, which bypasses
native browser chrome entirely, then failed on a real physical keypress).
Shift+D matches Blender's own "duplicate" convention, fitting alongside this
app's R/M single/shift-key style.

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

interface ConnectionEdge {           // SCAFFOLDING ONLY — unused by any logic
  side: "north" | "south" | "east" | "west";
  allowed: boolean;
}

interface ModuleDef {
  type: ModuleType;
  name: string;
  description: string;
  category: Category;
  group?: string;          // UI grouping label, e.g. "Circulation"
  color: number;           // hex int (also used as room-type colour everywhere)
  cells: Cell[];           // footprint relative to origin (0,0) at rotation 0
  height: number;          // in cells: furniture = 1, rooms = ROOM_HEIGHT (4), stair = 1 (nominal — see §2a)
  connectionEdges?: ConnectionEdge[];  // scaffolding, unused
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

### Windows (`windows.ts`) — derived, see §2d
```ts
type WindowVariant = "framed" | "full-height";
interface GlazingStat { targetRatio: number; achievedRatio: number; belowTarget: boolean }
interface WindowPlan extends GlazingStat {
  edges: Map<string, WindowVariant>;  // ABSOLUTE windowed edge keys → variant
  variant: WindowVariant | null;
}
function computeWindows(cells, roomTypeId, floorHeight, occupied, entranceEdgeKeys): WindowPlan;
const WINDOW_CONFIG: Record<roomTypeId, { targetRatio; variant; fixedEdges? }>;
// SILL_H = 0.9, LINTEL_H = 0.9, MIN_WINDOW_EDGES = 2 (all absolute metres/edges).
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
  viaDoor?: boolean;      // RESERVED for future door-based adjacency; always undefined now
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
  edges: GraphEdge[];
  entryIds: string[];      // non-blocked entrance host node ids
  entrances: EntranceStatus[];
  floorCount: number;
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
function computeEntranceDepths(graph: DwellingGraph): Map<string, number>; // standalone metric, see §8
const DEEP_ROOM_THRESHOLD_HOPS = 5;
```
`RuleContext` (built once per `validate()` call, `buildContext()`): node/edge
lookups, `degree()`, `is.{circulation,outdoor,bathroom,bedroom,kitchen,living,
recreation,room,stair,roomOrStair,public,habitable}` type predicates,
`entryIds`, `hasEntrance`, `reachableFrom(seeds, blocked?)` (multi-source BFS,
the reachability primitive every H*/G*/ST* rule uses).

### Project file (`projectIO.ts`)
```ts
interface InstanceData { type: string; cx: number; cz: number; rotation: number; mirrored?: boolean }
interface EntranceData { cx: number; cz: number; side: Side }
interface FloorData { cols: number; rows: number; instances: InstanceData[]; entrances: EntranceData[] }
interface ProjectFile { format: string; version: number; floors: FloorData[] }
```
`PROJECT_FORMAT = "flat-configurator-project"`, `APP_PROJECT_VERSION = 1`.
Tolerant/versioned load (`parseProject`); NOT serialized: camera state, active
floor, per-floor visibility (all view state — see §5) — a load always starts
all floors visible at the default axo extent. `mirrored` is an **additive** v1
field (§2g): absent → `false` via `normalizeInstance`, so pre-mirroring files
load unchanged — no version bump, no migration step.

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
- **Touch-based adjacency, not door-based.** Graph edges connect rooms/clusters/stairs whose footprints share a wall (orthogonally adjacent cells). Door/opening-based adjacency is deferred (`viaDoor` reserved).
- **Windows: derived, not stored** (§2d). Regenerated from room type + exterior edges on every wall rebuild (they ride the wall pass), on EXTERIOR edges only. Nothing serialized — export/import reproduces identical windows. Panel/glazing heights are absolute (fixed on taller floors), which is why walls must be true-height geometry (§2b). Doors / interior openings are a deliberate LATER task; where an entrance coincides with a windowed edge the door wins (that edge is skipped).
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
- **Never bind a keyboard shortcut to Ctrl/Cmd+D (or other browser-reserved combos like Ctrl+N/T/W)** — most browsers intercept these before the keydown ever reaches page JS, so `preventDefault()` is powerless; a synthetic-`dispatchEvent` test will falsely pass since it bypasses native browser chrome entirely, but a real keypress silently does nothing (or opens the bookmark dialog). This bit the original Ctrl/Cmd+D duplicate binding — fixed by switching to Shift+D (§2h).
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

---

## 6. Current state — built/verified vs. not

**Built & verified across recent sessions (quantitatively, via temporary debug
hooks — screenshot tooling was unreliable in this dev environment, so
verification leaned on exact geometry/state dumps rather than visual
screenshots):**
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
- **Whole-dwelling adjacency graph** (all floors, cross-floor stair edges) +
  toggleable bubble-diagram view (per-floor, entry rings, stair stubs, depth
  badges, highlight overlays).
- **Layout rules engine**: 25 rules (see §8), advisory/on-demand, surfaced in
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
  (only `kitchen` has a `PROP_BUILDERS` entry).
- Door/opening system — doors and INTERIOR openings are a deliberate later
  task (windows §2d cover exterior edges only; interior walls stay full
  solid). `GraphEdge.viaDoor` and `ModuleDef.connectionEdges` remain reserved
  scaffolding, unread by any logic (the latter now documents the mirror
  east↔west swap it will have to honour — §2g, §7).

**Known minor issue (deferred):** connector pieces are selected by clicking
their floor tile; their merged cluster walls live in a shared `clusterGroup`
and are not individually pickable — clicking a cluster wall doesn't select a
specific piece.

**Uncommitted at time of writing:** the mirroring feature (§2g) AND the
multi-select/group-ops/UI-polish feature (§2h) — modified `PROJECT_STATE.md`,
`index.html`, `src/style.css`, `src/core/adjacencyGraph.ts`,
`src/core/floorManager.ts`, `src/core/grid.ts`, `src/core/modules.ts`,
`src/core/projectIO.ts`, `src/core/store.ts`, `src/interaction/dragDrop.ts`,
`src/interaction/entranceController.ts`, `src/interaction/selection.ts`,
`src/main.ts`, `src/scene/clusterShells.ts`, `src/scene/ghostPreview.ts`,
`src/scene/moduleMesh.ts`, `src/scene/props/index.ts`,
`src/scene/props/kitchen.ts`, `src/scene/props/place.ts`,
`src/scene/stairMesh.ts`; new `src/scene/groupGhostPreview.ts`.
(Everything through undo/redo + entrance deletion is committed as `d191020`.)
Run `git status` to confirm before assuming this list is still current.

---

## 7. Future extension points (scaffolding already in place)

- **Door-based adjacency:** `GraphEdge.viaDoor?: boolean` is reserved; a later
  pass can set it without redesigning the edge model. `ConnectionEdge` on
  `ModuleDef` (per-side, `allowed`, future entry point/span) is scaffolded but
  unused. **When it grows real per-side behaviour it must respect mirroring**
  (§2g): a mirrored instance swaps its `east`/`west` edges (the two sides
  perpendicular to the mirror axis; north/south unchanged), applied BEFORE
  rotation — exactly as the cells transform. This is documented in the
  `ConnectionEdge` doc comment in `modules.ts`; nothing reads it yet.
- **Facade/window placement:** reuse `exteriorEdges()` (already the shared
  primitive for entrance placement, entrance validity, and D1/D2) to place
  windows/doors on a room's exterior edges.
- **Furnishing the remaining rooms:** the prop system is room-agnostic
  (`place.ts` helpers + `PROP_BUILDERS` registry). Add a layout module per
  room type + a registry entry; no engine changes needed.
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

---

## 8. Layout rules — current table (`src/core/rules.ts`)

All rules are **advisory** (never block placement), run on-demand via
"Check Layout", and read the whole-dwelling graph (§2c/§3). Severity: 🔴 hard,
🟡 soft, 🟢 note. This table must match `RULES` in `rules.ts` exactly — if
you add/remove/reword a rule, update this table in the same change.

**Entrance validity**
| ID | Severity | Description |
|---|---|---|
| E1 | 🟢 note | Place an entrance to validate circulation/reachability. |
| E2 | 🔴 hard | Entrance is blocked — its edge no longer faces outside. |

**Program completeness**
| ID | Severity | Description |
|---|---|---|
| P1 | 🔴 hard | A dwelling needs a bathroom. |
| P2 | 🔴 hard | A dwelling needs a kitchen. |
| P3 | 🟢 note | More than one kitchen — atypical, but not a problem. |

**Reachability** (entrance-rooted, whole dwelling, across stairs — corridors NOT required)
| ID | Severity | Description |
|---|---|---|
| H1 | 🔴 hard | Orphaned room — no path of adjacencies (including stairs) reaches an entrance. |
| H2 | 🔴 hard | A room or stair reachable from an entrance only by passing through a bathroom. |
| H3 | 🔴 hard | A room or stair reachable from an entrance only by passing through a bedroom. |
| H6 | 🔴 hard | A room or stair reachable from an entrance only by passing through an outdoor space. |
| ST2 | 🔴 hard | Stair not reachable from any entrance. |

*(H5 does not exist — ids are not contiguous; do not add one without a reason.)*

**Adjacency / privacy**
| ID | Severity | Description |
|---|---|---|
| H4 | 🔴 hard | Bathroom directly adjacent to a kitchen. |
| S3 | 🟡 soft | Bedroom directly adjacent to a kitchen, living room, or recreation room. |
| S4 | 🟡 soft | Two bedrooms directly adjacent. |
| S5 | 🟢 note | Kitchen and living room adjacent — open-plan; noted, not a problem. |
| G1 | 🟡 soft | No bathroom is reachable without passing through a bedroom (guest access). |
| G2 | 🟡 soft | Entrance opens directly into a private room (bedroom or bathroom). |

**Corridor justification** (circulation clusters)
| ID | Severity | Description |
|---|---|---|
| C1 | 🔴 hard | Orphaned corridor — connects to nothing (dead space). |
| C2 | 🟡 soft | Under-used corridor — connects to only one space. |

**Stairs**
| ID | Severity | Description |
|---|---|---|
| ST1 | 🟡 soft | Stair connects to nothing on one or both floors it should link. |
| ST2 | 🔴 hard | (see Reachability above) |

**Daylight / ventilation / glazing** (D1/D2 reuse `GraphNode.hasExteriorEdge`, §2c; W1 reuses `GraphNode.glazing`, §2d)
| ID | Severity | Description |
|---|---|---|
| D1 | 🔴 hard | Habitable room (bedroom, living room, or recreation room) has no exterior wall. |
| D2 | 🟡 soft | Kitchen has no exterior wall. |
| W1 | 🟡 soft | Room's glazing is below its daylight target (incl. zero windows because no ≥2-edge straight exterior run exists). |

**Room-count / connectivity balance**
| ID | Severity | Description |
|---|---|---|
| S1 | 🟡 soft | Outdoor/balcony over-connected (>2 adjacencies) — usually a leaf space. |
| S2 | 🟡 soft | Living room under-connected (≤1 adjacency) — typically a social hub. |

**Space-syntax depth** (informational metric, `computeEntranceDepths`, §3)
| ID | Severity | Description |
|---|---|---|
| DP1 | 🟡 soft | Room is unusually deep in the layout (≥`DEEP_ROOM_THRESHOLD_HOPS` = 5 hops from the entrance). |

Recreation Room is classified as **public/social** (`ctx.is.public`, same
category as Living Room) for the privacy rules, and as **habitable**
(`ctx.is.habitable`, same category as Bedroom + Living Room) for D1.
