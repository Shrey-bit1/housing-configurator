import { describe, it, expect } from "vitest";
import {
  STAIR_SPECS,
  RISER_TARGET_MM,
  TREAD_MM,
  RULE_2R_T_MM,
  riserCountFor,
  splitRisers,
  planStair,
  spiralPlan,
} from "./stairSpec";
import { CELL_SIZE } from "./grid";

/**
 * The numbers the 13 August meeting asked for, pinned. The point of this file
 * is that the report's stair table and the geometry `stairMesh.ts` draws come
 * from ONE derivation, so a footprint that stops holding its own flights fails
 * here rather than shipping as a stair that runs through a wall.
 */

/** The default storey: (DEFAULT_FLOOR_CELLS 4 + CLEARANCE_CELLS 1) × 0.6 m. */
const STOREY = 3.0;

describe("the proportion rule", () => {
  it("is 2R + T = 610 at the targets", () => {
    expect(2 * RISER_TARGET_MM + TREAD_MM).toBe(RULE_2R_T_MM);
  });
});

describe("riserCountFor", () => {
  it("puts the riser nearest 170 mm for the 3.0 m storey", () => {
    expect(riserCountFor(3.0)).toBe(18);
    expect((3.0 * 1000) / 18).toBeCloseTo(166.667, 3);
  });

  it("picks the count nearest the target rather than always rounding up", () => {
    expect(riserCountFor(3.6)).toBe(21); // 3600/170 = 21.18
    expect(riserCountFor(2.4)).toBe(14); // 2400/170 = 14.12
  });

  it("never returns fewer than two risers", () => {
    expect(riserCountFor(0.1)).toBe(2);
  });
});

describe("splitRisers", () => {
  it("splits evenly when it can", () => {
    expect(splitRisers(18, 2)).toEqual([9, 9]);
    expect(splitRisers(18, 3)).toEqual([6, 6, 6]);
    expect(splitRisers(18, 1)).toEqual([18]);
  });

  it("gives the remainder to the earlier flights, so the last is never longest", () => {
    expect(splitRisers(19, 2)).toEqual([10, 9]);
    expect(splitRisers(20, 3)).toEqual([7, 7, 6]);
  });

  it("always totals the risers it was given", () => {
    for (let r = 2; r <= 40; r++)
      for (const f of [1, 2, 3])
        expect(splitRisers(r, f).reduce((a, b) => a + b, 0)).toBe(r);
  });
});

describe("planStair at the 3.0 m storey", () => {
  it("gives every type 18 risers of 166.667 mm", () => {
    for (const spec of Object.values(STAIR_SPECS)) {
      const p = planStair(spec, STOREY);
      expect(p.risers).toBe(18);
      expect(p.riserMm).toBeCloseTo(166.667, 3);
    }
  });

  it("holds the tread at 270 mm for every type", () => {
    for (const spec of Object.values(STAIR_SPECS)) {
      const p = planStair(spec, STOREY);
      expect(p.treadMm).toBe(TREAD_MM);
      expect(p.treadCompressed).toBe(false);
    }
  });

  it("reports 2R + T as 603.3 mm, 6.7 mm under the 610 target", () => {
    const p = planStair(STAIR_SPECS.stair_straight, STOREY);
    expect(p.walkingRuleMm).toBeCloseTo(603.333, 3);
    expect(RULE_2R_T_MM - p.walkingRuleMm).toBeCloseTo(6.667, 3);
  });

  it("splits the straight run into one flight of 18, 17 goings, 4.59 m", () => {
    const p = planStair(STAIR_SPECS.stair_straight, STOREY);
    expect(p.risersPerFlight).toEqual([18]);
    expect(p.goingsPerFlight).toEqual([17]);
    expect(p.flightRunM[0]).toBeCloseTo(4.59, 6);
  });

  it("splits both doglegs into two flights of 9, 8 goings, 2.16 m", () => {
    for (const t of ["stair_dogleg", "stair_dogleg_wide"] as const) {
      const p = planStair(STAIR_SPECS[t], STOREY);
      expect(p.risersPerFlight).toEqual([9, 9]);
      expect(p.goingsPerFlight).toEqual([8, 8]);
      expect(p.flightRunM[0]).toBeCloseTo(2.16, 6);
    }
  });

  it("splits the C into three flights of 6, 5 goings, 1.35 m", () => {
    const p = planStair(STAIR_SPECS.stair_c, STOREY);
    expect(p.risersPerFlight).toEqual([6, 6, 6]);
    expect(p.goingsPerFlight).toEqual([5, 5, 5]);
    expect(p.flightRunM[0]).toBeCloseTo(1.35, 6);
  });
});

