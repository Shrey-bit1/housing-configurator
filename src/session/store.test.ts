import { describe, it, expect } from "vitest";
import { handleSession, sameResident, type KV } from "./store";

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
/** A binary call, for the preview endpoint: `call` is string-bodied only. */
function callBinary(kv: KV, method: string, path: string, body?: Uint8Array) {
  return handleSession(new Request(`http://store.test${path}`, { method, body: body as BodyInit }), kv);
}

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

  it("new flat: preview defaults false", async () => {
    const res = await put(new MemoryKV(), "/api/session/abc/flats/u9?resident=Ana", UNIT_TEXT);
    expect((await res.json()).preview).toBe(false);
  });
});

describe("sameResident", () => {
  it("is trimmed and case-insensitive; empty names are equal only to empty", () => {
    expect(sameResident("Ana", "Ana")).toBe(true);
    expect(sameResident("ana", "Ana")).toBe(true);
    expect(sameResident("  Ana  ", "Ana")).toBe(true);
    expect(sameResident("", "")).toBe(true);
    expect(sameResident("", "Ana")).toBe(false);
    expect(sameResident("Ana", "Ben")).toBe(false);
  });
});

describe("a flat belongs to whoever published it", () => {
  it("refuses a different resident's PUT with 409 and the owner's name", async () => {
    const kv = new MemoryKV();
    await put(kv, "/api/session/abc/flats/u9?resident=Ana", UNIT_TEXT);
    const res = await put(kv, "/api/session/abc/flats/u9?resident=Ben", UNIT_TEXT);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.resident).toBe("Ana");
    expect(body.error).toMatch(/published by Ana/);
    expect(body.error).toMatch(/\?replace=1/);
    // The refusal must not have touched the flat: still Ana's, still version 1.
    const state = await (await call(kv, "GET", "/api/session/abc")).json();
    expect(state.flats).toEqual([expect.objectContaining({ id: "u9", resident: "Ana", version: 1 })]);
  });

  it("the SAME resident republishes without needing replace, as before", async () => {
    const kv = new MemoryKV();
    await put(kv, "/api/session/abc/flats/u9?resident=Ana", UNIT_TEXT);
    const res = await put(kv, "/api/session/abc/flats/u9?resident=Ana", UNIT_TEXT);
    expect(res.status).toBe(200);
    expect((await res.json()).version).toBe(2);
  });

  it("a case-different republish is the same resident too (run 0026)", async () => {
    const kv = new MemoryKV();
    await put(kv, "/api/session/abc/flats/u9?resident=Ben", UNIT_TEXT);
    const res = await put(kv, "/api/session/abc/flats/u9?resident=ben", UNIT_TEXT);
    expect(res.status).toBe(200);
    const s = await res.json();
    expect(s.version).toBe(2);
    // The name as typed is what gets recorded — only the COMPARISON folded case.
    expect(s.resident).toBe("ben");
  });

  it("?replace=1 lets a different resident take a flat over", async () => {
    const kv = new MemoryKV();
    await put(kv, "/api/session/abc/flats/u9?resident=Ana", UNIT_TEXT);
    const res = await put(kv, "/api/session/abc/flats/u9?resident=Ben&replace=1", UNIT_TEXT);
    expect(res.status).toBe(200);
    const s = await res.json();
    expect(s.resident).toBe("Ben");
    expect(s.version).toBe(2);
    // Ben owns it now: a THIRD resident is refused in turn without their own replace.
    const third = await put(kv, "/api/session/abc/flats/u9?resident=Cy", UNIT_TEXT);
    expect(third.status).toBe(409);
    expect((await third.json()).resident).toBe("Ben");
  });

  it("a new id has no owner to conflict with", async () => {
    const res = await put(new MemoryKV(), "/api/session/abc/flats/u9?resident=Ana", UNIT_TEXT);
    expect(res.status).toBe(201);
  });
});

