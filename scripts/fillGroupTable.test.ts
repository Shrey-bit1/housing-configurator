import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
// @ts-expect-error plain JS beside a plain JS script; see the module's own header.
import {
  RESIDENTS,
  MESSAGES,
  SHARED,
  SHARE_MIN,
  SHARE_MAX,
  REASONS,
  CHANGES_MIND,
  FILLED_BY,
  FILLED_FOR_A_TEST,
  voteFor,
  firstPreference,
  followChance,
  chanceFor,
  otherThought,
  ballotFor,
  flatIdFor,
} from "./fillGroupTable.mjs";

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

/**
 * The vote (run 0041). What `scripts/vote-group.mjs` has the twenty do on an
 * open round.
 *
 * The pick rule is pure and lives in the table's file, so the whole count is a
 * property of data that can be checked without a store: a round of five pairs
 * is built here, one per dial, and the rule is driven over it. The runner is
 * read as text for the same reason `fill-group.mjs` is: importing it would
 * vote in a group.
 */

interface Voter extends Resident {
  cares: string[];
}
const voters = RESIDENTS as Voter[];
const round = (REASONS as string[]).map((dial, i) => ({ id: `p${i + 1}`, dial }));

describe("what the twenty care about", () => {
  it("is a ranking of all five reasons, for each of them", () => {
    for (const r of voters) {
      expect([...r.cares].sort(), `${r.name} ranks all five`).toEqual([...(REASONS as string[])].sort());
    }
  });

  it("is twenty different rankings", () => {
    expect(new Set(voters.map((r) => r.cares.join("|"))).size).toBe(20);
  });

  it("puts each reason first exactly four times", () => {
    for (const reason of REASONS as string[]) {
      expect(voters.filter((r) => r.cares[0] === reason).length, `${reason} is first`).toBe(4);
    }
  });

  it("puts each reason in a top two exactly eight times, which is what splits a pair 8 to 12", () => {
    for (const reason of REASONS as string[]) {
      expect(voters.filter((r) => r.cares.slice(0, 2).includes(reason)).length, `${reason} is top two`).toBe(8);
    }
  });
});

describe("the pick rule", () => {
  it("picks the challenger and ticks the dial when the dial is a top-two care", () => {
    const ana = voters[0];
    expect(ana.cares.slice(0, 2)).toEqual(["privacy", "shared space"]);
    expect(voteFor(ana, { id: "p1", dial: "privacy" })).toEqual({ pick: "b", reasons: ["privacy"] });
    expect(voteFor(ana, { id: "p2", dial: "shared space" })).toEqual({ pick: "b", reasons: ["shared space"] });
  });

  it("keeps the building they had and ticks their own first care otherwise", () => {
    const ana = voters[0];
    expect(voteFor(ana, { id: "p3", dial: "cost" })).toEqual({ pick: "a", reasons: ["privacy"] });
    expect(voteFor(ana, { id: "p5", dial: "short walks" })).toEqual({ pick: "a", reasons: ["privacy"] });
  });

  it("ticks exactly one of the five, whichever way it goes", () => {
    for (const r of voters) {
      for (const pair of round) {
        const v = voteFor(r, pair);
        expect(v.reasons, `${r.name} on ${pair.id}`).toHaveLength(1);
        expect(REASONS as string[]).toContain(v.reasons[0]);
        expect(["a", "b"]).toContain(v.pick);
      }
    }
  });

  it("splits every pair of a five-pair round 8 for the challenger and 12 for the building they had", () => {
    for (const pair of round) {
      const b = voters.filter((r) => voteFor(r, pair).pick === "b").length;
      expect(b, `${pair.id} (${pair.dial})`).toBe(8);
      expect(voters.length - b).toBe(12);
    }
  });

  it("does not give one person the same answer on all five pairs", () => {
    for (const r of voters) {
      const picks = new Set(round.map((p) => voteFor(r, p).pick));
      expect(picks.size, `${r.name} does not vote one way five times`).toBe(2);
    }
  });

  it("is the same on two runs, because nothing in it is random", () => {
    const once = voters.map((r) => round.map((p) => voteFor(r, p).pick).join(""));
    const twice = voters.map((r) => round.map((p) => voteFor(r, p).pick).join(""));
    expect(once).toEqual(twice);
  });
});

