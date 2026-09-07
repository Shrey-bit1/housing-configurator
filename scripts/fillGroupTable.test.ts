import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
// @ts-expect-error plain JS beside a plain JS script; see the module's own header.
import { RESIDENTS, MESSAGES, SHARED, SHARE_MIN, SHARE_MAX, flatIdFor } from "./fillGroupTable.mjs";

/**
 * The twenty `scripts/fill-group.mjs` fills a group with (run 0038).
 *
 * The table is what makes the filled group look like twenty people rather than
 * one person twenty times, and it is easy to get subtly wrong by hand: a name
 * repeated, a ballot missing one of the five, a square-metre figure outside the
 * range the building app's slider offers. Every one of those would only show up
 * as a group that reads oddly, long after the run that made it.
 *
 * The script itself is not imported here. Importing it would fill a group.
 */

interface Resident {
  name: string;
  file: string;
  shareM2: number;
  extraM2: number;
  ballot: string[];
  wishes: { corner: boolean; terrace: boolean; quiet: boolean };
}
const people = RESIDENTS as Resident[];

describe("the twenty", () => {
  it("are twenty", () => {
    expect(people).toHaveLength(20);
  });

  it("have twenty different names", () => {
    expect(new Set(people.map((r) => r.name)).size).toBe(20);
  });

  it("are ordinary first names, nothing a store would refuse", () => {
    for (const r of people) {
      expect(r.name.trim(), `"${r.name}" is not padded`).toBe(r.name);
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.name.length).toBeLessThanOrEqual(64);
      // The store's own rule for a resident name: nothing a terminal swallows.
      expect(/[\p{C}]/u.test(r.name), `"${r.name}" is printable`).toBe(false);
    }
  });

  it("take twenty different flats, and they are the twenty designed ones", () => {
    expect(new Set(people.map((r) => r.file)).size).toBe(20);
    expect(people.map((r) => r.file)).toEqual(
      Array.from({ length: 20 }, (_, i) => `unit-${i + 8}`)
    );
  });

  it("send under twenty different ids, one per flat", () => {
    const ids = people.map((r) => {
      const file = JSON.parse(
        readFileSync(new URL(`../public/units/${r.file}.json`, import.meta.url), "utf8")
      ) as { name: string };
      return flatIdFor(file.name);
    });
    expect(new Set(ids).size).toBe(20);
    for (const id of ids) expect(id, `"${id}" is a store-legal flat id`).toMatch(/^[a-z0-9-]{1,64}$/);
  });
});

describe("their answers", () => {
  it("ask for a square-metre figure inside the range", () => {
    for (const r of people) {
      expect(r.shareM2, `${r.name}'s shareM2`).toBeGreaterThanOrEqual(SHARE_MIN);
      expect(r.shareM2, `${r.name}'s shareM2`).toBeLessThanOrEqual(SHARE_MAX);
      expect(Number.isInteger(r.shareM2)).toBe(true);
    }
  });

  it("offer an extra figure the store will take, whole and not negative", () => {
    for (const r of people) {
      expect(Number.isInteger(r.extraM2), `${r.name}'s extraM2`).toBe(true);
      expect(r.extraM2).toBeGreaterThanOrEqual(0);
      expect(r.extraM2).toBeLessThanOrEqual(SHARE_MAX);
    }
  });

  it("do not all ask for the same thing, which would tell the building nothing", () => {
    expect(new Set(people.map((r) => r.shareM2)).size).toBeGreaterThan(5);
    expect(new Set(people.map((r) => r.ballot.join(","))).size).toBeGreaterThan(5);
    expect(new Set(people.map((r) => JSON.stringify(r.wishes))).size).toBeGreaterThan(4);
  });

  it("each rank all five shared spaces, once each", () => {
    for (const r of people) {
      expect(r.ballot, `${r.name}'s ballot`).toHaveLength(5);
      expect([...r.ballot].sort()).toEqual([...SHARED].sort());
    }
  });

  it("do not put the same space first twenty times", () => {
    expect(new Set(people.map((r) => r.ballot[0])).size).toBe(5);
  });

  it("answer all three wishes, as booleans, the way the store insists", () => {
    for (const r of people) {
      expect(Object.keys(r.wishes).sort()).toEqual(["corner", "quiet", "terrace"]);
      for (const v of Object.values(r.wishes)) expect(typeof v).toBe("boolean");
    }
  });

  it("set every wish both ways across the twenty", () => {
    for (const key of ["corner", "terrace", "quiet"] as const) {
      const values = new Set(people.map((r) => r.wishes[key]));
      expect(values, `${key} is set both ways`).toEqual(new Set([true, false]));
    }
  });
});

describe("what the room says", () => {
  it("is a few things from different people, so it is not silent and not one voice", () => {
    expect(MESSAGES.length).toBeGreaterThanOrEqual(2);
    expect(new Set((MESSAGES as { who: string }[]).map((m) => m.who)).size).toBe(MESSAGES.length);
  });

  it("is said by people who are in the group", () => {
    const names = new Set(people.map((r) => r.name));
    for (const m of MESSAGES as { who: string }[]) expect(names.has(m.who), `${m.who} is one of the twenty`).toBe(true);
  });

  it("is within what the store accepts", () => {
    for (const m of MESSAGES as { who: string; text: string }[]) {
      expect(m.text.length).toBeGreaterThan(0);
      expect(m.text.length).toBeLessThanOrEqual(500);
    }
  });
});

describe("the script itself", () => {
  const source = readFileSync(new URL("./fill-group.mjs", import.meta.url), "utf8");

  it("refuses a group that already holds flats unless --replace", () => {
    expect(source).toContain("if (held > 0 && !replace) {");
    expect(source).toContain("Pass --replace to fill it anyway");
  });

  it("writes only through the store's public calls", () => {
    for (const call of [
      'call("POST", "")',
      "`/flats/${flat.id}${q}`",
      "/preview`",
      "`/residents/${encodeURIComponent(r.name)}`",
      'call("POST", "/messages"',
    ]) {
      expect(source, `it makes the ${call} call`).toContain(call);
    }
    // Nothing that reaches around the store.
    expect(source).not.toContain("writeFileSync");
    expect(source).not.toContain("index.json");
  });

  it("does not exit hard, so a closing socket cannot abort it", () => {
    expect(source).not.toContain("process.exit(");
    expect(source).toContain("process.exitCode");
  });
});
