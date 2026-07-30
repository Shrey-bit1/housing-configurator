import { cellKey, type Cell } from "./grid";
import { SIDES, SIDE_DELTA, edgeKey, opposite, type Side } from "./exteriorEdges";
import { occupiedCells, isBathroom } from "./modules";
import { connectedComponents, clusterNodeId } from "./cluster";
import { buildSpaceTargets } from "./door";
import { borderReachableEmpty } from "./expansion";
import type { Floor } from "./floor";

/**
 * SEMI-EXTERIOR EDGES — the room↔balcony boundary as a french window.
 *
 * Where a room and an Outdoor cluster share a boundary, that boundary is not a
 * solid wall: it is glazed from the floor to door-head height and solid above,
 * and THE GLASS IS THE DOOR — you walk through it onto the balcony. Two things
 * follow from that one physical fact, and both are implemented off this module:
 *  - the room has real daylight there (it counts for D1/D2, and its area counts
 *    toward W1), and
 *  - the room has real access to the balcony (the graph carries an ACCESS edge
 *    with no authored door).
 *
 * An EDGE here is what `exteriorEdges.ts` already means — one cell plus one of
 * its four sides, 0.6 m of boundary. A room edge is semi-exterior iff the cell
 * across that side belongs to a QUALIFYING Outdoor cluster, so a wall run half
 * against a balcony and half against a bedroom is half french window, half
 * solid wall. BATHROOMS are excluded outright (privacy — see the rooms loop).
 *
 * Everything here is DERIVED — recomputed on every layout change alongside the
 * expansion pass, never stored, never serialized.
 */

/**
 * QUALIFICATION: an Outdoor cluster confers semi-exterior status only if the
 * cluster itself reaches the outside — at least one of its own edges faces a
 * cell that is empty AND border-reachable (or out of bounds). A courtyard
 * sealed inside the flat has no sky, so it confers nothing.
 *
 * "Empty" here is the RULES' notion of occupancy — the `buildSpaceTargets` key
 * set (rooms, clusters, stairs, and stair-hole projections from below), the
 * same set `exteriorEdges` is fed everywhere else. Furniture is deliberately
 * transparent: a 0.6 m cube parked at a balcony's edge does not take away its
 * sky (and A7.1 relies on this for railings).
 */
export interface SemiExteriorPlan {
  /** Room instance id → ABSOLUTE edge keys carrying french-window GLASS. Only
   *  these count for daylight/access; the solid returns at a run's ends are
   *  ordinary interior wall for every purpose. */
  glazedByRoom: Map<string, Set<string>>;
  /** Every ABSOLUTE edge key on a qualifying room↔outdoor boundary, in BOTH
   *  cell/side representations (room side and outdoor side) — glazed cells and
   *  solid returns alike. Used to stop NEW doors being authored there. */
  boundary: Set<string>;
  /** CIRCULATION cluster token → ABSOLUTE edge keys carrying french-window
   *  glass, the corridor counterpart of {@link glazedByRoom}. Kept as a separate
   *  map rather than widening that one: a room is an instance and a corridor is
   *  a merged component, so one map would hold two kinds of key and every
   *  consumer would have to know which it was reading. `rebuildClusterShells`
   *  consumes this; nothing on the room path changes. */
  glazedByCluster: Map<string, Set<string>>;
  /** Room instance id ↔ outdoor cluster token (`clusterNodeId`, the same token
   *  `buildSpaceTargets` uses), for the graph's doorless ACCESS edges. Present
   *  only where a run actually carries glass — no window, no access. */
  access: Array<{ roomId: string; clusterToken: string }>;
  /** Is (cx,cz) open sky? Empty of any SPACE and border-reachable, or out of
   *  bounds. Shared with the cluster-shell railing test (A7.1). */
  isOutside: (cx: number, cz: number) => boolean;
}

