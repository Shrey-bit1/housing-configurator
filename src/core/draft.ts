/**
 * The flat is kept as you draw (run 0036).
 *
 * Before this, a refresh lost the drawing. Nothing wrote the project anywhere
 * but a download, so closing the tab, reloading, or a crash cost an
 * afternoon's work. Measured on 6 September: loading a flat through
 * `?project=`, then reloading the app, left `localStorage` holding only
 * `reconfigure.session` and the flat's area reading a dash.
 *
 * The draft is the SAME string the undo history already takes as a snapshot,
 * `JSON.stringify(serializeProject(...))`, so there is one serialization in
 * the app and the draft cannot drift from what undo restores. It is written on
 * every mutating action, through the same `commitHistory` everything else
 * hangs off, and read once on load.
 *
 * Pure, no DOM: `DraftStore` is the two-and-a-bit methods of `Storage`, so a
 * `Map`-backed stub drives it in `draft.test.ts`.
 *
 * `design-automation`'s §2.1 again: whether a draft should be restored is ONE
 * rule with three reasons to say no, written once here rather than as three
 * conditions at the call site.
 */

/** Where the draft lives. Its own key, never mixed with the session's. */
export const DRAFT_KEY = "reconfigure.draft";

/** What a resident is told when their flat comes back by itself. Said once,
 *  quietly, because it is information rather than a warning: they did not ask
 *  for this and should know it happened. */
export const DRAFT_RESTORED = "Your flat is as you left it.";

/** The little of `Storage` this needs. `window.localStorage` has it, and so
 *  does a `Map` with three lines around it. */
export interface DraftStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

// There is no `clearDraft`, on purpose. A resident who empties their grid
// writes an empty draft like any other edit, and `readDraft` refuses to restore
// one with no rooms in it, so the draft clears itself. Nothing in the app
// deliberately throws a flat away: "Start over" goes back to the landing and
// leaves the drawing exactly where it was.

/**
 * Whether a serialized project has anything in it worth keeping. An empty grid
 * is not worth restoring: a resident who cleared their flat and came back
 * should see the landing and a fresh grid, not a ghost of nothing.
 *
 * Anything unparseable answers false rather than throwing, because a draft is
 * written by a browser this code cannot see and half a write is possible.
 */
export function draftHasRooms(text: string | null): boolean {
  if (text === null) return false;
  try {
    const data = JSON.parse(text) as { floors?: { instances?: unknown[] }[] };
    if (!Array.isArray(data.floors)) return false;
    return data.floors.some((f) => Array.isArray(f.instances) && f.instances.length > 0);
  } catch {
    return false;
  }
}

/** Keep the flat as it now stands. A storage that refuses (a private window,
 *  a full quota) costs the draft and nothing else. */
export function saveDraft(store: DraftStore | null, snapshot: string): void {
  try {
    store?.setItem(DRAFT_KEY, snapshot);
  } catch {
    // A draft that cannot be written is not worth interrupting a resident for.
  }
}

/**
 * The draft to restore on load, or null when there is nothing to restore.
 *
 * Three reasons to say no, in one place. There is no store, or nothing in it.
 * The URL already names a project, so a resident followed a link to a
 * particular flat and that file wins over whatever they drew last. Or the
 * draft holds no rooms, so restoring it would change nothing but would still
 * claim to have done something.
 *
 * A URL naming a `session` is NOT a reason to say no: that names a group, not
 * a flat, and a resident arriving through a group link still wants their own
 * drawing back.
 */
export function readDraft(store: DraftStore | null, search: string): string | null {
  if (store === null) return null;
  if (new URLSearchParams(search).has("project")) return null;
  let text: string | null = null;
  try {
    text = store.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
  return draftHasRooms(text) ? text : null;
}
