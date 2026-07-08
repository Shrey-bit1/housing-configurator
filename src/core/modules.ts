import type { Cell } from "./grid";

/**
 * A module type id. Rooms and furniture modules share one registry/type space
 * because they are placed/rotated/moved/deleted with identical mechanics and
 * collision-checked against ONE shared occupancy map (see store.ts).
 */
export type ModuleType = string;

/**
 * Furniture (0.6 m cubes) vs. room presets (taller, room-sized footprints) vs.
 * stairs (a two-floor structural object — see {@link MODULE_DEFS.stair}).
 */
export type Category = "module" | "room" | "stair";

/**
 * Connection-edge scaffolding (SECTION 1).
 *
 * Per-room-type metadata describing which sides of the footprint may host a
 * connection to an adjacent room. This is *scaffolding only* for a future
 * adjacency-rules feature — nothing reads or enforces it yet. It is shaped so
 * it can later grow an explicit entry point along an edge, e.g.
 *   { side: "north", allowed: true, entry?: { cx, cz }, span?: number }
 * `side` is relative to the footprint's own bounding box at rotation 0;
 * rotation handling would be layered on when rules are implemented.
 *
 * MIRRORING NOTE (for the future doors task): the footprint transform mirrors
 * across the local X axis (negates cx) BEFORE rotating (see {@link transformCell}).
 * That reflection swaps the two sides perpendicular to the mirror axis —
 * east ↔ west — while leaving north/south alone, all measured BEFORE the
 * subsequent rotation. So when this scaffolding grows real per-side behaviour,
 * a mirrored instance must swap its `east`/`west` edges (then apply rotation),
 * exactly as the cells do. No behaviour depends on this yet.
 */
export interface ConnectionEdge {
  side: "north" | "south" | "east" | "west";
  allowed: boolean;
}

/**
 * Static, data-driven description of a placeable shape. New modules/rooms are
 * added by extending {@link MODULE_DEFS} — no new meshes/classes required.
 */
export interface ModuleDef {
  type: ModuleType;
  name: string;
  description: string;
  /** "module" = 0.6 m furniture cube; "room" = taller room preset. */
  category: Category;
  /** UI grouping label (e.g. several presets shown under "Circulation"). */
  group?: string;
  /** Hex colour used for the material and the palette swatch. */
  color: number;
  /**
   * Occupied cells relative to the origin cell (0,0), at rotation 0.
   * The origin cell (0,0) is always part of the shape and is the rotation
   * pivot.
   */
  cells: Cell[];
  /** Height in cells. Furniture = 1 (0.6 m); rooms = {@link ROOM_HEIGHT}. */
  height: number;
  /** Scaffolding for future adjacency rules (rooms only). Currently unused. */
  connectionEdges?: ConnectionEdge[];
  /**
   * Connector cluster key (Circulation / Outdoor). Pieces sharing this key are
   * chained into one merged shell when adjacent (see clusterShells.ts), instead
   * of each getting its own walls. Undefined for normal rooms and furniture.
   */
  cluster?: string;
}

/** Room ceiling height in cells: 4 x 0.6 m = 2.4 m (spec: ~2.4–3.0 m). */
export const ROOM_HEIGHT = 4;

// ---- Footprint helpers -------------------------------------------------------

/** A solid w x d rectangle of cells, origin at (0,0). */
function rect(w: number, d: number): Cell[] {
  const cells: Cell[] = [];
  for (let cx = 0; cx < w; cx++)
    for (let cz = 0; cz < d; cz++) cells.push({ cx, cz });
  return cells;
}

/**
 * A w x d rectangle with a `nw` x `nd` rectangular notch removed from the
 * north-east (max-x, min-z) corner — gives a consistent L shape for all rooms.
 */
function lShape(w: number, d: number, nw: number, nd: number): Cell[] {
  return rect(w, d).filter(
    (c) => !(c.cx >= w - nw && c.cz < nd)
  );
}

/** All four sides open — the default scaffold for every room. */
const OPEN_EDGES: ConnectionEdge[] = [
  { side: "north", allowed: true },
  { side: "south", allowed: true },
  { side: "east", allowed: true },
  { side: "west", allowed: true },
];

// ---- Definitions -------------------------------------------------------------

