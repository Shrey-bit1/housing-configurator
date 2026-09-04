import { describe, it, expect } from "vitest";
import {
  packStorey,
  slotSize,
  doorAnchors,
  deriveDoors,
  deriveEntrance,
  areaM2,
  widestGap,
  cellKey,
  LayoutError,
  type StoreyPlan,
} from "./flatLayout";

/**
 * The generator's arithmetic, on one graph worked out by hand.
 *
 * The flat below is drawn on squared paper before it is written down here, so
 * every number in the assertions is a number a person counted. If the packer
 * ever shifts a room by a cell, or a door drifts to a corner, this is where it
 * shows, and it shows without booting the render layer.
 *
 * The flat: three rows from the origin at (2,2), on the 0.6 m grid.
 *
 *   row 0, depth 5, z 2..6    living 7×5 at x 2..8    bed1 6×5 at x 9..14
 *   row 1, depth 2, z 7..8    hall 13×2 at x 2..14
 *   row 2, depth 4, z 9..12   kitchen 4×4 at x 2..5   bath 4×4 at x 6..9
 *                             bed2 5×4 at x 10..14
 *
 * 143 cells, so 51.48 m². Every room touches the hall, which is what makes the
 * six-edge graph realisable at all.
 */
const PLAN: StoreyPlan = {
  origin: { cx: 2, cz: 2 },
  rows: [
    {
      slots: [
        { key: "living", type: "living" },
        { key: "bed1", type: "bedroom_large" },
      ],
    },
    { slots: [{ key: "hall", fill: "circulation", w: 13, d: 2 }] },
    {
      slots: [
        { key: "kitchen", type: "kitchen" },
        { key: "bath", type: "bathroom_full" },
        { key: "bed2", type: "bedroom_small" },
      ],
    },
  ],
};

describe("slot sizes", () => {
  it("reads a module's footprint from the catalogue", () => {
    expect(slotSize({ key: "a", type: "living" })).toEqual({ w: 7, d: 5 });
    expect(slotSize({ key: "a", type: "bedroom_small" })).toEqual({ w: 5, d: 4 });
  });

  it("turns a footprint on its side for a quarter rotation", () => {
    expect(slotSize({ key: "a", type: "bedroom_small", rotation: 1 })).toEqual({ w: 4, d: 5 });
  });

  it("adds the depths of a stack and keeps its width", () => {
    expect(
      slotSize({
        stack: [
          { key: "wc", type: "wc" }, // 2 × 3
          { key: "pad", fill: "circulation", w: 2, d: 2 },
        ],
      })
    ).toEqual({ w: 2, d: 5 });
  });

  it("refuses a stack whose parts are different widths", () => {
    expect(() =>
      slotSize({ stack: [{ key: "wc", type: "wc" }, { key: "k", type: "kitchen" }] })
    ).toThrow(LayoutError);
  });
});

describe("packing a storey", () => {
  const packed = packStorey(PLAN);

  it("places each room's origin where the hand drawing puts it", () => {
    const at = (type: string) => packed.placements.find((p) => p.type === type);
    expect(at("living")).toEqual({ type: "living", cx: 2, cz: 2, rotation: 0 });
    expect(at("bedroom_large")).toEqual({ type: "bedroom_large", cx: 9, cz: 2, rotation: 0 });
    expect(at("kitchen")).toEqual({ type: "kitchen", cx: 2, cz: 9, rotation: 0 });
    expect(at("bathroom_full")).toEqual({ type: "bathroom_full", cx: 6, cz: 9, rotation: 0 });
    expect(at("bedroom_small")).toEqual({ type: "bedroom_small", cx: 10, cz: 9, rotation: 0 });
  });

  it("tiles a 13-cell-wide hall as six doubles and one single per row", () => {
    const halls = packed.placements.filter((p) => p.type.startsWith("circulation"));
    expect(halls.filter((p) => p.type === "circulation_double")).toHaveLength(12);
    expect(halls.filter((p) => p.type === "circulation_single")).toHaveLength(2);
    expect(packed.placements).toHaveLength(19);
  });

  it("gives every room the cell count its module claims", () => {
    const size = (k: string) => packed.cells.get(k)!.size;
    expect(size("living")).toBe(35);
    expect(size("bed1")).toBe(30);
    expect(size("hall")).toBe(26);
    expect(size("kitchen")).toBe(16);
    expect(size("bath")).toBe(16);
    expect(size("bed2")).toBe(20);
    const total = [...packed.cells.values()].reduce((n, s) => n + s.size, 0);
    expect(total).toBe(143);
    expect(areaM2(total)).toBe(51.48);
  });

  it("bounds the storey at the rectangle the rows fill", () => {
    expect(packed.bounds).toEqual({ minX: 2, minZ: 2, maxX: 14, maxZ: 12 });
  });

  it("puts the corner cells where they belong", () => {
    expect(packed.cells.get("living")!.has(cellKey(2, 2))).toBe(true);
    expect(packed.cells.get("living")!.has(cellKey(8, 6))).toBe(true);
    expect(packed.cells.get("bed2")!.has(cellKey(14, 12))).toBe(true);
    expect(packed.cells.get("bed2")!.has(cellKey(15, 12))).toBe(false);
  });

  it("refuses a row whose slots are not all the same depth", () => {
    expect(() =>
      packStorey({
        origin: { cx: 0, cz: 0 },
        rows: [{ slots: [{ key: "a", type: "living" }, { key: "b", type: "kitchen" }] }],
      })
    ).toThrow(/slot 1 is 4 cells deep, the row is 5/);
  });

  it("keeps a growth void apart from a stairwell void", () => {
    // A growth void feeds the elastic room beside it and must be enclosed. A
    // stairwell void is the well over the stair below, which the app cuts for
    // itself, so gen-flat.mjs exempts it from the enclosure check and only the
    // flag tells them apart.
    const packed = packStorey({
      origin: { cx: 0, cz: 0 },
      rows: [
        { slots: [{ key: "a", type: "living" }, { void: true, w: 2, d: 5 }] },
        { slots: [{ void: true, w: 9, d: 4, stairwell: true }] },
      ],
    });
    expect(packed.voids.filter((v) => !v.stairwell)).toHaveLength(10);
    expect(packed.voids.filter((v) => v.stairwell)).toHaveLength(36);
    // A void places nothing, so only the living room shows up as an instance.
    expect(packed.placements).toHaveLength(1);
    expect(packed.cells.size).toBe(1);
  });

  it("refuses the same room key twice", () => {
    expect(() =>
      packStorey({
        origin: { cx: 0, cz: 0 },
        rows: [{ slots: [{ key: "a", type: "kitchen" }, { key: "a", type: "kitchen" }] }],
      })
    ).toThrow(/used twice/);
  });
});

