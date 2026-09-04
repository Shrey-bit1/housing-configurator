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
  publishPreview,
  takeoverConfirmText,
  decideTakeover,
  type KeyValue,
  type PublishResult,
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

describe("joining a group from the landing (run 0027)", () => {
  /** What the landing's join form does on submit, in `main.ts`: normalise the
   *  code, refuse through the same `whyPublishDisabled` the send panel uses,
   *  then write through the same `writeSession`. Restated here as the three
   *  calls rather than imported, since the form itself is DOM wiring. */
  function join(storage: KeyValue, code: string, resident: string): string | null {
    const next = { resident, code: normalizeCode(code) };
    const why = whyPublishDisabled(next);
    if (why !== null) return why;
    writeSession(storage, next);
    return null;
  }

  it("leaves state the send panel's own fields read back identically", () => {
    const s = new MemoryStorage();
    expect(join(s, "  Room-42 ", "Ana")).toBeNull();
    // The same helper the panel reads on load, against the same one key.
    expect(readSession(s, "")).toEqual({ resident: "Ana", code: "room-42" });
    expect(s.map.get(SESSION_STORAGE_KEY)).toBe('{"resident":"Ana","code":"room-42"}');
  });

  it("refuses a code the store would refuse, and writes nothing", () => {
    const s = new MemoryStorage();
    expect(join(s, "room 42", "Ana")).toMatch(/1 to 32/);
    expect(join(s, "room-42", "  ")).toMatch(/name/);
    expect(s.map.size).toBe(0);
  });
});

describe("whyPublishDisabled — publish is refused without a name or a code", () => {
  it("names the missing field, in group wording (run 0026)", () => {
    expect(whyPublishDisabled({ resident: "", code: "" })).toMatch(/name and a group code/);
    expect(whyPublishDisabled({ resident: "  ", code: "room-42" })).toMatch(/name/);
    expect(whyPublishDisabled({ resident: "Ana", code: "" })).toMatch(/group code/);
    expect(whyPublishDisabled({ resident: "Ana", code: "room 42" })).toMatch(/1 to 32/);
  });
  it("is null when both are usable", () => {
    expect(whyPublishDisabled({ resident: "Ana", code: "room-42" })).toBeNull();
  });
  it("writes the top-bar line for every state, in group wording (run 0026)", () => {
    expect(sessionLine({ resident: "", code: "" })).toBe("No group");
    expect(sessionLine({ resident: "Ana", code: "" })).toBe("No group · Ana");
    expect(sessionLine({ resident: "", code: "room-42" })).toBe("Group room-42");
    expect(sessionLine({ resident: "Ana ", code: "room-42" })).toBe("Group room-42 · Ana");
  });
});

