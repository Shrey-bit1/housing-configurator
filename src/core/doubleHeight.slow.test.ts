import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { FloorManager } from "./floorManager";
import { buildUnitExport } from "./unitExport";
import { serializeProject, parseProject } from "./projectIO";
import { CELL_SIZE } from "./grid";

/**
 * DOUBLE-HEIGHT ROOMS (run 0021), end to end through a real FloorManager: the
 * mark blocks the floor above, it refuses rather than deleting when something
 * is already there, it survives a save and load, it leaves the derived storey
 * height alone, and it reaches the bridge as `openCeilings`.
 *
 * Slow suite for the same reason `unitExport.slow.test.ts` is: a real
 * FloorManager pulls the three.js render layer in. No WebGL and no DOM are
 * needed, and `stubDeps` satisfies `FloorDeps` with plain objects.
 */

function stubDeps() {
  const sink = () => ({ clear() {}, deselect() {} });
  return {
    picker: {},
    ghost: sink(),
    groupGhost: sink(),
    dragDrop: {},
    selection: sink(),
    groundPlane: new THREE.Object3D(),
    sizeGroundPlane: () => {},
  } as unknown as Parameters<FloorManager["attach"]>[0];
}

/** A manager with two floors and a living room on the ground one. */
function twoStorey() {
  const fm = new FloorManager(new THREE.Scene(), 16, 16);
  fm.attach(stubDeps());
  const f0 = fm.floors[0];
  const living = f0.store.place("living", { cx: 1, cz: 1 }, 0, false)!;
  expect(living).toBeTruthy();
  // A stair gives the flat its second floor through the normal path.
  f0.store.place("stair", { cx: 8, cz: 1 }, 0, false);
  f0.addEntrance({ cx: 1, cz: 1 }, "west");
  fm.refreshWalls();
  return { fm, f0, living, f1: fm.floors[1] };
}

describe("marking a room double height", () => {
  it("blocks its whole footprint on the floor above", () => {
    const { fm, f0, living, f1 } = twoStorey();
    const before = f1.grid.holeCount;
    expect(f0.store.setDoubleHeight(living.id, true)).toEqual({ ok: true });
    // The living room is 7×5 = 35 cells, all of them now holes up there, on
    // top of whatever the stair already opened.
    expect(f1.grid.holeCount).toBe(before + 35);
    expect(fm.voidCells(f0).length).toBe(before + 35);
  });

  it("stops anything being placed in the volume it claims", () => {
    const { f0, living, f1 } = twoStorey();
    f0.store.setDoubleHeight(living.id, true);
    // Directly over the living room: refused, because the plate is gone.
    expect(f1.store.place("bedroom_small", { cx: 1, cz: 1 }, 0, false)).toBeNull();
    // Clear of it: still fine, so the block is the footprint and nothing more.
    expect(f1.store.place("bedroom_small", { cx: 8, cz: 8 }, 0, false)).toBeTruthy();
  });

  it("REFUSES, naming the cells, when the floor above is occupied", () => {
    const { f0, living, f1 } = twoStorey();
    const above = f1.store.place("bedroom_small", { cx: 1, cz: 1 }, 0, false)!;
    const res = f0.store.setDoubleHeight(living.id, true);
    expect(res.ok).toBe(false);
    expect(res.blockedBy!.length).toBe(20); // the bedroom's 5×4 overlap
    // And nothing was destroyed to make room.
    expect(f1.store.instances.has(above.id)).toBe(true);
    expect(living.doubleHeight).toBe(false);
  });

  it("can be cleared again, which never fails", () => {
    const { f0, living, f1 } = twoStorey();
    const before = f1.grid.holeCount;
    f0.store.setDoubleHeight(living.id, true);
    expect(f0.store.setDoubleHeight(living.id, false)).toEqual({ ok: true });
    expect(living.doubleHeight).toBe(false);
    expect(f1.grid.holeCount).toBe(before);
  });

  it("CREATES the floor above when there is none, exactly as a stair does", () => {
    // The mark claims the storey above, so that storey had better exist. This
    // is the same `voidCells` branch of `syncStairsAndHoles` a stair takes.
    const fm = new FloorManager(new THREE.Scene(), 16, 16);
    fm.attach(stubDeps());
    const f0 = fm.floors[0];
    const living = f0.store.place("living", { cx: 1, cz: 1 }, 0, false)!;
    expect(fm.floors).toHaveLength(1);

    expect(f0.store.setDoubleHeight(living.id, true)).toEqual({ ok: true });

    expect(fm.floors).toHaveLength(2);
    expect(fm.floors[1].grid.holeCount).toBe(35);
  });

  it("is refused for a connector, which has no coherent single volume", () => {
    const { f0 } = twoStorey();
    const hall = f0.store.place("circulation_single", { cx: 9, cz: 9 }, 0, false)!;
    expect(f0.store.setDoubleHeight(hall.id, true).ok).toBe(false);
    expect(hall.doubleHeight).toBe(false);
  });
});

