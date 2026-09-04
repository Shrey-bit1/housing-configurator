/**
 * FLAT LAYOUT — the arithmetic behind `scripts/gen-flat.mjs`.
 *
 * A bubble diagram says which rooms a flat has and which of them touch. It does
 * not say where anything is. This module is the step in between: it turns rows
 * of slots into absolute cells on the 0.6 m grid, then reads the doors back OUT
 * of the resulting geometry rather than taking them on trust.
 *
 * That direction matters. A door written by hand is a guess that the two rooms
 * really do share a straight boundary two cells long; the app prunes doors that
 * do not bind two live spaces (floorManager.ts:1006), so a guess disappears
 * silently and shows up much later as an unreachable room. Deriving the door
 * from the packed cells means a graph edge with no shared boundary is an error
 * at generation time, naming the pair.
 *
 * Everything here is pure and framework-free, which is what makes it testable
 * without the three.js render layer (scripts/flatLayout.test.ts). The runner
 * that boots the real FloorManager lives in `scripts/gen-flat.mjs`.
 */

import { MODULE_DEFS, occupiedCells } from "../src/core/modules";
import { SIDE_DELTA, type Side } from "../src/core/exteriorEdges";
import { DOOR_SPAN } from "../src/core/door";

export interface Cell {
  cx: number;
  cz: number;
}

/** A cell set, keyed `"cx,cz"`. */
export type CellSet = Set<string>;

export const cellKey = (cx: number, cz: number): string => `${cx},${cz}`;

/**
 * One slot in a row. A row is laid left to right and slots are butted against
 * each other, so a slot is the unit of horizontal packing.
 *
 *  - `room`   one module. `rotation` is in quarter turns, as InstanceData wants.
 *  - `stack`  two or more slots one behind the other (north to south) in the
 *             same column. This is how a bathroom sits over a WC in the depth
 *             of one bedroom without either of them becoming a separate row.
 *  - `fill`   a rectangle of circulation or outdoor cells, tiled with the
 *             1×1 and 2×1 modules. Halls and balconies have no single module
 *             of their own, so they are described by the patch they occupy.
 *  - `void`   a rectangle with nothing in it. The app grows living rooms and
 *             bedrooms into empty space they enclose (core/expansion.ts), so a
 *             void beside one of them is how a 12.6 m² seed becomes a 20 m²
 *             room without a second module. It only works where the void is
 *             enclosed on every side, which `gen-flat.mjs` checks against the
 *             grid border before it trusts the result.
 */
export type Slot =
  | { key: string; type: string; rotation?: number }
  | { stack: Slot[] }
  | { key: string; fill: "circulation" | "outdoor"; w: number; d: number }
  | { void: true; w: number; d: number };

/** A horizontal strip of the flat. Every slot in it must be the same depth. */
export interface Row {
  slots: Slot[];
}

export interface StoreyPlan {
  /** Where the storey's bounding box starts on the grid. */
  origin: Cell;
  rows: Row[];
}

export interface Diagram {
  id: string;
  name: string;
  color: string;
  /** Inclusive m² band the flat is meant to land in. Checked, not used to size. */
  targetM2: [number, number];
  grid: { cols: number; rows: number };
  northAngle?: number;
  storeys: StoreyPlan[];
  /** The bubble diagram's edges. Each becomes one door. */
  doors: [string, string][];
  /** One entrance on an outside edge of the named room. */
  entrance: { key: string; side: Side };
}

export interface Placement {
  type: string;
  cx: number;
  cz: number;
  rotation: number;
}

export interface StoreyLayout {
  placements: Placement[];
  /** Room key → the absolute cells it occupies. */
  cells: Map<string, CellSet>;
  /** Cells left deliberately empty for an elastic room to grow into. */
  voids: Cell[];
  /** The storey's bounding box, for the entrance and the size report. */
  bounds: { minX: number; minZ: number; maxX: number; maxZ: number };
}

export class LayoutError extends Error {}

// ---- Footprints -------------------------------------------------------------

/** A module's cells with its bounding box's min corner at the origin. */
function normalizedCells(type: string, rotation: number): Cell[] {
  const def = MODULE_DEFS[type];
  if (!def) throw new LayoutError(`unknown module type "${type}"`);
  const raw = occupiedCells(def, { cx: 0, cz: 0 }, rotation, false);
  const minX = Math.min(...raw.map((c) => c.cx));
  const minZ = Math.min(...raw.map((c) => c.cz));
  return raw.map((c) => ({ cx: c.cx - minX, cz: c.cz - minZ }));
}

