import { describe, it, expect } from "vitest";
import { isMine, sortMineFirst, deleteConfirmText, deleteRefusal } from "./unitBrowser";

/**
 * The unit browser's only DOM-free logic (run 0025): whether a session card
 * is the current resident's own, and the stable "mine first" ordering built
 * on it. The module needs a live DOM for everything else (`createUnitBrowser`
 * calls `document.createElement` immediately), which this project's vitest
 * setup does not provide (no jsdom/happy-dom dependency), so these two pure
 * functions are what the "Yours" mark and the sort are actually pinned
 * against.
 *
 * Run 0029 added two more of the same kind for the Delete control. Both are
 * pure for the reason `takeoverConfirmText` is: `window.confirm` returns
 * `false` under scripting without ever displaying, so a test that drove the
 * real dialog could only ever prove the decline path, and the sentence a
 * resident actually reads would go unchecked.
 */

describe("isMine", () => {
  it("matches only when both sides are the same, non-empty name", () => {
    expect(isMine("Ana", "Ana")).toBe(true);
    expect(isMine("Ana", "Ben")).toBe(false);
  });

  it("never matches with no resident name set, even against an empty owner", () => {
    expect(isMine("Ana", "")).toBe(false);
    expect(isMine("", "")).toBe(false);
  });

  it("is trimmed and case-insensitive (run 0026: ana is Ana)", () => {
    expect(isMine("Ana ", "ana")).toBe(true);
    expect(isMine("  ana", "Ana")).toBe(true);
  });
});

describe("sortMineFirst", () => {
  const flat = (id: string, resident: string) => ({ id, resident });

  it("puts the matching resident's flats first, stably", () => {
    const items = [flat("a", "Ben"), flat("b", "Ana"), flat("c", "Ben"), flat("d", "Ana")];
    expect(sortMineFirst(items, "Ana").map((f) => f.id)).toEqual(["b", "d", "a", "c"]);
  });

  it("changes nothing when no name is set", () => {
    const items = [flat("a", "Ben"), flat("b", "Ana")];
    expect(sortMineFirst(items, "")).toEqual(items);
  });

  it("changes nothing when nobody in the list matches", () => {
    const items = [flat("a", "Ben"), flat("b", "Cy")];
    expect(sortMineFirst(items, "Ana")).toEqual(items);
  });

  it("does not mutate the input array", () => {
    const items = [flat("a", "Ben"), flat("b", "Ana")];
    const copy = [...items];
    sortMineFirst(items, "Ana");
    expect(items).toEqual(copy);
  });
});

describe("deleteConfirmText — the sentence before a flat is removed", () => {
  it("names the flat and says the delete cannot be undone", () => {
    expect(deleteConfirmText("Flat 09 — two rooms, hall between")).toBe(
      'Delete "Flat 09 — two rooms, hall between" from the library? This cannot be undone.'
    );
  });

  it("quotes the name, so a name with its own punctuation still reads as one thing", () => {
    expect(deleteConfirmText("Unit 5")).toContain('"Unit 5"');
  });
});

describe("deleteRefusal — why a delete may not go ahead", () => {
  const entry = { id: "unit-9", name: "Flat 09 — two rooms, hall between" };

  it("refuses the flat whose copy is open in the editor, and names it", () => {
    expect(deleteRefusal(entry, "unit-9")).toBe(
      '"Flat 09 — two rooms, hall between" is the flat you have open. ' +
        "Open something else first, then delete it."
    );
  });

  it("allows any other flat while one is open", () => {
    expect(deleteRefusal(entry, "unit-10")).toBeNull();
  });

  it("allows every flat when nothing is open", () => {
    expect(deleteRefusal(entry, null)).toBeNull();
  });

  it("matches on the id rather than the name, since a rename must not free the lock", () => {
    expect(deleteRefusal({ id: "unit-9", name: "Renamed since" }, "unit-9")).not.toBeNull();
    expect(deleteRefusal({ id: "unit-90", name: entry.name }, "unit-9")).toBeNull();
  });
});
