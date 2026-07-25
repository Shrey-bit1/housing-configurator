import { cellKey, type Cell } from "./grid";
import type { Floor } from "./floor";
import { occupiedCells } from "./modules";
import { connectedComponents, clusterNodeId } from "./cluster";
import { exteriorEdges } from "./exteriorEdges";
import { buildSpaceTargets, resolveDoorSpaces, BELOW_PREFIX } from "./door";
import type { GlazingStat } from "./windows";

/**
 * Whole-dwelling adjacency graph — all floors' rooms/clusters/STAIRS as nodes,
 * with TOUCH edges (physical adjacency, incl. cross-floor `viaStair` touch) AND
 * authored-door ACCESS edges (`viaDoor`), and the floor-0 entrances (resolved +
 * validity-checked) marking entry roots.
 *
 * Purely DERIVED (recomputed from the live layout). It is what the rules engine
 * (`rules.ts`) consumes for entrance-rooted, cross-floor reachability, and what
 * the bubble-diagram renders (per-floor, with stair stubs). No rules here.
 *
 * Node ids are namespaced by floor (`<floor>/<rawId>`) because per-floor
 * instance ids (`m1`, …) and cluster ids collide across floors.
 *
 * STAIRS ARE GRAPH NODES (kind "stair"): a stair gets same-floor ("bottom")
 * edges to whatever touches its footprint on its own floor (produced generically
 * by the same touch-edge pass every node goes through) and `viaStair` ("top")
 * edges to whatever touches its footprint projected onto the floor above. This
 * lets rules check a stair's own reachability/connectivity (is it linked to
 * anything at all?) rather than only ever appearing as a shortcut between two
 * rooms — a room on floor N reaching a room on floor N+1 now routes THROUGH the
 * stair node (one extra hop), which doesn't change reachability results, just
 * makes the stair itself inspectable.
 */

export interface GraphNode {
  /** Dwelling-unique id: `<floor>/<rawId>`. */
  id: string;
  /** Id within its floor: a room/stair instance id, or `cluster:<key>:<min-cell>`. */
  rawId: string;
  floor: number;
  /** Room type id (def.type), cluster key ("circulation"/"outdoor"), or "stair". */
  roomTypeId: string;
  label: string;
  color: number;
  kind: "room" | "cluster" | "stair";
  /** Footprint cells (absolute, on its floor) — used for adjacency. */
  cells: Cell[];
  /** True when a NON-BLOCKED entrance attaches here (a reachability root). */
  isEntry?: boolean;
  /** True when this footprint has daylight: at least one TRUE exterior edge
   *  (per the shared {@link exteriorEdges} utility) OR at least one GLAZED
   *  SEMI-EXTERIOR edge — a french window onto a qualifying balcony, which is
   *  real daylight and real access (core/semiExterior.ts). The daylight rules
   *  (D1/D2) and W1's gate consume this rather than recomputing anything. */
  hasExteriorEdge: boolean;
  /** The two halves of {@link hasExteriorEdge}, kept apart on purpose: most
   *  consumers treat them alike, but the bridge export classifies TRUE
   *  exterior edges only, and a future daylight-discount rule (balcony depth)
   *  will want to know which is which. */
  hasTrueExteriorEdge: boolean;
  hasSemiExteriorEdge: boolean;
  /** Achieved-vs-target glazing for this room (rooms only), from the derived
   *  window generator (`floor.windowStats`) — the W1 rule consumes this rather
   *  than recomputing windows. Undefined for clusters/stairs and rooms whose
   *  type never windows. */
  glazing?: GlazingStat;
}

