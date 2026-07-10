import { cellKey, type Cell } from "./grid";
import {
  edgeKey,
  opposite,
  SIDE_DELTA,
  type BoundaryEdge,
  type Side,
} from "./exteriorEdges";
import { occupiedCells } from "./modules";
import { connectedComponents, clusterNodeId } from "./cluster";
import type { Floor } from "./floor";

/**
 * An AUTHORED interior door: a marker bound to a SHARED INTERIOR EDGE between two
 * spaces (rooms / clusters / a stair footprint). The opposite of windows (which
 * are DERIVED) — like entrances, doors are user-placed and serialized. But where
 * an entrance binds an EXTERIOR edge (one side is outside), a door binds an
 * INTERIOR boundary (a real space on BOTH sides), and it is what makes those two
 * spaces reachable from one another: with authored doors, reachability is
 * strictly door-based (see adjacencyGraph.ts / rules.ts), so physical touch
 * without a door is no longer a connection.
 *
 * A door spans EXACTLY 2 consecutive edges (1200 mm) on ONE straight boundary —
 * fixed at 2 for v1 (no 1-edge doors). Stored as an anchor cell + side (reusing
 * the canonical {@link edgeKey} machinery, same family as {@link Entrance}); the
 * second edge is implied by the side's run direction (+x for north/south walls,
 * +z for east/west). Doors live on ANY floor (unlike entrances, floor 0 only).
 *
 * Doors do NOT travel with rooms and are never derived: whenever a layout change
 * makes both of a door's edges no longer a shared boundary between the SAME two
 * spaces, the door is auto-removed as part of that same mutation (FloorManager),
 * inside one undo snapshot.
 */
export interface Door {
  /** Stable id = the anchor edge key (an edge hosts at most one door). */
  id: string;
  /** Anchor cell — the lower-index end of the 2-edge span (min cx for a
   *  north/south door, min cz for an east/west door). */
  cell: Cell;
  side: Side;
}

/** Edges a door spans (fixed at 2). Immutable v1 constant, referenced by name. */
export const DOOR_SPAN = 2;

/**
 * Height (world units) of a door OPENING: 0 → {@link DOOR_OPENING_H}, with a
 * SOLID panel above it up to the floor-to-floor height. Deliberately the INVERSE
 * of windows: a window's sill/lintel panels are fixed and the GLAZING GAP absorbs
 * extra floor height; a door's OPENING is fixed (an ergonomic 2100 mm constant)
 * and the PANEL above grows on taller floors. On a 3.0 m floor the two happen to
 * coincide (2100 = floorHeight − 900); they are not the same mechanism.
 */
export const DOOR_OPENING_H = 2.1;

/** Prefix marking a token that resolves to a stair on the floor BELOW (reached
 *  via its stairwell hole projected up). See {@link buildSpaceTargets}. */
export const BELOW_PREFIX = "^";

/** Stable id for a door anchored at (cell, side). */
export function doorId(cell: Cell, side: Side): string {
  return edgeKey(cell.cx, cell.cz, side);
}

/**
 * The two consecutive boundary edges a door occupies. North/south doors run
 * along x (anchor + (1,0)); east/west doors run along z (anchor + (0,1)).
 */
export function doorEdges(door: Door): [BoundaryEdge, BoundaryEdge] {
  const { cx, cz } = door.cell;
  const runX = door.side === "north" || door.side === "south";
  const d1x = runX ? cx + 1 : cx;
  const d1z = runX ? cz : cz + 1;
  return [
    { cx, cz, side: door.side },
    { cx: d1x, cz: d1z, side: door.side },
  ];
}

/**
 * Canonical key for one UNIT boundary edge, IDENTICAL for the two (cell, side)
 * representations of the same physical edge (a south edge of C == the north edge
 * of C's south neighbour). Keyed by the unordered pair of the two cells it
 * separates, so a door placed from either adjacent space maps to the same edges.
 */