/**
 * Glazed width of a french-window band on a run of `n` semi-exterior cells:
 *
 *   w = max(2, min(round(0.75n), n - 2))     and no window at all when w > n
 *
 * | n | w | reading                                                        |
 * |---|---|----------------------------------------------------------------|
 * | 1 | — | solid wall — 0.6 m holds no window, so nothing is conferred    |
 * | 2 | 2 | glass across the whole run (the 2-cell minimum outranks margins)|
 * | 3 | 2 | one solid cell at one end                                      |
 * | 4 | 2 | one solid cell each end                                        |
 * | 5 | 3 | one each end                                                   |
 * | 6 | 4 | one each end                                                   |
 * | 7 | 5 | one each end                                                   |
 * | 8 | 6 | exactly 75% — both rules agree                                 |
 * |≥8 |round(0.75n)| the 75% target binds; margins are ≥1 automatically    |
 *
 * So the one-cell returns cap the band below 75% for runs of 4–7 cells, and the
 * 75% target only actually governs from 8 cells (4.8 m) up. That is deliberate.
 *
 * The 2-cell minimum is 1.2 m — the SIA 500 accessible width this codebase
 * already uses, and exactly the door preset's 1200 mm — so the smallest french
 * window is precisely one door wide. That is the justification, not a
 * coincidence.
 *
 * ROUNDING IS ROUND-HALF-UP (`Math.round`) on purpose: n = 2 (1.5 → 2) and
 * n = 6 (4.5 → 5, then capped to 4 by the margins) depend on it. Do NOT
 * "tidy" this into `Math.floor`.
 */
export function frenchBandWidth(n: number): number {
  const w = Math.max(2, Math.min(Math.round(0.75 * n), n - 2));
  return w > n ? 0 : w;
}

/** Derive every room's french-window edges for one floor (see the module doc). */
export function computeSemiExterior(floor: Floor, floorBelow: Floor | null): SemiExteriorPlan {
  const grid = floor.grid;
  // The rules' occupancy: spaces only (rooms + clusters + stairs + hole
  // projections). Furniture is transparent — see the qualification doc above.
  const spaces = new Set(buildSpaceTargets(floor, floorBelow).keys());
  const isEmpty = (cx: number, cz: number) => !spaces.has(cellKey(cx, cz));
  const outsideCells = borderReachableEmpty(grid, isEmpty);
  const isOutside = (cx: number, cz: number) =>
    !grid.inBounds(cx, cz) || outsideCells.has(cellKey(cx, cz));

  const plan: SemiExteriorPlan = {
    glazedByRoom: new Map(),
    glazedByCluster: new Map(),
    boundary: new Set(),
    access: [],
    isOutside,
  };

  // ---- Which Outdoor clusters qualify -------------------------------------
  const outdoorCells: Cell[] = [];
  for (const inst of floor.store.instances.values())
    if (inst.def.cluster === "outdoor")
      outdoorCells.push(
        ...(floor.effectiveCells.get(inst.id) ??
          occupiedCells(inst.def, inst.origin, inst.rotation, inst.mirrored))
      );
  if (outdoorCells.length === 0) return plan;

  /** Qualifying outdoor cell key → its cluster token. */
  const qualifying = new Map<string, string>();
  for (const component of connectedComponents(outdoorCells)) {
    const reachesSky = component.some((c) =>
      SIDES.some((s) => {
        const [dx, dz] = SIDE_DELTA[s];
        return isOutside(c.cx + dx, c.cz + dz);
      })
    );
    if (!reachesSky) continue; // sealed courtyard — no sky, confers nothing
    const token = clusterNodeId("outdoor", component);
    for (const c of component) qualifying.set(cellKey(c.cx, c.cz), token);
  }
  if (qualifying.size === 0) return plan;

  // ---- Per space: boundary edges → runs → bands ----------------------------
  // ROOMS first, exactly as before. Bathrooms are excluded AT THE SOURCE
  // (privacy — a bathroom keeps a solid wall against outdoor space). Skipping
  // here, before `plan.boundary` is built, is what makes every consequence fall
  // out automatically and in the right direction: no glass, no daylight credit,
  // no doorless access, a balcony whose ONLY contact is a bathroom is
  // unreachable (OD1 fires) — and, because the authoring block reads
  // `plan.boundary`, a NEW door on a bathroom↔terrace boundary is authorable
  // again. Kitchens deliberately KEEP theirs: D2 wants the ventilation.
  for (const inst of floor.store.instances.values()) {
    const def = inst.def;
    if (def.category !== "room" || def.cluster) continue; // rooms only
    if (isBathroom(def)) continue;
    const cells =
      floor.effectiveCells.get(inst.id) ??
      occupiedCells(def, inst.origin, inst.rotation, inst.mirrored);
    const { glazed, accessTokens } = semiExteriorBands(cells, qualifying, plan.boundary);
    if (glazed.size === 0) continue;
    plan.glazedByRoom.set(inst.id, glazed);
    for (const clusterToken of accessTokens)
      plan.access.push({ roomId: inst.id, clusterToken });
  }

  // CIRCULATION clusters next, through the SAME construction. A corridor
  // against a balcony is as much of an envelope boundary as a room against one,
  // and until this existed the corridor got no glass while the room beside it
  // did. The unit is a connected COMPONENT rather than an instance, because
  // that is what `rebuildClusterShells` draws and what `clusterNodeId` names.
  const corridorCells: Cell[] = [];
  for (const inst of floor.store.instances.values())
    if (inst.def.cluster === "circulation")
      corridorCells.push(
        ...(floor.effectiveCells.get(inst.id) ??
          occupiedCells(inst.def, inst.origin, inst.rotation, inst.mirrored))
      );
  for (const component of connectedComponents(corridorCells)) {
    const { glazed, accessTokens } = semiExteriorBands(component, qualifying, plan.boundary);
    if (glazed.size === 0) continue;
    const token = clusterNodeId("circulation", component);
    plan.glazedByCluster.set(token, glazed);
    for (const clusterToken of accessTokens)
      plan.access.push({ roomId: token, clusterToken });
  }

  return plan;
}