describe("growth, and the void that has to follow it", () => {
  /**
   * A living room with an ENCLOSED strip beside it that expansion will fill.
   * The strip is cz 5, cx 1..7: walled by the living room above, two bathrooms
   * below, and a connector at each end, so it is not border-reachable and is
   * therefore a gap an elastic room can claim.
   */
  function withGrowth() {
    const fm = new FloorManager(new THREE.Scene(), 16, 16);
    fm.attach(stubDeps());
    const f0 = fm.floors[0];
    // A stair first, so floor 1 exists and can be occupied BEFORE any mark.
    f0.store.place("stair", { cx: 12, cz: 0 }, 0, false);
    const living = f0.store.place("living", { cx: 1, cz: 0 }, 0, false)!;
    f0.store.place("bathroom_large", { cx: 1, cz: 6 }, 0, false);
    f0.store.place("bathroom_large", { cx: 5, cz: 6 }, 0, false);
    f0.store.place("circulation_single", { cx: 0, cz: 5 }, 0, false);
    f0.store.place("circulation_single", { cx: 8, cz: 5 }, 0, false);
    return { fm, f0, f1: fm.floors[1], living };
  }

  const grown = (f: (typeof FloorManager.prototype.floors)[number], id: string) =>
    (f.effectiveCells.get(id) ?? []).length;

  it("grows into the enclosed strip when nothing is above it", () => {
    const { f0, living } = withGrowth();
    expect(grown(f0, living.id)).toBe(42); // 35 seed + the 7-cell strip
  });

  it("VOIDS THE GROWN ROOM, not its seed", () => {
    // The void has to be the room. Reading the seed left a grown
    // double-height room roofed over the part it had grown into.
    const { f0, f1, living } = withGrowth();
    expect(f0.store.setDoubleHeight(living.id, true)).toEqual({ ok: true });
    expect(grown(f0, living.id)).toBe(42);
    expect(f1.grid.holeCount).toBe(42 + 12); // the room, plus the stairwell
  });

  it("REFUSES TO GROW where the storey above is occupied", () => {
    // The upstairs bathroom covers cx 4..7 of the strip and none of the seed,
    // so the mark is allowed and the growth is what has to give way.
    const { f0, f1, living } = withGrowth();
    expect(f1.store.place("bathroom_large", { cx: 4, cz: 5 }, 0, false)).toBeTruthy();
    expect(grown(f0, living.id)).toBe(42); // still grown: not double height yet

    expect(f0.store.setDoubleHeight(living.id, true)).toEqual({ ok: true });

    // Retracted to the three strip cells whose volume above is free.
    expect(grown(f0, living.id)).toBe(38);
    const strip = (f0.effectiveCells.get(living.id) ?? [])
      .filter((c) => c.cz === 5)
      .map((c) => c.cx)
      .sort((a, b) => a - b);
    expect(strip).toEqual([1, 2, 3]);
  });

  it("keeps the hole exactly equal to what the room actually holds", () => {
    const { f0, f1, living } = withGrowth();
    f1.store.place("bathroom_large", { cx: 4, cz: 5 }, 0, false);
    f0.store.setDoubleHeight(living.id, true);
    // 38 room cells + 12 stairwell, and not one cell more: the hole tracks the
    // retracted footprint rather than the growth the room wanted.
    expect(f1.grid.holeCount).toBe(38 + 12);
    expect(grown(f0, living.id) + 12).toBe(f1.grid.holeCount);
  });

  it("a SINGLE-height room is unaffected by what is above it", () => {
    // The constraint is about claiming volume, so it must not leak into
    // ordinary rooms: this one keeps the whole strip.
    const { f0, f1, living } = withGrowth();
    f1.store.place("bathroom_large", { cx: 4, cz: 5 }, 0, false);
    expect(living.doubleHeight).toBe(false);
    expect(grown(f0, living.id)).toBe(42);
  });

  it("gives the growth back when the obstruction upstairs is removed", () => {
    const { f0, f1, living } = withGrowth();
    const up = f1.store.place("bathroom_large", { cx: 4, cz: 5 }, 0, false)!;
    f0.store.setDoubleHeight(living.id, true);
    expect(grown(f0, living.id)).toBe(38);

    f1.store.remove(up.id);

    expect(grown(f0, living.id)).toBe(42);
    expect(f1.grid.holeCount).toBe(42 + 12);
  });
});

