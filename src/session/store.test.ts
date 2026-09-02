import { describe, it, expect } from "vitest";
import { handleSession, type KV } from "./store";

/**
 * The session store's contract (docs/store.md), driven through an in-memory
 * `KV` so no Netlify is needed: routing and CORS, replace versus create on a
 * flat, the partial merge on a resident, `changed` clearing on a building
 * write, and the ETag retry that keeps two writers from clobbering the index.
 * `scripts/store-roundtrip.mjs` is the same contract against a live store.
 */

class MemoryKV implements KV {
  map = new Map<string, { data: string; etag: string }>();
  writes = 0;
  async get(key: string) {
    return this.map.get(key)?.data ?? null;
  }
  async getWithMetadata(key: string) {
    return this.map.get(key) ?? null;
  }
  async set(key: string, value: string, o: { onlyIfMatch?: string; onlyIfNew?: boolean } = {}) {
    const cur = this.map.get(key);
    if (o.onlyIfNew && cur) return { modified: false };
    if (o.onlyIfMatch !== undefined && cur?.etag !== o.onlyIfMatch) return { modified: false };
    this.map.set(key, { data: value, etag: String(++this.writes) });
    return { modified: true };
  }
}

const UNIT = {
  format: "dwelling-unit",
  version: 1,
  name: "Unit 9",
  storeys: [
    { cells: [[2, 3], [3, 3], [2, 4]], edges: [], height: 3 },
    { cells: [[2, 3], [3, 3]], edges: [], height: 3 },
  ],
};
/** Pretty-printed on purpose: the store must hand these bytes back untouched. */
const UNIT_TEXT = JSON.stringify(UNIT, null, 2);

function call(kv: KV, method: string, path: string, body?: string) {
  return handleSession(new Request(`http://store.test${path}`, { method, body }), kv);
}
const put = (kv: KV, path: string, body: unknown) =>
  call(kv, "PUT", path, typeof body === "string" ? body : JSON.stringify(body));

describe("routing", () => {
  it("answers OPTIONS with open CORS and nothing else", async () => {
    const res = await call(new MemoryKV(), "OPTIONS", "/api/session/abc/flats/x");
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toBe("GET, PUT, OPTIONS");
    expect(res.headers.get("access-control-allow-headers")).toBe("content-type");
  });

  it("returns an empty session for a code nobody has used, with CORS on it", async () => {
    const res = await call(new MemoryKV(), "GET", "/api/session/Fresh-1");
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(await res.json()).toEqual({ code: "fresh-1", flats: [], residents: [], building: null });
  });

  it("rejects unknown routes, bad codes and wrong methods, each with a message", async () => {
    const kv = new MemoryKV();
    expect((await call(kv, "GET", "/api/session")).status).toBe(404);
    expect((await call(kv, "GET", "/api/session/abc/walls/1")).status).toBe(404);
    expect((await call(kv, "GET", "/api/session/a%20b")).status).toBe(400);
    expect((await call(kv, "GET", "/api/session/" + "x".repeat(33))).status).toBe(400);
    expect((await call(kv, "DELETE", "/api/session/abc")).status).toBe(405);
    expect((await call(kv, "GET", "/api/session/abc/residents/ana")).status).toBe(405);
    expect((await call(kv, "POST", "/api/session/abc/building")).status).toBe(405);
    const bad = await call(kv, "GET", "/api/session/abc/flats/no-such");
    expect(bad.status).toBe(404);
    expect((await bad.json()).error).toMatch(/no flat "no-such"/);
  });
});

describe("publishing a flat", () => {
  it("creates at version 1, replaces at version 2, and keeps the bytes", async () => {
    const kv = new MemoryKV();
    const first = await put(kv, "/api/session/abc/flats/u9?resident=Ana&label=Corner%20flat", UNIT_TEXT);
    expect(first.status).toBe(201);
    expect(await first.json()).toMatchObject({
      id: "u9",
      resident: "Ana",
      label: "Corner flat",
      version: 1,
      changed: true,
      bbox: [2, 3, 3, 4],
      floors: 2,
      areaCells: 5,
    });

    const second = await put(kv, "/api/session/abc/flats/u9?resident=Ana", UNIT_TEXT);
    expect(second.status).toBe(200);
    const s = await second.json();
    expect(s.version).toBe(2);
    expect(s.label).toBe("Unit 9"); // no label sent, so the unit's own name
    expect(s.changed).toBe(true);

    const back = await call(kv, "GET", "/api/session/abc/flats/u9");
    expect(back.status).toBe(200);
    expect(back.headers.get("content-type")).toMatch(/application\/json/);
    expect(await back.text()).toBe(UNIT_TEXT);

    const session = await (await call(kv, "GET", "/api/session/abc")).json();
    expect(session.flats).toHaveLength(1);
    expect(session.flats[0].version).toBe(2);
    expect(JSON.stringify(session)).not.toContain('"storeys"');
  });

  it("refuses a missing resident and a body that is not a dwelling-unit file", async () => {
    const kv = new MemoryKV();
    expect((await put(kv, "/api/session/abc/flats/u9", UNIT_TEXT)).status).toBe(400);
    expect((await put(kv, "/api/session/abc/flats/u9?resident=Ana", "not json")).status).toBe(400);
    expect((await put(kv, "/api/session/abc/flats/u9?resident=Ana", { format: "other" })).status).toBe(400);
    expect((await put(kv, "/api/session/abc/flats/u9?resident=Ana", { ...UNIT, storeys: [{ cells: [[1]] }] })).status).toBe(400);
    expect((await put(kv, "/api/session/abc/flats/bad%20id?resident=Ana", UNIT_TEXT)).status).toBe(400);
    expect((await call(kv, "GET", "/api/session/abc")).status).toBe(200);
    expect((await (await call(kv, "GET", "/api/session/abc")).json()).flats).toEqual([]);
  });
});

