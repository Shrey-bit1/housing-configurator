/**
 * The session store — the shared place a flat is PUBLISHED to and a building
 * is READ from, so five residents in one room can work on one building
 * without passing files by hand. `docs/store.md` is the contract; this file is
 * the whole handler, and `netlify/functions/session.mts` is the eight-line
 * Netlify entry that gives it a Blobs store and a URL.
 *
 * The handler is written against the small `KV` interface below rather than
 * against `@netlify/blobs` directly, because that is the one seam that lets
 * `store.test.ts` drive every route through an in-memory map with no Netlify
 * running. A Netlify `Store` satisfies `KV` structurally, so the entry passes
 * it straight in.
 *
 * Storage layout, per session code:
 *   `{code}/index`           one JSON blob: flat SUMMARIES, residents, last run
 *   `{code}/flats/{id}`      the published `dwelling-unit` text, byte for byte
 *   `{code}/flats/{id}.preview`  the flat's JPEG preview, base64 (run 0024) —
 *     a SIBLING key, not a child of `{id}`; see `routePreview`'s comment.
 *
 * The index is what the building polls, so it never holds a flat body or a
 * preview; both are written once (at publish time, and right after) and read
 * only by their own one-flat calls. Every change to the index is a
 * read-modify-write under the blob's ETag, retried a few times, so two
 * residents publishing at once cannot overwrite each other's summary.
 *
 * There is no login. Anyone who knows the session code can read and write
 * everything in it. That is accepted for a five-person test and written down
 * in docs/store.md as the limit. One check narrows it since run 0024: a flat
 * id belongs to whoever last published it under a NEW resident name, and a
 * different resident's publish is refused (409) unless the request carries
 * `?replace=1` — so taking over somebody else's flat is a deliberate act, not
 * an accident of two residents proposing the same design number.
 */

/** The four calls the handler makes on storage; `@netlify/blobs`' `Store` has
 *  this shape. `delete` joined in run 0035, when leaving a group started
 *  taking the person's flats with it: a flat withdrawn has to stop existing
 *  rather than become an empty body, because `/export` reads every blob and an
 *  empty string there would read as a flat nobody can open. Deleting a key
 *  that is not there is not an error, in Blobs and here alike. */
export interface KV {
  get(key: string): Promise<string | null>;
  getWithMetadata(key: string): Promise<{ data: string; etag?: string } | null>;
  set(
    key: string,
    value: string,
    options?: { onlyIfMatch?: string; onlyIfNew?: boolean },
  ): Promise<{ modified: boolean }>;
  delete(key: string): Promise<void>;
}

/** What the polling call says about one flat. Never the flat itself. */
export interface FlatSummary {
  id: string;
  resident: string;
  label: string;
  version: number;
  /** True since the last publish, false once a building run has read it. */
  changed: boolean;
  /** `[minX, minZ, maxX, maxZ]` in cells over the union of every storey. */
  bbox: [number, number, number, number];
  floors: number;
  areaCells: number;
  publishedAt: string;
  /** True once a preview has been stored for this id; carried across a
   *  republish until a new preview overwrites it (run 0024). */
  preview: boolean;
}

export interface Resident {
  /** Flat id → how many of it this resident wants. Replaced whole when sent. */
  counts: Record<string, number>;
  /**
   * The PRE-0056 reading of the shared-space question: a wished share of floor
   * area as a fraction, 0..1, or null when never set.
   *
   * Nothing should read it again. The question the building app asks is now
   * "how many square metres of shared space should each person pay for", which
   * is {@link shareM2}, and a fraction cannot answer it. It stays in the record
   * and stays accepted because records already written into a live store carry
   * it, and dropping a key is a change other people's data would have to
   * survive.
   */
  share: number | null;
  /** Ordered ballot of shared-space type names, first is most wanted. */
  ballot: string[];
  /**
   * How many square metres of shared space this resident thinks EACH PERSON
   * should pay for. A whole number of square metres, zero or more, or null when
   * never answered. The building app takes the median over every resident's
   * answer, which is why it has to travel: before run 0030 the store dropped
   * this key without a word and that median was taken over one answer.
   *
   * There is no upper bound here on purpose. How high the slider goes is the
   * building app's business, and a bound written into the store would have to be
   * changed in two repositories at once.
   */
  shareM2: number | null;
  /**
   * How many square metres this resident offered to pay for BEYOND that share,
   * after the vote settled. Same units, same rules, same reason for no upper
   * bound.
   */
  extraM2: number | null;
  /**
   * The three wishes a resident makes about their OWN flat: a corner flat, one
   * near a terrace, one away from the noise. Null when never answered.
   *
   * All three keys are always present together, and a partial object is refused
   * rather than merged. A wish that is absent and a wish that is false are the
   * same thing to whoever reads them, so letting them differ here would invent a
   * third state the packer would then have to have an opinion about.
   *
   * The packer scores these. That is the building app's work and not this one's;
   * this end only has to carry them, which before run 0031 it did not, so they
   * lived in one browser's localStorage and nothing ever read them.
   */
  wishes: Wishes | null;
}

/** A resident's three wishes about their own flat. All three, always. */
export interface Wishes {
  corner: boolean;
  terrace: boolean;
  quiet: boolean;
}

