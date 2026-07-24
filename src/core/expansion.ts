import { cellKey, type Cell } from "./grid";
import { occupiedCells, isElastic } from "./modules";
import type { Floor } from "./floor";

/**
 * ELASTIC-ROOM EXPANSION — the derived effective footprints (batch ②).
 *
 * Rooms come in two classes (see {@link isElastic} in modules.ts):
 *  - FIXED (bathrooms, kitchen, circulation, outdoor, stair): what is placed
 *    is what exists.
 *  - ELASTIC (living, bedrooms, recreation): the placed rectangle is a SEED —
 *    a minimum claim. The effective footprint DERIVES from it: seeds grow to
 *    absorb enclosed empty space between placed rooms.
 *
 * Governing rules (each a settled design decision):
 *  1. DERIVED, ALWAYS-ON. Seeds stay the only stored truth; this recomputes
 *     from scratch on every layout change (FloorManager's sync pass), exactly
 *     like walls/windows/the graph. Nothing here is ever serialized.
 *  2. FILL ENCLOSED GAPS ONLY. An empty cell belongs to a gap iff it cannot
 *     reach the grid border through empty cells (orthogonal flood fill from
 *     the border — the voxelFaces outside-mask idiom). Empty space touching
 *     the outside world stays empty.
 *  3. FREE SHAPE (v1). No shape constraint, no growth limit — deliberately
 *     deferred pending a design review of real results (PROJECT_STATE §7).
 *  4. DETERMINISTIC CLAIM. Each gap cell is claimed by the NEAREST elastic
 *     room by orthogonal hops THROUGH the gap (per-room multi-source BFS from
 *     the room's boundary into the gap). Ties break by ascending numeric
 *     instance id ("m3" < "m12"). Gap cells are enumerated row-major and
 *     claimed cells appended in that order after the seed cells, so the same
 *     layout yields a BYTE-IDENTICAL map every time (and across save→load,
 *     since ids are re-assigned in serialization order). A gap with no
 *     adjacent elastic room stays empty (v1; "leftover becomes circulation"
 *     is parked).
 *
 * Strictly PER-FLOOR — expansion never crosses floors. Stairwell-hole cells
 * (the void over a stair below) are blocked: rooms never grow over the open
 * stairwell. Furniture modules block growth (they occupy the shared grid) but
 * are not spaces and get no entry.
 *
 * Returns EVERY non-furniture instance id → its effective ABSOLUTE cells:
 * fixed instances pass through unchanged; elastic = seed cells + claimed
 * cells. Consumers (walls, windows, graph, doors, entrances, export, readout)
 * read these instead of the raw seed footprints.
 */
export function computeExpansion(floor: Floor): Map<string, Cell[]> {
  const grid = floor.grid;
  const result = new Map<string, Cell[]>();
  const hard = new Set<string>();
  const elastic: { id: string; num: number; cells: Cell[] }[] = [];

  for (const inst of floor.store.instances.values()) {
    const cells = occupiedCells(inst.def, inst.origin, inst.rotation, inst.mirrored);
    for (const c of cells) hard.add(cellKey(c.cx, c.cz));
    if (inst.def.category === "module") continue; // furniture: blocks, not a space
    result.set(inst.id, cells);
    if (isElastic(inst.def))
      elastic.push({ id: inst.id, num: idNum(inst.id), cells });
  }
  if (elastic.length === 0) return result;

  const empty = (cx: number, cz: number) =>
    grid.inBounds(cx, cz) && !hard.has(cellKey(cx, cz)) && !grid.isHole(cx, cz);

  // Outside mask: empty cells reachable from the grid border through empty
  // cells. Whatever they can reach is "the outside world" and never fills.
  const outside = new Set<string>();
  const stack: Cell[] = [];
  const seedOutside = (cx: number, cz: number) => {
    if (!empty(cx, cz)) return;
    const k = cellKey(cx, cz);
    if (outside.has(k)) return;
    outside.add(k);
    stack.push({ cx, cz });
  };
  for (let cx = 0; cx < grid.cols; cx++) {
    seedOutside(cx, 0);
    seedOutside(cx, grid.rows - 1);
  }
  for (let cz = 0; cz < grid.rows; cz++) {
    seedOutside(0, cz);
    seedOutside(grid.cols - 1, cz);
  }
  while (stack.length) {
    const c = stack.pop()!;
    for (const [dx, dz] of N4) seedOutside(c.cx + dx, c.cz + dz);
  }

  const isGap = (cx: number, cz: number) => empty(cx, cz) && !outside.has(cellKey(cx, cz));

  // Per-elastic-room BFS distance field over the gap cells (sources: gap cells
  // orthogonally adjacent to the room's cells, at distance 1).
  elastic.sort((a, b) => a.num - b.num || (a.id < b.id ? -1 : 1));
  const dists = elastic.map((e) => gapDistances(e.cells, isGap));

  // Row-major claim: nearest room wins; ties go to the earlier (lower-id)
  // entry of the sorted elastic list.
  const claims = new Map<string, Cell[]>();
  for (let cz = 0; cz < grid.rows; cz++) {
    for (let cx = 0; cx < grid.cols; cx++) {
      if (!isGap(cx, cz)) continue;
      const k = cellKey(cx, cz);
      let best = Infinity;
      let winner = -1;
      for (let i = 0; i < elastic.length; i++) {
        const d = dists[i].get(k);
        if (d !== undefined && d < best) {
          best = d;
          winner = i;
        }
      }
      if (winner < 0) continue; // no elastic room can reach this gap → stays empty
      const id = elastic[winner].id;
      let arr = claims.get(id);
      if (!arr) claims.set(id, (arr = []));
      arr.push({ cx, cz });
    }
  }
  for (const e of elastic) {
    const claimed = claims.get(e.id);
    if (claimed) result.set(e.id, [...e.cells, ...claimed]);
  }
  return result;
}

const N4: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Numeric part of a store instance id ("m12" → 12) for the stable tie-break. */
function idNum(id: string): number {
  const n = parseInt(id.replace(/\D+/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

/** Multi-source BFS from `roomCells` INTO the gap: distance 1 at gap cells
 *  orthogonally adjacent to the room, growing only through gap cells. */
function gapDistances(
  roomCells: Cell[],
  isGap: (cx: number, cz: number) => boolean
): Map<string, number> {
  const dist = new Map<string, number>();
  let frontier: Cell[] = [];
  for (const c of roomCells) {
    for (const [dx, dz] of N4) {
      const cx = c.cx + dx;
      const cz = c.cz + dz;
      if (!isGap(cx, cz)) continue;
      const k = cellKey(cx, cz);
      if (dist.has(k)) continue;
      dist.set(k, 1);
      frontier.push({ cx, cz });
    }
  }
  let d = 1;
  while (frontier.length) {
    const next: Cell[] = [];
    for (const c of frontier) {
      for (const [dx, dz] of N4) {
        const cx = c.cx + dx;
        const cz = c.cz + dz;
        if (!isGap(cx, cz)) continue;
        const k = cellKey(cx, cz);
        if (dist.has(k)) continue;
        dist.set(k, d + 1);
        next.push({ cx, cz });
      }
    }
    frontier = next;
    d++;
  }
  return dist;
}