describe("a resident's wishes", () => {
  it("merges partial bodies and validates each field whole", async () => {
    const kv = new MemoryKV();
    const a = await put(kv, "/api/session/abc/residents/Ana%20B", { counts: { u9: 2 }, share: 0.3, ballot: ["laundry", "workshop"] });
    expect(a.status).toBe(200);
    expect(await a.json()).toEqual({ name: "Ana B", counts: { u9: 2 }, share: 0.3, ballot: ["laundry", "workshop"] });

    const b = await put(kv, "/api/session/abc/residents/Ana%20B", { share: 0.5 });
    expect(await b.json()).toEqual({ name: "Ana B", counts: { u9: 2 }, share: 0.5, ballot: ["laundry", "workshop"] });

    const c = await put(kv, "/api/session/abc/residents/Ben", {});
    expect(await c.json()).toEqual({ name: "Ben", counts: {}, share: null, ballot: [] });

    expect((await put(kv, "/api/session/abc/residents/Ben", { share: 1.5 })).status).toBe(400);
    expect((await put(kv, "/api/session/abc/residents/Ben", { counts: { u9: -1 } })).status).toBe(400);
    expect((await put(kv, "/api/session/abc/residents/Ben", { ballot: "laundry" })).status).toBe(400);
    expect((await put(kv, "/api/session/abc/residents/Ben", "[]")).status).toBe(400);
    expect((await put(kv, "/api/session/abc/residents/%20", {})).status).toBe(400);

    const session = await (await call(kv, "GET", "/api/session/abc")).json();
    expect(session.residents).toEqual([
      { name: "Ana B", counts: { u9: 2 }, share: 0.5, ballot: ["laundry", "workshop"] },
      { name: "Ben", counts: {}, share: null, ballot: [] },
    ]);
  });
});

describe("a building run", () => {
  it("is stored with a timestamp and clears changed on every flat until the next publish", async () => {
    const kv = new MemoryKV();
    await put(kv, "/api/session/abc/flats/u9?resident=Ana", UNIT_TEXT);
    await put(kv, "/api/session/abc/flats/u8?resident=Ben", UNIT_TEXT);
    expect((await (await call(kv, "GET", "/api/session/abc/building")).json())).toBeNull();

    const run = await put(kv, "/api/session/abc/building", { genome: [1, 2, 3], summary: { fitness: 0.8 }, by: "Ben" });
    expect(run.status).toBe(200);
    const stored = await run.json();
    expect(stored).toMatchObject({ genome: [1, 2, 3], summary: { fitness: 0.8 }, by: "Ben" });
    expect(Date.parse(stored.at)).not.toBeNaN();

    let session = await (await call(kv, "GET", "/api/session/abc")).json();
    expect(session.flats.map((f: { changed: boolean }) => f.changed)).toEqual([false, false]);
    expect(session.building).toEqual(stored);
    expect(await (await call(kv, "GET", "/api/session/abc/building")).json()).toEqual(stored);

    await put(kv, "/api/session/abc/flats/u9?resident=Ana", UNIT_TEXT);
    session = await (await call(kv, "GET", "/api/session/abc")).json();
    const byId = Object.fromEntries(session.flats.map((f: { id: string; changed: boolean }) => [f.id, f.changed]));
    expect(byId).toEqual({ u9: true, u8: false });

    expect((await put(kv, "/api/session/abc/building", "[]")).status).toBe(400);
  });
});

describe("two writers", () => {
  it("retries a write that lost the ETag race instead of overwriting", async () => {
    class RacingKV extends MemoryKV {
      raced = false;
      override async getWithMetadata(key: string) {
        const cur = await super.getWithMetadata(key);
        // Someone else's resident lands between this writer's read and write, once.
        if (cur && !this.raced) {
          this.raced = true;
          const other = JSON.parse(cur.data);
          other.residents.Ben = { counts: {}, share: 0.2, ballot: [] };
          await super.set(key, JSON.stringify(other));
        }
        return cur;
      }
    }
    const kv = new RacingKV();
    await put(kv, "/api/session/abc/residents/Ana", { share: 0.1 });
    const res = await put(kv, "/api/session/abc/residents/Ana", { share: 0.9 });
    expect(res.status).toBe(200);
    const session = await (await call(kv, "GET", "/api/session/abc")).json();
    expect(session.residents).toEqual([
      { name: "Ana", counts: {}, share: 0.9, ballot: [] },
      { name: "Ben", counts: {}, share: 0.2, ballot: [] },
    ]);
  });
});