export interface BuildingRun {
  genome: unknown;
  summary: unknown;
  by: string;
  at: string;
  /** OPTIONAL, opaque (run 0026): the building app's own plot — module grid
   *  size, floor count, whatever it decides a plot is. Stored exactly as sent
   *  and never read inside; the flat app's Regenerate (a future run) is the
   *  one reader, and even it need not understand every key. Absent when the
   *  building app that wrote this run predates the field. */
  plot?: Record<string, unknown>;
}

/** The index blob. Maps here, lists on the wire (see `sessionView`). */
/**
 * One thing somebody said to the group while it was deciding something.
 *
 * Append-only. There is no edit and no delete, because the point is a record of
 * what a group said while a building changed under them, and a record you can
 * quietly rewrite is not one. Moderation is not built here.
 */
export interface Message {
  /** Who said it, as they typed their name. */
  who: string;
  /** What they said, stored exactly as sent and never interpreted. */
  text: string;
  /** When the STORE received it, not when the sender's clock says. */
  at: string;
}

/** The last messages a group sent, oldest first. Older ones are dropped. */
export const MESSAGE_CAP = 200;
/** The longest one message may be. */
export const MESSAGE_MAX = 500;

/**
 * What the store itself says when somebody leaves (run 0036). `who` is empty
 * on this one, and only on this one, so a reader can tell the store's voice
 * from a person's without a second field: every message a person sends is
 * refused unless `who` is 1 to 64 printable characters.
 *
 * It exists so the record of a session can tell "four took part" from "five
 * took part and one left". Without it an export after a departure is
 * indistinguishable from one where that person never joined.
 */
export function leftMessage(name: string): Message {
  return { who: "", text: `${name} left the group.`, at: new Date().toISOString() };
}

/**
 * The five reasons a resident may tick beside a vote (run 0039).
 *
 * Copied word for word from the brief's "The vote chooses the building", which
 * says both apps read these five from that paragraph. They are the only ones
 * the store accepts, and they are also the five dials a challenger is built
 * on, which is why a pair names one of them as its `dial`.
 *
 * The wording is the data. "shared space" and "short walks" are two words on
 * purpose, because they are what a resident reads on the button.
 */
export const REASONS = ["privacy", "shared space", "cost", "light", "short walks"] as const;
export type Reason = (typeof REASONS)[number];

const isReason = (v: unknown): v is Reason => typeof v === "string" && (REASONS as readonly string[]).includes(v);

/** One building in a pair. The store never reads inside any of the three. */
export interface Candidate {
  genome: unknown;
  summary: unknown;
  /** The plot it was built on, opaque, the same shape `BuildingRun.plot` has. */
  plot?: Record<string, unknown>;
}

/**
 * Two buildings a resident chooses between, and why they differ.
 *
 * `dial` is the one reason the challenger was pushed on, and `sentence` is the
 * line the screen shows: "This one has more light and longer walks to the
 * stair." The store keeps both and reads neither; the building app writes them
 * and the flat app never sees them.
 */
export interface Pair {
  id: string;
  a: Candidate;
  b: Candidate;
  dial: Reason;
  sentence: string;
}

/** One person's answer on one pair. */
export interface Vote {
  who: string;
  pair: string;
  pick: "a" | "b";
  /** Any of the five, in any order, possibly none. */
  reasons: Reason[];
  /** When the STORE received it. A replacement carries the later time. */
  at: string;
}

/**
 * One round of the vote.
 *
 * A round is stored whole: its pairs with both buildings inside them, the five
 * weights it was built with, every vote cast on it, and when it opened and
 * closed. Nothing about a round is recomputed on read, so a round read back
 * next year is the round that ran.
 *
 * At most one round is open at a time. `closedAt` absent is what open means.
 */
export interface Round {
  n: number;
  pairs: Pair[];
  /** The five numbers the round was built with, one per reason, in REASONS' order. */
  weights: number[];
  openedAt: string;
  closedAt?: string;
  votes: Vote[];
}

interface SessionIndex {
  flats: Record<string, FlatSummary>;
  residents: Record<string, Resident>;
  building: BuildingRun | null;
  /** Optional in the type because an index written before run 0031 has none,
   *  and the store reads a record back as it found it rather than backfilling. */
  messages?: Message[];
  /** When somebody started this group on purpose, or absent if nobody did.
   *  Written once by `POST /api/session/{code}` and never overwritten. */
  startedAt?: string;
  /**
   * Every round, open and closed, oldest first (run 0039). ONE list rather
   * than an open round beside a history: at most one round is ever open, so
   * "the open round" and "the last closed round" are both views of this, and
   * two fields that could disagree would be two fields that eventually do.
   *
   * Optional in the type for the same reason `messages` is: an index written
   * before this run has none, and the store reads a record back as it found
   * it rather than backfilling.
   */
  rounds?: Round[];
}

/** The one open round, or undefined. At most one is open, which `PUT /round`
 *  is what enforces. */
function openRound(index: SessionIndex): Round | undefined {
  return (index.rounds ?? []).find((r) => r.closedAt === undefined);
}

/** The most recent closed round, or undefined. */
function lastClosedRound(index: SessionIndex): Round | undefined {
  const closed = (index.rounds ?? []).filter((r) => r.closedAt !== undefined);
  return closed[closed.length - 1];
}

