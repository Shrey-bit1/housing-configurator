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

/** Why Send is disabled, in the column's own words, or null when it can run.
 *  Words only (run 0026): a resident reads "group", never "session" — see
 *  `_cowork/design/DESIGN-BRIEF-3sep.md`'s Words section. The code itself
 *  (`SessionSettings`, `?session=`, `/api/session/…`) keeps its name. */
export function whyPublishDisabled(s: SessionSettings): string | null {
  const resident = s.resident.trim();
  if (!resident && !s.code) return "type your name and a group code above first";
  if (!resident) return "type your name above first";
  if (!s.code) return "enter a group code above first";
  if (!isValidCode(s.code)) return "a group code is 1 to 32 of a-z, 0-9, - and _";
  return null;
}

/** The top-bar line: which group, and who (words only, run 0026). */
export function sessionLine(s: SessionSettings): string {
  const resident = s.resident.trim();
  if (!s.code) return resident ? `No group · ${resident}` : "No group";
  return resident ? `Group ${s.code} · ${resident}` : `Group ${s.code}`;
}

/**
 * The confirm shown before Replace takes another resident's flat over (run
 * 0025), matching the library's own replace-or-new prompt. Pure, so a test
 * pins the wording directly instead of driving `window.confirm` — the same
 * automation trap run 0010 found: under scripting it returns `false` without
 * ever displaying, so a test that called the real dialog would only prove
 * the decline path.
 */
/**
 * What the landing should put in its two fields, and what it should say about
 * having done so.
 *
 * THE ONLY PLACE that decides whether this browser has been here before. Before
 * run 0031 the landing filled both fields from storage every time, so a person
 * who had never used the app could not tell a field holding their own name from
 * one holding somebody else's, and neither could a person sitting down at
 * somebody else's machine. A first visit now shows two empty fields and says
 * nothing.
 *
 * Pure, so the wording is pinned by a test rather than read off a screen, and
 * so the three cases (nothing known, both known, one known) are stated once.
 */
export function landingRecall(s: SessionSettings): { code: string; name: string; line: string } {
  const code = s.code.trim();
  const name = s.resident.trim();
  if (!code && !name) return { code: "", name: "", line: "" };
  const who = name ? `as ${name}` : "";
  const where = code ? `in ${code}` : "";
  const both = [who, where].filter(Boolean).join(" ");
  // "either" only when there are two things to change.
  const which = who && where ? "either" : "it";
  return { code, name, line: `Picking up where you left off, ${both}. Change ${which} if that is not you.` };
}

export function takeoverConfirmText(owner: string): string {
  return `This flat belongs to ${owner}. Take it over?`;
}

export type PublishResult =
  | { ok: true; id: string; label: string; version: number; changed: boolean }
  // `ownerResident` is set on a 409: whoever the store says already owns this
  // flat id, so the caller can name them and offer Replace (run 0024).
  | { ok: false; status: number; reason: string; ownerResident?: string };

/** The minimum of `fetch` this module calls, so a test can hand in a stub.
 *  `body` is `BodyInit` (not just `string`) since run 0024's preview PUT
 *  sends a `Blob`; `publishUnit`'s string body is a `BodyInit` too. */
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: BodyInit }) => Promise<Response>;

/**
 * PUT the unit download's exact bytes to
 * `{base}/api/session/{code}/flats/{id}?resident=…&label=…` (docs/store.md).
 * `replace: true` adds `&replace=1`, the one thing that lets this PUT take
 * over a flat another resident published (run 0024; `docs/store.md`'s 409).
 * Never throws: a network failure is `status: 0`, a refusal carries the
 * store's own `error` line, so the caller can print one honest result and
 * leave the files it already wrote alone.
 */
export async function publishUnit(
  fetchFn: FetchLike,
  base: string,
  s: SessionSettings,
  id: string,
  label: string,
  text: string,
  replace = false,
): Promise<PublishResult> {
  const query = new URLSearchParams({ resident: s.resident.trim(), label });
  if (replace) query.set("replace", "1");
  const url = `${base}/api/session/${encodeURIComponent(s.code)}/flats/${encodeURIComponent(id)}?${query}`;
  let res: Response;
  try {
    res = await fetchFn(url, { method: "PUT", headers: { "content-type": "application/json" }, body: text });
  } catch (err) {
    return { ok: false, status: 0, reason: err instanceof Error ? err.message : String(err) };
  }
  const body = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = undefined;
  }
  const record = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  if (!res.ok) {
    const reason =
      typeof record?.error === "string" ? record.error : body.trim().slice(0, 120) || res.statusText || "no reason given";
    return {
      ok: false,
      status: res.status,
      reason,
      ownerResident: res.status === 409 && typeof record?.resident === "string" ? record.resident : undefined,
    };
  }
  if (typeof record?.version !== "number") {
    return { ok: false, status: res.status, reason: "the store answered without a version" };
  }
  return {
    ok: true,
    id: typeof record.id === "string" ? record.id : id,
    label: typeof record.label === "string" ? record.label : label,
    version: record.version,
    changed: record.changed === true,
  };
}

export type TakeoverDecision =
  /** Retry the same publish with `replace: true`. */
  | { action: "retry" }
  /** Report this line and send nothing further; the flat is untouched. */
  | { action: "declined"; detail: string }
  /** Nothing to decide: report `r` exactly as `runSave` already would. */
  | { action: "proceed" };

/**
 * What to do after a publish attempt that came back a 409 (run 0025): pure,
 * so "a declined confirm sends no publish and writes the line" is testable
 * without a DOM. The real `window.confirm(takeoverConfirmText(owner))` call
 * happens in `main.ts`; this only turns its boolean answer, plus whether
 * Replace was ticked, into what `runSave` does next. Any `r` that is not a
 * 409-with-a-named-owner, or a 409 with Replace unticked, needs no decision —
 * `runSave` reports it exactly as before this run.
 */
export function decideTakeover(r: PublishResult, replaceTicked: boolean, confirmed: boolean): TakeoverDecision {
  if (r.ok || r.status !== 409 || r.ownerResident === undefined || !replaceTicked) return { action: "proceed" };
  if (confirmed) return { action: "retry" };
  return { action: "declined", detail: `not published — you chose not to take over ${r.ownerResident}'s flat` };
}

export type PreviewPublishResult = { ok: true } | { ok: false; reason: string };

/**
 * PUT a flat's preview JPEG to `{base}/api/session/{code}/flats/{id}/preview`
 * (docs/store.md). Called right after `publishUnit` succeeds, with the SAME
 * id; never throws, on the same terms as `publishUnit`, so a failed preview
 * never undoes a successful flat publish.
 */
export async function publishPreview(
  fetchFn: FetchLike,
  base: string,
  code: string,
  id: string,
  jpeg: Blob,
): Promise<PreviewPublishResult> {
  const url = `${base}/api/session/${encodeURIComponent(code)}/flats/${encodeURIComponent(id)}/preview`;
  let res: Response;
  try {
    res = await fetchFn(url, { method: "PUT", headers: { "content-type": "image/jpeg" }, body: jpeg });
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = undefined;
    }
    const record = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
    const reason =
      typeof record?.error === "string" ? record.error : body.trim().slice(0, 120) || res.statusText || `status ${res.status}`;
    return { ok: false, reason };
  }
  return { ok: true };
}
