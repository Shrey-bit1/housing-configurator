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

  it("is refused for a connector, which has no coherent single volume", () => {
    const { f0 } = twoStorey();
    const hall = f0.store.place("circulation_single", { cx: 9, cz: 9 }, 0, false)!;
    expect(f0.store.setDoubleHeight(hall.id, true).ok).toBe(false);
    expect(hall.doubleHeight).toBe(false);
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