/**
 * Who is at the table, as the store reads the room (run 0039).
 *
 * A person is in the group if they joined, which is a resident row, OR if they
 * own a flat, which is a flat published under their name. That is the building
 * app's own rule from its run 0059, and the store can answer it from its index
 * without being told, so a vote does not have to carry a membership list that
 * could be stale.
 *
 * Names come back as they were STORED, deduped by `sameResident`, so somebody
 * who typed "ana" once and "Ana" the next time is one person and counts once.
 * Sorted, so the expected count and the list are the same on every read.
 */
export function roomMembers(index: SessionIndex): string[] {
  const out: string[] = [];
  for (const name of [...Object.keys(index.residents), ...Object.values(index.flats).map((f) => f.resident)]) {
    if (!out.some((k) => sameResident(k, name))) out.push(name);
  }
  return out.sort();
}

/** Whether this person is at the table, by the same rule. */
function inRoom(index: SessionIndex, who: string): boolean {
  return roomMembers(index).some((k) => sameResident(k, who));
}

/** What one pair looks like in the polled state: the pair itself, plus the
 *  counting a client needs to say "8 of 20 so far" without doing arithmetic
 *  over a vote list it would have to fetch anyway. */
function pairView(round: Round, expected: number) {
  return round.pairs.map((p) => ({
    ...p,
    voted: round.votes.filter((v) => v.pair === p.id).length,
    expected,
  }));
}

/** A round on the wire. The votes ride along whole, so a client can count them
 *  its own way as well as read the counts above. */
function roundView(index: SessionIndex, round: Round | undefined) {
  if (round === undefined) return null;
  const expected = roomMembers(index).length;
  return { ...round, pairs: pairView(round, expected), expected };
}

/**
 * Whether this group exists, which is THE ONE RULE the whole feature turns on.
 *
 * True when somebody started it on purpose, and ALSO when it already holds a
 * flat or a resident. The second half is there so that every group already live
 * in the store reads as existing without a migration: they were all created by
 * the old behaviour, where a `GET` on an unused code conjured one, and none of
 * them carries `startedAt`.
 */
function groupExists(index: SessionIndex): boolean {
  return (
    typeof index.startedAt === "string" ||
    Object.keys(index.flats).length > 0 ||
    Object.keys(index.residents).length > 0
  );
}

const CORS = {
  "access-control-allow-origin": "*",
  // POST joined in run 0031 for the messages route, the store's first.
  // DELETE joined in run 0035. It has to be named here or a browser never
  // sends the call at all: the preflight fails and `fetch` rejects with
  // `TypeError: Failed to fetch`, which is what the building app's run 0059
  // measured when it tried to remove a resident.
  "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type",
};

/** Session codes and flat ids: short and URL-safe. Codes are lowercased first. */
const CODE = /^[a-z0-9_-]{1,32}$/;
const ID = /^[a-z0-9_-]{1,64}$/i;
const INDEX_ATTEMPTS = 4;

/**
 * A resident name off the wire, checked once (run 0035). It was written out
 * twice before, at the PUT and in the messages route, and leaving and renaming
 * would have made it four. The rule has not changed: trimmed, 1 to 64
 * characters, nothing a terminal would swallow.
 */
function residentName(raw: string): string {
  const who = raw.trim();
  if (who.length === 0 || who.length > 64 || /[\p{C}]/u.test(who)) {
    return fail(400, "resident name must be 1-64 printable characters");
  }
  return who;
}

/**
 * The key a resident's row is filed under, found the way ownership is decided
 * (run 0035). The row is keyed by the name AS TYPED, so "ana" must still find
 * "Ana"'s row, and `sameResident` is the one rule that says those are one
 * person. Undefined when nobody has a row.
 */
function residentKey(index: SessionIndex, who: string): string | undefined {
  return Object.keys(index.residents).find((k) => sameResident(k, who));
}

/**
 * The spelling this group already has for this person, which is what a removal
 * and a rename report back (run 0035). Their row's key when they have a row,
 * otherwise the name recorded against a flat they own, otherwise the name as
 * it was typed. The middle case is the one worth having: somebody who
 * published a flat and never sent any wishes has no row, and answering
 * `DELETE .../residents/dan` with "dan" would tell the caller a spelling the
 * store never held.
 */
function storedName(index: SessionIndex, who: string, owned: string[]): string {
  const key = residentKey(index, who);
  if (key !== undefined) return key;
  const first = owned[0];
  return first === undefined ? who : index.flats[first].resident;
}

/** Every flat this person owns, by the same one rule (run 0035). Sorted, so a
 *  removal and a rename report the same list in the same order every time. */
function flatsOwnedBy(index: SessionIndex, who: string): string[] {
  return Object.entries(index.flats)
    .filter(([, f]) => sameResident(f.resident, who))
    .map(([id]) => id)
    .sort();
}

/** Two resident names as the same person (run 0026): trimmed, case-insensitive.
 *  A republish by "ben" over a flat recorded as "Ben" is not a conflict — only
 *  the COMPARISON folds case; the name as typed is still what gets stored and
 *  shown (the ownership check below, and `isMine` in
 *  src/library/unitBrowser.ts, which restates this rather than importing it —
 *  that module is self-contained on purpose, see its own file header). */
export function sameResident(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json; charset=utf-8" },
  });
}

/** Route one request. Every response, errors included, carries the CORS headers. */
export async function handleSession(req: Request, kv: KV): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  try {
    return await route(req, kv);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}