export const MODULE_DEFS: Record<string, ModuleDef> = {
  // ----- Furniture modules (unchanged mechanics, 0.6 m tall) -----
  single: {
    type: "single",
    name: "Single",
    description: "1 cube",
    category: "module",
    color: 0x6e6a64,
    cells: rect(1, 1),
    height: 1,
  },
  domino: {
    type: "domino",
    name: "Domino",
    description: "2 cubes in a line",
    category: "module",
    color: 0xb0aaa0,
    cells: [
      { cx: 0, cz: 0 },
      { cx: 1, cz: 0 },
    ],
    height: 1,
  },
  ltriomino: {
    type: "ltriomino",
    name: "L-Triomino",
    description: "3 cubes, L shape",
    category: "module",
    color: 0x3a3a3a,
    cells: [
      { cx: 0, cz: 0 },
      { cx: 1, cz: 0 },
      { cx: 0, cz: 1 },
    ],
    height: 1,
  },

  // ----- Stairs (two-floor structural object) -----
  // A 180° DOGLEG: two 1-cell-wide flights running side by side in opposite
  // directions, with a full-width half-landing at the far end (the 180° turn).
  // Footprint 2 cells wide (x) × 6 cells long (z) at rotation 0 = 1.2 m × 3.6 m,
  // all on the grid: each flight run = 4.5 cells (2.7 m), landing = 1.5 cells
  // (0.9 m). `height` is nominal — the actual rise is the floor-to-floor gap,
  // applied at render time via scale.y (stairMesh + FloorManager). Neutral
  // concrete grey; not a room. Geometry detail lives in stairMesh.ts.
  stair: {
    type: "stair",
    name: "Stair (dogleg)",
    description: "180° dogleg · 2×6 · to floor above",
    category: "stair",
    group: "Stairs",
    color: 0x8a8a8a,
    cells: rect(2, 6),
    height: 1,
  },

  // ----- Room presets (room-sized footprints, ~2.4 m tall) -----
  living: {
    type: "living",
    name: "Living Room",
    description: "L-shape · 7×6 (3×2 notch)",
    category: "room",
    group: "Living Room",
    color: 0xd32f2f,
    cells: lShape(7, 6, 3, 2),
    height: ROOM_HEIGHT,
    connectionEdges: OPEN_EDGES,
  },
  kitchen: {
    type: "kitchen",
    name: "Kitchen",
    description: "L-shape · 5×4 (2×2 notch)",
    category: "room",
    group: "Kitchen",
    color: 0xf5c400,
    cells: lShape(5, 4, 2, 2),
    height: ROOM_HEIGHT,
    connectionEdges: OPEN_EDGES,
  },
  bedroom_small: {
    type: "bedroom_small",
    name: "Bedroom — Small",
    description: "Rectangle · 5×4",
    category: "room",
    group: "Bedroom",
    color: 0x1565c0,
    cells: rect(5, 4),
    height: ROOM_HEIGHT,
    connectionEdges: OPEN_EDGES,
  },
  bedroom_large: {
    type: "bedroom_large",
    name: "Bedroom — Large",
    description: "L-shape · 6×6 (2×3 notch)",
    category: "room",
    group: "Bedroom",
    color: 0x0d2c54,
    cells: lShape(6, 6, 2, 3),
    height: ROOM_HEIGHT,
    connectionEdges: OPEN_EDGES,
  },
  bathroom_small: {
    type: "bathroom_small",
    name: "Bathroom — Small",
    description: "Rectangle · 3×3",
    category: "room",
    group: "Bathroom",
    color: 0xede7da,
    cells: rect(3, 3),
    height: ROOM_HEIGHT,
    connectionEdges: OPEN_EDGES,
  },
  bathroom_large: {
    type: "bathroom_large",
    name: "Bathroom — Large",
    description: "Rectangle · 4×4",
    category: "room",
    group: "Bathroom",
    color: 0x9b9690,
    cells: rect(4, 4),
    height: ROOM_HEIGHT,
    connectionEdges: OPEN_EDGES,
  },
  recreation: {
    type: "recreation",
    name: "Recreation Room",
    description: "L-shape · 6×5 (2×2 notch)",
    category: "room",
    group: "Recreation Room",
    color: 0xc68a1e,
    cells: lShape(6, 5, 2, 2),
    height: ROOM_HEIGHT,
    connectionEdges: OPEN_EDGES,
  },
  circulation_single: {
    type: "circulation_single",
    name: "Circulation — Single",
    description: "Connector · 1×1",
    category: "room",
    group: "Circulation",
    color: 0x1a1a1a,
    cells: rect(1, 1),
    height: ROOM_HEIGHT,
    connectionEdges: OPEN_EDGES,
    cluster: "circulation",
  },
  circulation_double: {
    type: "circulation_double",
    name: "Circulation — Double",
    description: "Connector · 1×2",
    category: "room",
    group: "Circulation",
    color: 0x1a1a1a,
    cells: [
      { cx: 0, cz: 0 },
      { cx: 1, cz: 0 },
    ],
    height: ROOM_HEIGHT,
    connectionEdges: OPEN_EDGES,
    cluster: "circulation",
  },
  outdoor_single: {
    type: "outdoor_single",
    name: "Outdoor — Single",
    description: "Balcony · 1×1",
    category: "room",
    group: "Outdoor",
    color: 0x4a7c59,
    cells: rect(1, 1),
    height: ROOM_HEIGHT,
    connectionEdges: OPEN_EDGES,
    cluster: "outdoor",
  },
  outdoor_double: {
    type: "outdoor_double",
    name: "Outdoor — Double",
    description: "Balcony · 1×2",
    category: "room",
    group: "Outdoor",
    color: 0x4a7c59,
    cells: [
      { cx: 0, cz: 0 },
      { cx: 1, cz: 0 },
    ],
    height: ROOM_HEIGHT,
    connectionEdges: OPEN_EDGES,
    cluster: "outdoor",
  },
};