describe("the four who change their mind", () => {
  it("are four, named, and all of them are in the group", () => {
    expect(CHANGES_MIND).toHaveLength(4);
    expect(CHANGES_MIND).toEqual(["Bruno", "Elin", "Rosa", "Viktor"]);
    for (const name of CHANGES_MIND as string[]) {
      expect(voters.some((r) => r.name === name), `${name} is one of the twenty`).toBe(true);
    }
  });

  it("really change their pick, never say the same thing twice", () => {
    for (const name of CHANGES_MIND as string[]) {
      const r = voters.find((v) => v.name === name)!;
      const settled = voteFor(r, round[0]);
      const first = otherThought(r, round[0]);
      expect(first.pick, `${name} changes pick`).not.toBe(settled.pick);
    }
  });

  it("cast one extra vote each, on the round's first pair only", () => {
    for (const name of CHANGES_MIND as string[]) {
      const r = voters.find((v) => v.name === name)!;
      const ballot = ballotFor(r, round) as { pair: string; replaced: boolean }[];
      expect(ballot, `${name} casts six votes on five pairs`).toHaveLength(6);
      const extra = ballot.filter((v) => v.replaced);
      expect(extra).toHaveLength(1);
      expect(extra[0].pair).toBe("p1");
      expect(ballot[0].replaced).toBe(true);
      expect(ballot[1]).toMatchObject({ pair: "p1", replaced: false });
    }
  });

  it("leave everybody else casting one vote per pair", () => {
    for (const r of voters.filter((v) => !(CHANGES_MIND as string[]).includes(v.name))) {
      const ballot = ballotFor(r, round) as { replaced: boolean }[];
      expect(ballot, `${r.name} casts five`).toHaveLength(5);
      expect(ballot.every((v) => !v.replaced)).toBe(true);
    }
  });

  it("make a round of five pairs 104 votes cast, 100 current and 4 replaced", () => {
    const all = voters.flatMap((r) => ballotFor(r, round) as { replaced: boolean }[]);
    expect(all).toHaveLength(104);
    expect(all.filter((v) => v.replaced)).toHaveLength(4);
    expect(all.filter((v) => !v.replaced)).toHaveLength(100);
  });
});

describe("the vote script itself", () => {
  const source = readFileSync(new URL("./vote-group.mjs", import.meta.url), "utf8");

  it("writes only through the store's public calls", () => {
    expect(source).toContain('call("GET", "")');
    expect(source).toContain("`/rounds/${open.n}/votes`");
    expect(source).not.toContain("writeFileSync");
    expect(source).not.toContain("index.json");
  });

  it("exits 2 when it was asked wrongly and nothing was written", () => {
    expect(source).toContain("process.exitCode = 2;");
    // Both refusals return before any vote is cast.
    expect(source).toContain('console.error("usage: node scripts/vote-group.mjs <store-url> <group-code> [--round n]");');
    expect(source).toContain("no open round in");
    expect(source).toContain("is the open one.");
  });

  it("exits 1 when votes did not land, refused or failed", () => {
    expect(source).toContain("if (failures > 0 || strangers.length > 0) process.exitCode = 1;");
  });

  it("does not exit hard, so a closing socket cannot abort it", () => {
    expect(source).not.toContain("process.exit(");
    expect(source).toContain("process.exitCode");
  });

  it("names which of the two statuses a refusal arrived as", () => {
    expect(source).toContain("const notInTheGroup = (status) => status === 403 || status === 404;");
    expect(source).toContain("the store's own 403");
    expect(source).toContain("404, which is how `netlify dev` delivers the store's 403");
  });
});