export interface GraphEdge {
  a: string; // node id
  b: string; // node id
  /**
   * The graph emits BOTH kinds of edge between spaces:
   *  - `viaDoor: false` — a TOUCH edge: the two footprints share a wall
   *    (physical adjacency). Consumed only by the proximity rules (H4/S3/S4/S5),
   *    which are about being next to each other, not about access.
   *  - `viaDoor: true` — an ACCESS edge: the two spaces are connected. ALL
   *    reachability-family rules (H1/H2/H3/H6/G1/ST2/C1/C2/DP1,
   *    entrance-rooted) traverse ONLY these — physical touch without access is
   *    not a connection. Stair links (bottom and top) are access edges too,
   *    formed only where a door faces the stair footprint / hole projection.
   *    Since the semi-exterior pass an ACCESS edge is not necessarily an
   *    AUTHORED DOOR: a french window is one too (see {@link viaFrench}).
   */
  viaDoor: boolean;
  /** A cross-floor link made by a stair (vs. a normal same-floor wall touch). */
  viaStair?: boolean;
  /** An ACCESS edge conferred by a FRENCH WINDOW on a room↔balcony boundary,
   *  with no authored door — the glass IS the door (core/semiExterior.ts).
   *  Outdoor clusters are LEAVES for routing, so no interior path ever passes
   *  THROUGH one (see rules.ts `reachableFrom` / `accessDepths`). */
  viaFrench?: boolean;
}

/**
 * Validity-checked entrance, re-derived every graph build: an entrance binds to
 * a (cell, side) at placement time, but nothing re-validates it as the layout
 * changes afterward — a later room placed against that edge, or the host room
 * itself being removed, makes it stale. `blocked` is true when either the host
 * cell no longer resolves to a room/cluster, or the edge is no longer exterior
 * (re-checked here via the shared {@link exteriorEdges} utility). A blocked
 * entrance never contributes to `entryIds`/`isEntry`.
 */
export interface EntranceStatus {
  /** Dwelling-scoped id: `<floor>/<entrance.id>`. */
  id: string;
  floor: number;
  /** Dwelling node id of the room/cluster it's attached to, if resolvable. */
  hostId: string | null;
  blocked: boolean;
}

export interface DwellingGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Node ids that carry a NON-BLOCKED entrance (floor-0 roots for reachability). */
  entryIds: string[];
  /** Every floor-0 entrance's current validity (see {@link EntranceStatus}). */
  entrances: EntranceStatus[];
  floorCount: number;
  /** Total authored doors across all floors — lets the cutover note (DR1)
   *  explain a wall of reachability flags on a doorless dwelling. */
  doorCount: number;
}

/** Namespace a per-floor raw id into a dwelling-unique node id. */
export function dwellingNodeId(floor: number, rawId: string): string {
  return `${floor}/${rawId}`;
}

/** Split a dwelling node id back into its floor index + raw id. */
export function parseDwellingNodeId(id: string): { floor: number; rawId: string } {
  const slash = id.indexOf("/");
  return { floor: Number(id.slice(0, slash)), rawId: id.slice(slash + 1) };
}

/** Same encoding as {@link dwellingNodeId}, named separately for call-site
 *  clarity when the id identifies an ENTRANCE rather than a graph node. */
export const dwellingEntranceId = dwellingNodeId;

const NEIGH: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Build one floor's room/cluster/stair nodes (namespaced) + a cell→node-id owner map.
 *  `floorBelow` (null on the ground floor) supplies stair-hole projections so
 *  `hasExteriorEdge` doesn't count a void-facing edge as exterior (see below). */
