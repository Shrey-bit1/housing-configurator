import { CELL_SIZE, type Cell } from "./grid";
import {
  exteriorEdges,
  edgeKey,
  type BoundaryEdge,
  type Side,
} from "./exteriorEdges";
import {
  sideBearing,
  bearingSector,
  southDistance,
  isNorthLit,
  sortSectorsBySouth,
  type CompassSector,
} from "./orientation";

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
 * A band is never narrower than {@link MIN_WINDOW_EDGES} (1200 mm) as a whole.
 *
 * CORNER WRAPPING: a band that exhausts its straight run before the room's
 * glazing target is met may continue around a CONVEX exterior corner onto the
 * perpendicular run (an L, or — falling out naturally at both ends — a U in
 * plan), in preference to opening a separate, unconnected band elsewhere. See
 * {@link Arm}/{@link stepArm} below. Concave (notch-inner) corners never wrap —
 * see the doc comment on {@link cornerCheckSide} for why the same test that
 * finds a wrap can never fire there. Wrapping never crosses an entrance edge
 * (those are already excluded from `ext` below, same as a straight run).
 *
 * SOUTH BIAS: the plan is a pure, deterministic function of (footprint,
 * floorHeight, occupancy, entrances, **northAngle**). Seed runs are chosen in
 * order of SOUTHERNNESS first (a run's compass bearing under `northAngle`, via
 * `sideBearing`, nearest due south wins), length as the tie-break — so glazing
 * migrates to the sunny faces. Band growth + corner-wrapping (below) then
 * proceed exactly as before. Rotating north re-scores the runs, so windows
 * visibly move to whatever face now points south; the whole thing stays a pure
 * function of the transformed footprint + angle (derive-don't-store), so the
 * canonical plan is reproduced identically on load, undo, rotate, and mirror.
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

/** Achieved-vs-target glazing for one room — what the W1 rule consumes, plus the
 *  derived orientation of the room's glazing (OR1 + the report's mix line). */
export interface GlazingStat {
  /** Target glazing area / floor area (0 for types that never window). */
  targetRatio: number;
  /** Achieved glazing area / floor area. */
  achievedRatio: number;
  /** Achieved below target (only ever true for windowed room types). */
  belowTarget: boolean;
  /** Distinct compass sectors this room's windowed edges face, most-southern
   *  first (see {@link sortSectorsBySouth}); EMPTY when the room has no glazing.
   *  Derived under the project's `northAngle` — a corner-wrapped band naturally
   *  contributes two sectors (one per leg). Consumed by the report's mix line. */
  sectors: CompassSector[];
  /** True iff the room HAS glazing AND every windowed edge is north-facing
   *  (within {@link isNorthLit}'s arc of due north) — OR1's exact condition. A
   *  room with NO glazing is `false` here (its daylight is D1/W1's business, not
   *  OR1's), so gating OR1 on this can never double-fire with them. */
  northLit: boolean;
}

export interface WindowPlan extends GlazingStat {
  /** Windowed edges (ABSOLUTE cell coords) → their variant. */
  edges: Map<string, WindowVariant>;
  /** The variant used for this room (null when it gets no windows). */
  variant: WindowVariant | null;
}

/** A continuous straight run of same-side exterior edges (a run itself never
 *  turns a corner — {@link buildRuns} stops at one — but a band placed on one
 *  MAY continue past its ends onto an adjacent run; see {@link stepArm}). */
interface Run {
  side: Side;
  edges: BoundaryEdge[];
  /** This run's compass bearing under the project northAngle (all its edges
   *  share one side, so one bearing). Drives the south-bias seed ordering. */
  bearing: number;
}

/**
 * Compute the window plan for one room.
 *
 * @param cells             room's ABSOLUTE footprint cells
 * @param roomTypeId        `def.type` (keys {@link WINDOW_CONFIG})
 * @param floorHeight       floor's true floor-to-floor height (world units)
 * @param occupied          set of ALL room/cluster/stair cell keys on the floor
 * @param entranceEdgeKeys  edges hosting an entrance — skipped (a door wins there)
 * @param northAngle        project north (degrees, see orientation.ts) — biases
 *                          seed-run selection toward south and classifies the
 *                          resulting glazing's orientation. Default 0 keeps the
 *                          pre-north behaviour (grid-south = due south).
 */
export function computeWindows(
  cells: Cell[],
  roomTypeId: string,
  floorHeight: number,
  occupied: Set<string>,
  entranceEdgeKeys: Set<string>,
  northAngle = 0
): WindowPlan {
  const config = WINDOW_CONFIG[roomTypeId];
  if (!config) {
    // Type never gets windows (bathroom / circulation / outdoor).
    return {
      edges: new Map(), variant: null,
      targetRatio: 0, achievedRatio: 0, belowTarget: false,
      sectors: [], northLit: false,
    };
  }

  const { targetRatio, variant, fixedEdges } = config;
  const floorArea = cells.length * CELL_AREA;
  const perEdge = perEdgeGlazing(variant, floorHeight);

  // Exterior edges, minus any coinciding with an entrance (door wins there).
  const ext = exteriorEdges(cells, occupied).filter(
    (e) => !entranceEdgeKeys.has(edgeKey(e.cx, e.cz, e.side))
  );
  // Lookup for corner-wrap walking (`stepArm`) — same edge set as `ext`, keyed.
  const extKeys = new Set(ext.map((e) => edgeKey(e.cx, e.cz, e.side)));

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

  // Place bands: SOUTHERNMOST run first (bearing nearest due south under
  // northAngle), length as the tie-break, then a stable final key so the plan
  // is fully deterministic even when two faces tie on southernness (e.g. north
  // pointing exactly NE/NW makes two sides equidistant from south). A run
  // centred+grown covers the need on its own; a run too short is used in full
  // and then WRAPPED around a convex corner at either end (see `stepArm`)
  // before falling back to the next run in the sorted order.
  const runs = buildRuns(ext, northAngle).sort(
    (a, b) =>
      southDistance(a.bearing) - southDistance(b.bearing) ||
      b.edges.length - a.edges.length ||
      runKey(a) - runKey(b)
  );
  const windowed = new Map<string, WindowVariant>();
  const used = new Set<string>(); // every placed edge, straight or wrapped
  let placed = 0;
  let remaining = edgesNeeded;

  const place = (e: BoundaryEdge) => {
    const k = edgeKey(e.cx, e.cz, e.side);
    windowed.set(k, variant);
    used.add(k);
    placed++;
    remaining--;
  };

  for (const run of runs) {
    if (remaining <= 0) break;
    // A run already touched by an earlier band's corner-wrap isn't a fresh,
    // independent seed any more (its edges are spoken for) — skip it. Distinct
    // runs are otherwise always edge-disjoint (buildRuns' own guarantee), so
    // this only ever trips for a wrap-consumed run.
    if (run.edges.some((e) => used.has(edgeKey(e.cx, e.cz, e.side)))) continue;
    if (run.edges.length < MIN_WINDOW_EDGES) continue; // can't host a ≥2 band on its own

    if (run.edges.length <= remaining) {
      // Run alone can't (fully) cover the need — use all of it, then try to
      // wrap a convex corner at each end for the shortfall. A 1-edge wrap is
      // fine here (the band as a whole is already ≥2 from the straight run).
      for (const e of run.edges) place(e);
      if (remaining > 0) {
        const first = run.edges[0];
        const last = run.edges[run.edges.length - 1];
        const lowArm: Arm = { cx: first.cx, cz: first.cz, side: run.side, dir: -1 };
        const highArm: Arm = { cx: last.cx, cz: last.cz, side: run.side, dir: 1 };
        let lowAlive = true;
        let highAlive = true;
        // Alternate the two arms so a band that wraps both ends (U-shaped)
        // grows evenly rather than exhausting one side before touching the
        // other; an end with no valid corner just falls out of rotation.
        while (remaining > 0 && (lowAlive || highAlive)) {
          if (lowAlive) {
            const e = stepArm(lowArm, extKeys, used);
            if (e) place(e);
            else lowAlive = false;
            if (remaining <= 0) break;
          }
          if (highAlive) {
            const e = stepArm(highArm, extKeys, used);
            if (e) place(e);
            else highAlive = false;
          }
        }
      }
    } else {
      // Run alone covers the need — original centred, symmetric placement.
      let b = Math.max(MIN_WINDOW_EDGES, remaining);
      // Avoid leaving "need exactly 1 more" (which would force a 1-edge window
      // on some future unconnected band): extend THIS band by 1 if the run has
      // room; else the next band's max(2, 1) = 2 covers it.
      if (remaining - b === 1 && b < run.edges.length) b += 1;
      const start = Math.floor((run.edges.length - b) / 2); // centre the band
      for (let i = start; i < start + b; i++) place(run.edges[i]);
    }
  }

  const achievedRatio = floorArea > 0 ? (placed * perEdge) / floorArea : 0;
  const effectiveTargetRatio =
    fixedEdges !== undefined
      ? floorArea > 0
        ? (targetEdges * perEdge) / floorArea
        : 0
      : targetRatio;

  // Orientation of the glazing actually placed (for OR1 + the report's mix
  // line). Each windowed edge's side → its bearing under northAngle → a sector;
  // northLit iff there's glazing and EVERY edge faces within the north arc.
  const sectorSet = new Set<CompassSector>();
  let allNorth = true;
  for (const key of windowed.keys()) {
    const side = key.slice(key.lastIndexOf(",") + 1) as Side;
    const bearing = sideBearing(side, northAngle);
    sectorSet.add(bearingSector(bearing));
    if (!isNorthLit(bearing)) allNorth = false;
  }

  return {
    edges: windowed,
    variant,
    targetRatio: effectiveTargetRatio,
    achievedRatio,
    belowTarget: placed < targetEdges,
    sectors: sortSectorsBySouth([...sectorSet]),
    northLit: windowed.size > 0 && allNorth,
  };
}

/** Stable final ordering key for two runs that tie on southernness AND length —
 *  a deterministic tie-break so the plan never depends on Map iteration order.
 *  Encodes the run's side then its first edge's coordinates. */
function runKey(run: Run): number {
  const sideRank = { north: 0, east: 1, south: 2, west: 3 }[run.side];
  const e = run.edges[0];
  return sideRank * 1e6 + (e.cx + 500) * 1e3 + (e.cz + 500);
}

/**
 * Group exterior edges into continuous straight runs. A run is edges on the
 * SAME side (normal) that are colinear and consecutive along that side's axis:
 * north/south runs vary in cx at fixed cz; east/west runs vary in cz at fixed
 * cx. So a run itself never turns a corner — a BAND may still continue past a
 * run's end onto an adjacent one, see {@link stepArm}. Each run carries its
 * compass `bearing` under `northAngle` (all its edges share one side) for the
 * south-bias sort in {@link computeWindows}.
 */
function buildRuns(edges: BoundaryEdge[], northAngle: number): Run[] {
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
    const bearing = sideBearing(side, northAngle);
    const horiz = side === "north" || side === "south";
    list.sort((a, b) => (horiz ? a.cx - b.cx : a.cz - b.cz));
    let cur: BoundaryEdge[] = [];
    let prev = NaN;
    for (const e of list) {
      const coord = horiz ? e.cx : e.cz;
      if (cur.length === 0 || coord === prev + 1) cur.push(e);
      else {
        runs.push({ side, edges: cur, bearing });
        cur = [e];
      }
      prev = coord;
    }
    if (cur.length) runs.push({ side, edges: cur, bearing });
  }
  return runs;
}

