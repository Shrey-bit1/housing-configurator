import { describe, it, expect } from "vitest";
import {
  saveDraft,
  readDraft,
  draftHasRooms,
  forgetThisBrowser,
  remembersAnything,
  asksToForget,
  withoutFresh,
  BROWSER_MEMORY,
  DRAFT_KEY,
  DRAFT_RESTORED,
  START_AGAIN,
  FORGET_CONFIRM,
  type ForgetfulStore,
} from "./draft";
import { SESSION_STORAGE_KEY, readSession, landingRecall } from "../session/session";

/**
 * The one rule that decides whether a flat comes back by itself (run 0036).
 * Driven directly, with a Map for a store, because the rule is the whole
 * feature and the wiring in main.ts is two lines.
 */

class MapStore implements ForgetfulStore {
  map = new Map<string, string>();
  throwOnRead = false;
  throwOnWrite = false;
  throwOnRemove = false;
  getItem(k: string): string | null {
    if (this.throwOnRead) throw new Error("blocked");
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    if (this.throwOnWrite) throw new Error("quota");
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    if (this.throwOnRemove) throw new Error("blocked");
    this.map.delete(k);
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

/**
 * Starting again (run 0040). What this browser remembers, whether the landing
 * offers to forget it, and what forgetting clears.
 *
 * `forgetThisBrowser` is the one place that decides what goes, so the written
 * line, the `?fresh` address and these tests all read the same list. Every
 * case below drives it directly rather than through the DOM, which this
 * project has no jsdom for.
 */

const someone = (store: MapStore, s: { resident?: string; code?: string }) =>
  store.setItem(SESSION_STORAGE_KEY, JSON.stringify({ resident: "", code: "", ...s }));

describe("what this browser remembers", () => {
  it("remembers nothing on a first visit", () => {
    expect(remembersAnything(new MapStore())).toBe(false);
    expect(remembersAnything(null)).toBe(false);
  });

  it("remembers a flat with something in it", () => {
    const store = new MapStore();
    saveDraft(store, project(3));
    expect(remembersAnything(store)).toBe(true);
  });

  it("remembers a group code on its own", () => {
    const store = new MapStore();
    someone(store, { code: "hall-14" });
    expect(remembersAnything(store)).toBe(true);
  });

  it("remembers a name on its own", () => {
    const store = new MapStore();
    someone(store, { resident: "Ana" });
    expect(remembersAnything(store)).toBe(true);
  });

  it("does not count a flat with nothing in it", () => {
    // Emptying the editor writes an empty draft like any other edit, so this
    // is the state the browser is in the moment after somebody starts again.
    const store = new MapStore();
    saveDraft(store, project(0));
    expect(remembersAnything(store)).toBe(false);
  });

  it("does not count a session holding two empty strings", () => {
    const store = new MapStore();
    someone(store, {});
    expect(remembersAnything(store)).toBe(false);
    someone(store, { resident: "   " });
    expect(remembersAnything(store)).toBe(false);
  });

  it("says no rather than throwing when the browser will not be read", () => {
    const store = new MapStore();
    someone(store, { code: "hall-14" });
    store.throwOnRead = true;
    expect(remembersAnything(store)).toBe(false);
  });
});

describe("forgetting this browser", () => {
  it("clears the flat and the session, and says which", () => {
    const store = new MapStore();
    saveDraft(store, project(3));
    someone(store, { resident: "Ana", code: "hall-14" });
    expect(forgetThisBrowser(store)).toEqual([DRAFT_KEY, SESSION_STORAGE_KEY]);
    expect([...store.map.keys()]).toEqual([]);
  });

  it("clears exactly the two keys it names and nothing else", () => {
    expect([...BROWSER_MEMORY]).toEqual([DRAFT_KEY, SESSION_STORAGE_KEY]);
    const store = new MapStore();
    saveDraft(store, project(3));
    someone(store, { resident: "Ana", code: "hall-14" });
    store.setItem("something.else", "kept");
    forgetThisBrowser(store);
    expect([...store.map.keys()]).toEqual(["something.else"]);
  });

  it("leaves the landing reading as a first visit afterwards", () => {
    const store = new MapStore();
    saveDraft(store, project(3));
    someone(store, { resident: "Ana", code: "hall-14" });
    forgetThisBrowser(store);
    expect(remembersAnything(store)).toBe(false);
    const back = readSession(store, "");
    expect(back).toEqual({ resident: "", code: "" });
    // Two empty fields and no sentence under them, which is what a first
    // visit is (run 0031).
    expect(landingRecall(back)).toEqual({ code: "", name: "", line: "" });
    expect(readDraft(store, "")).toBe(null);
  });

  it("costs nothing when there was nothing, and does not throw without a store", () => {
    expect(forgetThisBrowser(new MapStore())).toEqual([DRAFT_KEY, SESSION_STORAGE_KEY]);
    expect(() => forgetThisBrowser(null)).not.toThrow();
  });

  it("says only what it managed to clear", () => {
    const store = new MapStore();
    store.throwOnRemove = true;
    expect(forgetThisBrowser(store)).toEqual([]);
  });
});

describe("?fresh", () => {
  it("is the address asking to be forgotten", () => {
    expect(asksToForget("?fresh")).toBe(true);
    expect(asksToForget("?fresh=1")).toBe(true);
    expect(asksToForget("?session=hall-14&fresh")).toBe(true);
  });

  it("is not any other address", () => {
    expect(asksToForget("")).toBe(false);
    expect(asksToForget("?session=hall-14")).toBe(false);
    expect(asksToForget("?refresh=1")).toBe(false);
  });

  it("clears the same two keys the written line clears", () => {
    const store = new MapStore();
    saveDraft(store, project(3));
    someone(store, { resident: "Ana", code: "hall-14" });
    forgetThisBrowser(store);
    expect([...store.map.keys()]).toEqual([]);
  });

  it("leaves a clean address behind, so a reload does not forget again", () => {
    expect(withoutFresh("http://x/?fresh")).toBe("/");
    expect(withoutFresh("http://x/?fresh=1")).toBe("/");
    expect(withoutFresh("http://x/?session=hall-14&fresh")).toBe("/?session=hall-14");
    expect(asksToForget(withoutFresh("http://x/?fresh"))).toBe(false);
  });

  it("leaves everything else about the address alone", () => {
    expect(withoutFresh("http://x/?project=a.json&fresh&session=b")).toBe("/?project=a.json&session=b");
    expect(withoutFresh("http://x/?session=b")).toBe("/?session=b");
  });
});

describe("what the landing says about it", () => {
  it("offers it in the brief's voice, as one short line", () => {
    expect(START_AGAIN).toBe("Start again with a new flat.");
  });

  it("asks once, naming both halves of what goes and what does not", () => {
    expect(FORGET_CONFIRM).toBe(
      "This forgets the flat and the name on this browser. " +
        "The flat you sent stays in your group. Start again?"
    );
  });
});
