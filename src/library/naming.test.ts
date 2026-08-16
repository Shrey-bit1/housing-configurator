import { describe, it, expect } from "vitest";
import {
  projectNameFor,
  unitNameFor,
  numberFromName,
  nextFreeNumber,
  findLibraryEntry,
} from "./naming";
import committedRaw from "../../public/units/index.json?raw";
import { parseUnitLibraryIndex } from "./manifest";

/**
 * The naming convention and the number the save dialog proposes. The dialog
 * opening on the right number is what makes authoring a run of units need no
 * typing, so the gap behaviour is pinned rather than left to be rediscovered.
 */

const entry = (id: string, name = id) => ({ id, name });

describe("names for a design number", () => {
  it("writes Flat n and Unit n for the same design", () => {
    expect(projectNameFor(4)).toBe("Flat 4");
    expect(unitNameFor(4)).toBe("Unit 4");
  });
});

describe("numberFromName", () => {
  it("reads the number out of a name or an id", () => {
    expect(numberFromName("Unit 4")).toBe(4);
    expect(numberFromName("unit-4")).toBe(4);
    expect(numberFromName("Flat 12")).toBe(12);
    expect(numberFromName("flat-12")).toBe(12);
  });

  it("returns null for the pre-convention descriptive names", () => {
    expect(numberFromName("Flat 2 — single storey")).toBeNull();
    expect(numberFromName("flat-2-single-storey")).toBeNull();
    expect(numberFromName("Studio A")).toBeNull();
    expect(numberFromName("")).toBeNull();
  });

  it("refuses zero and negatives", () => {
    expect(numberFromName("Unit 0")).toBeNull();
    expect(numberFromName("Unit -1")).toBeNull();
  });
});

describe("nextFreeNumber", () => {
  it("proposes 1 for an empty library", () => {
    expect(nextFreeNumber([])).toBe(1);
  });

  it("proposes the next one up from a dense run", () => {
    expect(nextFreeNumber([entry("unit-1"), entry("unit-2"), entry("unit-3")])).toBe(4);
  });

  it("FILLS A GAP rather than stranding it", () => {
    // The documented choice: lowest free, not highest plus one. Deleting Unit 3
    // and saving again offers 3 back.
    expect(nextFreeNumber([entry("unit-1"), entry("unit-2"), entry("unit-4")])).toBe(3);
    expect(nextFreeNumber([entry("unit-2"), entry("unit-3")])).toBe(1);
  });

  it("ignores entries whose names do not follow the convention", () => {
    expect(
      nextFreeNumber([
        entry("flat-2-single-storey", "Flat 2 — single storey"),
        entry("flat-3-terrace", "Flat 3 — terrace"),
      ])
    ).toBe(1);
  });

  it("still counts a RENAMED entry, because the id keeps the number", () => {
    // Rename changes the display name and leaves the id (docs/library-format.md),
    // so design 4 is not offered again while unit-4 exists under another name.
    expect(nextFreeNumber([entry("unit-4", "Studio A")])).toBe(1);
    expect(nextFreeNumber([entry("unit-1"), entry("unit-2"), entry("unit-3"), entry("unit-4", "Studio A")])).toBe(5);
  });

  it("agrees with the committed library, whatever it currently holds", () => {
    // Asserted as a PROPERTY, not as a literal. Run 0019 pinned this at 4,
    // which was true of the library that day and false the moment a unit was
    // added; a test that has to be edited every time content lands gets edited
    // carelessly. What the function actually promises is checked instead: the
    // number it returns is free, and every smaller one is taken.
    const units = parseUnitLibraryIndex(committedRaw).units;
    const n = nextFreeNumber(units);
    const taken = new Set(
      units.flatMap((u) => [numberFromName(u.id), numberFromName(u.name)]).filter((x) => x !== null)
    );
    expect(taken.has(n)).toBe(false);
    for (let i = 1; i < n; i++) expect(taken.has(i)).toBe(true);
  });
});

describe("findLibraryEntry — what a save would collide with", () => {
  const units = [
    entry("unit-1", "Unit 1"),
    entry("unit-4", "Studio A"),
    entry("flat-2-single-storey", "Flat 2 — single storey"),
  ];

  it("finds the entry whose id the name slugifies to", () => {
    expect(findLibraryEntry(units, "Unit 1")!.id).toBe("unit-1");
  });

  it("finds a RENAMED entry by its id, so design 4 is offered for replacement", () => {
    expect(findLibraryEntry(units, "Unit 4")!.id).toBe("unit-4");
  });

  it("finds an entry by an exact display-name match", () => {
    expect(findLibraryEntry(units, "Flat 2 — single storey")!.id).toBe("flat-2-single-storey");
  });

  it("returns undefined when nothing collides, which is the new-entry path", () => {
    expect(findLibraryEntry(units, "Unit 9")).toBeUndefined();
  });
});