describe("doors read out of the geometry", () => {
  const packed = packStorey(PLAN);

  it("finds every anchor on the hall's north wall under the living room", () => {
    const anchors = doorAnchors(packed.cells.get("hall")!, packed.cells.get("living")!, "north");
    // The living room spans x 2..8, so a two-cell door fits at x 2 through 7.
    expect(anchors).toEqual([2, 3, 4, 5, 6, 7].map((cx) => ({ cx, cz: 7 })));
  });

  it("finds nothing on a wall the two rooms do not share", () => {
    expect(doorAnchors(packed.cells.get("living")!, packed.cells.get("bed2")!, "south")).toEqual([]);
  });

  it("puts each door in the middle of the longest run it found", () => {
    const doors = deriveDoors(packed.cells, [
      ["hall", "living"],
      ["hall", "bed1"],
      ["hall", "kitchen"],
      ["hall", "bath"],
      ["hall", "bed2"],
    ]);
    expect(doors).toEqual([
      { cx: 4, cz: 7, side: "north", between: ["hall", "living"] },
      { cx: 11, cz: 7, side: "north", between: ["hall", "bed1"] },
      { cx: 3, cz: 8, side: "south", between: ["hall", "kitchen"] },
      { cx: 7, cz: 8, side: "south", between: ["hall", "bath"] },
      { cx: 11, cz: 8, side: "south", between: ["hall", "bed2"] },
    ]);
  });

  it("refuses a graph edge between two rooms that never touch", () => {
    expect(() => deriveDoors(packed.cells, [["living", "bed2"]])).toThrow(
      /share no straight boundary/
    );
  });

  it("names a room the graph mentions and the plan does not", () => {
    expect(() => deriveDoors(packed.cells, [["hall", "study"]])).toThrow(/no room called "study"/);
  });
});

describe("the entrance", () => {
  const packed = packStorey(PLAN);

  it("lands on the hall's west edge, which faces nothing", () => {
    expect(deriveEntrance(packed.cells, "hall", "west")).toEqual({ cx: 2, cz: 7, side: "west" });
  });

  it("refuses a side that is built against another room", () => {
    // The hall's whole north side is the living room and bedroom 1.
    expect(() => deriveEntrance(packed.cells, "kitchen", "north")).toThrow(
      /has no north edge facing the outside/
    );
  });
});

describe("the wet-room gap", () => {
  const packed = packStorey(PLAN);

  it("reads zero when the kitchen and the bathroom share a wall", () => {
    expect(widestGap(packed.cells, ["kitchen", "bath"])).toBe(0);
  });

  it("counts the cells between two rooms that do not touch", () => {
    // The kitchen's east edge is x 5, bedroom 2's west edge is x 10, both at
    // z 9..12: four cells of bathroom stand between them.
    expect(widestGap(packed.cells, ["kitchen", "bed2"])).toBe(4);
  });
});
