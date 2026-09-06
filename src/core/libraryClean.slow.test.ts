import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { FloorManager } from "./floorManager";
import { computeDwellingGraph } from "./adjacencyGraph";
import { validate } from "./rules";
import { parseProject } from "./projectIO";
import type { DwellingUnitFile } from "./unitExport";

/**
 * EVERY FLAT IN THE LIBRARY IS CLEAN.
 *
 * The library is data, and data rots quietly. A unit file can be hand-edited, or
 * re-saved from a state that was never checked, or left behind by a rule change
 * that turned an advisory finding into a must-fix. None of that shows anywhere
 * until somebody opens the flat in the editor and sees red.
 *
 * So this walks `public/units/` file by file, loads each one through the same
 * path the browser's "Open a copy" uses, and runs the two functions Check Layout
 * runs: `computeDwellingGraph` over the loaded floors, then `validate` over the
 * graph. Zero must-fix on every file, no exceptions and no allow-list. Advisory
 * findings are the designer's business and are not asserted.
 *
 * The files are picked up by glob rather than listed, so a flat added to the
 * library is covered the moment it lands, and a flat that cannot pass cannot be
 * added quietly.
 *
 * ONE FLAT IS ALREADY ROTTEN. `unit-5.json` was in the library before this test
 * existed and fails four rules: it has no bathroom, its second storey is cut off
 * because no stair reaches it, and the rooms up there are orphaned. Run 0028
 * found it and was not allowed to touch the seven flats that were already
 * there, so it is quarantined below by name and by the exact four rules it
 * breaks. That is deliberately brittle. Fixing the flat breaks this test, which
 * is the reminder to delete the quarantine; a fifth failure appearing breaks it
 * too. Nothing else in the library gets this treatment.
 *
 * Slow suite, because a real {@link FloorManager} pulls in the three.js render
 * layer. Same stubs and the same reason as libraryRoundTrip.slow.test.ts.
 */

/** file name → the must-fix rule ids it is known to break, newest first. */
const QUARANTINE: Record<string, string[]> = {
  "unit-5.json": ["P1", "H1", "ST3", "ST2"],
};

const UNITS = import.meta.glob<DwellingUnitFile>("../../public/units/*.json", {
  eager: true,
  import: "default",
});

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

// The manifest lives in the same directory and is not a unit.
const FILES = Object.entries(UNITS)
  .filter(([path]) => !path.endsWith("/index.json"))
  .map(([path, unit]) => [path.split("/").pop()!, unit] as const)
  .sort(([a], [b]) => a.localeCompare(b));

/**
 * The flats this project DESIGNED, as opposed to the ones that happen to be in
 * the folder. Run 0028 drew five and run 0029 drew fifteen more, and the point
 * of naming them is that the glob above cannot tell a missing flat from a flat
 * that was never there. If one is deleted the glob simply stops checking it.
 */
const DESIGNED = Array.from({ length: 20 }, (_, i) => `unit-${i + 8}.json`);

describe("every library unit passes Check Layout", () => {
  it("finds the library where it is meant to be", () => {
    expect(FILES.length).toBeGreaterThan(0);
  });

  it("still holds all twenty designed flats", () => {
    const present = new Set(FILES.map(([name]) => name));
    expect(DESIGNED.filter((n) => !present.has(n))).toEqual([]);
  });

  for (const [name, unit] of FILES) {
    it(`${name}: parses and carries zero must-fix`, () => {
      expect(unit.format).toBe("dwelling-unit");
      expect(Array.isArray(unit.storeys)).toBe(true);

      const parsed = parseProject(JSON.stringify(unit.sourceProject));
      expect(parsed.status).toBe("current");
      if (parsed.status !== "current") throw new Error("unreachable");

      const fm = new FloorManager(new THREE.Scene(), 16, 16);
      fm.attach(stubDeps());
      const { skipped } = fm.loadProject(parsed.data);
      expect(skipped).toBe(0);

      const violations = validate(computeDwellingGraph(fm.floors), fm.orientationPreference);
      const mustFix = violations.filter((v) => v.severity === "hard");
      const known = QUARANTINE[name];
      if (known) {
        expect(
          mustFix.map((v) => v.ruleId),
          `${name} is quarantined — if this changed, update or delete its entry`
        ).toEqual(known);
        return;
      }
      expect(
        mustFix.map((v) => `${v.ruleId}: ${v.description}`),
        `${name} has must-fix findings`
      ).toEqual([]);
    });
  }
});