describe("what a filled group says about itself", () => {
  it("says it in one sentence, naming what is not real", () => {
    expect(FILLED_FOR_A_TEST).toBe(
      "This group was filled for a test, with twenty people who are not real."
    );
  });

  it("is said by a name no resident can be confused with", () => {
    expect(FILLED_BY).toBe("The app");
    expect(people.some((r) => r.name === FILLED_BY)).toBe(false);
    // The store refuses an empty `who`, which is what its own voice is
    // (`residentName` in src/session/store.ts:402 answers 400). Giving that
    // voice a public door is a change to the store, which run 0043 was told
    // not to make, so the line is said by a name instead.
    expect(FILLED_BY.trim().length).toBeGreaterThan(0);
    expect(FILLED_BY.length).toBeLessThanOrEqual(64);
  });

  it("is the last thing the fill script writes", () => {
    const source = readFileSync(new URL("./fill-group.mjs", import.meta.url), "utf8");
    // `lastIndexOf`, because the first mention is the import at the top.
    const said = source.lastIndexOf("FILLED_FOR_A_TEST");
    const messages = source.indexOf('call("POST", "/messages", JSON.stringify(m)');
    expect(said, "the line is in the script").toBeGreaterThan(0);
    expect(said, "and it comes after the three the twenty say").toBeGreaterThan(messages);
    // Nothing writes after it: what follows is the read-back.
    expect(source.slice(said)).not.toContain('call("PUT"');
    expect(source.slice(said)).not.toContain('call("POST", "/messages"');
  });

  it("reads as the app speaking, in the guide's voice", () => {
    expect(FILLED_FOR_A_TEST.includes("—")).toBe(false);
    expect(FILLED_FOR_A_TEST.includes("!")).toBe(false);
    expect(FILLED_FOR_A_TEST.trim().endsWith(".")).toBe(true);
    // Within what the store accepts for a message.
    expect(FILLED_FOR_A_TEST.length).toBeLessThanOrEqual(500);
  });
});

/**
 * The group settles (run 0044).
 *
 * Before this run the split was 8 to 12 on every pair of every round, so four
 * rounds ran and none reached the three quarters the brief needs. The rule now
 * takes the round: round 1 is what people want, and from round 2 whoever
 * wanted the challenger has watched it lose and comes across.
 *
 * All of it is pure, so a whole vote can be counted here without a store.
 */
const SEED = "settle-0044";
const roundPairs = (n: number) =>
  (REASONS as string[]).map((dial, i) => ({ id: `r${n}-p${i + 1}`, dial }));
const forChallenger = (n: number, seed = SEED) =>
  roundPairs(n).map((p) => voters.filter((r) => voteFor(r, p, n, seed).pick === "b").length);