/**
 * Path parsing is a plain segment split rather than one regex: run 0024 added
 * a fourth shape (`flats/{id}/preview`) alongside the three from run 0022/23
 * (bare, `flats/{id}`, `residents/{name}`, `building`, `export`), and a
 * regex with two nested optional groups was already at the edge of readable.
 */
async function route(req: Request, kv: KV): Promise<Response> {
  const url = new URL(req.url);
  const segs = url.pathname.split("/").filter(Boolean);
  if (segs[0] !== "api" || segs[1] !== "session" || segs[2] === undefined) {
    return fail(404, "no such route; see docs/store.md");
  }
  const code = decodeSegment(segs[2]).toLowerCase();
  if (!CODE.test(code)) return fail(400, "session code must be 1-32 of a-z, 0-9, - and _");
  const rest = segs.slice(3);
  const indexKey = `${code}/index`;

  if (rest.length === 0) {
    // Starting a group is the one call that must fail when it would otherwise
    // succeed silently. Before run 0032 a `GET` on an unused code conjured a
    // group, so one typo in a code started an empty group of one while the
    // resident believed they had joined the twenty.
    if (req.method === "POST") {
      let started = false;
      await updateIndex(kv, indexKey, (index) => {
        // Re-checked INSIDE the mutate rather than before it, because
        // updateIndex re-reads and re-runs this on a lost ETag race, so two
        // people starting the same code at once cannot both be told they won.
        started = !groupExists(index);
        if (started) index.startedAt = new Date().toISOString();
      });
      if (!started) return fail(409, `group "${code}" has already been started`);
      return json(sessionView(code, await readIndex(kv, indexKey)), 201);
    }
    if (req.method !== "GET") return fail(405, "GET or POST only");
    return json(sessionView(code, await readIndex(kv, indexKey)));
  }

  if (rest[0] === "flats" && rest.length >= 2 && rest.length <= 3) {
    const id = decodeSegment(rest[1]);
    if (!ID.test(id)) return fail(400, "flat id must be 1-64 of a-z, 0-9, - and _");
    const flatKey = `${code}/flats/${id}`;

    if (rest.length === 3) {
      if (rest[2] !== "preview") return fail(404, "no such route; see docs/store.md");
      return routePreview(req, kv, code, id, indexKey);
    }

    if (req.method === "GET") {
      const text = await kv.get(flatKey);
      if (text === null) return fail(404, `no flat "${id}" in session "${code}"`);
      return new Response(text, {
        headers: { ...CORS, "content-type": "application/json; charset=utf-8" },
      });
    }
    if (req.method !== "PUT") return fail(405, "GET or PUT only");
    const resident = (url.searchParams.get("resident") ?? "").trim();
    if (!resident) return fail(400, "?resident= is required: who is publishing");
    const replace = url.searchParams.get("replace") === "1";
    const text = await req.text();
    const unit = parseUnit(text);
    const label = (url.searchParams.get("label") ?? "").trim() || unit.name;

    // A flat belongs to whoever last published it under a resident name
    // (run 0024): a different resident's PUT is refused unless ?replace=1,
    // so two residents proposing the same design number cannot silently
    // overwrite one another. ponytail: this check and the write below are two
    // separate reads of the index, so a publish landing in the gap between
    // them is not caught; closing that needs the ownership check moved inside
    // updateIndex's own retry, which is the upgrade path if it ever matters at
    // this scale (a five-person room, human-speed saves).
    const existing = (await readIndex(kv, indexKey)).flats[id];
    if (existing && !sameResident(existing.resident, resident) && !replace) {
      return json(
        {
          error: `"${id}" was published by ${existing.resident}; add ?replace=1 to take it over`,
          resident: existing.resident,
        },
        409
      );
    }

    // The body is stored byte for byte; the summary is the only thing derived from it.
    await kv.set(flatKey, text);
    let summary!: FlatSummary;
    let created = false;
    await updateIndex(kv, indexKey, (index) => {
      const prev = index.flats[id];
      created = prev === undefined;
      summary = {
        id,
        resident,
        label,
        version: prev ? prev.version + 1 : 1,
        changed: true,
        preview: prev?.preview ?? false,
        ...measure(unit),
        publishedAt: new Date().toISOString(),
      };
      index.flats[id] = summary;
    });
    return json(summary, created ? 201 : 200);
  }

  if (rest[0] === "residents") {
    const who = residentName(decodeSegment(rest[1] ?? ""));

    // `residents/{name}/rename` (run 0035). One call rather than a PUT under
    // the new name and a DELETE of the old, because between those two a
    // person is at the table twice and the building app is polling.
    if (rest.length === 3 && rest[2] === "rename") {
      if (req.method !== "POST") return fail(405, "POST only");
      const body = await req.json().catch(() => fail(400, "body must be JSON"));
      if (!isRecord(body)) return fail(400, "body must be a JSON object");
      if (typeof body.to !== "string") return fail(400, "body must carry a `to` name");
      const to = residentName(body.to);
      let moved!: { from: string; to: string; flats: string[] };
      await updateIndex(kv, indexKey, (index) => {
        const from = residentKey(index, who);
        const owned = flatsOwnedBy(index, who);
        if (from === undefined && owned.length === 0) {
          return fail(404, `no resident "${who}" in session "${code}"`);
        }
        // A person renaming to another spelling of their own name is the case
        // this call exists for, so it is not a clash with themselves. Anyone
        // else holding the name, by a row or by a flat, is.
        if (!sameResident(who, to)) {
          const takenBy = residentKey(index, to);
          if (takenBy !== undefined || flatsOwnedBy(index, to).length > 0) {
            return fail(409, `"${to}" is already at the table in session "${code}"`);
          }
        }
        const name = storedName(index, who, owned);
        const record = from === undefined ? undefined : index.residents[from];
        if (from !== undefined) delete index.residents[from];
        if (record !== undefined) index.residents[to] = record;
        for (const id of owned) index.flats[id].resident = to;
        moved = { from: name, to, flats: owned };
      });
      return json(moved);
    }

    if (rest.length !== 2) return fail(404, "no such route; see docs/store.md");

    // Leaving takes the flat with it (run 0035, Shrey's decision of
    // 6 September). One person is one profile is one flat, so a person who
    // goes cannot leave a flat behind for the building to keep packing.
    if (req.method === "DELETE") {
      let gone!: { resident: string; flats: string[] };
      await updateIndex(kv, indexKey, (index) => {
        const key = residentKey(index, who);
        const owned = flatsOwnedBy(index, who);
        if (key === undefined && owned.length === 0) {
          return fail(404, `no resident "${who}" in session "${code}"`);
        }
        const name = storedName(index, who, owned);
        if (key !== undefined) delete index.residents[key];
        for (const id of owned) delete index.flats[id];
        // The store says so, in the group's own chat (run 0036). Under the
        // same cap as anything a person says, so a group that churns cannot
        // grow the index without bound.
        const said = index.messages ?? [];
        said.push(leftMessage(name));
        index.messages = said.slice(-MESSAGE_CAP);
        gone = { resident: name, flats: owned };
      });
      // The index is the record of what exists, so it loses the flats first
      // and the blobs go afterwards. A crash between the two leaves orphaned
      // bytes nothing points at, which is the harmless order; the reverse
      // leaves the index promising a flat that `/export` cannot read.
      for (const id of gone.flats) {
        await kv.delete(`${code}/flats/${id}`);
        await kv.delete(`${code}/flats/${id}.preview`);
      }
      return json(gone);
    }

    if (req.method !== "PUT") return fail(405, "PUT, DELETE or POST .../rename only");
    const patch = parseResidentPatch(await req.json().catch(() => fail(400, "body must be JSON")));
    let record!: Resident;
    await updateIndex(kv, indexKey, (index) => {
      record = {
        ...(index.residents[who] ??
          { counts: {}, share: null, ballot: [], shareM2: null, extraM2: null, wishes: null }),
        ...patch,
      };
      index.residents[who] = record;
    });
    return json({ name: who, ...record });
  }

  if (rest.length === 1 && rest[0] === "messages") {
    // POST rather than PUT because this appends rather than replaces, and it is
    // the one call in the store that does. Reading them is the poll's job, so
    // there is no GET here: a client that wants the chat is already polling.
    if (req.method !== "POST") return fail(405, "POST only");
    const body = await req.json().catch(() => fail(400, "body must be JSON"));
    if (!isRecord(body)) return fail(400, "body must be a JSON object");

    // `who` gets the same loose rule a resident name gets (run 0026): trimmed,
    // 1 to 64 characters, nothing a terminal would swallow. It is deliberately
    // NOT checked against the resident list, because somebody may say something
    // before they have published a flat.
    if (typeof body.who !== "string") return fail(400, "who must be 1-64 printable characters");
    const who = residentName(body.who);
    // `text` is NOT trimmed before the length check the way `who` is, because
    // the leading and trailing spaces of a message are the sender's business.
    // It is only rejected for being empty or too long.
    const text = typeof body.text === "string" ? body.text : "";
    if (text.length === 0 || text.length > MESSAGE_MAX) {
      return fail(400, `text must be 1-${MESSAGE_MAX} characters`);
    }

    const message: Message = { who, text, at: new Date().toISOString() };
    await updateIndex(kv, indexKey, (index) => {
      const list = index.messages ?? [];
      list.push(message);
      // Oldest dropped, so a long session cannot grow the index without bound.
      index.messages = list.slice(-MESSAGE_CAP);
    });
    return json(message, 201);
  }

  // ---- The vote (run 0039) -------------------------------------------------
  // Rounds of pairs, one vote per person per pair, and a round that closes
  // itself when the last expected vote lands. The brief's "The vote chooses
  // the building" is what all of this is shaped by; the store holds it and
  // counts nothing beyond "has everybody voted".

  if (rest.length === 1 && rest[0] === "round") {
    if (req.method !== "PUT") return fail(405, "PUT only");
    const body = await req.json().catch(() => fail(400, "body must be JSON"));
    const round = parseRound(body);
    let stored!: Round;
    await updateIndex(kv, indexKey, (index) => {
      const rounds = index.rounds ?? [];
      const open = openRound(index);
      // Two clients racing to open the same round cannot both win: the check
      // is INSIDE the mutate, which `updateIndex` re-runs on a lost ETag, so
      // the loser sees the winner's round and is refused.
      if (open !== undefined) {
        return fail(409, `round ${open.n} in session "${code}" is still open`);
      }
      const last = rounds[rounds.length - 1];
      const wanted = last === undefined ? 1 : last.n + 1;
      if (round.n !== wanted) {
        return fail(409, `next round in session "${code}" is ${wanted}, not ${round.n}`);
      }
      stored = { ...round, openedAt: new Date().toISOString(), votes: [] };
      index.rounds = [...rounds, stored];
    });
    return json(roundView(await readIndex(kv, indexKey), stored), 201);
  }

  if (rest[0] === "rounds" && rest.length === 3) {
    const n = Number(decodeSegment(rest[1]));
    if (!Number.isInteger(n) || n < 1) return fail(400, "round number must be a whole number \u2265 1");

    if (rest[2] === "votes") {
      if (req.method !== "POST") return fail(405, "POST only");
      const body = await req.json().catch(() => fail(400, "body must be JSON"));
      if (!isRecord(body)) return fail(400, "body must be a JSON object");
      if (typeof body.who !== "string") return fail(400, "who must be 1-64 printable characters");
      const who = residentName(body.who);
      const pick = body.pick;
      if (pick !== "a" && pick !== "b") return fail(400, 'pick must be "a" or "b"');
      const pair = typeof body.pair === "string" ? body.pair.trim() : "";
      if (!pair) return fail(400, "pair must name one of the round's pairs");
      const reasons = parseReasons(body.reasons);

      let vote!: Vote;
      await updateIndex(kv, indexKey, (index) => {
        const open = openRound(index);
        // A vote on anything but the open round is refused, whether that round
        // has closed or never existed. The message says which it was, because
        // the two mean different things to whoever is holding the screen.
        if (open === undefined || open.n !== n) {
          const known = (index.rounds ?? []).some((r) => r.n === n);
          return fail(409, known ? `round ${n} in session "${code}" is closed` : `no open round ${n} in session "${code}"`);
        }
        if (!open.pairs.some((p) => p.id === pair)) {
          return fail(400, `no pair "${pair}" in round ${n}`);
        }
        // The room rule, read from the index rather than passed in: a person
        // who joined or who owns a flat. Anyone else is not at this table.
        if (!inRoom(index, who)) {
          return fail(403, `"${who}" is not in session "${code}"`);
        }
        vote = { who, pair, pick, reasons, at: new Date().toISOString() };
        // One vote per person per pair. A second one replaces the first while
        // the round is open, so a resident who changes their mind does not
        // have to be told they cannot.
        open.votes = open.votes.filter((v) => !(v.pair === pair && sameResident(v.who, who)));
        open.votes.push(vote);
      });
      return json(vote, 201);
    }

    return fail(404, "no such route; see docs/store.md");
  }

  if (rest.length === 1 && rest[0] === "export") {
    // The whole session as one file (run 0023): the state the poll returns
    // plus every flat body, carried as a STRING so its bytes survive the
    // document around it. This is the thesis record of a room at the end of
    // a test, so it is deliberately the only call that reads every blob.
    if (req.method !== "GET") return fail(405, "GET only");
    const index = await readIndex(kv, indexKey);
    const bodies: Record<string, string | null> = {};
    for (const id of Object.keys(index.flats)) bodies[id] = await kv.get(`${code}/flats/${id}`);
    // Every round, open and closed, oldest first (run 0039). This is the only
    // call that carries them, for the same reason it is the only one that
    // carries the flat bodies: it is the thesis record of a room at the end of
    // a test, and a poll should not drag a building through the wire every few
    // seconds.
    return json({
      ...sessionView(code, index),
      rounds: (index.rounds ?? []).map((r) => roundView(index, r)),
      bodies,
      exportedAt: new Date().toISOString(),
    });
  }

  if (rest.length !== 1 || rest[0] !== "building") return fail(404, "no such route; see docs/store.md");
  if (req.method === "GET") return json((await readIndex(kv, indexKey)).building);
  if (req.method !== "PUT") return fail(405, "GET or PUT only");
  const body = await req.json().catch(() => fail(400, "body must be JSON"));
  if (!isRecord(body)) return fail(400, "body must be a JSON object");
  const run: BuildingRun = {
    genome: body.genome ?? null,
    summary: body.summary ?? null,
    by: typeof body.by === "string" ? body.by : "",
    at: new Date().toISOString(),
  };
  if ("plot" in body) {
    if (!isRecord(body.plot)) return fail(400, "plot must be a JSON object");
    run.plot = body.plot;
  }
  await updateIndex(kv, indexKey, (index) => {
    index.building = run;
    for (const flat of Object.values(index.flats)) flat.changed = false;
  });
  return json(run);
}

