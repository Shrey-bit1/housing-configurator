import { CELL_SIZE, type Cell } from "./grid";
import {
  exteriorEdges,
  edgeKey,
  type BoundaryEdge,
  type Side,
} from "./exteriorEdges";

/**
 * Rule-driven window GENERATOR — pure computation, no Three.js.
 *
 * Windows are DERIVED, never stored: this decides, per room, which of its
 * exterior cell-edges get glazed and with which panel-kit variant, from the
 * room type + its exterior edges + the floor height. Regenerated on every wall
 * rebuild (see FloorManager.rebuildWalls), exactly like cluster shells and
 * stair holes. The renderer (moduleMesh.buildBoundaryWalls) consumes the
 * per-edge assignment; the W1 rule consumes the achieved-vs-target stat.
 *
 * Exterior-edge detection reuses the shared {@link exteriorEdges} utility, so a
 * wall shared with another room (or facing a stair/cluster) is never windowed.
 * A window band never wraps a corner (bands live within one straight run on one
 * side) and is never narrower than {@link MIN_WINDOW_EDGES} (1200 mm).
 */

/** A windowed edge is either sill+lintel+glazing ("framed") or sill+glazing
 *  with the floor slab above acting as the lintel ("full-height"). */
export type WindowVariant = "framed" | "full-height";

// ---- Panel-kit dimensions (absolute real-world metres, in floor coords) ----
// Panels stay these heights regardless of floor height; the glazing gap absorbs
// any extra height on taller floors.

/** Solid wall band from 0 → here on every windowed edge. */
export const SILL_H = 0.9;
/** Solid wall band hanging this far from the top (framed variant only). */
export const LINTEL_H = 0.9;
/** One windowed cell-edge is this wide (a grid cell). */
export const EDGE_WIDTH = CELL_SIZE;
/** Hard minimum window width: no 1-edge windows, ever. */
export const MIN_WINDOW_EDGES = 2;

const CELL_AREA = CELL_SIZE * CELL_SIZE; // 0.36 m² per footprint cell

interface WindowTypeConfig {
  /** Target glazing area as a fraction of floor area. Ignored if `fixedEdges`. */
  targetRatio: number;
  variant: WindowVariant;
  /** Kitchen: a fixed band size (one 2-edge band), ratio not used for sizing. */
  fixedEdges?: number;
}

/**
 * Per-room-type window policy. Room types ABSENT from this table get NO windows
 * (bathrooms, circulation, outdoor). Targets grounded in Swiss practice
 * (habitable rooms want glazing ≥ ~1/10 of floor area). Tunable.
 */
export const WINDOW_CONFIG: Record<string, WindowTypeConfig> = {
  living: { targetRatio: 1 / 6, variant: "full-height" },
  recreation: { targetRatio: 1 / 6, variant: "full-height" },
  bedroom_small: { targetRatio: 1 / 10, variant: "framed" },
  bedroom_large: { targetRatio: 1 / 10, variant: "framed" },
  kitchen: { targetRatio: 1 / 10, variant: "framed", fixedEdges: 2 },
};

/** Glazing AREA (m²) contributed by ONE windowed edge, given the variant and
 *  the floor's true floor-to-floor height. */
export function perEdgeGlazing(variant: WindowVariant, floorHeight: number): number {
  const gap =
    variant === "full-height"
      ? floorHeight - SILL_H // slab above is the lintel
      : floorHeight - SILL_H - LINTEL_H;
  return EDGE_WIDTH * Math.max(0, gap);
}

/** Achieved-vs-target glazing for one room — what the W1 rule consumes. */
export interface GlazingStat {
  /** Target glazing area / floor area (0 for types that never window). */
  targetRatio: number;
  /** Achieved glazing area / floor area. */
  achievedRatio: number;
  /** Achieved below target (only ever true for windowed room types). */
  belowTarget: boolean;
}

export interface WindowPlan extends GlazingStat {
  /** Windowed edges (ABSOLUTE cell coords) → their variant. */
  edges: Map<string, WindowVariant>;
  /** The variant used for this room (null when it gets no windows). */
  variant: WindowVariant | null;
}

/** A continuous straight run of same-side exterior edges (never wraps a corner). */
interface Run {
  side: Side;
  edges: BoundaryEdge[];
}

/**
 * Compute the window plan for one room.
 *
 * @param cells             room's ABSOLUTE footprint cells
 * @param roomTypeId        `def.type` (keys {@link WINDOW_CONFIG})
 * @param floorHeight       floor's true floor-to-floor height (world units)
 * @param occupied          set of ALL room/cluster/stair cell keys on the floor
 * @param entranceEdgeKeys  edges hosting an entrance — skipped (a door wins there)
 */
