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
 *
 * Every sentence this module returns comes from `src/core/words.ts` (run
 * 0042). The rules for who is at the table stay here; the words they are said
 * in live with every other word a resident reads.
 */
import {
  whoLineText,
  sessionLineText,
  recallLine,
  takeoverConfirm,
  storeNotRunning,
  noSuchGroup,
  declinedTakeover,
} from "../core/words";

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
 * The words a made-up group code is built from.
 *
 * Chosen to be said across a table without spelling: one or two syllables, no
 * pair that sounds alike, nothing that could be heard as a letter, and nothing
 * whose spelling anybody would have to ask about. All lowercase a-z, so a code
 * is inside the store's own `CODE` rule by construction.
 */
const CODE_WORDS = [
  "amber", "anchor", "apple", "basil", "birch", "cedar", "cherry", "cobalt",
  "copper", "cotton", "daisy", "delta", "ember", "fern", "garnet", "ginger",
  "harbour", "hazel", "indigo", "ivory", "jasmine", "juniper", "lantern",
  "lemon", "lilac", "linen", "maple", "marble", "meadow", "mulberry", "nutmeg",
  "olive", "onyx", "orchard", "pebble", "pepper", "pewter", "poppy", "quartz",
  "quince", "rosemary", "saffron", "sage", "salmon", "sorrel", "spruce",
  "sumac", "teasel", "thistle", "thyme", "timber", "topaz", "tulip", "velvet",
  "walnut", "willow", "yarrow", "zinc",
] as const;

/**
 * A group code a person can read aloud: one of {@link CODE_WORDS} and two
 * digits, joined by a hyphen, so `willow-42`.
 *
 * Pure, and the randomness is injected, so a test can pin the shape and the
 * collision retry without waiting on chance. `taken` is asked before a code is
 * offered, and a taken one is tried again up to `attempts` times; after that it
 * gives up and returns null rather than looping, because a wordlist of 58 words
 * and 100 numbers is 5800 codes and running out means something else is wrong.
 */
export function inventCode(
  taken: (code: string) => boolean,
  random: () => number = Math.random,
  attempts = 12
): string | null {
  for (let i = 0; i < attempts; i++) {
    const word = CODE_WORDS[Math.floor(random() * CODE_WORDS.length)];
    const digits = String(Math.floor(random() * 100)).padStart(2, "0");
    const code = `${word}-${digits}`;
    if (!taken(code)) return code;
  }
  return null;
}

/**
 * Why a call to the store failed, in the two ways that matter to a resident.
 *
 * `"absent"` means the store is not running: the app is being served by plain
 * Vite on 5173 rather than by Netlify, so `/api/session/...` falls through to
 * the SPA fallback and the app gets `index.html` where it asked for JSON. The
 * old behaviour printed the parser's own words, "Unexpected token '<'", which
 * is an exception shown to a person.
 *
 * `"error"` means the store answered and said no. That is the store's own
 * message and it keeps saying it, because it is about the request rather than
 * about the setup.
 */
export type StoreFailure = "absent" | "error";

/** Where the store lives when it is running, and the command that starts it. */
export const STORE_ADDRESS = "http://localhost:8888";
export const STORE_COMMAND = "npm run dev";

/**
 * Which of the two happened. THE ONE RULE, read by every screen that talks to
 * the store, so the app cannot decide it three different ways.
 *
 * A thrown error is a connection that never landed. A response that is not
 * `ok` is the store answering, unless it is a 404 carrying HTML, which is what
 * a static server says about a path it has never heard of. And an `ok`
 * response whose body will not parse as JSON is the SPA fallback: 200, an HTML
 * page, and nothing to do with the store at all.
 */
export function classifyStoreFailure(
  res: { ok: boolean; status: number; headers?: { get(name: string): string | null } } | null,
  parsedJson: boolean
): StoreFailure {
  if (res === null) return "absent";
  const type = res.headers?.get("content-type") ?? "";
  const html = type.includes("text/html");
  if (res.ok) return parsedJson ? "error" : "absent";
  if (res.status === 404 && html) return "absent";
  return "error";
}

/** The one sentence a resident reads when the store is not running. It names
 *  the command and the address, so it can be acted on without asking. */
export function storeAbsentText(): string {
  return storeNotRunning(STORE_COMMAND, STORE_ADDRESS);
}

/**
 * Whether the store says this group has been started, and if it cannot say,
 * why not (run 0032, reshaped by run 0033).
 *
 * It returns the reason rather than a bare boolean, because a missing store and
 * a missing group are different things to the person reading the answer, and
 * collapsing them is how "the store is not running" used to reach a resident as
 * "no such group" or, worse, as a parser error.
 */
export async function checkGroup(
  code: string,
  f: typeof fetch = fetch
): Promise<{ started: boolean } | { failure: StoreFailure }> {
  let res: Response;
  try {
    res = await f(`/api/session/${encodeURIComponent(code)}`);
  } catch {
    return { failure: classifyStoreFailure(null, false) };
  }
  let body: unknown;
  let parsed = true;
  try {
    body = await res.json();
  } catch {
    parsed = false;
  }
  if (!res.ok || !parsed) return { failure: classifyStoreFailure(res, parsed) };
  return { started: (body as { exists?: boolean }).exists === true };
}

/** Start a group at `code`. True on 201, false on 409 or anything else. */
export async function startGroup(code: string, f: typeof fetch = fetch): Promise<boolean> {
  try {
    return (await f(`/api/session/${encodeURIComponent(code)}`, { method: "POST" })).status === 201;
  } catch {
    return false;
  }
}

/** What a resident is told when they join a code nobody has started. Pure, for
 *  the same reason every other sentence in this file is. */
export function noSuchGroupText(code: string): string {
  return noSuchGroup(code);
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

/**
 * Who is sending and where to, as one sentence for step 02 (run 0036).
 *
 * Step 02 used to carry the same two fields the landing already asked for,
 * open, every time. A resident who has joined a group has answered that
 * question and should be told the answer rather than asked it again, so the
 * fields fold away behind a "change" and this line stands in their place.
 *
 * `ready` is false when there is nobody or no group yet. The screen uses it for
 * two things: the fields start open rather than folded, and the red button
 * leads back to the landing's join instead of trying to send.
 */
export function whoLine(s: SessionSettings): { line: string; ready: boolean } {
  const resident = s.resident.trim();
  return { line: whoLineText(resident, s.code), ready: Boolean(resident && s.code) };
}

/** The top-bar line: which group, and who (words only, run 0026). */
export function sessionLine(s: SessionSettings): string {
  const resident = s.resident.trim();
  return sessionLineText(resident, s.code);
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
  return { code, name, line: recallLine(name, code) };
}

export function takeoverConfirmText(owner: string): string {
  return takeoverConfirm(owner);
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
  return { action: "declined", detail: declinedTakeover(r.ownerResident ?? "") };
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