// ---- Corner wrapping --------------------------------------------------------
//
// A band walks outward from a run's own two ends via `stepArm`, one edge at a
// time. Each end is an independent "arm": as long as the next cell along the
// CURRENT side is still exterior, the arm just keeps going in a straight line
// (still inside `buildRuns`' notion of a run — this only actually bites the
// first time, since a run is already maximal by construction). Once that
// fails, the arm tries to WRAP: does the cell it's sitting on also have an
// exterior edge on the perpendicular face pointing the same way the arm has
// been walking? If so, that's a convex corner — hop onto the new face and
// keep walking (in a, possibly different, direction fixed by the face just
// left; see `wrapDirection`). If not, the arm is done (a concave corner, an
// entrance edge — already absent from `extKeys` — or the map's own edge).

/** One end of a growing band: the last edge it placed, and which way (+1/−1
 *  along that side's own axis) it's currently walking. */
interface Arm {
  cx: number;
  cz: number;
  side: Side;
  dir: 1 | -1;
}

/**
 * Which perpendicular face to test, on the SAME cell an arm is sitting on, for
 * a convex-corner continuation. A horizontal run (north/south) walking toward
 * −cx checks its cell's WEST face; toward +cx, EAST. A vertical run (east/
 * west) walking toward −cz checks NORTH; toward +cz, SOUTH — i.e. always "the
 * face that points the same way the arm is already heading."
 *
 * This can only ever match a CONVEX corner: both faces tested belong to ONE
 * cell (the arm's own), which is exactly what makes a boundary vertex convex
 * (a single cell contributing both edges, a 90° turn through the room's
 * interior). A concave (reflex) corner is the opposite shape — its two edges
 * belong to two DIFFERENT, diagonally-adjacent cells around a missing notch
 * cell — which this same-cell test structurally never examines, so it can
 * never fire there. No separate concave exclusion is needed.
 */