function buildFloorNodes(
  floor: Floor,
  fi: number,
  floorBelow: Floor | null
): { nodes: GraphNode[]; owner: Map<string, string> } {
  const nodes: GraphNode[] = [];
  const connectors = new Map<string, { color: number; label: string; cells: Cell[] }>();

  for (const inst of floor.store.instances.values()) {
    const def = inst.def;
    if (def.category === "stair") {
      nodes.push({
        id: dwellingNodeId(fi, inst.id),
        rawId: inst.id,
        floor: fi,
        roomTypeId: def.type,
        label: def.name,
        color: def.color,
        kind: "stair",
        cells: occupiedCells(def, inst.origin, inst.rotation, inst.mirrored),
        hasExteriorEdge: false, // filled in below, once the floor's occupied set exists
        hasTrueExteriorEdge: false,
        hasSemiExteriorEdge: false,
      });
      continue;
    }
    if (def.category !== "room") continue; // furniture modules excluded
    // EFFECTIVE footprint (core/expansion.ts): an elastic room's node carries
    // its grown cells, so adjacency, reachability, depth, entrance hosting,
    // D1/D2 exterior-ness, and the diagram all see the derived shape. Fixed
    // instances pass through; absent id → seed fallback.
    const cells =
      floor.effectiveCells.get(inst.id) ??
      occupiedCells(def, inst.origin, inst.rotation, inst.mirrored);
    if (def.cluster) {
      let entry = connectors.get(def.cluster);
      if (!entry) {
        entry = { color: def.color, label: def.group ?? def.cluster, cells: [] };
        connectors.set(def.cluster, entry);
      }
      entry.cells.push(...cells);
    } else {
      nodes.push({
        id: dwellingNodeId(fi, inst.id),
        rawId: inst.id,
        floor: fi,
        roomTypeId: def.type,
        label: def.name,
        color: def.color,
        kind: "room",
        cells,
        hasExteriorEdge: false,
        hasTrueExteriorEdge: false,
        hasSemiExteriorEdge: false,
        glazing: floor.windowStats.get(inst.id), // derived by the wall/window pass
      });
    }
  }

  for (const [key, entry] of connectors) {
    for (const component of connectedComponents(entry.cells)) {
      const raw = clusterNodeId(key, component);
      nodes.push({
        id: dwellingNodeId(fi, raw),
        rawId: raw,
        floor: fi,
        roomTypeId: key,
        label: entry.label,
        color: entry.color,
        kind: "cluster",
        cells: component,
        hasExteriorEdge: false,
        hasTrueExteriorEdge: false,
        hasSemiExteriorEdge: false,
      });
    }
  }

  const owner = new Map<string, string>();
  for (const node of nodes)
    for (const c of node.cells) owner.set(cellKey(c.cx, c.cz), node.id);

  // Daylight/ventilation rules (D1/D2) need to know which rooms touch the
  // OUTSIDE (open sky), not just any non-room edge. Classify exterior edges
  // against the SAME `buildSpaceTargets` set the door system uses — which adds,
  // beyond this floor's rooms/clusters/stairs, the stair-HOLE PROJECTIONS from
  // the floor below. Without those, a floor-N+1 room bordering the stairwell
  // void would count the void-facing edge as "exterior" (no sky there), letting
  // D1 pass a windowless room and W1 count void-facing edges. (Same-floor
  // stairs were already covered — they're real occupants; the hole is the gap.)
  // …and, since the sealed-void fix, an edge must also face a cell that can
  // REACH THE GRID BORDER (`floor.isOutside`): a room that walls off an empty
  // pocket has no facade there, so D1 fires and no window is generated onto it.
  const occupied = new Set(buildSpaceTargets(floor, floorBelow).keys());
  for (const node of nodes) {
    node.hasTrueExteriorEdge = exteriorEdges(node.cells, occupied, floor.isOutside).length > 0;
    // A GLAZED semi-exterior edge (french window onto a qualifying balcony) is
    // real daylight, so it satisfies D1/D2 and opens W1's gate exactly like a
    // true exterior edge. The solid returns at a run's ends confer nothing —
    // `glazedByRoom` holds only the glazed cells (core/semiExterior.ts).
    node.hasSemiExteriorEdge = (floor.semiExterior?.glazedByRoom.get(node.rawId)?.size ?? 0) > 0;
    node.hasExteriorEdge = node.hasTrueExteriorEdge || node.hasSemiExteriorEdge;
  }

  return { nodes, owner };
}

