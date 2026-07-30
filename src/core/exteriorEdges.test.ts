import { describe, it, expect } from "vitest";
import { Grid, cellKey, type Cell } from "./grid";
import { borderReachableEmpty } from "./expansion";
import { connectedComponents } from "./cluster";
import { semiExteriorBands } from "./semiExterior";
import { isFacadeEdge, edgeKey, SIDES, SIDE_DELTA, type Side } from "./exteriorEdges";

/**
 * The first test in this repository, and it exists because both defects ever
 * found in `isFacadeEdge` were found by READING it. Neither is reachable by
 * clicking around: a sealed courtyard needs a balcony ringed on four sides, and
 * a sealed empty pocket needs rooms placed around a gap left on purpose. The
 * browser checks that were meant to cover this function would have missed both.
 *
 * The two halves of the predicate are exercised through the REAL derivations
 * rather than stubs, because both defects were failures to defer to those
 * derivations, and a stub would have agreed with the broken version:
 *  - open sky comes from `borderReachableEmpty` (expansion.ts), which is what
 *    `Floor.isOutside` is built from;
 *  - the room-to-outdoor half reproduces how `computeSemiExterior` fills its
 *    `boundary` set, including the `reachesSky` gate that rejects a sealed
 *    courtyard, using the real `connectedComponents`.
 *
 * A whole `Floor` is deliberately not constructed. `src/core/floor.ts` imports
 * `../scene/*`, so building one would drag the render layer into a test about a
 * geometric predicate. What is reproduced here is the wiring, roughly fifteen
 * lines; every decision the wiring depends on is the real function.
 */

/** Build the two predicates `isFacadeEdge` takes, from a placed layout. */
function derive(
  cols: number,
  rows: number,
  spaces: Cell[],
  outdoor: Cell[]
): {
  occupied: Set<string>;
  isOutside: (cx: number, cz: number) => boolean;
  isSemiExterior: (cx: number, cz: number, side: Side) => boolean;
} {
  const grid = new Grid(cols, rows);
  const occupied = new Set([...spaces, ...outdoor].map((c) => cellKey(c.cx, c.cz)));

  // Exactly `computeSemiExterior`'s own derivation (semiExterior.ts): empty
  // means no SPACE occupies the cell, and outside means empty and reachable
  // from the grid border, or out of bounds.
  const isEmpty = (cx: number, cz: number) => !occupied.has(cellKey(cx, cz));
  const outsideCells = borderReachableEmpty(grid, isEmpty);
  const isOutside = (cx: number, cz: number) =>
    !grid.inBounds(cx, cz) || outsideCells.has(cellKey(cx, cz));

  // `boundary`, as computeSemiExterior fills it: only outdoor components that
  // REACH SKY qualify, and both representations of each edge are recorded.
  const qualifying = new Set<string>();
  for (const component of connectedComponents(outdoor)) {
    const reachesSky = component.some((c) =>
      SIDES.some((s) => {
        const [dx, dz] = SIDE_DELTA[s];
        return isOutside(c.cx + dx, c.cz + dz);
      })
    );
    if (!reachesSky) continue; // sealed courtyard — confers nothing
    for (const c of component) qualifying.add(cellKey(c.cx, c.cz));
  }
  // The app's OWN boundary construction, not a copy of it. Before run 0011 this
  // helper reproduced about fifteen lines of `computeSemiExterior`, so the test
  // could keep passing while the app diverged; both now call one function.
  const boundary = new Set<string>();
  const qualifyingTokens = new Map([...qualifying].map((k) => [k, "outdoor"] as const));
  semiExteriorBands(spaces, qualifyingTokens, boundary);
  const isSemiExterior = (cx: number, cz: number, side: Side) =>
    boundary.has(edgeKey(cx, cz, side));

  return { occupied, isOutside, isSemiExterior };
}

/** A solid rectangle of cells, inclusive of both corners. */
function rect(x0: number, z0: number, x1: number, z1: number): Cell[] {
  const out: Cell[] = [];
  for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) out.push({ cx, cz });
  return out;
}

describe("isFacadeEdge", () => {
  it("counts an edge onto open sky as facade", () => {
    // One 2×2 room in the middle of a 10×10 grid. Its north edge faces empty
    // cells that reach the grid border, so it is the enclosure.
    const room = rect(4, 4, 5, 5);
    const { occupied, isOutside, isSemiExterior } = derive(10, 10, room, []);
    expect(isFacadeEdge(4, 4, "north", occupied, isOutside, isSemiExterior)).toBe(true);
  });

  it("counts an edge onto an adjacent open balcony as facade", () => {
    // The defect this predicate was written for. The balcony's cells are
    // OCCUPIED, so the open-sky half says no; the room-to-outdoor half says yes
    // because the balcony reaches sky on its far side.
    const room = rect(4, 4, 5, 5);
    const balcony = rect(6, 4, 6, 5); // directly east of the room, open beyond
    const { occupied, isOutside, isSemiExterior } = derive(10, 10, room, balcony);
    expect(occupied.has(cellKey(6, 4))).toBe(true); // the balcony really is occupied
    expect(isFacadeEdge(5, 4, "east", occupied, isOutside, isSemiExterior)).toBe(true);
  });

  it("does NOT count an edge onto a sealed empty pocket as facade", () => {
    // Defect 1. A ring of rooms around one empty cell at (5,5). That cell is
    // unoccupied, so testing `!occupied` alone calls this facade; it cannot be
    // reached from the border, so it is not sky and the room has no window here.
    const ring = rect(4, 4, 6, 6).filter((c) => !(c.cx === 5 && c.cz === 5));
    const { occupied, isOutside, isSemiExterior } = derive(10, 10, ring, []);
    expect(occupied.has(cellKey(5, 5))).toBe(false); // the pocket is empty
    expect(isOutside(5, 5)).toBe(false); // but sealed off from the border
    expect(isFacadeEdge(5, 4, "south", occupied, isOutside, isSemiExterior)).toBe(false);
  });

  it("counts a CIRCULATION edge onto an open adjacent balcony as facade", () => {
    // Run 0011: corridors enter the semi-exterior system too, so a corridor
    // against a balcony is envelope exactly as a room against one is. The
    // predicate does not know the difference; what changed is that
    // `computeSemiExterior` now records the corridor's boundary at all.
    const corridor = rect(4, 4, 4, 6); // a 1x3 run of circulation cells
    const balcony = rect(5, 4, 5, 6); // directly east, open beyond
    const { occupied, isOutside, isSemiExterior } = derive(10, 10, corridor, balcony);
    expect(occupied.has(cellKey(5, 5))).toBe(true); // the balcony is occupied
    expect(isFacadeEdge(4, 5, "east", occupied, isOutside, isSemiExterior)).toBe(true);
  });

  it("does NOT count an edge onto a sealed courtyard balcony as facade", () => {
    // Defect 2. Same ring, but the middle cell is an OUTDOOR placement. A
    // bespoke "is the neighbour outdoor" test calls this facade; the real gate
    // is `reachesSky`, and a balcony with no open side confers nothing.
    const ring = rect(4, 4, 6, 6).filter((c) => !(c.cx === 5 && c.cz === 5));
    const courtyard: Cell[] = [{ cx: 5, cz: 5 }];
    const { occupied, isOutside, isSemiExterior } = derive(10, 10, ring, courtyard);
    expect(occupied.has(cellKey(5, 5))).toBe(true); // it is a real outdoor cell
    expect(isFacadeEdge(5, 4, "south", occupied, isOutside, isSemiExterior)).toBe(false);
  });
});