/**
 * The offset from a module's bounding-box corner to its ORIGIN cell. Placement
 * data stores the origin, and rotation moves it off the corner, so this is the
 * correction that lets a caller say "put the corner here" and get it right for
 * every rotation without knowing the rotation matrix.
 */
function originOffset(type: string, rotation: number): Cell {
  const def = MODULE_DEFS[type];
  const raw = occupiedCells(def, { cx: 0, cz: 0 }, rotation, false);
  return {
    cx: -Math.min(...raw.map((c) => c.cx)),
    cz: -Math.min(...raw.map((c) => c.cz)),
  };
}

/** Width and depth in cells of whatever a slot covers. */
export function slotSize(slot: Slot): { w: number; d: number } {
  if ("stack" in slot) {
    const parts = slot.stack.map(slotSize);
    const w = parts[0].w;
    for (const [i, p] of parts.entries())
      if (p.w !== w)
        throw new LayoutError(
          `stacked slots must be the same width: slot 0 is ${w} cells, slot ${i} is ${p.w}`
        );
    return { w, d: parts.reduce((n, p) => n + p.d, 0) };
  }
  if ("fill" in slot || "void" in slot) return { w: slot.w, d: slot.d };
  const cells = normalizedCells(slot.type, slot.rotation ?? 0);
  return {
    w: Math.max(...cells.map((c) => c.cx)) + 1,
    d: Math.max(...cells.map((c) => c.cz)) + 1,
  };
}

// ---- Packing ----------------------------------------------------------------

/**
 * Tile a `w × d` rectangle with the double (2×1) and single (1×1) modules of a
 * cluster. Halls and balconies are patches rather than rooms, so they get
 * described by their rectangle and tiled here; the doubles come first so an
 * even-width patch never contains a single, and rule A1's accessible-width test
 * (a 2×2 block inside the cluster) is met by any patch two cells deep.
 */
function tileFill(
  kind: "circulation" | "outdoor",
  at: Cell,
  w: number,
  d: number
): { placements: Placement[]; cells: Cell[] } {
  const double = kind === "circulation" ? "circulation_double" : "outdoor_double";
  const single = kind === "circulation" ? "circulation_single" : "outdoor_single";
  const placements: Placement[] = [];
  const cells: Cell[] = [];
  for (let z = 0; z < d; z++) {
    let x = 0;
    while (x < w) {
      const two = x + 2 <= w;
      placements.push({
        type: two ? double : single,
        cx: at.cx + x,
        cz: at.cz + z,
        rotation: 0,
      });
      cells.push({ cx: at.cx + x, cz: at.cz + z });
      if (two) cells.push({ cx: at.cx + x + 1, cz: at.cz + z });
      x += two ? 2 : 1;
    }
  }
  return { placements, cells };
}

/** Place one slot with its bounding-box corner at `at`, recursing into stacks. */
function placeSlot(
  slot: Slot,
  at: Cell,
  out: { placements: Placement[]; cells: Map<string, CellSet>; voids: Cell[] }
): void {
  if ("stack" in slot) {
    let z = at.cz;
    for (const child of slot.stack) {
      placeSlot(child, { cx: at.cx, cz: z }, out);
      z += slotSize(child).d;
    }
    return;
  }

  if ("void" in slot) {
    for (let x = 0; x < slot.w; x++)
      for (let z = 0; z < slot.d; z++) out.voids.push({ cx: at.cx + x, cz: at.cz + z });
    return;
  }

  const claimed: Cell[] = [];
  if ("fill" in slot) {
    const tiled = tileFill(slot.fill, at, slot.w, slot.d);
    out.placements.push(...tiled.placements);
    claimed.push(...tiled.cells);
  } else {
    const rotation = slot.rotation ?? 0;
    const off = originOffset(slot.type, rotation);
    out.placements.push({
      type: slot.type,
      cx: at.cx + off.cx,
      cz: at.cz + off.cz,
      rotation,
    });
    for (const c of normalizedCells(slot.type, rotation))
      claimed.push({ cx: at.cx + c.cx, cz: at.cz + c.cz });
  }

  if (out.cells.has(slot.key))
    throw new LayoutError(`room key "${slot.key}" is used twice`);
  out.cells.set(slot.key, new Set(claimed.map((c) => cellKey(c.cx, c.cz))));
}

