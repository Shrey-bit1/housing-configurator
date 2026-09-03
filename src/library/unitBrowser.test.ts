import { describe, it, expect } from "vitest";
import { isMine, sortMineFirst } from "./unitBrowser";

/**
 * The unit browser's only DOM-free logic (run 0025): whether a session card
 * is the current resident's own, and the stable "mine first" ordering built
 * on it. The module needs a live DOM for everything else (`createUnitBrowser`
 * calls `document.createElement` immediately), which this project's vitest
 * setup does not provide (no jsdom/happy-dom dependency), so these two pure
 * functions are what the "Yours" mark and the sort are actually pinned
 * against.
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