describe("every flight fits inside the footprint it claims", () => {
  // The invariant that makes occupancy honest: geometry never leaves its cells.
  it("holds for all four types at the default storey", () => {
    for (const spec of Object.values(STAIR_SPECS)) {
      if (spec.kind === "spiral") continue; // measured as a circle, checked below
      const p = planStair(spec, STOREY);
      const lengthM = spec.lengthCells * CELL_SIZE;
      const landings = spec.kind === "dogleg" ? 1 : spec.kind === "c" ? 2 : 0;
      const needed = Math.max(...p.flightRunM) + landings * spec.flightWidthM;
      expect(needed).toBeLessThanOrEqual(lengthM + 1e-9);
    }
  });

  it("holds for storeys up to 4.2 m, compressing the tread rather than overrunning", () => {
    for (let h = 2.4; h <= 4.2; h += 0.6) {
      for (const spec of Object.values(STAIR_SPECS)) {
        if (spec.kind === "spiral") continue;
        const p = planStair(spec, h);
        const lengthM = spec.lengthCells * CELL_SIZE;
        const landings = spec.kind === "dogleg" ? 1 : spec.kind === "c" ? 2 : 0;
        const needed = Math.max(...p.flightRunM) + landings * spec.flightWidthM;
        expect(needed).toBeLessThanOrEqual(lengthM + 1e-9);
      }
    }
  });

  it("flags the compression when it happens rather than hiding it", () => {
    // A tall storey needs more risers than the C's footprint can hold at 270.
    const p = planStair(STAIR_SPECS.stair_c, 4.2);
    expect(p.risers).toBe(25);
    expect(p.treadCompressed).toBe(true);
    expect(p.treadMm).toBeLessThan(TREAD_MM);
  });
});

describe("the two dogleg widths", () => {
  it("offers 1.8 m tight as the default and 2.4 m generous beside it", () => {
    expect(STAIR_SPECS.stair_dogleg.widthCells * CELL_SIZE).toBeCloseTo(1.8, 6);
    expect(STAIR_SPECS.stair_dogleg.flightWidthM).toBe(0.9);
    expect(STAIR_SPECS.stair_dogleg_wide.widthCells * CELL_SIZE).toBeCloseTo(2.4, 6);
    expect(STAIR_SPECS.stair_dogleg_wide.flightWidthM).toBe(1.2);
  });

  it("fills the width with its two flights in both", () => {
    for (const t of ["stair_dogleg", "stair_dogleg_wide"] as const) {
      const s = STAIR_SPECS[t];
      expect(2 * s.flightWidthM).toBeCloseTo(s.widthCells * CELL_SIZE, 6);
    }
  });
});

describe("the spiral, and what 4×4 costs", () => {
  const spec = STAIR_SPECS.stair_spiral;
  const plan = planStair(spec, STOREY);
  const sp = spiralPlan(spec, plan);

  it("makes exactly one turn out of its 18 treads", () => {
    expect(sp.degreesPerTread).toBe(20);
    expect(sp.degreesPerTread * plan.risers).toBe(360);
  });

  it("is a 2.4 m circle in a 2.4 m square", () => {
    expect(sp.outerRadiusM).toBe(1.2);
    expect(spec.widthCells * CELL_SIZE).toBeCloseTo(2.4, 6);
    expect(spec.widthCells).toBe(spec.lengthCells);
  });

  it("MISSES the walking rule at this size, and says by how much", () => {
    // The finding, as a number: 227 mm at the walking line, not 270.
    expect(sp.walkRadiusM).toBeCloseTo(0.65, 6);
    expect(sp.walkGoingMm).toBeCloseTo(226.9, 1);
    expect(2 * plan.riserMm + sp.walkGoingMm).toBeCloseTo(560.2, 1);
    expect(2 * plan.riserMm + sp.walkGoingMm).toBeLessThan(RULE_2R_T_MM);
  });

  it("gives the size that WOULD meet it, so the trade is visible", () => {
    expect(sp.radiusForTargetM).toBeCloseTo(0.7735, 4);
    expect(sp.squareForTargetM).toBeCloseTo(2.894, 3);
    // Which is 5 cells, not 4.
    expect(Math.ceil(sp.squareForTargetM / CELL_SIZE)).toBe(5);
  });

  it("still has a generous going at the outer edge", () => {
    expect(sp.outerGoingMm).toBeCloseTo(418.9, 1);
  });
});