describe("a resident's wishes", () => {
  it("merges partial bodies and validates each field whole", async () => {
    const kv = new MemoryKV();
    const a = await put(kv, "/api/session/abc/residents/Ana%20B", { counts: { u9: 2 }, share: 0.3, ballot: ["laundry", "workshop"] });
    expect(a.status).toBe(200);
    expect(await a.json()).toEqual({ name: "Ana B", counts: { u9: 2 }, share: 0.3, ballot: ["laundry", "workshop"], shareM2: null, extraM2: null });

    const b = await put(kv, "/api/session/abc/residents/Ana%20B", { share: 0.5 });
    expect(await b.json()).toEqual({ name: "Ana B", counts: { u9: 2 }, share: 0.5, ballot: ["laundry", "workshop"], shareM2: null, extraM2: null });

    const c = await put(kv, "/api/session/abc/residents/Ben", {});
    expect(await c.json()).toEqual({ name: "Ben", counts: {}, share: null, ballot: [], shareM2: null, extraM2: null });

    expect((await put(kv, "/api/session/abc/residents/Ben", { share: 1.5 })).status).toBe(400);
    expect((await put(kv, "/api/session/abc/residents/Ben", { counts: { u9: -1 } })).status).toBe(400);
    expect((await put(kv, "/api/session/abc/residents/Ben", { ballot: "laundry" })).status).toBe(400);
    expect((await put(kv, "/api/session/abc/residents/Ben", "[]")).status).toBe(400);
    expect((await put(kv, "/api/session/abc/residents/%20", {})).status).toBe(400);

    const session = await (await call(kv, "GET", "/api/session/abc")).json();
    expect(session.residents).toEqual([
      { name: "Ana B", counts: { u9: 2 }, share: 0.5, ballot: ["laundry", "workshop"], shareM2: null, extraM2: null },
      { name: "Ben", counts: {}, share: null, ballot: [], shareM2: null, extraM2: null },
    ]);
  });
});

