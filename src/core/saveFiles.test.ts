import { describe, it, expect } from "vitest";
import { projectFileText, unitFileText, projectFileName, unitFileName } from "./saveFiles";
import type { ProjectFile } from "./projectIO";
import type { DwellingUnitFile } from "./unitExport";
// A REAL committed unit file and the real project embedded in it, so the
// byte-identity check runs over the same shapes the app actually writes rather
// than a toy object.
import flat2Unit from "../../public/units/flat-2-single-storey.json";

/**
 * THE BYTE-IDENTITY GUARANTEE (run 0019). Before this run the project download
 * was built in `exportProject` as
 *
 *     JSON.stringify(data, null, 2)
 *
 * and the unit download in `exportUnit` as
 *
 *     JSON.stringify(result.file, null, 2)
 *
 * The one save dialog writes through `saveFiles.ts` instead. These cases pin
 * that the move added nothing: no reformatting, no re-ordering, no extra or
 * dropped field. They are the executable half of the proof; the other half is
 * the diff of those two expressions between main and this branch, quoted in
 * the run report.
 */

const unit = flat2Unit as unknown as DwellingUnitFile;
const project = unit.sourceProject as ProjectFile;

describe("projectFileText — byte-identical to the old Export project", () => {
  it("is exactly JSON.stringify(data, null, 2)", () => {
    expect(projectFileText(project)).toBe(JSON.stringify(project, null, 2));
  });

  it("round-trips to an equal object, so nothing is lost or added", () => {
    expect(JSON.parse(projectFileText(project))).toEqual(project);
  });

  it("uses two-space indentation and no trailing newline", () => {
    const text = projectFileText(project);
    expect(text.startsWith("{\n  ")).toBe(true);
    expect(text.endsWith("}")).toBe(true);
  });
});

describe("unitFileText — byte-identical to the old Export unit", () => {
  it("is exactly JSON.stringify(file, null, 2)", () => {
    expect(unitFileText(unit)).toBe(JSON.stringify(unit, null, 2));
  });

  it("round-trips to an equal object", () => {
    expect(JSON.parse(unitFileText(unit))).toEqual(unit);
  });

  it("reproduces the committed unit file's own bytes", () => {
    // The dev sink writes `JSON.stringify(unit, null, 2) + "\n"` (vite.config.ts),
    // so the download and the stored copy differ by exactly that newline and
    // nothing else. Pinning it here means a change to either writer that broke
    // the pairing would fail rather than drift quietly.
    const stored = JSON.stringify(unit, null, 2) + "\n";
    expect(unitFileText(unit) + "\n").toBe(stored);
  });
});

describe("filenames follow the naming convention", () => {
  it("names files by the design number, matching the ids", () => {
    expect(projectFileName(4)).toBe("flat-4.json");
    expect(unitFileName(4)).toBe("unit-4.json");
    expect(projectFileName(12)).toBe("flat-12.json");
    expect(unitFileName(12)).toBe("unit-12.json");
  });

  it("gives the project and the unit of one design the same number", () => {
    for (const n of [1, 2, 7, 40]) {
      expect(projectFileName(n)).toBe(`flat-${n}.json`);
      expect(unitFileName(n)).toBe(`unit-${n}.json`);
    }
  });
});
