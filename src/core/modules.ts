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

// Historical note: `ConnectionEdge` per-room-type scaffolding once lived here as
// a placeholder for authored adjacency/access metadata. It was SUPERSEDED by
// user-placed interior doors (see core/door.ts) — an authored door IS the access
// specification the scaffolding was a proxy for — and removed. Door-based
// reachability is now the model (adjacencyGraph.ts `viaDoor` edges, rules.ts).

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
  /**
   * Connector cluster key (Circulation / Outdoor). Pieces sharing this key are
   * chained into one merged shell when adjacent (see clusterShells.ts), instead
   * of each getting its own walls. Undefined for normal rooms and furniture.
   */
  cluster?: string;
}

/** Room ceiling height in cells: 4 x 0.6 m = 2.4 m (spec: ~2.4–3.0 m). */
export const ROOM_HEIGHT = 4;

/**
 * The ELASTIC room types — their placed rectangle is a SEED (a minimum claim)
 * whose effective footprint grows to absorb enclosed empty space between
 * placed rooms (core/expansion.ts). Everything else — bathrooms, kitchen,
 * circulation, outdoor, stair — is FIXED: what is placed is what exists (the
 * serviced/structural spaces). Class is a FUNCTION OF TYPE, derived here in
 * the same spirit as rules.ts's `ctx.is.*` — never stored per instance.
 */
const ELASTIC_TYPES = new Set(["living", "bedroom_small", "bedroom_large", "recreation"]);

/** Whether this def's effective footprint is derived by expansion (see above). */
export function isElastic(def: ModuleDef): boolean {
  return def.category === "room" && !def.cluster && ELASTIC_TYPES.has(def.type);
}

/**
 * The BATHROOM room types — THE one list, shared by the def-level
 * {@link isBathroom} and rules.ts's node-level `ctx.is.bathroom`, so the two can
 * never drift when a bathroom preset is added.
 */
export const BATHROOM_TYPES = ["bathroom_small", "bathroom_large"];

/**
 * Whether this def is a bathroom. A bathroom keeps a SOLID wall against outdoor
 * space — privacy — so it is excluded from french windows at the source
 * (core/semiExterior.ts): no glass, no daylight credit, no doorless access.
 * Class is a FUNCTION OF TYPE, derived here in the same spirit as
 * rules.ts's `ctx.is.*` — never stored per instance (cf. {@link isElastic}).
 */
export function isBathroom(def: ModuleDef): boolean {
  return def.category === "room" && !def.cluster && BATHROOM_TYPES.includes(def.type);
}

/**
 * The WET room types — bathrooms plus the kitchen. These are the spaces that
 * carry plumbing, so they are the ones whose position is binding on the building
 * around the flat rather than exchangeable inside it.
 *
 * There is no shaft type in this app yet. When one is added it belongs in this
 * list, because every consumer here asks "does this cell need a pipe" rather
 * than "is this a bathroom", and a shaft answers yes.
 */
export const WET_TYPES = [...BATHROOM_TYPES, "kitchen"];

/** Whether this def is a wet room. Class is a FUNCTION OF TYPE, derived here in
 *  the same spirit as {@link isBathroom} and {@link isElastic}. */
export function isWet(def: ModuleDef): boolean {
  return def.category === "room" && !def.cluster && WET_TYPES.includes(def.type);
}

/** The BEDROOM room types, shared by the interface view's position tint and by
 *  rules.ts's node-level `ctx.is.bedroom`. */
export const BEDROOM_TYPES = ["bedroom_small", "bedroom_large"];

/** Whether this def is a bedroom. */
export function isBedroom(def: ModuleDef): boolean {
  return def.category === "room" && !def.cluster && BEDROOM_TYPES.includes(def.type);
}

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
 * north-east (max-x, min-z) corner — gives a consistent L shape.
 *
 * Currently CALLER-LESS: every room preset became a rectangle (batch ① of the
 * elastic-rooms work — rectangles are the seeds the derived expansion batch
 * builds on). Kept, and exported, as a shared footprint utility.
 */
export function lShape(w: number, d: number, nw: number, nd: number): Cell[] {
  return rect(w, d).filter(
    (c) => !(c.cx >= w - nw && c.cz < nd)
  );
}

// ---- Definitions -------------------------------------------------------------

export const MODULE_DEFS: Record<string, ModuleDef> = {
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
    description: "Rectangle · 7×5",
    category: "room",
    group: "Living Room",
    color: 0xc13a2e,
    cells: rect(7, 5),
    height: ROOM_HEIGHT,  },
  kitchen: {
    type: "kitchen",
    name: "Kitchen",
    description: "Rectangle · 4×4",
    category: "room",
    group: "Kitchen",
    color: 0xe8b117,
    cells: rect(4, 4),
    height: ROOM_HEIGHT,  },
  bedroom_small: {
    type: "bedroom_small",
    name: "Bedroom — Small",
    description: "Rectangle · 5×4",
    category: "room",
    group: "Bedroom",
    color: 0x16336e,
    cells: rect(5, 4),
    height: ROOM_HEIGHT,  },
  bedroom_large: {
    type: "bedroom_large",
    name: "Bedroom — Large",
    description: "Rectangle · 6×5",
    category: "room",
    group: "Bedroom",
    color: 0x274a9e,
    cells: rect(6, 5),
    height: ROOM_HEIGHT,  },
  bathroom_small: {
    type: "bathroom_small",
    name: "Bathroom — Small",
    description: "Rectangle · 3×3",
    category: "room",
    group: "Bathroom",
    color: 0xd8d4cb,
    cells: rect(3, 3),
    height: ROOM_HEIGHT,  },
  bathroom_large: {
    type: "bathroom_large",
    name: "Bathroom — Large",
    description: "Rectangle · 4×4",
    category: "room",
    group: "Bathroom",
    color: 0xd8d4cb,
    cells: rect(4, 4),
    height: ROOM_HEIGHT,  },
  recreation: {
    type: "recreation",
    name: "Recreation Room",
    description: "Rectangle · 5×5",
    category: "room",
    group: "Recreation Room",
    color: 0xb98a2f,
    cells: rect(5, 5),
    height: ROOM_HEIGHT,  },
  circulation_single: {
    type: "circulation_single",
    name: "Circulation — Single",
    description: "Connector · 1×1",
    category: "room",
    group: "Circulation",
    color: 0x141414,
    cells: rect(1, 1),
    height: ROOM_HEIGHT,    cluster: "circulation",
  },
  circulation_double: {
    type: "circulation_double",
    name: "Circulation — Double",
    description: "Connector · 1×2",
    category: "room",
    group: "Circulation",
    color: 0x141414,
    cells: [
      { cx: 0, cz: 0 },
      { cx: 1, cz: 0 },
    ],
    height: ROOM_HEIGHT,    cluster: "circulation",
  },
  outdoor_single: {
    type: "outdoor_single",
    name: "Outdoor — Single",
    description: "Balcony · 1×1",
    category: "room",
    group: "Outdoor",
    color: 0x2e6b4f,
    cells: rect(1, 1),
    height: ROOM_HEIGHT,    cluster: "outdoor",
  },
  outdoor_double: {
    type: "outdoor_double",
    name: "Outdoor — Double",
    description: "Balcony · 1×2",
    category: "room",
    group: "Outdoor",
    color: 0x2e6b4f,
    cells: [
      { cx: 0, cz: 0 },
      { cx: 1, cz: 0 },
    ],
    height: ROOM_HEIGHT,    cluster: "outdoor",
  },
};


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