describe("the group settles", () => {
  it("disagrees in round 1, 8 for the challenger on every pair", () => {
    expect(forChallenger(1)).toEqual([8, 8, 8, 8, 8]);
  });

  it("has left the disagreement behind by round 2, and mostly reached three quarters", () => {
    // Six in ten of the eight come across, so a pair lands between 14 and 18
    // of 20. On `settle-0044` four of the five pairs are at or past three
    // quarters in round 2 and the fifth is at 14.
    const counts = forChallenger(2).map((b) => 20 - b);
    for (const kept of counts) expect(kept, `${20 - kept} for the challenger`).toBeGreaterThanOrEqual(14);
    expect(counts.filter((k) => k >= 15).length).toBeGreaterThanOrEqual(4);
  });

  it("is settled by round 3, three quarters or more on every pair", () => {
    for (const b of forChallenger(3)) {
      expect(20 - b, `${b} for the challenger`).toBeGreaterThanOrEqual(15);
    }
  });

  it("only ever grows the winning side, because nobody on it moves", () => {
    for (let n = 2; n <= 5; n++) {
      const before = forChallenger(n - 1).reduce((a, b) => a + b, 0);
      const after = forChallenger(n).reduce((a, b) => a + b, 0);
      expect(after, `round ${n} against round ${n - 1}`).toBeLessThanOrEqual(before);
    }
  });

  it("keeps round 1 exactly what it was, so the first count is a real disagreement", () => {
    for (const p of roundPairs(1)) {
      for (const r of voters) {
        expect(voteFor(r, p, 1, SEED)).toEqual(firstPreference(r, p));
        // No round given at all means round 1 too, which is what every test
        // written before this run relies on.
        expect(voteFor(r, p)).toEqual(firstPreference(r, p));
      }
    }
  });

  it("gives the same group the same votes every time", () => {
    expect(forChallenger(2)).toEqual(forChallenger(2));
    expect(forChallenger(3)).toEqual(forChallenger(3));
  });

  it("gives two different groups different votes, so the seed is doing something", () => {
    expect(forChallenger(2, "one-group")).not.toEqual(forChallenger(2, "another-group"));
  });

  it("settles any group by round 3, whatever the code", () => {
    // Round 2 draws against six in ten, so a particular group can sit just
    // under three quarters on a pair. Round 3 draws against nine in ten and
    // every one of these codes is at or past it.
    for (const seed of ["one-group", "another-group", "hall-14", "walk-08", "settle-0044"]) {
      for (const b of forChallenger(3, seed)) {
        expect(20 - b, `${seed}: ${b} for the challenger`).toBeGreaterThanOrEqual(15);
      }
    }
  });

  it("only moves people who wanted the challenger", () => {
    for (const p of roundPairs(2)) {
      for (const r of voters) {
        if (firstPreference(r, p).pick === "a") {
          expect(voteFor(r, p, 2, SEED).pick, `${r.name} was already on a`).toBe("a");
        }
      }
    }
  });

  it("lets somebody who comes across keep their own reason", () => {
    const moved = roundPairs(2)
      .flatMap((p) => voters.map((r) => ({ r, p })))
      .find(({ r, p }) => firstPreference(r, p).pick === "b" && voteFor(r, p, 2, SEED).pick === "a");
    expect(moved, "somebody comes across in round 2").toBeDefined();
    expect(voteFor(moved!.r, moved!.p, 2, SEED).reasons).toEqual([moved!.r.cares[0]]);
  });

  it("rises the chance by round and never above nine in ten", () => {
    expect(followChance(1)).toBe(0);
    expect(followChance(2)).toBe(0.6);
    expect(followChance(3)).toBe(0.9);
    expect(followChance(9)).toBe(0.9);
  });

  it("draws a number in [0, 1), one per person per dial", () => {
    const draws = (REASONS as string[]).map((dial) => chanceFor(SEED, "Ana", dial));
    for (const d of draws) {
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThan(1);
    }
    expect(new Set(draws).size).toBe(5);
    // One draw per person per dial, held for the whole vote. That is what
    // makes somebody who has come across stay across.
    expect(chanceFor(SEED, "Ana", "light")).toBe(chanceFor(SEED, "Ana", "light"));
    expect(chanceFor(SEED, "Ana", "light")).not.toBe(chanceFor(SEED, "Bruno", "light"));
  });

  it("still lets the four change their mind, in every round", () => {
    for (const n of [1, 2, 3]) {
      const pairs = roundPairs(n);
      for (const name of CHANGES_MIND as string[]) {
        const r = voters.find((v) => v.name === name)!;
        const ballot = ballotFor(r, pairs, n, SEED) as { pair: string; replaced: boolean }[];
        expect(ballot, `${name} in round ${n}`).toHaveLength(6);
        expect(ballot[0].replaced).toBe(true);
        expect(ballot[0].pair).toBe(pairs[0].id);
      }
    }
  });
});
