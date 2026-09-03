import { describe, it, expect } from "vitest";
import { unitStats } from "./unitStats";
import type { UnitStorey } from "./unitExport";

/**
 * The save column's "Your flat" numbers (run 0026), pure: no FloorManager,
 * no DOM. See unitStats.ts's own header for why this lives apart from
 * unitExport.ts (its runtime exports drag in the scene-adjacent import
 * graph unitExport.test.ts already documents avoiding).
 */

const storey = (cells: [number, number][], glazed: number, blank: number): UnitStorey => ({
  cells,
  height: 3,
  edges: [
    ...Array.from({ length: glazed }, (_, i): UnitStorey["edges"][number] => ({
      cell: [i, 0],
      side: "N",
      class: "glazed",
    })),
    ...Array.from({ length: blank }, (_, i): UnitStorey["edges"][number] => ({
      cell: [i, 0],
      side: "S",
      class: "blank",
    })),
  ],
});

describe("unitStats", () => {
  it("sums cells to area (0.36 m² each) and counts storeys", () => {
    const s = unitStats([storey([[0, 0], [1, 0], [0, 1]], 0, 0)]);
    expect(s.areaM2).toBeCloseTo(3 * 0.36, 5);
    expect(s.storeys).toBe(1);
  });

  it("sums glazed edges only, at 0.6 m each, ignoring blank/entrance/open", () => {
    const s = unitStats([storey([[0, 0]], 6, 3)]);
    expect(s.glazingM).toBeCloseTo(6 * 0.6, 5);
  });

  it("adds across every storey, not just the first", () => {
    const s = unitStats([storey([[0, 0], [1, 0]], 2, 0), storey([[0, 0]], 1, 0)]);
    expect(s.storeys).toBe(2);
    expect(s.areaM2).toBeCloseTo(3 * 0.36, 5);
    expect(s.glazingM).toBeCloseTo(3 * 0.6, 5);
  });

  it("is all zero for an empty unit", () => {
    expect(unitStats([])).toEqual({ areaM2: 0, storeys: 0, glazingM: 0 });
  });
});