function cornerCheckSide(side: Side, dir: 1 | -1): Side {
  const horiz = side === "north" || side === "south";
  const low = dir === -1;
  if (horiz) return low ? "west" : "east";
  return low ? "north" : "south";
}

/**
 * The walking direction a band continues in immediately after wrapping onto a
 * new face, determined solely by the face it just wrapped FROM (independent
 * of which end of the run, or which of the two perpendicular faces, it turned
 * onto — verified by direct case analysis of all four convex-corner shapes).
 * A south-facing run always hands off at DECREASING cz (back toward the room,
 * up whichever east/west face it lands on); north at increasing cz; east at
 * decreasing cx; west at increasing cx.
 */
function wrapDirection(fromSide: Side): 1 | -1 {
  return fromSide === "north" || fromSide === "west" ? 1 : -1;
}

/**
 * Advance `arm` by one edge — straight along its current face if possible,
 * else around a convex corner (updating `arm.side`/`arm.dir` in place) — and
 * return the newly-claimed edge, or `null` if the arm has dead-ended (map
 * edge, entrance, concave corner, or an edge another arm already claimed).
 */
function stepArm(arm: Arm, extKeys: Set<string>, used: Set<string>): BoundaryEdge | null {
  const horiz = arm.side === "north" || arm.side === "south";
  const straightCell = horiz
    ? { cx: arm.cx + arm.dir, cz: arm.cz }
    : { cx: arm.cx, cz: arm.cz + arm.dir };
  const straightKey = edgeKey(straightCell.cx, straightCell.cz, arm.side);
  if (extKeys.has(straightKey) && !used.has(straightKey)) {
    arm.cx = straightCell.cx;
    arm.cz = straightCell.cz;
    return { cx: arm.cx, cz: arm.cz, side: arm.side };
  }
  const turnSide = cornerCheckSide(arm.side, arm.dir);
  const turnKey = edgeKey(arm.cx, arm.cz, turnSide);
  if (extKeys.has(turnKey) && !used.has(turnKey)) {
    arm.dir = wrapDirection(arm.side); // must read the OLD side before overwriting
    arm.side = turnSide;
    return { cx: arm.cx, cz: arm.cz, side: arm.side };
  }
  return null;
}
