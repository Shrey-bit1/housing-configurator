import { describe, it, expect } from "vitest";
import { axoFrame } from "./previewFrame";

/**
 * The preview's pose and size, pinned on a known bounding box (run 0024).
 * No THREE, no DOM, no scene — `axoFrame` is plain arithmetic, and these
 * numbers were computed once from the same formula and are pinned here
 * rather than re-derived, the way the rest of this codebase pins geometry
 * (`stairSpec.test.ts`).
 */

const BOX = { min: { x: 0, y: 0, z: 0 }, max: { x: 6, y: 3, z: 4 } };

describe("axoFrame", () => {
  it("looks from the standard isometric direction, straight up", () => {
    const { direction, up } = axoFrame(BOX, 4 / 3);
    const third = 1 / Math.sqrt(3);
    expect(direction.x).toBeCloseTo(third, 10);
    expect(direction.y).toBeCloseTo(third, 10);
    expect(direction.z).toBeCloseTo(third, 10);
    expect(up).toEqual({ x: 0, y: 1, z: 0 });
  });

  it("centres on the box's own centre", () => {
    expect(axoFrame(BOX, 4 / 3).center).toEqual({ x: 3, y: 1.5, z: 2 });
  });

  it("sizes the frustum from the box's projected half-extents, margined", () => {
    // Computed from the same box-corner projection this function uses:
    // halfW ≈ 3.535534 (= 5/√2), halfH ≈ 3.265986; at aspect 4:3, halfH
    // governs (halfW/aspect ≈ 2.651650 is smaller), so viewSize = halfH × 1.15.
    expect(axoFrame(BOX, 4 / 3).viewSize).toBeCloseTo(3.7558842722675396, 10);
  });

  it("switches to the width-governed branch at a narrower aspect", () => {
    // At aspect 1:1, halfW/aspect (3.535534) exceeds halfH (3.265986), so the
    // OTHER branch of max(halfH, halfW/aspect) governs.
    expect(axoFrame(BOX, 1).viewSize).toBeCloseTo(4.065863991822648, 10);
  });

  it("never frames tighter than a 0.5 half-extent, even for a single point", () => {
    const point = { min: { x: 5, y: 2, z: 1 }, max: { x: 5, y: 2, z: 1 } };
    expect(axoFrame(point, 4 / 3).viewSize).toBeCloseTo(0.575, 10); // 0.5 × 1.15
    expect(axoFrame(point, 4 / 3).center).toEqual({ x: 5, y: 2, z: 1 });
  });
});
