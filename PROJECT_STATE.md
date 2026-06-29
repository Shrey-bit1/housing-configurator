# PROJECT_STATE.md

Reference doc for reorienting after context loss. Reflects the actual code as of
commit `07f2626` on `main`. Reference-style, not prose. **Read the cited files to
confirm before relying on any detail.**

> ⚠️ **Accuracy note up front:** There is **no rules / validation system in the
> codebase yet** — no rules table, no `H1–H5`/`S1–S5`, no adjacency validation,
> no advisory feedback. The adjacency graph (§3, §2) is the *foundation* built to
> feed a future rules system, but that system is unimplemented. See §7.

---

## 1. What the project is

A browser-based **3D flat / housing configurator** built with **TypeScript +
Three.js**, bundled with **Vite**. It is a thesis tool: the user places modular
rooms and furniture on a 0.6 m grid, viewed in an axonometric (isometric)
projection, to compose multi-floor flat layouts. Rooms snap to the grid, can be
rotated in 90° increments, moved, and deleted; the app renders rooms as hollow
"dollhouse" shells with a camera-aware cutaway so interiors are visible. It is a
work-in-progress research artifact, not a production app.

---

## 2. Core architecture — systems and the files that own them

| System | Owner file(s) | Notes |
|---|---|---|
| Grid + occupancy + coordinate conversion | `src/core/grid.ts` | `Grid` class: dims, occupancy `Map<"cx,cz", instanceId>`, `gridToWorld`/`worldToGrid` (grid centred on world origin), `canPlace`/`occupy`/`free`/`inBounds`/`resize`. `CELL_SIZE = 0.6`. |
| Room / module definitions (presets, L-shapes) | `src/core/modules.ts` | `MODULE_DEFS` registry, `ModuleDef`, `lShape()`/`rect()` footprint helpers, `rotateCell`/`rotatedCells`/`occupiedCells`, `ROOM_HEIGHT = 4`. |
| Placed-instance store (place/move/rotate/delete) | `src/core/store.ts` | `ModuleStore`: single source mutating occupancy + scene together. `instances: Map<id, ModuleInstance>`, `onChange` hook, `reconcileAfterResize`, `maxRoomHeightCells`. |
| Mesh building: solid cubes, **room shells**, connector tiles, **concave-corner wall logic** | `src/scene/moduleMesh.ts` | `buildModuleMesh()` routes: connector→tile, room→`buildRoomShell` (hollow open-top shell), else solid cubes. `buildBoundaryWalls()` is the shared clean-corner wall generator (exported; reused by clusters). `WALL_T = 0.1`, `FLOOR_H = 0.15`. |
| Dynamic dollhouse **cutaway** | `src/scene/cutaway.ts` | `updateCutaway()` hides wall meshes whose `userData.wallNormal · viewDir > THRESHOLD (0.12)`; throttled (recompute on camera move or `markCutawayDirty()`). |
| **Multi-floor** support | `src/core/floor.ts`, `src/core/floorManager.ts` | `Floor` = own grid + `ModuleStore` + `GridView` + `clusterGroup`, all under one `group`. `FloorManager`: stack, active floor, vertical stacking offsets, dim inactive floors. `DEFAULT_FLOOR_CELLS = 4`, `CLEARANCE_CELLS = 1`. |
| Grid dots / floor visual | `src/scene/gridView.ts` | Intersection dots + border; `setDimmed`. |
| **Circulation / Outdoor cluster merging** | `src/scene/clusterShells.ts` (+ `src/core/cluster.ts`) | `rebuildClusterShells()` groups connector cells by `def.cluster`, flood-fills connected components (`connectedComponents`), draws ONE merged boundary shell per cluster (outer walls only). |
| **Voxel furniture prop** system | `src/scene/props/*` | `voxelProp.ts` (format + library), `place.ts` (transform/tiling/clip/wall-clip + merged `InstancedMesh`), `kitchen.ts` (Kitchen layout), `index.ts` (`PROP_BUILDERS` registry). Data in `src/scene/props/data/*.json`. |
| **Adjacency graph** (bubble-diagram data) | `src/core/adjacencyGraph.ts` | `computeAdjacencyGraph(store)` → `AdjacencyGraph`. Derived, per-floor, touch-based. |
| Bubble-diagram **view** | `src/ui/graphView.ts` | Toggleable full-screen 2D force-directed node-edge diagram. |
| Sidebar palette / grid-size / floor tabs | `src/ui/palette.ts` | Rebuilt on floor-state change. |
| Scene/camera/lights, **Reset View** | `src/scene/sceneSetup.ts` | Orthographic iso camera, `resetView()`. |
| Interaction | `src/interaction/picker.ts`, `dragDrop.ts`, `selection.ts` | Raycast picking, palette→canvas placement, select/move/rotate/delete. |
| Wiring / render loop | `src/main.ts` | Constructs everything; `animate()` renders 3D or drives the graph view. Default grid 16×16. |
| **Rules / validation** | — | **Does not exist.** Future; see §7. |

