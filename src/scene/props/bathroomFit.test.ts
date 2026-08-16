import { describe, it, expect } from "vitest";
import { VOXEL_SIZE } from "./voxelProp";
// The SAME voxel files the app draws, loaded as JSON modules rather than
// through node:fs: tsconfig's `src` net carries no node types, and the vite
// pipeline serves the identical bytes.
import toiletData from "./data/toilet.json";
import basinData from "./data/basin.json";
import bathtubData from "./data/bathtub.json";
import { MODULE_DEFS } from "../../core/modules";
import { CELL_SIZE } from "../../core/grid";

/**
 * DOES THE FURNITURE ACTUALLY FIT. The 13 August prompt proposed sizes for the
 * two new bathrooms and asked for them to be contradicted if the fixtures do
 * not fit at true size with real clearances. This file is that check, run
 * against the SAME voxel files the app draws, so a prop re-authored a size
 * larger fails here rather than quietly overlapping a wall.
 *
 * A voxel is 50 mm (props/voxelProp.ts), so a prop's authored `size` in voxels
 * is its real size: [width, height, depth] along its own axes before facing
 * rotation.
 */

function propSizeM(data: { size: number[] }): { w: number; h: number; d: number } {
  const [w, h, d] = data.size;
  return { w: w * VOXEL_SIZE, h: h * VOXEL_SIZE, d: d * VOXEL_SIZE };
}

function roomSizeM(type: string): { w: number; d: number } {
  const cells = MODULE_DEFS[type].cells;
  const w = Math.max(...cells.map((c) => c.cx)) + 1;
  const d = Math.max(...cells.map((c) => c.cz)) + 1;
  return { w: w * CELL_SIZE, d: d * CELL_SIZE };
}

const wc = propSizeM(toiletData);
const basin = propSizeM(basinData);
const tub = propSizeM(bathtubData);

describe("the fixtures are the sizes the report quotes", () => {
  it("draws a 400 × 700 WC", () => {
    expect(wc.w).toBeCloseTo(0.4, 6);
    expect(wc.d).toBeCloseTo(0.7, 6);
  });

  it("draws a 500 × 400 basin", () => {
    expect(basin.w).toBeCloseTo(0.5, 6);
    expect(basin.d).toBeCloseTo(0.4, 6);
  });

  it("draws a 1700 × 750 bathtub, the size the meeting named", () => {
    expect(tub.w).toBeCloseTo(1.7, 6);
    expect(tub.d).toBeCloseTo(0.75, 6);
  });
});

/** Clear floor a fixture must have in front of it, metres. Domestic figures:
 *  a WC needs 600 to sit down, a basin 600 to stand at, a bath 700 to step in.
 *  Each carries a 1 mm slack because these are sums of binary fractions:
 *  1.8 − 0.7 − 0.5 evaluates to 0.5999999999999996, which is 600 mm in every
 *  sense that matters to a bathroom. */
const MM = 0.001;
const CLEAR_WC = 0.6 - MM;
const CLEAR_BASIN = 0.6 - MM;
const CLEAR_TUB = 0.7 - MM;

describe("the minimal WC at 2×3 cells", () => {
  const room = roomSizeM("wc");

  it("is 1.2 × 1.8 m", () => {
    expect(room.w).toBeCloseTo(1.2, 6);
    expect(room.d).toBeCloseTo(1.8, 6);
  });

  it("fits the WC across the end wall with room to spare", () => {
    expect(wc.w).toBeLessThanOrEqual(room.w);
    expect(room.w - wc.w).toBeCloseTo(0.8, 6); // 400 either side
  });

  it("leaves 600 mm of clear floor in front of the WC", () => {
    // Depth less the WC's own 700 and the basin's 500 along the far wall.
    const clear = room.d - wc.d - basin.w;
    expect(clear).toBeCloseTo(0.6, 6);
    expect(clear).toBeGreaterThanOrEqual(CLEAR_WC);
  });

  it("leaves 800 mm of clear width past the basin", () => {
    const clear = room.w - basin.d;
    expect(clear).toBeCloseTo(0.8, 6);
    expect(clear).toBeGreaterThanOrEqual(CLEAR_BASIN);
  });

  it("VERDICT: the proposed 2×3 holds", () => {
    expect(room.d - wc.d - basin.w).toBeGreaterThanOrEqual(CLEAR_WC);
  });
});

describe("the full bathroom at 4×4 cells", () => {
  const room = roomSizeM("bathroom_full");

  it("is 2.4 × 2.4 m", () => {
    expect(room.w).toBeCloseTo(2.4, 6);
    expect(room.d).toBeCloseTo(2.4, 6);
  });

  it("takes the 1700 tub along a wall with 700 to spare", () => {
    expect(tub.w).toBeLessThanOrEqual(room.w);
    expect(room.w - tub.w).toBeCloseTo(0.7, 6);
  });

  it("leaves 950 mm between the tub and the WC opposite", () => {
    const clear = room.d - tub.d - wc.d;
    expect(clear).toBeCloseTo(0.95, 6);
    expect(clear).toBeGreaterThanOrEqual(CLEAR_TUB);
    expect(clear).toBeGreaterThanOrEqual(CLEAR_WC);
  });

  it("still clears the basin projecting from the side wall", () => {
    // The basin sits in the band between tub and WC; what it leaves across the
    // room is the width less its 400 depth.
    expect(room.w - basin.d).toBeCloseTo(2.0, 6);
    expect(room.w - basin.d).toBeGreaterThanOrEqual(CLEAR_BASIN);
  });

  it("VERDICT: the proposed 4×4 holds comfortably", () => {
    expect(room.d - tub.d - wc.d).toBeGreaterThanOrEqual(CLEAR_TUB);
  });
});

describe("the full bathroom, compact, at 3×4 cells", () => {
  const room = roomSizeM("bathroom_full_compact");

  it("is 1.8 × 2.4 m", () => {
    expect(room.w).toBeCloseTo(1.8, 6);
    expect(room.d).toBeCloseTo(2.4, 6);
  });

  it("fits the tub, and THE TUB IS WHAT BINDS: 100 mm of slack", () => {
    expect(tub.w).toBeLessThanOrEqual(room.w);
    expect(room.w - tub.w).toBeCloseTo(0.1, 6);
  });

  it("keeps the same 950 mm between tub and WC", () => {
    const clear = room.d - tub.d - wc.d;
    expect(clear).toBeCloseTo(0.95, 6);
    expect(clear).toBeGreaterThanOrEqual(CLEAR_TUB);
  });

  it("leaves 1400 mm across once the basin projects", () => {
    expect(room.w - basin.d).toBeCloseTo(1.4, 6);
    expect(room.w - basin.d).toBeGreaterThanOrEqual(CLEAR_BASIN);
  });

  it("VERDICT: the proposed 3×4 holds, with the tub the tight dimension", () => {
    expect(room.w - tub.w).toBeGreaterThan(0);
    expect(room.d - tub.d - wc.d).toBeGreaterThanOrEqual(CLEAR_TUB);
  });

  it("would NOT hold one cell narrower, which is why 3×4 is the floor", () => {
    // 2×4 is 1.2 m and the tub is 1.7 m: it simply does not go in.
    expect(tub.w).toBeGreaterThan(2 * CELL_SIZE);
  });
});