describe("the two square-metre answers (run 0030)", () => {
  it("reads back null on both when the resident has never been written", async () => {
    const kv = new MemoryKV();
    const r = await put(kv, "/api/session/abc/residents/Cara", {});
    expect(await r.json()).toEqual({
      name: "Cara", counts: {}, share: null, ballot: [], shareM2: null, extraM2: null,
    });
  });

  it("merges a body carrying only shareM2 and leaves counts and ballot alone", async () => {
    const kv = new MemoryKV();
    await put(kv, "/api/session/abc/residents/Ana", { counts: { u9: 2 }, ballot: ["garden"] });
    const r = await put(kv, "/api/session/abc/residents/Ana", { shareM2: 7 });
    expect(await r.json()).toEqual({
      name: "Ana", counts: { u9: 2 }, share: null, ballot: ["garden"], shareM2: 7, extraM2: null,
    });
  });

  it("accepts zero and null, which are different answers", async () => {
    const kv = new MemoryKV();
    const zero = await put(kv, "/api/session/abc/residents/Ana", { shareM2: 0, extraM2: 0 });
    expect(zero.status).toBe(200);
    expect(await zero.json()).toMatchObject({ shareM2: 0, extraM2: 0 });
    // Zero is "I answered, and my answer is none of it". Null is "I never
    // answered". The building app's median has to be able to tell them apart.
    const back = await put(kv, "/api/session/abc/residents/Ana", { shareM2: null });
    expect(await back.json()).toMatchObject({ shareM2: null, extraM2: 0 });
  });

  it("refuses a negative, a fraction and a string, on either key", async () => {
    const kv = new MemoryKV();
    for (const key of ["shareM2", "extraM2"]) {
      for (const bad of [-1, 7.5, "7"]) {
        const r = await put(kv, "/api/session/abc/residents/Ana", { [key]: bad });
        expect(r.status, `${key} = ${JSON.stringify(bad)}`).toBe(400);
        expect(await r.text()).toContain(`${key} must be a whole number of square metres`);
      }
    }
  });

  it("carries both fields through the export as well as the poll", async () => {
    const kv = new MemoryKV();
    await put(kv, "/api/session/abc/residents/Ana", { shareM2: 7, extraM2: 5 });
    const polled = await (await call(kv, "GET", "/api/session/abc")).json();
    expect(polled.residents).toEqual([
      { name: "Ana", counts: {}, share: null, ballot: [], shareM2: 7, extraM2: 5 },
    ]);
    const exported = await (await call(kv, "GET", "/api/session/abc/export")).json();
    expect(exported.residents).toEqual(polled.residents);
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

  it("carries an opaque plot (run 0026), optional and rejected only if not an object", async () => {
    const kv = new MemoryKV();
    const plot = { modulesX: 11, modulesY: 11, floors: 7 };
    const run = await put(kv, "/api/session/abc/building", { genome: [1], summary: null, by: "Ben", plot });
    expect(run.status).toBe(200);
    expect((await run.json()).plot).toEqual(plot);
    const session = await (await call(kv, "GET", "/api/session/abc")).json();
    expect(session.building.plot).toEqual(plot);

    // No plot at all: still fine, and the field is simply absent.
    const noPlot = await put(kv, "/api/session/abc/building", { genome: [1], summary: null, by: "Ben" });
    expect(noPlot.status).toBe(200);
    expect("plot" in (await noPlot.json())).toBe(false);

    // A plot that is not a JSON object: 400, whether an array or a scalar.
    expect((await put(kv, "/api/session/abc/building", { genome: [1], summary: null, by: "Ben", plot: [1, 2] })).status).toBe(400);
    expect((await put(kv, "/api/session/abc/building", { genome: [1], summary: null, by: "Ben", plot: "flat" })).status).toBe(400);
  });
});

describe("a session leaves as one file", () => {
  it("exports the state the poll returns plus every flat body, byte for byte", async () => {
    const kv = new MemoryKV();
    await put(kv, "/api/session/abc/flats/u9?resident=Ana", UNIT_TEXT);
    await put(kv, "/api/session/abc/flats/u8?resident=Ben&label=Terrace", UNIT_TEXT.replace("Unit 9", "Unit 8"));
    await put(kv, "/api/session/abc/residents/Ana", { share: 0.4 });
    await put(kv, "/api/session/abc/building", { genome: [1], summary: null, by: "Ana" });

    const res = await call(kv, "GET", "/api/session/abc/export");
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const out = await res.json();
    const state = await (await call(kv, "GET", "/api/session/abc")).json();
    expect(out.code).toBe("abc");
    expect(out.flats).toEqual(state.flats);
    expect(out.residents).toEqual(state.residents);
    expect(out.building).toEqual(state.building);
    expect(out.bodies).toEqual({ u9: UNIT_TEXT, u8: UNIT_TEXT.replace("Unit 9", "Unit 8") });
    expect(Date.parse(out.exportedAt)).not.toBeNaN();

    expect((await call(kv, "PUT", "/api/session/abc/export", "{}")).status).toBe(405);
    const empty = await (await call(kv, "GET", "/api/session/nobody/export")).json();
    expect(empty).toMatchObject({ code: "nobody", flats: [], residents: [], building: null, bodies: {} });
  });
});

describe("a flat has a picture", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

  it("refuses a preview for a flat that has never been published", async () => {
    const res = await callBinary(new MemoryKV(), "PUT", "/api/session/abc/flats/u9/preview", jpeg);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/no flat "u9"/);
  });

  it("stores the preview, marks the flat, and returns the same bytes on GET", async () => {
    const kv = new MemoryKV();
    await put(kv, "/api/session/abc/flats/u9?resident=Ana", UNIT_TEXT);

    const put1 = await callBinary(kv, "PUT", "/api/session/abc/flats/u9/preview", jpeg);
    expect(put1.status).toBe(200);
    expect(await put1.json()).toEqual({ ok: true, bytes: jpeg.length });

    const state = await (await call(kv, "GET", "/api/session/abc")).json();
    expect(state.flats[0].preview).toBe(true);

    const got = await callBinary(kv, "GET", "/api/session/abc/flats/u9/preview");
    expect(got.status).toBe(200);
    expect(got.headers.get("content-type")).toBe("image/jpeg");
    expect(got.headers.get("access-control-allow-origin")).toBe("*");
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(jpeg);
  });

  it("404s a preview nobody sent, refuses an empty body and the wrong method", async () => {
    const kv = new MemoryKV();
    await put(kv, "/api/session/abc/flats/u9?resident=Ana", UNIT_TEXT);
    expect((await callBinary(kv, "GET", "/api/session/abc/flats/u9/preview")).status).toBe(404);
    expect((await callBinary(kv, "PUT", "/api/session/abc/flats/u9/preview", new Uint8Array())).status).toBe(400);
    expect((await callBinary(kv, "POST", "/api/session/abc/flats/u9/preview", jpeg)).status).toBe(405);
    expect((await call(kv, "GET", "/api/session/abc/flats/u9/preview/extra")).status).toBe(404);
  });

  it("survives a republish: the OLD preview stays flagged until a new one lands", async () => {
    const kv = new MemoryKV();
    await put(kv, "/api/session/abc/flats/u9?resident=Ana", UNIT_TEXT);
    await callBinary(kv, "PUT", "/api/session/abc/flats/u9/preview", jpeg);
    await put(kv, "/api/session/abc/flats/u9?resident=Ana", UNIT_TEXT); // version 2
    const state = await (await call(kv, "GET", "/api/session/abc")).json();
    expect(state.flats[0]).toMatchObject({ version: 2, preview: true });
  });
});

describe("two writers", () => {
  it("retries a write that lost the ETag race instead of overwriting", async () => {
    class RacingKV extends MemoryKV {
      raced = false;
      override async getWithMetadata(key: string) {
        const cur = await super.getWithMetadata(key);
        // Someone else's resident lands between this writer's read and write, once.
        // It goes straight into the index rather than through the merge, so it
        // is written with the THREE keys a record had before run 0030 — which
        // is exactly what a record already sitting in a live store looks like.
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
      { name: "Ana", counts: {}, share: 0.9, ballot: [], shareM2: null, extraM2: null },
      // Ben keeps the shape he was written with. The store reads a record back
      // as it found it and does not backfill, so an old record stays readable
      // and its two missing keys simply read as absent rather than as zero.
      { name: "Ben", counts: {}, share: 0.2, ballot: [] },
    ]);
  });
});