describe("publishUnit — the call the fourth output makes", () => {
  const settings = { resident: "Ana B", code: "room-42" };
  const bytes = '{\n  "format": "dwelling-unit",\n  "version": 1\n}';

  /** A fetch stub that records the one call and answers as told. */
  function stub(status: number, body: string) {
    const calls: { url: string; init: { method: string; headers: Record<string, string>; body: BodyInit } }[] = [];
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

  it("carries the owner's name on a 409, for the dialog to show", async () => {
    const { calls, fetchFn } = stub(409, '{"error":"\\"unit-4\\" was published by Ben; add ?replace=1 to take it over","resident":"Ben"}');
    const r = await publishUnit(fetchFn, "", settings, "unit-4", "Unit 4", bytes);
    expect(r).toEqual({ ok: false, status: 409, reason: expect.stringContaining("Ben"), ownerResident: "Ben" });
    expect(calls[0].url).not.toContain("replace");
  });

  it("does not set ownerResident on a non-409 failure, even if the body carries a resident field", async () => {
    const { fetchFn } = stub(400, '{"error":"bad request","resident":"Ben"}');
    const r = await publishUnit(fetchFn, "", settings, "unit-4", "Unit 4", bytes);
    expect((r as { ownerResident?: string }).ownerResident).toBeUndefined();
  });

  it("adds &replace=1 only when asked", async () => {
    const { calls, fetchFn } = stub(200, '{"id":"unit-4","label":"Unit 4","version":2,"changed":true}');
    await publishUnit(fetchFn, "", settings, "unit-4", "Unit 4", bytes, true);
    expect(calls[0].url).toContain("replace=1");
  });
});

describe("publishPreview — the call that sends a flat's picture", () => {
  /** A fetch stub over PreviewPublishResult's needs: records the call, answers as told. */
  function stub(status: number, body: string) {
    const calls: { url: string; init: { method: string; headers: Record<string, string>; body: BodyInit } }[] = [];
    const fetchFn = async (url: string, init: (typeof calls)[number]["init"]) => {
      calls.push({ url, init });
      return new Response(body, { status, headers: { "content-type": "application/json" } });
    };
    return { calls, fetchFn };
  }
  const jpeg = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });

  it("PUTs the JPEG to the documented URL with the image content type", async () => {
    const { calls, fetchFn } = stub(200, '{"ok":true,"bytes":3}');
    const r = await publishPreview(fetchFn, "https://x.test", "room-42", "unit-4", jpeg);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://x.test/api/session/room-42/flats/unit-4/preview");
    expect(calls[0].init.method).toBe("PUT");
    expect(calls[0].init.headers["content-type"]).toBe("image/jpeg");
    expect(calls[0].init.body).toBe(jpeg);
    expect(r).toEqual({ ok: true });
  });

  it("carries the store's own reason on a refusal", async () => {
    const { fetchFn } = stub(404, '{"error":"no flat \\"unit-4\\" in session \\"room-42\\""}');
    const r = await publishPreview(fetchFn, "", "room-42", "unit-4", jpeg);
    expect(r).toEqual({ ok: false, reason: 'no flat "unit-4" in session "room-42"' });
  });

  it("never throws on a network failure", async () => {
    const fetchFn = async () => {
      throw new TypeError("Failed to fetch");
    };
    const r = await publishPreview(fetchFn, "", "room-42", "unit-4", jpeg);
    expect(r).toEqual({ ok: false, reason: "Failed to fetch" });
  });
});

describe("takeoverConfirmText — the wording Save asks before a takeover", () => {
  it("names the owner", () => {
    expect(takeoverConfirmText("Ana")).toBe("This flat belongs to Ana. Take it over?");
    expect(takeoverConfirmText("Ben")).toBe("This flat belongs to Ben. Take it over?");
  });
});

describe("decideTakeover — what runSave does after a 409, without a DOM", () => {
  const conflict: PublishResult = { ok: false, status: 409, reason: "…", ownerResident: "Ana" };
  const success: PublishResult = { ok: true, id: "unit-6", label: "Unit 6", version: 1, changed: true };
  const otherFailure: PublishResult = { ok: false, status: 500, reason: "boom" };
  const conflictNoOwner: PublishResult = { ok: false, status: 409, reason: "…" };

  it("retries when Replace is ticked and the confirm is accepted", () => {
    expect(decideTakeover(conflict, true, true)).toEqual({ action: "retry" });
  });

  it("declines with a line naming the owner, sends nothing further", () => {
    expect(decideTakeover(conflict, true, false)).toEqual({
      action: "declined",
      detail: "not published — you chose not to take over Ana's flat",
    });
  });

  it("proceeds (reports the 409 as-is) when Replace was never ticked, confirm or not", () => {
    expect(decideTakeover(conflict, false, true)).toEqual({ action: "proceed" });
    expect(decideTakeover(conflict, false, false)).toEqual({ action: "proceed" });
  });

  it("proceeds for a success — there is nothing to decide", () => {
    expect(decideTakeover(success, true, true)).toEqual({ action: "proceed" });
  });

  it("proceeds for a non-409 failure, even with Replace ticked", () => {
    expect(decideTakeover(otherFailure, true, true)).toEqual({ action: "proceed" });
  });

  it("proceeds for a 409 that names no owner", () => {
    expect(decideTakeover(conflictNoOwner, true, true)).toEqual({ action: "proceed" });
  });
});
