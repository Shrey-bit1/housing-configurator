import { cellKey, type Cell } from "./grid";
import type { Floor } from "./floor";
import { occupiedCells } from "./modules";
import { connectedComponents, clusterNodeId } from "./cluster";
import { exteriorEdges } from "./exteriorEdges";
import type { GlazingStat } from "./windows";

/**
 * Whole-dwelling adjacency graph — all floors' rooms/clusters/STAIRS as nodes,
 * with intra-floor touch edges PLUS cross-floor `viaStair` edges, and the
 * floor-0 entrances (resolved + validity-checked) marking entry roots.
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
  /** True when at least one boundary edge of this footprint faces outside
   *  (per the shared {@link exteriorEdges} utility) — daylight rules (D1/D2)
   *  consume this rather than recomputing exterior edges themselves. */
  hasExteriorEdge: boolean;
  /** Achieved-vs-target glazing for this room (rooms only), from the derived
   *  window generator (`floor.windowStats`) — the W1 rule consumes this rather
   *  than recomputing windows. Undefined for clusters/stairs and rooms whose
   *  type never windows. */
  glazing?: GlazingStat;
}

export interface GraphEdge {
  a: string; // node id
  b: string; // node id
  /** FUTURE: door/opening-based adjacency. Touch edges leave this undefined. */
  viaDoor?: boolean;
  /** A cross-floor link made by a stair (vs. a normal same-floor wall touch). */
  viaStair?: boolean;
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

/** Build one floor's room/cluster/stair nodes (namespaced) + a cell→node-id owner map. */
function buildFloorNodes(
  floor: Floor,
  fi: number
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
      });
      continue;
    }
    if (def.category !== "room") continue; // furniture modules excluded
    const cells = occupiedCells(def, inst.origin, inst.rotation, inst.mirrored);
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
      });
    }
  }

  const owner = new Map<string, string>();
  for (const node of nodes)
    for (const c of node.cells) owner.set(cellKey(c.cx, c.cz), node.id);

  // Daylight/ventilation rules (D1/D2) need to know which rooms touch the
  // outside — reuse the shared exteriorEdges utility against this floor's full
  // occupied-cell set (includes the node's own cells, so an interior boundary
  // between two cells of the SAME footprint correctly doesn't count as exterior).
  const occupied = new Set(owner.keys());
  for (const node of nodes) node.hasExteriorEdge = exteriorEdges(node.cells, occupied).length > 0;

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
 * Edges:
 *  - intra-floor (any node kind, incl. stairs): two nodes are adjacent when
 *    their footprints share a wall edge (orthogonal cells; corner-only contact
 *    doesn't count). This is what gives a stair its "bottom-side" connections.
 *  - cross-floor (`viaStair`): each stair's OWN node gets an edge to every
 *    room/cluster/stair touching its footprint projected onto the floor above
 *    (its "top-side" connections). A stair adjacent to nothing on a side simply
 *    has no edges there — inspectable by rules (ST1/ST2).
 *
 * Entrances: each floor-0 entrance is re-validated against the CURRENT
 * occupancy (a later room may have built over its edge) and, if still open to
 * the outside, roots reachability at the node owning its cell.
 */
export function computeDwellingGraph(floors: Floor[]): DwellingGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const owners: Map<string, string>[] = [];

  // 1) Per-floor nodes + intra-floor touch edges (generic over room/cluster/stair).
  floors.forEach((floor, fi) => {
    const built = buildFloorNodes(floor, fi);
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
          edges.push({ a: node.id, b: other });
        }
      }
    }
  });

  // 2) Cross-floor stair edges: each stair's node (its bottom-side edges came
  // from step 1 above, generically) gets viaStair edges to whatever touches its
  // footprint on the floor above.
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
        edges.push({ a: stairId, b: t, viaStair: true });
      }
    }
  });

  // 3) Entrances → validity-checked entry roots (floor 0 only).
  const entrances: EntranceStatus[] = [];
  const entryIds = new Set<string>();
  const f0 = floors[0];
  if (f0) {
    const occupied0 = new Set(owners[0].keys()); // every room/cluster/stair cell
    for (const ent of f0.entrances) {
      const hostId = owners[0].get(cellKey(ent.cell.cx, ent.cell.cz)) ?? null;
      const stillExterior = exteriorEdges([ent.cell], occupied0).some((e) => e.side === ent.side);
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
  };
}
