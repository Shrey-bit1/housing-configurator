import { describe, it, expect } from "vitest";
import { slugifyUnitName, assignUnitId } from "./ids";

/**
 * The id-collision contract (docs/library-format.md): ids are lowercase slugs
 * of the display name, files are named by id, and a second save under an
 * already-used name gets a numeric suffix instead of overwriting — the fix
 * for the old Unit_2 name clash. The dev save endpoint (vite.config.ts) and
 * the production download fallback (main.ts) both assign through these two
 * functions, so this file pins the behaviour for both.
 */

describe("slugifyUnitName", () => {
  it("lowercases and collapses non-alphanumeric runs to single hyphens", () => {
    expect(slugifyUnitName("Flat 2 — single storey")).toBe("flat-2-single-storey");
    expect(slugifyUnitName("Unit")).toBe("unit");
    expect(slugifyUnitName("  A   B  ")).toBe("a-b");
    expect(slugifyUnitName("Café № 3!")).toBe("caf-3");
  });

  it("never returns an empty id", () => {
    expect(slugifyUnitName("")).toBe("unit");
    expect(slugifyUnitName("—–—")).toBe("unit");
  });
});

describe("assignUnitId", () => {
  it("uses the bare slug when free", () => {
    expect(assignUnitId("Flat 2 — single storey", [])).toBe("flat-2-single-storey");
  });

  it("gives two saves under one display name two distinct ids", () => {
    const taken: string[] = [];
    const first = assignUnitId("Unit 2", taken);
    taken.push(first);
    const second = assignUnitId("Unit 2", taken);
    expect(first).toBe("unit-2");
    expect(second).toBe("unit-2-2");
    expect(second).not.toBe(first);
  });

  it("counts past every taken suffix, not just the first", () => {
    const taken = ["flat", "flat-2", "flat-3"];
    expect(assignUnitId("Flat", taken)).toBe("flat-4");
  });

  it("is deterministic against the same taken set", () => {
    const taken = ["unit"];
    expect(assignUnitId("Unit", taken)).toBe(assignUnitId("Unit", taken));
  });
});