/**
 * Pack one storey's rows onto the grid.
 *
 * Rows stack from the origin southwards. Within a row, slots butt left to
 * right. Every slot in a row must be exactly as deep as the row, which is the
 * one rule that keeps the packer from producing the notched leftovers a script
 * makes and a person does not: a shortfall is an error naming the row and the
 * slot, not a hole to be filled later.
 */
export function packStorey(plan: StoreyPlan): StoreyLayout {
  const out = {
    placements: [] as Placement[],
    cells: new Map<string, CellSet>(),
    voids: [] as Cell[],
  };
  let z = plan.origin.cz;
  let widest = 0;

  for (const [r, row] of plan.rows.entries()) {
    const sizes = row.slots.map(slotSize);
    const depth = Math.max(...sizes.map((s) => s.d));
    for (const [i, s] of sizes.entries())
      if (s.d !== depth)
        throw new LayoutError(
          `row ${r}: slot ${i} is ${s.d} cells deep, the row is ${depth} — ` +
            `every slot in a row must fill its depth, or the flat gets a notch`
        );

    let x = plan.origin.cx;
    for (const [i, slot] of row.slots.entries()) {
      placeSlot(slot, { cx: x, cz: z }, out);
      x += sizes[i].w;
    }
    widest = Math.max(widest, x - plan.origin.cx);
    z += depth;
  }

  // Two rooms overlapping would be caught later by the store refusing to place
  // one of them, and the refusal names no room. Catching it here does.
  const seen = new Map<string, string>();
  for (const [key, set] of out.cells)
    for (const c of set) {
      const other = seen.get(c);
      if (other) throw new LayoutError(`"${key}" and "${other}" both claim cell ${c}`);
      seen.set(c, key);
    }
  for (const v of out.voids) {
    const other = seen.get(cellKey(v.cx, v.cz));
    if (other) throw new LayoutError(`a void and "${other}" both claim cell ${v.cx},${v.cz}`);
  }

  return {
    placements: out.placements,
    cells: out.cells,
    voids: out.voids,
    bounds: {
      minX: plan.origin.cx,
      minZ: plan.origin.cz,
      maxX: plan.origin.cx + widest - 1,
      maxZ: z - 1,
    },
  };
}

// ---- Doors ------------------------------------------------------------------

/**
 * Every anchor cell in `a` at which a door on `side` would bind `a` to `b`.
 *
 * A door covers exactly two consecutive edges (core/door.ts, DOOR_SPAN), which
 * run along x for a north or south door and along z for an east or west one.
 * Both edges have to join the same two spaces, so an anchor qualifies only when
 * the anchor AND its neighbour along the door's run are both in `a` with both
 * of their opposite cells in `b`. That is the same test `resolveDoorSpaces`
 * applies at load time, done early enough to be an error message.
 */
export function doorAnchors(a: CellSet, b: CellSet, side: Side): Cell[] {
  const [dx, dz] = SIDE_DELTA[side];
  const along = side === "north" || side === "south" ? { cx: 1, cz: 0 } : { cx: 0, cz: 1 };
  const binds = (cx: number, cz: number) =>
    a.has(cellKey(cx, cz)) && b.has(cellKey(cx + dx, cz + dz));

  const out: Cell[] = [];
  for (const k of a) {
    const [cx, cz] = k.split(",").map(Number);
    let ok = true;
    for (let i = 0; i < DOOR_SPAN; i++)
      if (!binds(cx + along.cx * i, cz + along.cz * i)) ok = false;
    if (ok) out.push({ cx, cz });
  }
  return out.sort((p, q) => p.cz - q.cz || p.cx - q.cx);
}

export interface DerivedDoor {
  cx: number;
  cz: number;
  side: Side;
  between: [string, string];
}

/**
 * One door per edge of the bubble diagram, placed in the middle of the longest
 * straight run the two rooms share.
 *
 * The middle rather than the first candidate because a door hard against the
 * corner of a room is the tell of a generated plan, and because it leaves the
 * furniture wall of both rooms free. Doors already placed are avoided cell for
 * cell, since the app refuses two doors on one physical edge (core/door.ts).
 */