/**
 * `GET`/`PUT` of `flats/{id}/preview` (run 0024). The JPEG travels as the
 * request body and is kept base64-encoded under its own key, through the same
 * string-only `KV` the rest of the store uses — one interface, one seam for
 * `store.test.ts` to drive without a real Blobs store, at the cost of the
 * ~33% base64 overhead on top of a JPEG that is already small.
 */
async function routePreview(req: Request, kv: KV, code: string, id: string, indexKey: string): Promise<Response> {
  // A SIBLING of the flat's own key (`{code}/flats/{id}`), never a child of
  // it: Netlify Blobs' local sandbox maps keys onto a real filesystem path,
  // so `{code}/flats/{id}/preview` would need `{id}` to be a directory when
  // it is already a file holding the flat itself — a collision that hung
  // every write under `netlify dev`, discovered live in this run. Production
  // Blobs may not share that failure mode, but the key is wrong regardless
  // of backend: two objects should not need one to be the other's folder.
  const previewKey = `${code}/flats/${id}.preview`;
  if (req.method === "GET") {
    const b64 = await kv.get(previewKey);
    if (b64 === null) return fail(404, `no preview for "${id}" in session "${code}"`);
    return new Response(base64ToBytes(b64).buffer as ArrayBuffer, {
      headers: { ...CORS, "content-type": "image/jpeg" },
    });
  }
  if (req.method !== "PUT") return fail(405, "GET or PUT only");
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length === 0) return fail(400, "empty preview body");
  const index = await readIndex(kv, indexKey);
  if (!index.flats[id]) return fail(404, `no flat "${id}" in session "${code}"; publish it before its preview`);
  await kv.set(previewKey, bytesToBase64(bytes));
  await updateIndex(kv, indexKey, (idx) => {
    const summary = idx.flats[id];
    if (summary) summary.preview = true;
  });
  return json({ ok: true, bytes: bytes.length });
}

