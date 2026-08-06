import { describe, it, expect } from "vitest";
import { parseUnitLibraryIndex, ManifestParseError } from "./manifest";
// The REAL committed manifest and the unit files it points at, loaded through
// the vite pipeline (`?raw` / JSON modules) rather than node:fs, because
// tsconfig's `src` net has no node types and the tests should not need them.
import committedRaw from "../../public/units/index.json?raw";
import flat2Unit from "../../public/units/flat-2-single-storey.json";
import flat3Unit from "../../public/units/flat-3-terrace.json";

/**
 * Two halves. The schema cases pin `parseUnitLibraryIndex` against hand-built
 * inputs; the committed-manifest cases run the REAL `public/units/index.json`
 * through the same parser the browser uses and cross-check it against the unit
 * files it points at, so a bad hand edit fails here rather than rendering a
 * broken library.
 */

function validEntry(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "flat-2-single-storey",
    name: "Flat 2 — single storey",
    color: "#f783ac",
    file: "flat-2-single-storey.json",
    preview: "flat-2-single-storey.jpg",
    storeys: 1,
    areaM2: 69.84,
    savedAt: "2026-08-06T20:44:56.100Z",
    ...over,
  };
}

function index(units: unknown[]): string {
  return JSON.stringify({ format: "unit-library", version: 1, units });
}

describe("parseUnitLibraryIndex — schema", () => {
  it("accepts a valid manifest", () => {
    const m = parseUnitLibraryIndex(index([validEntry()]));
    expect(m.units).toHaveLength(1);
    expect(m.units[0].id).toBe("flat-2-single-storey");
  });

  it("rejects a wrong discriminator, version, or shape", () => {
    expect(() => parseUnitLibraryIndex("not json")).toThrow(ManifestParseError);
    expect(() => parseUnitLibraryIndex(JSON.stringify({ format: "x", version: 1, units: [] }))).toThrow(/format/);
    expect(() => parseUnitLibraryIndex(JSON.stringify({ format: "unit-library", version: 2, units: [] }))).toThrow(/version/);
    expect(() => parseUnitLibraryIndex(JSON.stringify({ format: "unit-library", version: 1, units: {} }))).toThrow(/units/);
  });

  it("rejects a non-slug id and names the offending field", () => {
    expect(() => parseUnitLibraryIndex(index([validEntry({ id: "Unit_2" })]))).toThrow(/units\[0\]\.id/);
  });

  it("rejects files not named by id", () => {
    expect(() => parseUnitLibraryIndex(index([validEntry({ file: "other.json" })]))).toThrow(/named by id/);
    expect(() => parseUnitLibraryIndex(index([validEntry({ preview: "other.jpg" })]))).toThrow(/named by id/);
  });

  it("rejects duplicate ids — the collision rule's other half", () => {
    expect(() => parseUnitLibraryIndex(index([validEntry(), validEntry()]))).toThrow(/duplicate id/);
  });

  it("rejects bad numbers and colours", () => {
    expect(() => parseUnitLibraryIndex(index([validEntry({ storeys: 0 })]))).toThrow(/storeys/);
    expect(() => parseUnitLibraryIndex(index([validEntry({ areaM2: -1 })]))).toThrow(/areaM2/);
    expect(() => parseUnitLibraryIndex(index([validEntry({ color: "red" })]))).toThrow(/color/);
    expect(() => parseUnitLibraryIndex(index([validEntry({ savedAt: "yesterday" })]))).toThrow(/savedAt/);
  });
});

describe("the committed manifest", () => {
  const unitFiles: Record<string, typeof flat2Unit | typeof flat3Unit> = {
    "flat-2-single-storey": flat2Unit,
    "flat-3-terrace": flat3Unit,
  };

  it("parses through the same validator the browser uses", () => {
    const m = parseUnitLibraryIndex(committedRaw);
    expect(m.units.length).toBe(2);
    const ids = m.units.map((u) => u.id);
    expect(ids).toContain("flat-2-single-storey");
    expect(ids).toContain("flat-3-terrace");
    // The rule fixtures stay out of the library (run 0018's assumption 4).
    expect(ids.some((id) => id.startsWith("flat-1"))).toBe(false);
  });

  it("agrees with each unit file on storeys, area, name, and colour", () => {
    for (const u of parseUnitLibraryIndex(committedRaw).units) {
      const unit = unitFiles[u.id];
      expect(unit, `unit file for ${u.id} is imported above`).toBeDefined();
      expect(unit.format).toBe("dwelling-unit");
      expect(unit.name).toBe(u.name);
      expect(unit.color).toBe(u.color);
      expect(unit.storeys.length).toBe(u.storeys);
      const cells = unit.storeys.reduce((n, s) => n + s.cells.length, 0);
      expect(Math.round(cells * unit.cellSize * unit.cellSize * 100) / 100).toBe(u.areaM2);
    }
  });
});