function physEdgeKey(cx: number, cz: number, side: Side): string {
  const [dx, dz] = SIDE_DELTA[side];
  const a = cellKey(cx, cz);
  const b = cellKey(cx + dx, cz + dz);
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** The two physical boundary edges a door occupies (representation-independent). */
export function doorPhysEdges(door: Door): string[] {
  return doorEdges(door).map((e) => physEdgeKey(e.cx, e.cz, e.side));
}

/**
 * True if `door` shares ANY physical boundary edge with an existing door. This
 * is the real dedup/conflict test — an anchor-id match is insufficient because
 * ONE physical boundary has TWO (cell, side) representations (place from either
 * side) AND two collinear doors can overlap on a shared middle edge. Rejecting on
 * a shared physical edge covers both: no two doors ever share a wall segment, so
 * a door's opening/marker/access-edge stays a clean 2-edge (1200 mm) unit.
 */
export function doorOverlaps(door: Door, existing: Door[]): boolean {
  const mine = new Set(doorPhysEdges(door));
  return existing.some((d) => doorPhysEdges(d).some((k) => mine.has(k)));
}

/**
 * Resolve the two spaces a door connects, using a caller-supplied `targetAt`
 * (cell → opaque space token, or null for empty/exterior). Returns the pair, or
 * null if the door is INVALID: any edge faces nothing (exterior), or the two
 * edges don't join the SAME two DISTINCT spaces on a straight boundary.
 *
 * Symmetric in the two spaces; the token space is the caller's (dwelling node
 * ids for the graph, local instance/cluster tokens for placement validity), so
 * this single function is the one definition of door validity + connectivity.
 */
export function resolveDoorSpaces(
  door: Door,
  targetAt: (cx: number, cz: number) => string | null
): { a: string; b: string } | null {
  let a: string | null = null;
  let b: string | null = null;
  for (const e of doorEdges(door)) {
    const [dx, dz] = SIDE_DELTA[e.side];
    const here = targetAt(e.cx, e.cz);
    const there = targetAt(e.cx + dx, e.cz + dz);
    if (here === null || there === null || here === there) return null;
    if (a === null) {
      a = here;
      b = there;
    } else if (a !== here || b !== there) {
      return null; // both edges must join the SAME ordered pair (straight boundary)
    }
  }
  return a !== null && b !== null ? { a, b } : null;
}

/**
 * Map every cell of a floor to an opaque SPACE TOKEN — the resolver both door
 * placement/validity (FloorManager) and door access edges (adjacencyGraph) share
 * so they always agree on "what is a distinct space here":
 *  - a room / stair instance → its instance id,
 *  - a connector cluster → its {@link clusterNodeId} (so all pieces of one
 *    circulation/outdoor cluster read as ONE space, matching the graph),
 *  - a stair on `floorBelow`, projected straight up onto this floor's stairwell
 *    hole → `{@link BELOW_PREFIX}` + that stair's id (so an upper-floor room can
 *    door onto the stair arrival — the stair's "top" connection).
 *
 * Furniture modules are ignored. Below-floor projections never overwrite a real
 * occupant (a hole cell is unoccupiable, so there is never a conflict; guarded
 * anyway).
 */
export function buildSpaceTargets(floor: Floor, floorBelow?: Floor | null): Map<string, string> {
  const targets = new Map<string, string>();
  const clusterCells = new Map<string, Cell[]>();

  for (const inst of floor.store.instances.values()) {
    const def = inst.def;
    if (def.category === "module") continue; // furniture is not a space
    const cells = occupiedCells(def, inst.origin, inst.rotation, inst.mirrored);
    if (def.cluster) {
      const arr = clusterCells.get(def.cluster) ?? [];
      arr.push(...cells);
      clusterCells.set(def.cluster, arr);
    } else {
      // Rooms and stairs are their own space, keyed by instance id.
      for (const c of cells) targets.set(cellKey(c.cx, c.cz), inst.id);
    }
  }

  for (const [key, cells] of clusterCells)
    for (const component of connectedComponents(cells)) {
      const token = clusterNodeId(key, component);
      for (const c of component) targets.set(cellKey(c.cx, c.cz), token);
    }

  if (floorBelow)
    for (const inst of floorBelow.store.instances.values()) {
      if (inst.def.category !== "stair") continue;
      for (const c of occupiedCells(inst.def, inst.origin, inst.rotation, inst.mirrored)) {
        const key = cellKey(c.cx, c.cz);
        if (!targets.has(key)) targets.set(key, BELOW_PREFIX + inst.id);
      }
    }

  return targets;
}

/**
 * The room/cluster wall segments a door cuts, split by which side is which kind.
 * A shared interior boundary carries TWO wall segments (each adjacent space
 * builds its own, inset to its side), so a door must cut the opening in BOTH:
 *  - `rooms`: instance id → set of LOCAL edge keys (abs − origin) to open,
 *  - `clusters`: set of ABSOLUTE edge keys to open (cluster shells are built in
 *    world/grid space).
 * A door onto a STAIR (or a below-floor stair hole) cuts only the room/cluster
 * side — the stair has no shell wall — which falls out automatically since a
 * stair/void cell resolves to no room/cluster owner here.
 *
 * `ownerAt` returns the room/cluster/stair instance id occupying a cell (grid
 * occupancy); `instKind` classifies that owner. Only rooms and clusters get a
 * wall cut; stairs and empty cells are skipped.
 */
export function doorWallCuts(
  doors: Door[],
  ownerAt: (cx: number, cz: number) => string | undefined,
  resolveOwner: (id: string) => { kind: "room" | "cluster" | "other"; origin: Cell } | null
): { rooms: Map<string, Set<string>>; clusters: Set<string> } {
  const rooms = new Map<string, Set<string>>();
  const clusters = new Set<string>();
  const addRoom = (id: string, key: string) => {
    let set = rooms.get(id);
    if (!set) rooms.set(id, (set = new Set<string>()));
    set.add(key);
  };
  const cut = (cx: number, cz: number, side: Side) => {
    const owner = ownerAt(cx, cz);
    if (!owner) return;
    const info = resolveOwner(owner);
    if (!info) return;
    if (info.kind === "room")
      addRoom(owner, edgeKey(cx - info.origin.cx, cz - info.origin.cz, side));
    else if (info.kind === "cluster") clusters.add(edgeKey(cx, cz, side));
  };
  for (const door of doors)
    for (const e of doorEdges(door)) {
      const [dx, dz] = SIDE_DELTA[e.side];
      cut(e.cx, e.cz, e.side); // this space's segment
      cut(e.cx + dx, e.cz + dz, opposite(e.side)); // the neighbouring space's segment
    }
  return { rooms, clusters };
}
