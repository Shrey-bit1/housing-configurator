import { cellKey, type Cell } from "./grid";

/**
 * Exterior-edge detection — a standalone, reusable utility.
 *
 * For a footprint (a set of cells) on a floor, finds the boundary edges that
 * face OUTSIDE: edges whose neighbouring cell across them is not occupied by any
 * room/cluster. Edges shared with another room/cluster (or interior to the
 * footprint) are NOT exterior.
 *
 * Built generic on purpose: the entrance feature uses it to know where an
 * entrance may attach; a later facade / window-tagging task will reuse the same
 * function to find a room's exterior walls. Nothing entrance-specific lives here.
 */

/** A footprint edge side, in grid space: north=-z, south=+z, east=+x, west=-x. */
export type Side = "north" | "south" | "east" | "west";

export const SIDE_DELTA: Record<Side, [number, number]> = {
  north: [0, -1],
  south: [0, 1],
  east: [1, 0],
  west: [-1, 0],
};

export const SIDES: Side[] = ["north", "south", "east", "west"];

export function opposite(side: Side): Side {
  return side === "north" ? "south" : side === "south" ? "north" : side === "east" ? "west" : "east";
}

/** A boundary edge: a cell of the footprint + the side it sits on. */
export interface BoundaryEdge {
  cx: number;
  cz: number;
  side: Side;
}

/** Stable key for an edge (dedupe / id). */
export function edgeKey(cx: number, cz: number, side: Side): string {
  return `${cx},${cz},${side}`;
}

/** Inverse of {@link edgeKey}. */
export function parseEdgeKey(key: string): BoundaryEdge {
  const [cx, cz, side] = key.split(",");
  return { cx: Number(cx), cz: Number(cz), side: side as Side };
}

/**
 * Exterior boundary edges of `cells` — THE definition of "faces the outside",
 * shared by every consumer (windows, D1/D2 via `hasExteriorEdge`, W1's gate,
 * entrance validity/E2, the bridge export's envelope). An edge is exterior when
 * the cell across it is:
 *  - not in `occupied` — the set of ALL room+cluster+stair cell keys on the
 *    floor (typically including `cells` themselves), so an edge shared with
 *    another space, or interior to the footprint, never qualifies; AND
 *  - OUTSIDE per `isOutside` — empty AND reachable from the grid border, or out
 *    of bounds (see `Floor.isOutside` / expansion.ts's `borderReachableEmpty`).
 *
 * The second test is what stops a SEALED VOID from counting as exterior: a
 * pocket of empty cells walled in on every side has no sky, so an edge facing it
 * is plain interior wall — no D1 credit, no window onto a sightless shaft, no
 * entrance placeable there. `isOutside` is deliberately REQUIRED, not optional:
 * a call site that forgot it would silently fork this definition, which is the
 * one thing this utility exists to prevent.
 */
export function exteriorEdges(
  cells: Cell[],
  occupied: Set<string>,
  isOutside: (cx: number, cz: number) => boolean
): BoundaryEdge[] {
  const out: BoundaryEdge[] = [];
  for (const c of cells) {
    for (const side of SIDES) {
      const [dx, dz] = SIDE_DELTA[side];
      const nx = c.cx + dx;
      const nz = c.cz + dz;
      if (occupied.has(cellKey(nx, nz))) continue; // shared/interior
      if (!isOutside(nx, nz)) continue; // sealed void — empty, but no sky
      out.push({ cx: c.cx, cz: c.cz, side });
    }
  }
  return out;
}
