import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { FloorManager } from "./floorManager";
import { buildUnitExport } from "./unitExport";
import { computeWindows } from "./windows";
import { occupiedCells } from "./modules";
import { edgeKey, parseEdgeKey } from "./exteriorEdges";
import { buildSpaceTargets } from "./door";
import type { Cell } from "./grid";

/**
 * THE ENFORCING HALF of the export glazing invariant. `unitExport.test.ts` pins
 * the pure derivations and says openly that it cannot fail when
 * `unitExport.ts` regresses, because it never calls it. This one does call it,
 * over a real {@link FloorManager} with real placements, and compares the
 * exported glazed set against the set the wall pass would build from the same
 * inputs.
 *
 * It lives behind `npm run test:slow` rather than `npm test` for one measured
 * reason. `floorManager.ts` imports `../scene/clusterShells`,
 * `../scene/moduleMesh` and `../scene/stairMesh`, and `core/floor.ts` imports
 * four more scene modules, so this file pulls the whole three.js render layer
 * into the process. The fast suite runs in about 1.6 s; adding this import graph
 * to it took the same suite to 11.94 s when measured in run 0013. Keeping the
 * fast tests fast is worth one extra script.
 *
 * NO WEBGL IS NEEDED and no DOM is touched. three.js builds `BufferGeometry` in
 * plain Node, and the only thing standing between a headless `FloorManager` and
 * a working one is `FloorDeps`, which exists so the manager can drive the
 * interaction layer. Every member it actually uses is either a field assignment
 * or a no-argument call, so {@link stubDeps} satisfies all of them with plain
 * objects and one `THREE.Object3D`. That was the exact blocker run 0013 hit at
 * `floorManager.ts:771`, where `recomputeStack` reads `deps.groundPlane`.
 */

/**
 * A `FloorDeps` that does nothing. The manager only ever CLEARS the ghosts,
 * REASSIGNS a few fields on the controllers, calls `sizeGroundPlane`, and moves
 * `groundPlane`, so nothing here has to behave; it only has to exist and accept
 * assignment. Cast at the boundary rather than importing the controller types,
 * because importing them would drag the canvas-bound classes in for no gain.
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

/** A solid rectangle of cells, inclusive of both corners. */
function rect(x0: number, z0: number, x1: number, z1: number): Cell[] {
  const out: Cell[] = [];
  for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) out.push({ cx, cz });
  return out;
}

/**
 * The BUILT glazed set: exactly what `floorManager.rebuildAllShells` hands to
 * the wall builders, re-derived here from the same live floor. Rooms go through
 * `computeWindows` with their french set folded in, and cluster components
 * contribute their `glazedByCluster` bands whole.
 */
function builtGlazing(fm: FloorManager, fi: number): Set<string> {
  const floor = fm.floors[fi];
  const below = fi > 0 ? fm.floors[fi - 1] : null;
  const occupied = new Set(buildSpaceTargets(floor, below).keys());
  const entranceEdges = new Set(
    fi === 0 ? floor.entrances.map((e) => edgeKey(e.cell.cx, e.cell.cz, e.side)) : []
  );
  const height = fm.floorHeightOf(floor);

  const out = new Set<string>();
  for (const inst of floor.store.instances.values()) {
    if (inst.def.category !== "room" || inst.def.cluster) continue;
    const cells =
      floor.effectiveCells.get(inst.id) ??
      occupiedCells(inst.def, inst.origin, inst.rotation, inst.mirrored);
    const plan = computeWindows(
      cells, inst.def.type, height, occupied, floor.isOutside,
      entranceEdges, fm.northAngle, floor.semiExterior?.glazedByRoom.get(inst.id)
    );
    for (const key of plan.edges.keys()) out.add(key);
  }
  for (const glazed of floor.semiExterior?.glazedByCluster.values() ?? [])
    for (const key of glazed) out.add(key);
  return out;
}

/**
 * The unit-local translation the export applies (unitExport.ts:173-184): ONE
 * offset for the whole unit, the min corner over the union of every storey's
 * cells, so storeys keep their mutual registration. Built edge keys are
 * ABSOLUTE grid coordinates, so they have to come through this before they can
 * be compared with anything read back out of the file.
 */
function unitOffset(fm: FloorManager): { dx: number; dz: number } {
  let minX = Infinity;
  let minZ = Infinity;
  fm.floors.forEach((floor, i) => {
    for (const key of buildSpaceTargets(floor, i > 0 ? fm.floors[i - 1] : null).keys()) {
      const [cx, cz] = key.split(",").map(Number);
      if (cx < minX) minX = cx;
      if (cz < minZ) minZ = cz;
    }
  });
  return { dx: minX, dz: minZ };
}

/** Absolute edge keys translated into the export's unit-local space. */
function toUnitSpace(keys: Set<string>, off: { dx: number; dz: number }): Set<string> {
  const out = new Set<string>();
  for (const k of keys) {
    const e = parseEdgeKey(k);
    out.add(edgeKey(e.cx - off.dx, e.cz - off.dz, e.side));
  }
  return out;
}

/** Side letter back to the `Side` the edge keys are written in. The export
 *  compresses sides to single letters on the wire (unitExport.ts SIDE_LETTER);
 *  this is that map read backwards, so the comparison happens in one vocabulary. */
const SIDE_OF_LETTER = { N: "north", S: "south", E: "east", W: "west" } as const;

/** The EXPORTED glazed set for storey `fi`, read back out of the real export
 *  file and translated into the same absolute edge keys the wall pass uses. */