/** Base64 through the platform's own `atob`/`btoa` (DOM lib, no `Buffer`,
 *  no dependency) rather than Node's Buffer — this file runs under a Netlify
 *  Function and under plain Node via Vitest alike, and both have these. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeSegment(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return fail(400, "malformed URL segment");
  }
}

const emptyIndex = (): SessionIndex => ({ flats: {}, residents: {}, building: null });

async function readIndex(kv: KV, key: string): Promise<SessionIndex> {
  const text = await kv.get(key);
  return text === null ? emptyIndex() : (JSON.parse(text) as SessionIndex);
}

/**
 * Read-modify-write under the blob's ETag. A write that lost a race returns
 * `modified: false` and the loop reads again; an unknown session is created
 * with `onlyIfNew`, so two first arrivals cannot both create it.
 */
async function updateIndex(kv: KV, key: string, mutate: (index: SessionIndex) => void): Promise<void> {
  for (let attempt = 0; attempt < INDEX_ATTEMPTS; attempt++) {
    const cur = await kv.getWithMetadata(key);
    const index = cur ? (JSON.parse(cur.data) as SessionIndex) : emptyIndex();
    mutate(index);
    const res = await kv.set(key, JSON.stringify(index), cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
    if (res.modified) return;
  }
  fail(409, `the session changed under this write ${INDEX_ATTEMPTS} times; try again`);
}

/** The wire shape of a whole session: lists rather than maps, never a flat body. */
function sessionView(code: string, index: SessionIndex) {
  return {
    code,
    flats: Object.values(index.flats),
    residents: Object.entries(index.residents).map(([name, r]) => ({ name, ...r })),
    building: index.building,
    // Added in run 0032 BESIDE everything else, never in place of it: the
    // building app polls this call continuously and treats what it already
    // reads the way it always has. `exists` is the one rule, `groupExists`.
    exists: groupExists(index),
    // Named one by one here, unlike a resident's fields, which ride in on the
    // spread above. So a top-level addition like this one DOES need a line, and
    // it defaults to an empty list rather than being absent, so a group with
    // nothing said reads as having said nothing.
    messages: index.messages ?? [],
    // The vote, as two views of one list (run 0039). `round` is the open one
    // with its per-pair counts, `lastRound` the one that closed most
    // recently. Both are null rather than absent, so a client can tell "no
    // round" from "a field this store does not have". The whole history is in
    // `/export` only: a poll runs every few seconds and every round carries
    // two whole buildings.
    round: roundView(index, openRound(index)),
    lastRound: roundView(index, lastClosedRound(index)),
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

interface UnitShape {
  name: string;
  storeys: { cells: [number, number][] }[];
}

/** The least the store needs to believe a body is a `dwelling-unit` file. */
function parseUnit(text: string): UnitShape {
  let u: unknown;
  try {
    u = JSON.parse(text);
  } catch {
    return fail(400, "body must be the dwelling-unit JSON");
  }
  if (!isRecord(u) || u.format !== "dwelling-unit" || !Array.isArray(u.storeys)) {
    return fail(400, 'body must be a "dwelling-unit" file with a storeys array');
  }
  for (const s of u.storeys) {
    if (!isRecord(s) || !Array.isArray(s.cells)) return fail(400, "every storey needs a cells array");
    for (const c of s.cells) {
      if (!Array.isArray(c) || c.length !== 2 || !c.every((n) => Number.isInteger(n))) {
        return fail(400, "every cell must be [x, z] integers");
      }
    }
  }
  return { name: typeof u.name === "string" ? u.name : "", storeys: u.storeys as UnitShape["storeys"] };
}

/** Bounding box, storey count and cell count over the union of every storey. */
function measure(unit: UnitShape): Pick<FlatSummary, "bbox" | "floors" | "areaCells"> {
  let areaCells = 0;
  const bbox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const s of unit.storeys) {
    for (const [x, z] of s.cells) {
      areaCells++;
      bbox[0] = Math.min(bbox[0], x);
      bbox[1] = Math.min(bbox[1], z);
      bbox[2] = Math.max(bbox[2], x);
      bbox[3] = Math.max(bbox[3], z);
    }
  }
  return { bbox: areaCells ? bbox : [0, 0, 0, 0], floors: unit.storeys.length, areaCells };
}

/** Only the keys present are merged; each one is checked whole. */
function parseResidentPatch(body: unknown): Partial<Resident> {
  if (!isRecord(body)) return fail(400, "body must be a JSON object");
  const patch: Partial<Resident> = {};
  if ("counts" in body) {
    const c = body.counts;
    if (!isRecord(c) || !Object.values(c).every((n) => Number.isInteger(n) && (n as number) >= 0)) {
      return fail(400, "counts must map flat ids to whole numbers ≥ 0");
    }
    patch.counts = c as Record<string, number>;
  }
  if ("share" in body) {
    const s = body.share;
    if (s !== null && !(typeof s === "number" && s >= 0 && s <= 1)) return fail(400, "share must be a number 0..1 or null");
    patch.share = s as number | null;
  }
  if ("ballot" in body) {
    const b = body.ballot;
    if (!Array.isArray(b) || !b.every((t) => typeof t === "string")) return fail(400, "ballot must be a list of strings");
    patch.ballot = b as string[];
  }
  // The two square-metre answers (run 0030). Same shape as the three above:
  // present or absent, and checked whole when present. No upper bound, because
  // the slider's range belongs to the building app and a limit written here
  // would have to move in two repositories at once.
  for (const key of ["shareM2", "extraM2"] as const) {
    if (!(key in body)) continue;
    const v = body[key];
    if (v !== null && !(typeof v === "number" && Number.isInteger(v) && v >= 0)) {
      return fail(400, `${key} must be a whole number of square metres ≥ 0, or null`);
    }
    patch[key] = v as number | null;
  }
  // The three wishes (run 0031). Checked whole: null, or an object carrying all
  // three keys as booleans. A partial object is a 400 rather than a merge, for
  // the reason on the field itself.
  if ("wishes" in body) {
    const w = body.wishes;
    if (w !== null) {
      const ok =
        isRecord(w) &&
        WISH_KEYS.every((k) => typeof w[k] === "boolean") &&
        Object.keys(w).length === WISH_KEYS.length;
      if (!ok) {
        return fail(400, `wishes must be null or an object with ${WISH_KEYS.join(", ")} all boolean`);
      }
    }
    patch.wishes = w as Wishes | null;
  }
  return patch;
}

/** The three, named once so the check, the message and the document agree. */
const WISH_KEYS = ["corner", "terrace", "quiet"] as const;

/** The reasons off the wire: a list, any length including none, and every
 *  entry one of the five. Anything else is a 400 naming the five. */
function parseReasons(raw: unknown): Reason[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return fail(400, `reasons must be a list of ${REASONS.join(", ")}`);
  for (const r of raw) {
    if (!isReason(r)) return fail(400, `"${String(r)}" is not one of ${REASONS.join(", ")}`);
  }
  return raw as Reason[];
}

/** One building of a pair. The store checks that the three keys are there and
 *  reads inside none of them. */
function parseCandidate(raw: unknown, where: string): Candidate {
  if (!isRecord(raw)) return fail(400, `${where} must be a JSON object`);
  if (!("genome" in raw)) return fail(400, `${where} must carry a genome`);
  if (!("summary" in raw)) return fail(400, `${where} must carry a summary`);
  const c: Candidate = { genome: raw.genome, summary: raw.summary };
  if ("plot" in raw) {
    if (!isRecord(raw.plot)) return fail(400, `${where}.plot must be a JSON object`);
    c.plot = raw.plot;
  }
  return c;
}

/**
 * A round off the wire, checked whole before anything is written. `openedAt`
 * and `votes` are the store's to set, so a body carrying them is ignored
 * rather than refused: they are not a caller's to send and a 400 would be
 * pedantry.
 */
function parseRound(raw: unknown): Omit<Round, "openedAt" | "votes"> {
  if (!isRecord(raw)) return fail(400, "body must be a JSON object");
  const n = raw.n;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1) {
    return fail(400, "n must be a whole number \u2265 1");
  }
  if (!Array.isArray(raw.pairs) || raw.pairs.length === 0) {
    return fail(400, "pairs must be a list with at least one pair in it");
  }
  const ids = new Set<string>();
  const pairs: Pair[] = raw.pairs.map((p, i) => {
    if (!isRecord(p)) return fail(400, `pairs[${i}] must be a JSON object`);
    const id = typeof p.id === "string" ? p.id.trim() : "";
    if (!id) return fail(400, `pairs[${i}].id must be a non-empty string`);
    if (ids.has(id)) return fail(400, `two pairs share the id "${id}"`);
    ids.add(id);
    if (!isReason(p.dial)) return fail(400, `pairs[${i}].dial must be one of ${REASONS.join(", ")}`);
    if (typeof p.sentence !== "string" || p.sentence.trim() === "") {
      return fail(400, `pairs[${i}].sentence must say what is different between the two`);
    }
    return {
      id,
      a: parseCandidate(p.a, `pairs[${i}].a`),
      b: parseCandidate(p.b, `pairs[${i}].b`),
      dial: p.dial,
      sentence: p.sentence,
    };
  });
  const weights = raw.weights;
  if (
    !Array.isArray(weights) ||
    weights.length !== REASONS.length ||
    !weights.every((w) => typeof w === "number" && Number.isFinite(w))
  ) {
    return fail(400, `weights must be ${REASONS.length} numbers, one per reason, in the order ${REASONS.join(", ")}`);
  }
  return { n, pairs, weights: weights as number[] };
}
