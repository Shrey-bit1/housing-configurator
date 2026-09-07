import { describe, it, expect } from "vitest";
import { saveDraft, readDraft, draftHasRooms, DRAFT_KEY, DRAFT_RESTORED, type DraftStore } from "./draft";

/**
 * The one rule that decides whether a flat comes back by itself (run 0036).
 * Driven directly, with a Map for a store, because the rule is the whole
 * feature and the wiring in main.ts is two lines.
 */

class MapStore implements DraftStore {
  map = new Map<string, string>();
  throwOnRead = false;
  throwOnWrite = false;
  getItem(k: string): string | null {
    if (this.throwOnRead) throw new Error("blocked");
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    if (this.throwOnWrite) throw new Error("quota");
    this.map.set(k, v);
  }
}

/** A serialized project with `n` rooms on one floor. Only the shape the rule
 *  reads is filled in; the loader's own parsing is tested elsewhere. */
const project = (n: number): string =>
  JSON.stringify({
    format: "flat-configurator-project",
    version: 1,
    floors: [{ cols: 20, rows: 20, instances: Array.from({ length: n }, (_, i) => ({ id: `i${i}` })), entrances: [], doors: [] }],
  });

describe("draftHasRooms", () => {
  it("is true for a project with something placed", () => {
    expect(draftHasRooms(project(1))).toBe(true);
    expect(draftHasRooms(project(9))).toBe(true);
  });

  it("is false for an empty grid, so clearing a flat clears the draft", () => {
    expect(draftHasRooms(project(0))).toBe(false);
  });

  it("is false for nothing, for rubbish and for the wrong shape", () => {
    expect(draftHasRooms(null)).toBe(false);
    expect(draftHasRooms("")).toBe(false);
    expect(draftHasRooms("{ half a write")).toBe(false);
    expect(draftHasRooms(JSON.stringify({ format: "flat-configurator-project" }))).toBe(false);
    expect(draftHasRooms(JSON.stringify({ floors: "not a list" }))).toBe(false);
  });

  it("counts rooms across every floor, not only the first", () => {
    const twoFloors = JSON.stringify({
      floors: [
        { instances: [], entrances: [], doors: [] },
        { instances: [{ id: "a" }], entrances: [], doors: [] },
      ],
    });
    expect(draftHasRooms(twoFloors)).toBe(true);
  });
});

describe("readDraft", () => {
  it("brings back what was last drawn", () => {
    const store = new MapStore();
    saveDraft(store, project(3));
    expect(readDraft(store, "")).toBe(project(3));
  });

  it("keeps the draft under its own key, apart from the session's", () => {
    const store = new MapStore();
    saveDraft(store, project(3));
    expect([...store.map.keys()]).toEqual([DRAFT_KEY]);
  });

  it("says nothing to restore when there is no store", () => {
    expect(readDraft(null, "")).toBe(null);
  });

  it("says nothing to restore when nothing was ever saved", () => {
    expect(readDraft(new MapStore(), "")).toBe(null);
  });

  it("lets a URL that names a project win over the draft", () => {
    const store = new MapStore();
    saveDraft(store, project(3));
    expect(readDraft(store, "?project=flat-2-single-storey.json")).toBe(null);
  });

  it("still restores for a URL that names only a group, which is not a flat", () => {
    const store = new MapStore();
    saveDraft(store, project(3));
    expect(readDraft(store, "?session=hall-14")).toBe(project(3));
  });

  it("refuses a draft with nothing in it rather than announcing a restore", () => {
    const store = new MapStore();
    saveDraft(store, project(2));
    saveDraft(store, project(0)); // the resident cleared the grid
    expect(readDraft(store, "")).toBe(null);
  });

  it("survives a storage that refuses to be read", () => {
    const store = new MapStore();
    saveDraft(store, project(3));
    store.throwOnRead = true;
    expect(readDraft(store, "")).toBe(null);
  });
});

describe("saveDraft", () => {
  it("costs the draft and nothing else when the browser refuses the write", () => {
    const store = new MapStore();
    store.throwOnWrite = true;
    expect(() => saveDraft(store, project(3))).not.toThrow();
    expect(store.map.size).toBe(0);
  });

  it("does nothing at all without a store", () => {
    expect(() => saveDraft(null, project(3))).not.toThrow();
  });

  it("replaces the draft rather than keeping a history of them", () => {
    const store = new MapStore();
    saveDraft(store, project(1));
    saveDraft(store, project(2));
    expect(store.map.size).toBe(1);
    expect(readDraft(store, "")).toBe(project(2));
  });
});

describe("what a resident is told", () => {
  it("says it once, quietly, and says what happened rather than warning", () => {
    expect(DRAFT_RESTORED).toBe("Your flat is as you left it.");
  });
});
