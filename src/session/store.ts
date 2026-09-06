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

/** The three calls the handler makes on storage; `@netlify/blobs`' `Store` has this shape. */
export interface KV {
  get(key: string): Promise<string | null>;
  getWithMetadata(key: string): Promise<{ data: string; etag?: string } | null>;
  set(
    key: string,
    value: string,
    options?: { onlyIfMatch?: string; onlyIfNew?: boolean },
  ): Promise<{ modified: boolean }>;
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
interface SessionIndex {
  flats: Record<string, FlatSummary>;
  residents: Record<string, Resident>;
  building: BuildingRun | null;
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, PUT, OPTIONS",
  "access-control-allow-headers": "content-type",
};

/** Session codes and flat ids: short and URL-safe. Codes are lowercased first. */
const CODE = /^[a-z0-9_-]{1,32}$/;
const ID = /^[a-z0-9_-]{1,64}$/i;
const INDEX_ATTEMPTS = 4;

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
    if (req.method !== "GET") return fail(405, "GET only");
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
    if (req.method !== "PUT") return fail(405, "PUT only");
    const who = decodeSegment(rest[1] ?? "").trim();
    if (who.length === 0 || who.length > 64 || /[\p{C}]/u.test(who)) {
      return fail(400, "resident name must be 1-64 printable characters");
    }
    const patch = parseResidentPatch(await req.json().catch(() => fail(400, "body must be JSON")));
    let record!: Resident;
    await updateIndex(kv, indexKey, (index) => {
      record = {
        ...(index.residents[who] ?? { counts: {}, share: null, ballot: [], shareM2: null, extraM2: null }),
        ...patch,
      };
      index.residents[who] = record;
    });
    return json({ name: who, ...record });
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
    return json({ ...sessionView(code, index), bodies, exportedAt: new Date().toISOString() });
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
  return patch;
}
