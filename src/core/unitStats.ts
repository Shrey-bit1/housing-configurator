import { CELL_SIZE } from "./grid";
import type { UnitStorey } from "./unitExport";

/**
 * The three numbers the save column's "Your flat" card shows (run 0026),
 * read straight off an already-built unit's storeys — never recomputed by
 * hand, so the card can never disagree with what a save would actually
 * write. `areaM2` mirrors the store's own convention (docs/store.md's
 * `areaCells × 0.36`, a GROSS figure); `glazingM` sums every `"glazed"`
 * edge's width (one cell, `CELL_SIZE`) across every storey.
 *
 * Its own file rather than a function in `unitExport.ts`: that module's
 * `import type { FloorManager }` is erased at compile time, but pulling in
 * its RUNTIME exports drags in `./adjacencyGraph`, `./door` and `./windows`
 * behind it, which `unitExport.test.ts`'s own header explains is the reason
 * that suite avoids importing `unitExport.ts` at all — a fast test for this
 * function would otherwise pay that cost for no reason. `type UnitStorey`
 * here is erased the same way, so this file imports nothing at runtime
 * beyond `grid.ts`'s `CELL_SIZE`.
 */
export interface UnitStats {
  areaM2: number;
  storeys: number;
  glazingM: number;
}

export function unitStats(storeys: UnitStorey[]): UnitStats {
  let cells = 0;
  let glazedEdges = 0;
  for (const s of storeys) {
    cells += s.cells.length;
    glazedEdges += s.edges.filter((e) => e.class === "glazed").length;
  }
  return {
    areaM2: Math.round(cells * CELL_SIZE * CELL_SIZE * 100) / 100,
    storeys: storeys.length,
    glazingM: Math.round(glazedEdges * CELL_SIZE * 10) / 10,
  };
}
