import { describe, it, expect } from "vitest";
import {
  SESSION_STORAGE_KEY,
  normalizeCode,
  isValidCode,
  readSession,
  writeSession,
  whyPublishDisabled,
  sessionLine,
  publishUnit,
  type KeyValue,
} from "./session";

/**
 * The session settings and the publish call (run 0023), without a browser:
 * a Map stands in for localStorage and a stub for fetch. What is pinned is
 * the storage key and shape, `?session=` winning over the stored code and
 * being stored, the refusals that keep Publish off, and that `publishUnit`
 * sends the unit bytes to the documented URL and never throws.
 */

class MemoryStorage implements KeyValue {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}

describe("codes", () => {
  it("lowercases and trims on the way in, matching the store", () => {
    expect(normalizeCode("  Room-42 ")).toBe("room-42");
  });
  it("accepts what the store accepts", () => {
    expect(isValidCode("room-42")).toBe(true);
    expect(isValidCode("a_b")).toBe(true);
    expect(isValidCode("")).toBe(false);
    expect(isValidCode("room 42")).toBe(false);
    expect(isValidCode("x".repeat(33))).toBe(false);
  });
});

describe("readSession — the localStorage key and ?session=", () => {
  it("reads empty settings when nothing is stored and storage is missing", () => {
    expect(readSession(new MemoryStorage(), "")).toEqual({ resident: "", code: "" });
    expect(readSession(null, "")).toEqual({ resident: "", code: "" });
  });

  it("stores under one key as {resident, code} and reads it back", () => {
    const s = new MemoryStorage();
    writeSession(s, { resident: "Ana", code: "room-42" });
    expect(s.map.get(SESSION_STORAGE_KEY)).toBe('{"resident":"Ana","code":"room-42"}');
    expect(readSession(s, "")).toEqual({ resident: "Ana", code: "room-42" });
  });

  it("lets ?session= win over the stored code, stores it, and keeps the name", () => {
    const s = new MemoryStorage();
    writeSession(s, { resident: "Ana", code: "room-42" });
    expect(readSession(s, "?session=Studio-7&project=x")).toEqual({ resident: "Ana", code: "studio-7" });
    expect(JSON.parse(s.map.get(SESSION_STORAGE_KEY)!)).toEqual({ resident: "Ana", code: "studio-7" });
  });

  it("ignores an empty ?session= and a corrupt stored value", () => {
    const s = new MemoryStorage();
    writeSession(s, { resident: "Ana", code: "room-42" });
    expect(readSession(s, "?session=").code).toBe("room-42");
    s.map.set(SESSION_STORAGE_KEY, "not json");
    expect(readSession(s, "")).toEqual({ resident: "", code: "" });
    s.map.set(SESSION_STORAGE_KEY, '{"resident":5,"code":"ROOM"}');
    expect(readSession(s, "")).toEqual({ resident: "", code: "room" });
  });
});

describe("whyPublishDisabled — publish is refused without a name or a code", () => {
  it("names the missing field", () => {
    expect(whyPublishDisabled({ resident: "", code: "" })).toMatch(/name and a session code/);
    expect(whyPublishDisabled({ resident: "  ", code: "room-42" })).toMatch(/name/);
    expect(whyPublishDisabled({ resident: "Ana", code: "" })).toMatch(/session code/);
    expect(whyPublishDisabled({ resident: "Ana", code: "room 42" })).toMatch(/1 to 32/);
  });
  it("is null when both are usable", () => {
    expect(whyPublishDisabled({ resident: "Ana", code: "room-42" })).toBeNull();
  });
  it("writes the top-bar line for every state", () => {
    expect(sessionLine({ resident: "", code: "" })).toBe("No session");
    expect(sessionLine({ resident: "Ana", code: "" })).toBe("No session · Ana");
    expect(sessionLine({ resident: "", code: "room-42" })).toBe("Session room-42");
    expect(sessionLine({ resident: "Ana ", code: "room-42" })).toBe("Session room-42 · Ana");
  });
});

describe("publishUnit — the call the fourth output makes", () => {
  const settings = { resident: "Ana B", code: "room-42" };
  const bytes = '{\n  "format": "dwelling-unit",\n  "version": 1\n}';

  /** A fetch stub that records the one call and answers as told. */
  function stub(status: number, body: string) {
    const calls: { url: string; init: { method: string; headers: Record<string, string>; body: string } }[] = [];
    const fetchFn = async (url: string, init: (typeof calls)[number]["init"]) => {
      calls.push({ url, init });
      return new Response(body, { status, headers: { "content-type": "application/json" } });
    };
    return { calls, fetchFn };
  }

  it("PUTs the unit bytes to the documented URL with resident and label in the query", async () => {
    const { calls, fetchFn } = stub(201, '{"id":"unit-4","resident":"Ana B","label":"Unit 4","version":1,"changed":true}');
    const r = await publishUnit(fetchFn, "https://x.test", settings, "unit-4", "Unit 4", bytes);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://x.test/api/session/room-42/flats/unit-4?resident=Ana+B&label=Unit+4");
    expect(calls[0].init.method).toBe("PUT");
    expect(calls[0].init.headers["content-type"]).toBe("application/json");
    expect(calls[0].init.body).toBe(bytes);
    expect(r).toEqual({ ok: true, id: "unit-4", label: "Unit 4", version: 1, changed: true });
  });

  it("reports a replace as its new version", async () => {
    const { fetchFn } = stub(200, '{"id":"unit-4","label":"Unit 4","version":2,"changed":true}');
    const r = await publishUnit(fetchFn, "", settings, "unit-4", "Unit 4", bytes);
    expect(r).toMatchObject({ ok: true, version: 2 });
  });

  it("carries the store's own reason on a refusal, and the status", async () => {
    const { fetchFn } = stub(400, '{"error":"?resident= is required: who is publishing"}');
    const r = await publishUnit(fetchFn, "", settings, "unit-4", "Unit 4", bytes);
    expect(r).toEqual({ ok: false, status: 400, reason: "?resident= is required: who is publishing" });
  });

  it("falls back to the body text when the failure is not JSON", async () => {
    const { fetchFn } = stub(502, "<html>Bad Gateway</html>");
    const r = await publishUnit(fetchFn, "", settings, "unit-4", "Unit 4", bytes);
    expect(r).toEqual({ ok: false, status: 502, reason: "<html>Bad Gateway</html>" });
  });

  it("never throws on a network failure: status 0 and the error's message", async () => {
    const fetchFn = async () => {
      throw new TypeError("Failed to fetch");
    };
    const r = await publishUnit(fetchFn, "", settings, "unit-4", "Unit 4", bytes);
    expect(r).toEqual({ ok: false, status: 0, reason: "Failed to fetch" });
  });

  it("treats a 200 without a version as a failure rather than a publish", async () => {
    const { fetchFn } = stub(200, "{}");
    const r = await publishUnit(fetchFn, "", settings, "unit-4", "Unit 4", bytes);
    expect(r).toMatchObject({ ok: false, status: 200 });
  });
});