/** Node ids whose footprint is orthogonally adjacent to any of `cells`. */
function nodesTouching(cells: Cell[], owner: Map<string, string>): string[] {
  const ids = new Set<string>();
  for (const c of cells)
    for (const [dx, dz] of NEIGH) {
      const id = owner.get(cellKey(c.cx + dx, c.cz + dz));
      if (id) ids.add(id);
    }
  return [...ids];
}

/**
 * Build the whole-dwelling graph from the floor stack.
 *
 * Edges (see {@link GraphEdge}):
 *  - TOUCH (`viaDoor: false`): two footprints share a wall edge (orthogonal
 *    cells; corner-only contact doesn't count), plus cross-floor `viaStair`
 *    touch where a stair physically underlies the floor above. Physical
 *    adjacency only — feeds the proximity rules and the diagram's faint lines.
 *  - ACCESS (`viaDoor: true`): an authored door binds the two spaces. The only
 *    edges that confer reachability. Stair links (bottom + top) are access
 *    edges too, formed only where a door faces the stair footprint / its
 *    hole projection on the floor above — no automatic stair reachability.
 *
 * Entrances: each floor-0 entrance is re-validated against the CURRENT
 * occupancy (a later room may have built over its edge) and, if still open to
 * the outside, roots reachability at the node owning its cell (the entrance is
 * the exterior door).
 */
