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
 * Exterior boundary edges of `cells`. `occupied` is the set of ALL room+cluster
 * cell keys on the floor (typically including `cells` themselves). An edge is
 * exterior when the cell across it is not in `occupied` — i.e. it faces outside,
 * not another room/cluster and not the footprint's own interior.
 */
export function exteriorEdges(cells: Cell[], occupied: Set<string>): BoundaryEdge[] {
  const out: BoundaryEdge[] = [];
  for (const c of cells) {
    for (const side of SIDES) {
      const [dx, dz] = SIDE_DELTA[side];
      if (occupied.has(cellKey(c.cx + dx, c.cz + dz))) continue; // shared/interior
      out.push({ cx: c.cx, cz: c.cz, side });
    }
  }
  return out;
}