**Concave-corner wall logic** (Part of `buildBoundaryWalls`): walls are inset to
the INTERIOR side of their boundary line (no protrusion). N/S walls (run in x)
take full length and "own" corner squares; E/W walls (run in z) are trimmed by
one wall thickness at any end where the same cell also has a perpendicular
boundary (convex corner). At concave corners the two walls belong to different
cells and meet edge-to-edge with no overlap. Walls are grouped into ≤4 merged
meshes by outward normal (±x, ±z), each tagged `userData.wallNormal` for cutaway.

---

## 3. Key data structures / formats (written out)

### Cell (`grid.ts`)
```ts
interface Cell { cx: number; cz: number }   // integer grid coords
const CELL_SIZE = 0.6;                       // metres per cell
// gridToWorld: world centre of a cell; grid is centred on world origin.
```

### Room / module definition (`modules.ts`)
```ts
type ModuleType = string;            // id; rooms + furniture share one type-space
type Category = "module" | "room";   // furniture (0.6m cube) vs room preset

interface ConnectionEdge {           // SCAFFOLDING ONLY — unused by any logic
  side: "north" | "south" | "east" | "west";
  allowed: boolean;                  // (future: + entry point / span)
}

interface ModuleDef {
  type: ModuleType;
  name: string;            // display, e.g. "Bedroom — Small"
  description: string;
  category: Category;
  group?: string;          // UI grouping label, e.g. "Circulation"
  color: number;           // hex int (also used as room-type colour everywhere)
  cells: Cell[];           // footprint relative to origin (0,0) at rotation 0
  height: number;          // in cells: furniture = 1, rooms = ROOM_HEIGHT (4)
  connectionEdges?: ConnectionEdge[];  // scaffolding, unused
  cluster?: string;        // "circulation" | "outdoor" for connector merging
}
// ROOM_HEIGHT = 4 cells = 2.4 m.
```
Registry: `MODULE_DEFS: Record<string, ModuleDef>`; lists `MODULE_LIST`
(furniture) and `ROOM_LIST` (rooms). Rotation: `rotateCell((x,z)) -> (-z,x)`
(90° CW); `occupiedCells(def, origin, rotation)` = absolute cells.

### Placed instance (`store.ts`)
```ts
interface ModuleInstance { id; def: ModuleDef; origin: Cell; rotation: number; group: THREE.Group }
// ModuleStore.onChange?: () => void  — fires on place/move/rotate/remove/reconcile.
```

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

### Adjacency graph (`adjacencyGraph.ts`)
```ts
interface GraphNode {
  id: string;            // room instance id, or `cluster:<key>:<min-cell>`
  roomTypeId: string;    // def.type, or cluster key ("circulation"/"outdoor")
  label: string;
  color: number;
  kind: "room" | "cluster";
  cells: Cell[];         // footprint (absolute), used for adjacency
}
interface GraphEdge {
  a: string; b: string;  // node ids
  viaDoor?: boolean;     // RESERVED for future door-based adjacency; always undefined now
}
interface AdjacencyGraph { nodes: GraphNode[]; edges: GraphEdge[] }
```

### Rules table structure
**Not implemented — no such structure exists in the code.** See §7 for the
intended shape and the scaffolding that exists.

---

## 4. Conventions & decisions

