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

import { SESSION_STORAGE_KEY } from "../session/session";

/** Where the draft lives. Its own key, never mixed with the session's. */
export const DRAFT_KEY = "reconfigure.draft";

/**
 * Everything this browser remembers about the person using it (run 0040).
 *
 * ONE list, and the one place that decides what "forget this browser" means.
 * The landing's written line, the `?fresh` address and any test all clear
 * exactly this and nothing else, so there is no way for the three to drift
 * apart and no way for a key to be forgotten by one route and kept by
 * another.
 *
 * The draft is the flat as it was being drawn; the session is the group code
 * and the name. Nothing else is stored per browser, and nothing here reaches
 * the store: a flat already sent stays in its group, and taking it out is done
 * from the group screen.
 */
export const BROWSER_MEMORY = [DRAFT_KEY, SESSION_STORAGE_KEY] as const;

/**
 * Forget this browser. Returns the keys it cleared, so a caller can say what
 * happened and a test can pin it exactly.
 *
 * A storage that refuses is not worth interrupting anybody for, the same as
 * everywhere else in this file, so a key that cannot be removed is simply not
 * in the answer.
 */
export function forgetThisBrowser(store: ForgetfulStore | null): string[] {
  const cleared: string[] = [];
  for (const key of BROWSER_MEMORY) {
    try {
      store?.removeItem(key);
      cleared.push(key);
    } catch {
      // Nothing to say about a key a browser will not let go of.
    }
  }
  return cleared;
}

/**
 * Whether this browser remembers anything worth starting again from, which is
 * what decides whether the landing offers to. A flat with something in it, a
 * group code, a name, or any of them.
 *
 * A draft holding an empty grid does NOT count, for the same reason
 * {@link readDraft} refuses to restore one: there is nothing there to start
 * again from, and offering to forget it would be offering to forget nothing.
 * That case is not hypothetical. Emptying the editor writes an empty draft
 * like any other edit, so the moment after somebody starts again the key is
 * back with an empty project inside it (found live).
 *
 * A session holding two empty strings does not count either, for the same
 * reason: it is what a browser is left with after somebody typed into a field
 * and cleared it again.
 */
export function remembersAnything(store: ForgetfulStore | null): boolean {
  if (store === null) return false;
  try {
    if (draftHasRooms(store.getItem(DRAFT_KEY))) return true;
    const raw = store.getItem(SESSION_STORAGE_KEY);
    if (raw === null) return false;
    const s = JSON.parse(raw) as { resident?: unknown; code?: unknown };
    const said = (v: unknown) => typeof v === "string" && v.trim() !== "";
    return said(s.resident) || said(s.code);
  } catch {
    return false;
  }
}

/** Whether an address is asking to be forgotten before anything is shown. */
export function asksToForget(search: string): boolean {
  return new URLSearchParams(search).has("fresh");
}

/** The same address with `?fresh` taken out, so a reload does not forget
 *  again. Everything else about the address is left alone. */
export function withoutFresh(url: string): string {
  const u = new URL(url, "http://x");
  u.searchParams.delete("fresh");
  const q = u.searchParams.toString();
  return `${u.pathname}${q ? `?${q}` : ""}${u.hash}`;
}

/** What a resident is told when their flat comes back by itself. Said once,
 *  quietly, because it is information rather than a warning: they did not ask
 *  for this and should know it happened. */
export const DRAFT_RESTORED = "Your flat is as you left it.";

/** The landing's own written way out, under the doors (run 0040). Quieter than
 *  a door, because it undoes rather than does. */
export const START_AGAIN = "Start again with a new flat.";

/**
 * The one question it asks, before anything is cleared. It names both halves
 * of what goes and, because a person who has sent a flat will wonder, says
 * plainly that the sent one is not among them.
 */
export const FORGET_CONFIRM =
  "This forgets the flat and the name on this browser. " +
  "The flat you sent stays in your group. Start again?";

/** The little of `Storage` this needs. `window.localStorage` has it, and so
 *  does a `Map` with three lines around it. */
export interface DraftStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The little more that forgetting needs. `window.localStorage` has it. */
export interface ForgetfulStore extends DraftStore {
  removeItem(key: string): void;
}

// There is no `clearDraft`. A resident who empties their grid writes an empty
// draft like any other edit, and `readDraft` refuses to restore one with no
// rooms in it, so the draft clears itself. "Start over" in the menu goes back
// to the landing and leaves the drawing exactly where it was.
//
// `forgetThisBrowser` above is the one deliberate throwing-away, added in run
// 0040, and it is deliberate in the strong sense: a person asks for it in
// words and is asked once to confirm.

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