/** Furniture modules, in palette order. */
export const MODULE_LIST: ModuleDef[] = [
  MODULE_DEFS.single,
  MODULE_DEFS.domino,
  MODULE_DEFS.ltriomino,
];

/** Stairs, in palette order (its own category — spans two floors). */
export const STAIR_LIST: ModuleDef[] = [MODULE_DEFS.stair];

/** Room presets, in palette order. */
export const ROOM_LIST: ModuleDef[] = [
  MODULE_DEFS.living,
  MODULE_DEFS.kitchen,
  MODULE_DEFS.bedroom_small,
  MODULE_DEFS.bedroom_large,
  MODULE_DEFS.bathroom_small,
  MODULE_DEFS.bathroom_large,
  MODULE_DEFS.recreation,
  MODULE_DEFS.circulation_single,
  MODULE_DEFS.circulation_double,
  MODULE_DEFS.outdoor_single,
  MODULE_DEFS.outdoor_double,
];

/**
 * Rotate a relative cell offset by `rotation` 90° clockwise steps about the
 * origin (0,0). Clockwise in grid space: (x,z) -> (-z, x).
 */
export function rotateCell(cell: Cell, rotation: number): Cell {
  const r = ((rotation % 4) + 4) % 4;
  let { cx, cz } = cell;
  for (let i = 0; i < r; i++) {
    const nx = -cz;
    const nz = cx;
    cx = nx;
    cz = nz;
  }
  return { cx, cz };
}

/**
 * Reflect a relative cell offset across the LOCAL X axis (the plane cx = 0),
 * i.e. negate cx, keeping the origin (0,0) — the rotation pivot — fixed. This
 * is a left/right flip that swaps a footprint's east (+x) and west (−x) sides.
 */
export function mirrorCell(cell: Cell): Cell {
  return { cx: -cell.cx, cz: cell.cz };
}

/**
 * THE central footprint transform — the single source of truth every consumer
 * (occupancy, ghost, walls, props, stairs, graph) must agree on.
 *
 * Order is fixed and load-bearing: **mirror FIRST (across local X), THEN
 * rotate.** Mirror-then-rotate and rotate-then-mirror give different results,
 * so this order is the convention; anything that reconstructs a footprint's
 * geometry from `(rotation, mirrored)` must apply the two steps in this order.
 */
export function transformCell(cell: Cell, rotation: number, mirrored: boolean): Cell {
  return rotateCell(mirrored ? mirrorCell(cell) : cell, rotation);
}

/** The shape's relative cells after applying `mirrored` (first) then `rotation`. */
export function rotatedCells(def: ModuleDef, rotation: number, mirrored = false): Cell[] {
  return def.cells.map((c) => transformCell(c, rotation, mirrored));
}

/**
 * Absolute cells a module occupies when its origin cell sits at `origin`,
 * mirrored (or not), and rotated by `rotation` steps. This is the bridge from
 * module data to the grid occupancy map — mirror then rotate then translate.
 */
export function occupiedCells(
  def: ModuleDef,
  origin: Cell,
  rotation: number,
  mirrored = false
): Cell[] {
  return rotatedCells(def, rotation, mirrored).map((c) => ({
    cx: origin.cx + c.cx,
    cz: origin.cz + c.cz,
  }));
}