/**
 * THE semi-exterior band construction, shared by rooms and circulation clusters
 * and by the test, so no consumer can drift from it.
 *
 * Given a footprint and the qualifying outdoor cells, it records every boundary
 * edge into `boundary` (both cell/side representations, so a door candidate hits
 * it from either side), splits the boundary into maximal contiguous runs per
 * side and line, and glazes a centred band in each run whose width comes from
 * {@link frenchBandWidth}. A one-cell contact confers nothing and stays solid.
 *
 * Returns the glazed ABSOLUTE edge keys and the outdoor cluster tokens the glass
 * grants access to. It mutates `boundary` because the caller wants every
 * boundary edge recorded whether or not it ends up glazed: the door-authoring
 * block reads `boundary`, and a solid return at a run's end is still a
 * room↔outdoor boundary.
 */
export function semiExteriorBands(
  cells: Cell[],
  qualifying: Map<string, string>,
  boundary: Set<string>
): { glazed: Set<string>; accessTokens: Set<string> } {
  // Boundary edges facing a qualifying outdoor cell, bucketed per side and per
  // line so contiguous runs fall out. North/south runs vary in cx along a fixed
  // cz; east/west runs vary in cz along a fixed cx.
  const bySideLine = new Map<string, { cell: Cell; token: string; along: number }[]>();
  for (const c of cells) {
    for (const side of SIDES) {
      const [dx, dz] = SIDE_DELTA[side];
      const token = qualifying.get(cellKey(c.cx + dx, c.cz + dz));
      if (!token) continue;
      boundary.add(edgeKey(c.cx, c.cz, side));
      boundary.add(edgeKey(c.cx + dx, c.cz + dz, opposite(side)));
      const runsAlongX = side === "north" || side === "south";
      const line = `${side}|${runsAlongX ? c.cz : c.cx}`;
      const entry = bySideLine.get(line) ?? [];
      entry.push({ cell: c, token, along: runsAlongX ? c.cx : c.cz });
      bySideLine.set(line, entry);
    }
  }

  const glazed = new Set<string>();
  const accessTokens = new Set<string>();
  for (const [line, entries] of bySideLine) {
    const side = line.slice(0, line.indexOf("|")) as Side;
    entries.sort((a, b) => a.along - b.along);
    // Maximal contiguous runs. A boundary that turns a corner is two runs in v1
    // (corner-wrap is PARKED — see PROJECT_STATE §2o).
    let start = 0;
    for (let i = 1; i <= entries.length; i++) {
      if (i < entries.length && entries[i].along === entries[i - 1].along + 1) continue;
      const run = entries.slice(start, i);
      start = i;
      const w = frenchBandWidth(run.length);
      if (w === 0) continue; // 1-cell contact: solid wall, nothing conferred
      // Centre the band; an odd remainder puts the extra solid cell at the FAR
      // end (`Math.floor` of the leading margin).
      const lead = Math.floor((run.length - w) / 2);
      for (let k = lead; k < lead + w; k++) {
        const e = run[k];
        glazed.add(edgeKey(e.cell.cx, e.cell.cz, side));
        accessTokens.add(e.token);
      }
    }
  }
  return { glazed, accessTokens };
}
