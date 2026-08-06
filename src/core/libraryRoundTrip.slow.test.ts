import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { FloorManager } from "./floorManager";
import { buildUnitExport, type DwellingUnitFile } from "./unitExport";
import { parseProject } from "./projectIO";
// The committed seed units, loaded as JSON modules (no node:fs — tsconfig's
// `src` net has no node types, and the vite pipeline serves the same bytes).
import flat2Raw from "../../public/units/flat-2-single-storey.json";
import flat3Raw from "../../public/units/flat-3-terrace.json";

/**
 * The library round trip (docs/library-format.md): a seed unit opened from the
 * library — its embedded `sourceProject` loaded through the real import path —
 * and re-exported must reproduce the stored unit file. This is the guarantee
 * the browser's "Open a copy" leans on: what you open IS the unit the library
 * shows, storeys and edges included, so re-saving an unchanged copy adds an
 * equivalent entry rather than a drifted one.
 *
 * Slow suite because a real {@link FloorManager} pulls in the three.js render
 * layer (same reason as unitExport.slow.test.ts, and the same stubDeps
 * trick — no WebGL, no DOM).
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

function roundTrip(stored: DwellingUnitFile): DwellingUnitFile {
  const fm = new FloorManager(new THREE.Scene(), 16, 16);
  fm.attach(stubDeps());
  const parsed = parseProject(JSON.stringify(stored.sourceProject));
  expect(parsed.status).toBe("current");
  const { skipped } = fm.loadProject(parsed.data);
  expect(skipped).toBe(0);

  const result = buildUnitExport(fm, stored.name, stored.color);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("unreachable");
  return result.file;
}

const SEEDS: [string, DwellingUnitFile][] = [
  ["flat-2-single-storey", flat2Raw as unknown as DwellingUnitFile],
  ["flat-3-terrace", flat3Raw as unknown as DwellingUnitFile],
];

describe("library round trip (real FloorManager)", () => {
  for (const [id, stored] of SEEDS) {
    it(`${id}: storeys and edges survive open → re-export unchanged`, () => {
      const rebuilt = roundTrip(stored);

      // The run-0018 contract: storeys and edges unchanged. Deep equality over
      // the whole storeys array covers cells, cellKinds, cellRooms, every
      // classified edge, and heights at once.
      expect(rebuilt.storeys).toEqual(stored.storeys);

      // The rest of the envelope that must survive: identity and grid terms.
      expect(rebuilt.name).toBe(stored.name);
      expect(rebuilt.color).toBe(stored.color);
      expect(rebuilt.cellSize).toBe(stored.cellSize);
      expect(rebuilt.northAngle).toBe(stored.northAngle);
      expect(rebuilt.roomTypes).toEqual(stored.roomTypes);

      // And the embedded save itself: loading and re-serializing reproduces
      // the same sourceProject, so a copy of a copy cannot drift either.
      expect(rebuilt.sourceProject).toEqual(stored.sourceProject);
    });
  }
});