export function computeDwellingGraph(floors: Floor[]): DwellingGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const owners: Map<string, string>[] = [];

  // 1) Per-floor nodes + intra-floor TOUCH edges (generic over room/cluster/
  // stair) — physical shared-wall adjacency, `viaDoor: false`. Feeds the
  // proximity rules (H4/S3/S4/S5) and the diagram's faint/dashed "touching" lines.
  floors.forEach((floor, fi) => {
    const built = buildFloorNodes(floor, fi, fi > 0 ? floors[fi - 1] : null);
    nodes.push(...built.nodes);
    owners[fi] = built.owner;

    const seen = new Set<string>();
    for (const node of built.nodes) {
      for (const c of node.cells) {
        for (const [dx, dz] of NEIGH) {
          const other = built.owner.get(cellKey(c.cx + dx, c.cz + dz));
          if (!other || other === node.id) continue;
          const k = node.id < other ? `${node.id}|${other}` : `${other}|${node.id}`;
          if (seen.has(k)) continue;
          seen.add(k);
          edges.push({ a: node.id, b: other, viaDoor: false });
        }
      }
    }
  });

  // 2) Cross-floor stair TOUCH edges (`viaDoor: false`, `viaStair: true`): each
  // stair physically reaches whatever sits over its footprint on the floor
  // above. Informational only now (the diagram shows it as a faint stub, "could
  // door here"); it does NOT confer reachability — that needs a real door (step
  // 4). Kept so the physical stair-over-room relationship stays legible.
  const stairSeen = new Set<string>();
  floors.forEach((floor, fi) => {
    const aboveOwner = owners[fi + 1];
    if (!aboveOwner) return;
    for (const inst of floor.store.instances.values()) {
      if (inst.def.category !== "stair") continue;
      const foot = occupiedCells(inst.def, inst.origin, inst.rotation, inst.mirrored);
      const stairId = dwellingNodeId(fi, inst.id);
      for (const t of nodesTouching(foot, aboveOwner)) {
        const k = stairId < t ? `${stairId}|${t}` : `${t}|${stairId}`;
        if (stairSeen.has(k)) continue;
        stairSeen.add(k);
        edges.push({ a: stairId, b: t, viaDoor: false, viaStair: true });
      }
    }
  });

  // 3) AUTHORED DOOR ACCESS edges (`viaDoor: true`): the only edges that confer
  // reachability. Each door resolves to the two spaces its edges bind (via the
  // shared space-target map, incl. stair holes projected up from the floor
  // below), producing a room↔room / room↔cluster / cluster↔cluster / space↔stair
  // access edge. A door onto a below-floor stair hole is the stair's "top"
  // access; a door onto a same-floor stair footprint is its "bottom" access.
  const nodeIdSet = new Set(nodes.map((n) => n.id));
  const accessSeen = new Set<string>();
  const toNode = (token: string, fi: number): { id: string; below: boolean } =>
    token.startsWith(BELOW_PREFIX)
      ? { id: dwellingNodeId(fi - 1, token.slice(BELOW_PREFIX.length)), below: true }
      : { id: dwellingNodeId(fi, token), below: false };
  floors.forEach((floor, fi) => {
    if (floor.doors.length === 0) return;
    const targets = buildSpaceTargets(floor, fi > 0 ? floors[fi - 1] : null);
    const targetAt = (cx: number, cz: number) => targets.get(cellKey(cx, cz)) ?? null;
    for (const door of floor.doors) {
      const spaces = resolveDoorSpaces(door, targetAt);
      if (!spaces) continue;
      const na = toNode(spaces.a, fi);
      const nb = toNode(spaces.b, fi);
      if (na.id === nb.id || !nodeIdSet.has(na.id) || !nodeIdSet.has(nb.id)) continue;
      const k = na.id < nb.id ? `${na.id}|${nb.id}` : `${nb.id}|${na.id}`;
      if (accessSeen.has(k)) continue;
      accessSeen.add(k);
      edges.push({ a: na.id, b: nb.id, viaDoor: true, viaStair: na.below || nb.below });
    }
  });

  // 4) SEMI-EXTERIOR ACCESS edges (`viaDoor: true, viaFrench: true`): a room
  // and a qualifying Outdoor cluster that share a run carrying a FRENCH WINDOW
  // are connected — the glass is the door, so no authored door is needed. No
  // window means no access: a 1-cell contact leaves the balcony unreachable
  // (0.6 m of wall is not a way through), which is exactly when OD1 fires.
  // Deliberately NOT generalised: room↔circulation and room↔room boundaries
  // still require an authored door.
  floors.forEach((floor, fi) => {
    for (const { roomId, clusterToken } of floor.semiExterior?.access ?? []) {
      const a = dwellingNodeId(fi, roomId);
      const b = dwellingNodeId(fi, clusterToken);
      if (a === b || !nodeIdSet.has(a) || !nodeIdSet.has(b)) continue;
      const k = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (accessSeen.has(k)) continue; // an authored door here already counts
      accessSeen.add(k);
      edges.push({ a, b, viaDoor: true, viaFrench: true });
    }
  });

  // 5) Entrances → validity-checked entry roots (floor 0 only).
  const entrances: EntranceStatus[] = [];
  const entryIds = new Set<string>();
  const f0 = floors[0];
  if (f0) {
    const occupied0 = new Set(owners[0].keys()); // every room/cluster/stair cell
    for (const ent of f0.entrances) {
      const hostId = owners[0].get(cellKey(ent.cell.cx, ent.cell.cz)) ?? null;
      // Same exterior test as everything else, so an entrance onto a sealed
      // void reads as blocked (E2) exactly as one built over does.
      const stillExterior = exteriorEdges([ent.cell], occupied0, f0.isOutside).some(
        (e) => e.side === ent.side
      );
      const blocked = hostId === null || !stillExterior;
      entrances.push({ id: dwellingEntranceId(0, ent.id), floor: 0, hostId, blocked });
      if (!blocked && hostId) entryIds.add(hostId);
    }
  }
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  for (const id of entryIds) {
    const n = byId.get(id);
    if (n) n.isEntry = true;
  }

  return {
    nodes,
    edges,
    entryIds: [...entryIds],
    entrances,
    floorCount: floors.length,
    doorCount: floors.reduce((sum, f) => sum + f.doors.length, 0),
  };
}