export function deriveDoors(
  cells: Map<string, CellSet>,
  edges: [string, string][]
): DerivedDoor[] {
  const SIDES: Side[] = ["north", "south", "east", "west"];
  const taken = new Set<string>();
  const out: DerivedDoor[] = [];

  for (const [ka, kb] of edges) {
    const a = cells.get(ka);
    const b = cells.get(kb);
    if (!a) throw new LayoutError(`door "${ka}"–"${kb}": no room called "${ka}"`);
    if (!b) throw new LayoutError(`door "${ka}"–"${kb}": no room called "${kb}"`);

    // The longest run of consecutive anchors on any side, so the door lands on
    // the widest piece of shared wall rather than the first one found.
    let best: { side: Side; run: Cell[] } | null = null;
    for (const side of SIDES) {
      const along = side === "north" || side === "south" ? "cx" : "cz";
      const fixed = along === "cx" ? "cz" : "cx";
      const anchors = doorAnchors(a, b, side).filter(
        (c) => !taken.has(`${c.cx},${c.cz},${side}`)
      );
      let run: Cell[] = [];
      for (const c of anchors) {
        const prev = run[run.length - 1];
        if (prev && prev[fixed] === c[fixed] && prev[along] + 1 === c[along]) run.push(c);
        else run = [c];
        if (!best || run.length > best.run.length) best = { side, run: [...run] };
      }
    }

    if (!best || best.run.length === 0)
      throw new LayoutError(
        `door "${ka}"–"${kb}": the two rooms share no straight boundary ${DOOR_SPAN} cells long, ` +
          `so the graph edge cannot become a door`
      );

    const at = best.run[Math.floor((best.run.length - 1) / 2)];
    // Both edges of the chosen door, so a later door cannot reuse either.
    const along = best.side === "north" || best.side === "south" ? { cx: 1, cz: 0 } : { cx: 0, cz: 1 };
    for (let i = 0; i < DOOR_SPAN; i++)
      taken.add(`${at.cx + along.cx * i},${at.cz + along.cz * i},${best.side}`);

    out.push({ cx: at.cx, cz: at.cz, side: best.side, between: [ka, kb] });
  }
  return out;
}

// ---- Entrance ---------------------------------------------------------------

/**
 * An entrance on a true outside edge of the named room: a cell of that room
 * whose neighbour across `side` is not part of the flat at all. The middle
 * candidate again, for the same reason as the doors.
 */
export function deriveEntrance(
  cells: Map<string, CellSet>,
  key: string,
  side: Side
): { cx: number; cz: number; side: Side } {
  const room = cells.get(key);
  if (!room) throw new LayoutError(`entrance: no room called "${key}"`);
  const occupied = new Set<string>();
  for (const set of cells.values()) for (const c of set) occupied.add(c);

  const [dx, dz] = SIDE_DELTA[side];
  const free = [...room]
    .map((k) => k.split(",").map(Number))
    .filter(([cx, cz]) => !occupied.has(cellKey(cx + dx, cz + dz)))
    .sort((p, q) => p[1] - q[1] || p[0] - q[0]);

  if (free.length === 0)
    throw new LayoutError(
      `entrance: "${key}" has no ${side} edge facing the outside — every cell on that side ` +
        `is built against another room`
    );
  const [cx, cz] = free[Math.floor((free.length - 1) / 2)];
  return { cx, cz, side };
}

// ---- Reporting --------------------------------------------------------------

/** Cell area in m², the grid's own constant squared. */
export const CELL_M = 0.6;

export function areaM2(cellCount: number): number {
  return Math.round(cellCount * CELL_M * CELL_M * 100) / 100;
}

/**
 * The largest orthogonal gap in cells between any two of the named rooms,
 * measured centre to centre minus their half extents. Zero means they touch.
 * This is what proves the wet rooms of a flat sit close enough for one shaft.
 */
export function widestGap(cells: Map<string, CellSet>, keys: string[]): number {
  const present = keys.filter((k) => cells.has(k));
  let worst = 0;
  for (let i = 0; i < present.length; i++)
    for (let j = i + 1; j < present.length; j++) {
      let best = Infinity;
      for (const p of cells.get(present[i])!)
        for (const q of cells.get(present[j])!) {
          const [px, pz] = p.split(",").map(Number);
          const [qx, qz] = q.split(",").map(Number);
          best = Math.min(best, Math.abs(px - qx) + Math.abs(pz - qz) - 1);
        }
      worst = Math.max(worst, best);
    }
  return worst;
}