function exportedGlazing(file: ReturnType<typeof buildUnitExport>, fi: number): Set<string> {
  if (!file.ok) throw new Error("export failed");
  const out = new Set<string>();
  for (const e of file.file.storeys[fi].edges)
    if (e.class === "glazed") out.add(edgeKey(e.cell[0], e.cell[1], SIDE_OF_LETTER[e.side]));
  return out;
}

/**
 * A layout that exercises BOTH glazing sources at once: a living room with
 * ordinary exterior walls, a corridor running along its south side, and a
 * balcony beyond the corridor open to the sky. The room glazes through
 * `computeWindows`; the corridor glazes only through `glazedByCluster`, which is
 * the source f2af130's rooms-only filter dropped.
 */
function buildFlat(): FloorManager {
  const fm = new FloorManager(new THREE.Scene(), 16, 16);
  fm.attach(stubDeps());
  const f0 = fm.floors[0];
  expect(f0.store.place("living", { cx: 4, cz: 4 }, 0, false)).toBeTruthy();
  for (const c of rect(4, 9, 8, 9))
    expect(f0.store.place("circulation_single", c, 0, false)).toBeTruthy();
  for (const c of rect(4, 10, 8, 10))
    expect(f0.store.place("outdoor_single", c, 0, false)).toBeTruthy();
  f0.addEntrance({ cx: 4, cz: 4 }, "west");
  fm.refreshWalls();
  return fm;
}

describe("unit export glazing parity (real FloorManager)", () => {
  it("builds a FloorManager headlessly with a stubbed FloorDeps", () => {
    const fm = buildFlat();
    expect(fm.floors.length).toBeGreaterThan(0);
    expect(fm.floors[0].store.instances.size).toBe(11); // 1 room + 5 corridor + 5 balcony
    expect(fm.floors[0].semiExterior).toBeDefined();
  });

  it("gives the corridor french glass onto the balcony", () => {
    // The premise: without cluster glazing the two sides agree trivially.
    const fm = buildFlat();
    const cluster = fm.floors[0].semiExterior!.glazedByCluster;
    const total = [...cluster.values()].reduce((n, s) => n + s.size, 0);
    expect(total).toBeGreaterThan(0);
  });

  // KNOWN DEFECT, run 0014. `it.fails` passes while the body throws, so the
  // suite stays green and this turns RED the moment someone repairs the export,
  // which is the signal to delete the `.fails` and keep the assertion.
  //
  // What breaks: `unitExport.ts:311` enumerates the envelope with
  // `exteriorEdges(cells, occupied, floor.isOutside)`, the STRICT open-sky test,
  // which skips any edge whose neighbour cell is occupied
  // (`exteriorEdges.ts:131`). A balcony cell IS occupied, so no french-window
  // edge ever enters the list, and the `glazed` class that `glazedKeys` correctly
  // holds for it at `unitExport.ts:297` has nowhere to land. Run 0011 fixed the
  // key set and left the enumeration on the strict test, so the f2af130 bug
  // survived in its other half.
  //
  // Measured on this layout: the corridor builds a 3-edge french band at local
  // `1,5,south`, `2,5,south`, `3,5,south` and the export contains none of them.
  // Measured separately on a room placed directly against a balcony: 3 french
  // edges built, 0 glazed edges exported out of 26 edges total.
  it.fails("exports exactly the glazed set the wall pass builds", () => {
    const fm = buildFlat();
    const built = builtGlazing(fm, 0);
    const file = buildUnitExport(fm, "Test unit", "#cc4433");
    expect(file.ok).toBe(true);
    const exported = exportedGlazing(file, 0);

    // Both sides in the export's unit-local space. Equality, not containment: a
    // subset check would pass on a missing edge, which is exactly the failure
    // this test exists to catch.
    const builtLocal = toUnitSpace(built, unitOffset(fm));

    expect([...exported].sort()).toEqual([...builtLocal].sort());
    expect(exported.size).toBeGreaterThan(0);
  });

  it("drops every french-window edge from the export (the defect, as a number)", () => {
    // The same gap as the case above, asserted in the direction that currently
    // holds, so the report has an exact figure and a regression in the OTHER
    // direction (fewer ordinary windows exported) still fails something.
    const fm = buildFlat();
    const off = unitOffset(fm);
    const french = new Set<string>();
    for (const glazed of fm.floors[0].semiExterior!.glazedByCluster.values())
      for (const key of glazed) french.add(key);
    for (const glazed of fm.floors[0].semiExterior!.glazedByRoom.values())
      for (const key of glazed) french.add(key);
    const frenchLocal = toUnitSpace(french, off);
    const exported = exportedGlazing(buildUnitExport(fm, "Test unit", "#cc4433"), 0);

    expect(frenchLocal.size).toBe(3); // a 5-cell corridor contact glazes 3
    for (const key of frenchLocal) expect(exported.has(key)).toBe(false);
  });

  it("keeps the entrance edge out of the glazed set", () => {
    // A door wins its edge: the wall pass skips entrance edges when generating
    // windows, and the export classes them "entrance", so neither side may show
    // glass there. This is the one place the two sets could agree with each
    // other and both be wrong, so it is asserted against the model directly.
    const fm = buildFlat();
    const file = buildUnitExport(fm, "Test unit", "#cc4433");
    expect(file.ok).toBe(true);
    const exported = exportedGlazing(file, 0);
    const off = unitOffset(fm);
    for (const e of fm.floors[0].entrances)
      expect(exported.has(edgeKey(e.cell.cx - off.dx, e.cell.cz - off.dz, e.side))).toBe(false);
  });
});