describe("the derived storey height", () => {
  it("does NOT change: the room takes the storey above, it does not grow its own", () => {
    const { fm, f0, living } = twoStorey();
    const before = fm.floorHeightOf(f0);
    const stackBefore = fm.floors.map((f) => f.group.position.y);
    f0.store.setDoubleHeight(living.id, true);
    expect(fm.floorHeightOf(f0)).toBe(before);
    expect(fm.floors.map((f) => f.group.position.y)).toEqual(stackBefore);
    // Which is the default storey, since nothing tall was placed.
    expect(before).toBeCloseTo(3.0, 6);
    expect(before).toBeCloseTo((4 + 1) * CELL_SIZE, 6);
  });
});

describe("save and load", () => {
  it("keeps the mark through a round trip", () => {
    const { fm, f0, living } = twoStorey();
    f0.store.setDoubleHeight(living.id, true);

    const text = JSON.stringify(
      serializeProject(fm.floors, fm.northAngle, fm.orientationPreference)
    );
    expect(text).toContain('"doubleHeight":true');

    const fresh = new FloorManager(new THREE.Scene(), 16, 16);
    fresh.attach(stubDeps());
    fresh.loadProject(parseProject(text).data);

    const reloaded = [...fresh.floors[0].store.instances.values()].filter(
      (i) => i.def.type === "living"
    );
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].doubleHeight).toBe(true);
    // And the void is live again on the floor above, not just the flag.
    expect(fresh.floors[1].grid.holeCount).toBeGreaterThanOrEqual(35);
  });

  it("loads a file written BEFORE the field existed as all floors present", () => {
    const { fm, f0, living } = twoStorey();
    f0.store.setDoubleHeight(living.id, true);
    const data = serializeProject(fm.floors, fm.northAngle, fm.orientationPreference);

    // Strip the field the way a pre-0021 file simply would not have it.
    const stripped = JSON.parse(JSON.stringify(data)) as typeof data;
    for (const f of stripped.floors) for (const i of f.instances) delete i.doubleHeight;
    expect(JSON.stringify(stripped)).not.toContain("doubleHeight");

    const fresh = new FloorManager(new THREE.Scene(), 16, 16);
    fresh.attach(stubDeps());
    fresh.loadProject(parseProject(JSON.stringify(stripped)).data);

    for (const inst of fresh.floors[0].store.instances.values())
      expect(inst.doubleHeight).toBe(false);
  });
});

describe("openCeilings on the wire", () => {
  it("lists exactly the cells the double-height room covers", () => {
    const { fm, f0, living } = twoStorey();
    f0.store.setDoubleHeight(living.id, true);
    const res = buildUnitExport(fm, "Unit 7", "#4dabf7");
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("unreachable");

    const ground = res.file.storeys[0];
    const open = new Set(ground.openCeilings!.map(([x, z]) => `${x},${z}`));
    // 35 living-room cells plus the stair's own 12, both open upward.
    expect(open.size).toBe(35 + 12);
    // Every listed cell is part of the storey it belongs to.
    const cells = new Set(ground.cells.map(([x, z]) => `${x},${z}`));
    for (const k of open) expect(cells.has(k)).toBe(true);
  });

  it("gives the TOP storey none, because the roof is not this format's business", () => {
    const { fm, f0, living } = twoStorey();
    f0.store.setDoubleHeight(living.id, true);
    const res = buildUnitExport(fm, "Unit 7", "#4dabf7");
    if (!res.ok) throw new Error("unreachable");
    const top = res.file.storeys[res.file.storeys.length - 1];
    expect(top.openCeilings).toEqual([]);
  });

  it("is EMPTY on every storey when nothing is marked, which is the old meaning", () => {
    const { fm } = twoStorey();
    const res = buildUnitExport(fm, "Unit 7", "#4dabf7");
    if (!res.ok) throw new Error("unreachable");
    // The stair still opens its own ceiling; nothing else does.
    expect(res.file.storeys[0].openCeilings!.length).toBe(12);
    expect(res.file.storeys[1].openCeilings).toEqual([]);
  });

  it("normalizes with the rest of the storey, so it points at real cells", () => {
    const { fm, f0, living } = twoStorey();
    f0.store.setDoubleHeight(living.id, true);
    const res = buildUnitExport(fm, "Unit 7", "#4dabf7");
    if (!res.ok) throw new Error("unreachable");
    // The unit is translated to its own origin, so no coordinate may be
    // negative and every open cell must still be inside the footprint.
    for (const [x, z] of res.file.storeys[0].openCeilings!) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(z).toBeGreaterThanOrEqual(0);
    }
  });
});