export function computeWindows(
  cells: Cell[],
  roomTypeId: string,
  floorHeight: number,
  occupied: Set<string>,
  entranceEdgeKeys: Set<string>
): WindowPlan {
  const config = WINDOW_CONFIG[roomTypeId];
  if (!config) {
    // Type never gets windows (bathroom / circulation / outdoor).
    return { edges: new Map(), variant: null, targetRatio: 0, achievedRatio: 0, belowTarget: false };
  }

  const { targetRatio, variant, fixedEdges } = config;
  const floorArea = cells.length * CELL_AREA;
  const perEdge = perEdgeGlazing(variant, floorHeight);

  // Exterior edges, minus any coinciding with an entrance (door wins there).
  const ext = exteriorEdges(cells, occupied).filter(
    (e) => !entranceEdgeKeys.has(edgeKey(e.cx, e.cz, e.side))
  );

  // How many edges we need to glaze to hit the target.
  let edgesNeeded: number;
  if (fixedEdges !== undefined) {
    edgesNeeded = fixedEdges;
  } else {
    edgesNeeded = perEdge > 0 ? Math.ceil((floorArea * targetRatio) / perEdge) : 0;
  }
  // Enforce the 2-edge minimum (round a computed 1 up to 2).
  if (edgesNeeded > 0 && edgesNeeded < MIN_WINDOW_EDGES) edgesNeeded = MIN_WINDOW_EDGES;
  const targetEdges = edgesNeeded;

  // Place bands: longest straight run first, band centred on the run and grown
  // symmetrically to meet the remaining need (each band still ≥2 edges).
  const runs = buildRuns(ext).sort((a, b) => b.edges.length - a.edges.length);
  const windowed = new Map<string, WindowVariant>();
  let placed = 0;
  let remaining = edgesNeeded;
  for (const run of runs) {
    if (remaining <= 0) break;
    if (run.edges.length < MIN_WINDOW_EDGES) continue; // can't host a ≥2 band
    let b = Math.min(run.edges.length, Math.max(MIN_WINDOW_EDGES, remaining));
    // Avoid leaving "need exactly 1 more" (which would force a 1-edge window):
    // extend THIS band by 1 if the run has room; else the next band's
    // max(2, 1) = 2 covers it. Either way no 1-edge window is ever created.
    if (remaining - b === 1 && b < run.edges.length) b += 1;
    const start = Math.floor((run.edges.length - b) / 2); // centre the band
    for (let i = start; i < start + b; i++) {
      const e = run.edges[i];
      windowed.set(edgeKey(e.cx, e.cz, e.side), variant);
    }
    placed += b;
    remaining -= b;
  }

  const achievedRatio = floorArea > 0 ? (placed * perEdge) / floorArea : 0;
  const effectiveTargetRatio =
    fixedEdges !== undefined
      ? floorArea > 0
        ? (targetEdges * perEdge) / floorArea
        : 0
      : targetRatio;

  return {
    edges: windowed,
    variant,
    targetRatio: effectiveTargetRatio,
    achievedRatio,
    belowTarget: placed < targetEdges,
  };
}

/**
 * Group exterior edges into continuous straight runs. A run is edges on the
 * SAME side (normal) that are colinear and consecutive along that side's axis:
 * north/south runs vary in cx at fixed cz; east/west runs vary in cz at fixed
 * cx. So a run never turns a corner — window bands can't wrap corners.
 */
function buildRuns(edges: BoundaryEdge[]): Run[] {
  const groups = new Map<string, BoundaryEdge[]>();
  for (const e of edges) {
    const horiz = e.side === "north" || e.side === "south"; // runs along x
    const fixed = horiz ? e.cz : e.cx;
    const gkey = `${e.side}:${fixed}`;
    let list = groups.get(gkey);
    if (!list) groups.set(gkey, (list = []));
    list.push(e);
  }

  const runs: Run[] = [];
  for (const list of groups.values()) {
    const side = list[0].side;
    const horiz = side === "north" || side === "south";
    list.sort((a, b) => (horiz ? a.cx - b.cx : a.cz - b.cz));
    let cur: BoundaryEdge[] = [];
    let prev = NaN;
    for (const e of list) {
      const coord = horiz ? e.cx : e.cz;
      if (cur.length === 0 || coord === prev + 1) cur.push(e);
      else {
        runs.push({ side, edges: cur });
        cur = [e];
      }
      prev = coord;
    }
    if (cur.length) runs.push({ side, edges: cur });
  }
  return runs;
}