- **0.6 m structural cell = 12 voxels @ 5 cm.** Structural grid uses `CELL_SIZE = 0.6`; authored props use `VOXEL_SIZE = 0.05`, so `VOXELS_PER_CELL = 12`.
- **One shared occupancy map per floor** for rooms AND furniture modules — collision is checked uniformly (a room can't overlap a module or another room). Owned by `Grid`; mutated only via `ModuleStore`.
- **Clusters: full rebuild from occupancy.** Circulation/Outdoor cluster shells (and the adjacency graph) are recomputed from scratch on every change (`store.onChange`), not incrementally — so growth/shrink/split/merge all "just work." Same-type only, orthogonal (4-neighbour) adjacency; corner-only contact does not connect (`connectedComponents` in `core/cluster.ts` is the single definition, shared by clusters and the graph).
- **Touch-based adjacency, not door-based.** Graph edges connect rooms whose footprints share a wall (orthogonally adjacent cells). Door/opening-based adjacency is deferred (`viaDoor` reserved).
- **Adjacency graph is intra-floor only.** No cross-floor/vertical edges.
- **Graph view recomputes per-frame while open** (cheap at this scale) → live updates; node positions persist by id across recomputes.
- **Prop seating:** prop voxels that fall inside a wall strip are clipped (`insideWall` in `place.ts`), so furniture sits flush against wall inner faces, never through walls. Stove is freestanding in a counter gap (counter tiles around it); sink backs an outer wall (faucet to wall).
- **Inactive floors:** rendered dimmed via opaque colour-fade toward the background (NOT alpha transparency — avoids depth-sort "slicing" artifacts) and are non-interactive. Multi-colour voxel props are flagged `noDim` (not faded).
- **Rule validation (when built) is intended to be on-demand and advisory** (non-blocking) — but this is a stated intent, **not implemented**.

---

## 5. Current state — built/verified vs. not

**Built & verified (visually and/or quantitatively this session):**
- Grid, occupancy, placement, rotate, move, delete; grid resize with reconcile.
- All room presets render as clean hollow shells; concave corners verified
  z-fight-free (Kitchen, Living, Bedroom-Large, Recreation L-shapes).
- Dynamic cutaway hides camera-facing walls reactively (rooms + clusters).
- Multi-floor: stacking with clearance gap, floor tabs, add/delete, per-floor
  grid size, dim/non-interactive inactive floors.
- Circulation & Outdoor merged cluster shells (outer walls only; same-type only;
  split on deletion); adjacent different-type clusters stay separate.
- Outdoor/Balcony room type.
- Kitchen voxel props (counter_run, overhead_cabinet, stove, sink, fridge) loaded
  from JSON, run-tiled with clipping, fixtures placed once, wall-clipped, merged
  to one InstancedMesh (1 draw call), rotate with the room.
- Adjacency graph computation + toggleable bubble-diagram view (colored+labeled
  nodes, touch edges, force layout, per-floor, live updates).

**Not built:**
- **Rules / adjacency validation system** (the H1–H5/S1–S5 the request mentions
  do not exist anywhere).
- Furniture for rooms other than Kitchen — **all other rooms are empty shells**
  (only `kitchen` has a `PROP_BUILDERS` entry).
- Save/load/persistence (layout is in-memory only).
- Cross-floor connections (stairs / vertical circulation).
- Door/opening system.

**Known minor issue (deferred):** connector pieces are selected by clicking their
floor tile; their merged cluster walls live in a shared `clusterGroup` and are not
individually pickable — clicking a cluster wall doesn't select a specific piece.

---

## 6. Future extension points (scaffolding already in place noted)

- **Door-based adjacency:** `GraphEdge.viaDoor?: boolean` is reserved; a later
  pass can set it without redesigning the edge model. `ConnectionEdge` on
  `ModuleDef` (per-side, `allowed`, future entry point/span) is scaffolded but
  unused.
- **Cross-floor / stair edges:** adjacency graph is intra-floor; vertical edges
  are a planned extension.
- **Furnishing the remaining rooms:** the prop system is room-agnostic
  (`place.ts` helpers + `PROP_BUILDERS` registry). Add a layout module per room
  type + a registry entry; no engine changes needed.
- **Cluster-wall selection friction** (see §5) — make cluster walls map back to a
  piece if desired.
- **Save / load persistence** of the layout (floors, instances).

---

## 7. Rules table — **NOT YET IMPLEMENTED**

The request references a rules table (`H1–H5` hard rules, `S1–S5` soft rules) and
on-demand/advisory validation. **None of this is in the code.** There is:

- no rules data structure, no rules table, no `H1–H5`/`S1–S5` definitions,
- no validation pass, no "invalid layout" feedback, no enforcement.

What exists is the **foundation** the rules system was meant to consume:
- `computeAdjacencyGraph(floor.store)` → `AdjacencyGraph` (§3) — the derived
  artifact a rules engine would read.
- `ConnectionEdge` scaffolding on `ModuleDef` and the reserved `GraphEdge.viaDoor`.

**Intended (documented intent only) shape when implemented** — so a future agent
knows the direction, but must build it:
- A rules table of hard (`H*`) and soft (`S*`) rules, each consuming the
  `AdjacencyGraph` (e.g. "Kitchen must be adjacent to Circulation", "Bedroom
  should not be adjacent to Kitchen").
- Validation run **on-demand** (not live), producing **advisory** (non-blocking)
  results.

Do not document specific H1–H5/S1–S5 rules as existing — they do not. Define them
when the rules feature is actually built, then replace this section.
