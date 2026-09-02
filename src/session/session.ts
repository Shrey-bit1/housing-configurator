/**
 * The session — who this resident is and which room they are in — and the
 * publish call that sends a unit file to the session store (docs/store.md).
 *
 * The two settings are HOW YOU SAVE, never part of the design, so they live in
 * `localStorage` under one key and are never written into a project file. A
 * session code can also arrive in the URL as `?session=room-42`, which wins
 * over the stored one and is then stored, so a code passed around a room as a
 * link sticks after the first visit.
 *
 * Pure over a two-method storage and a `fetch`, so `session.test.ts` drives
 * the whole thing with a Map and a stub.
 */

export const SESSION_STORAGE_KEY = "reconfigure.session";

export interface SessionSettings {
  /** The name typed in. Trimmed before use, kept as typed in the field. */
  resident: string;
  /** Lowercased on the way in, matching the store (src/session/store.ts). */
  code: string;
}

/** The two `localStorage` methods this module uses; a Map with these works. */
export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The store's own rule, applied on the way in so a code never needs to be typed twice. */
export function normalizeCode(raw: string): string {
  return raw.trim().toLowerCase();
}

/** The store's `CODE` rule, mirrored so the dialog can refuse before the network does. */
export function isValidCode(code: string): boolean {
  return /^[a-z0-9_-]{1,32}$/.test(code);
}

/**
 * The stored settings, with a `?session=` in the URL winning over the stored
 * code and being stored at once. Storage that is missing or refuses (a private
 * window, a full quota) reads as empty and never throws.
 */
export function readSession(storage: KeyValue | null, search: string): SessionSettings {
  let stored: Partial<SessionSettings> = {};
  try {
    const raw = storage?.getItem(SESSION_STORAGE_KEY);
    if (raw) stored = JSON.parse(raw) as Partial<SessionSettings>;
  } catch {
    stored = {};
  }
  const s: SessionSettings = {
    resident: typeof stored.resident === "string" ? stored.resident : "",
    code: typeof stored.code === "string" ? normalizeCode(stored.code) : "",
  };
  const fromUrl = new URLSearchParams(search).get("session");
  if (fromUrl !== null && normalizeCode(fromUrl)) {
    s.code = normalizeCode(fromUrl);
    writeSession(storage, s);
  }
  return s;
}

export function writeSession(storage: KeyValue | null, s: SessionSettings): void {
  try {
    storage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(s));
  } catch {
    // A refused write loses only the convenience of being remembered.
  }
}

/** Why Publish is disabled, in the dialog's own words, or null when it can run. */
export function whyPublishDisabled(s: SessionSettings): string | null {
  const resident = s.resident.trim();
  if (!resident && !s.code) return "type your name and a session code above first";
  if (!resident) return "type your name above first";
  if (!s.code) return "enter a session code above first";
  if (!isValidCode(s.code)) return "a session code is 1 to 32 of a-z, 0-9, - and _";
  return null;
}

/** The top-bar line: which room, and who. */
export function sessionLine(s: SessionSettings): string {
  const resident = s.resident.trim();
  if (!s.code) return resident ? `No session · ${resident}` : "No session";
  return resident ? `Session ${s.code} · ${resident}` : `Session ${s.code}`;
}
