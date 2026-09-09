/**
 * The twenty residents `scripts/fill-group.mjs` fills a group with, and the
 * way `scripts/vote-group.mjs` has them vote.
 *
 * Its own file so it can be checked without being run: importing either runner
 * would fill a group or vote in one. Same split as `scripts/flatLayout.ts`
 * beside `scripts/gen-flat.mjs`, and for the same reason.
 *
 * A FIXED TABLE, not random. Two runs give the same group and the same count,
 * so a screenshot taken today and one taken next week show the same room, and
 * a number that looks odd can be traced to a line here.
 *
 * The answers are spread on purpose. `shareM2` runs 3 to 12 and no two
 * neighbours share a figure; the ballots are different orderings of the five
 * shared spaces rather than one ordering twenty times; the wishes are set
 * every way round; `cares` is twenty different orderings of the five reasons.
 * A group where everybody wants the same thing tells the building app nothing,
 * and twenty identical answers are one person twenty times.
 */

/** The five kinds of shared space (`_cowork/design/shared-space-method.md`). */
export const SHARED = ["hall", "terrace", "laundry", "lounge", "social"];

/**
 * The five reasons, in the store's own order (`REASONS` in
 * src/session/store.ts:188). Restated here rather than imported for the same
 * reason `flatIdFor` is: this is plain Node beside plain Node scripts, and
 * importing a TypeScript module would need a build step to run one command.
 */
export const REASONS = ["privacy", "shared space", "cost", "light", "short walks"];

/** The lowest and highest square-metre figure this table uses. */
export const SHARE_MIN = 3;
export const SHARE_MAX = 12;

/**
 * One per designed flat. `file` is the library file the flat comes from.
 *
 * `cares` ranks the five reasons for this person, the one they care about most
 * first. It is a second ordering beside `ballot` rather than a reading of it,
 * because the two rank different things: `ballot` orders the five kinds of
 * shared space, and a pair in the vote names a dial, which is one of the five
 * REASONS. Nothing in a ballot answers "how much does this person care about
 * light", so the rule in `voteFor` below had to be given a column that does.
 *
 * The orderings are built so that each reason is somebody's first care exactly
 * four times and sits in somebody's top two exactly eight times. That is what
 * makes a pair split 8 to 12 rather than 20 to 0 or 10 to 10.
 */
export const RESIDENTS = [
  { name: "Ana",    file: "unit-8",  shareM2: 7,  extraM2: 4, ballot: ["hall", "terrace", "laundry", "lounge", "social"], wishes: { corner: true,  terrace: false, quiet: true  },
    cares: ["privacy", "shared space", "cost", "light", "short walks"] },
  { name: "Bruno",  file: "unit-9",  shareM2: 4,  extraM2: 0, ballot: ["terrace", "lounge", "hall", "social", "laundry"], wishes: { corner: false, terrace: true,  quiet: false },
    cares: ["shared space", "cost", "privacy", "light", "short walks"] },
  { name: "Mina",   file: "unit-10", shareM2: 11, extraM2: 6, ballot: ["social", "hall", "terrace", "laundry", "lounge"], wishes: { corner: true,  terrace: true,  quiet: false },
    cares: ["cost", "shared space", "privacy", "light", "short walks"] },
  { name: "Leo",    file: "unit-11", shareM2: 6,  extraM2: 2, ballot: ["lounge", "laundry", "social", "hall", "terrace"], wishes: { corner: false, terrace: false, quiet: true  },
    cares: ["light", "shared space", "privacy", "cost", "short walks"] },
  { name: "Sofia",  file: "unit-12", shareM2: 9,  extraM2: 5, ballot: ["laundry", "hall", "lounge", "terrace", "social"], wishes: { corner: true,  terrace: false, quiet: false },
    cares: ["short walks", "shared space", "privacy", "cost", "light"] },
  { name: "Tomas",  file: "unit-13", shareM2: 3,  extraM2: 0, ballot: ["hall", "social", "terrace", "lounge", "laundry"], wishes: { corner: false, terrace: true,  quiet: true  },
    cares: ["privacy", "shared space", "light", "short walks", "cost"] },
  { name: "Nadia",  file: "unit-14", shareM2: 12, extraM2: 8, ballot: ["terrace", "hall", "laundry", "social", "lounge"], wishes: { corner: true,  terrace: true,  quiet: true  },
    cares: ["shared space", "light", "privacy", "cost", "short walks"] },
  { name: "Karim",  file: "unit-15", shareM2: 5,  extraM2: 1, ballot: ["lounge", "social", "hall", "laundry", "terrace"], wishes: { corner: false, terrace: false, quiet: false },
    cares: ["cost", "shared space", "light", "short walks", "privacy"] },
  { name: "Elin",   file: "unit-16", shareM2: 8,  extraM2: 3, ballot: ["social", "laundry", "lounge", "terrace", "hall"], wishes: { corner: true,  terrace: false, quiet: true  },
    cares: ["light", "shared space", "short walks", "privacy", "cost"] },
  { name: "Pavel",  file: "unit-17", shareM2: 10, extraM2: 0, ballot: ["laundry", "terrace", "hall", "lounge", "social"], wishes: { corner: false, terrace: true,  quiet: false },
    cares: ["short walks", "shared space", "cost", "light", "privacy"] },
  { name: "Rosa",   file: "unit-18", shareM2: 6,  extraM2: 7, ballot: ["hall", "lounge", "social", "terrace", "laundry"], wishes: { corner: true,  terrace: true,  quiet: false },
    cares: ["privacy", "light", "shared space", "cost", "short walks"] },
  { name: "Jonas",  file: "unit-19", shareM2: 4,  extraM2: 2, ballot: ["terrace", "social", "laundry", "hall", "lounge"], wishes: { corner: false, terrace: false, quiet: true  },
    cares: ["shared space", "short walks", "privacy", "cost", "light"] },
  { name: "Yuki",   file: "unit-20", shareM2: 12, extraM2: 4, ballot: ["lounge", "hall", "terrace", "social", "laundry"], wishes: { corner: true,  terrace: false, quiet: false },
    cares: ["cost", "short walks", "privacy", "shared space", "light"] },
  { name: "Milos",  file: "unit-21", shareM2: 7,  extraM2: 0, ballot: ["social", "terrace", "lounge", "laundry", "hall"], wishes: { corner: false, terrace: true,  quiet: true  },
    cares: ["light", "privacy", "shared space", "cost", "short walks"] },
  { name: "Freya",  file: "unit-22", shareM2: 9,  extraM2: 6, ballot: ["laundry", "lounge", "hall", "social", "terrace"], wishes: { corner: true,  terrace: true,  quiet: true  },
    cares: ["short walks", "cost", "privacy", "shared space", "light"] },
  { name: "Idris",  file: "unit-23", shareM2: 3,  extraM2: 1, ballot: ["hall", "laundry", "terrace", "lounge", "social"], wishes: { corner: false, terrace: false, quiet: false },
    cares: ["privacy", "short walks", "shared space", "cost", "light"] },
  { name: "Lena",   file: "unit-24", shareM2: 11, extraM2: 5, ballot: ["terrace", "laundry", "social", "lounge", "hall"], wishes: { corner: true,  terrace: false, quiet: true  },
    cares: ["shared space", "privacy", "cost", "light", "short walks"] },
  { name: "Omar",   file: "unit-25", shareM2: 5,  extraM2: 3, ballot: ["lounge", "terrace", "laundry", "hall", "social"], wishes: { corner: false, terrace: true,  quiet: false },
    cares: ["cost", "privacy", "shared space", "light", "short walks"] },
  { name: "Greta",  file: "unit-26", shareM2: 8,  extraM2: 0, ballot: ["social", "lounge", "hall", "terrace", "laundry"], wishes: { corner: true,  terrace: true,  quiet: false },
    cares: ["light", "cost", "shared space", "privacy", "short walks"] },
  { name: "Viktor", file: "unit-27", shareM2: 10, extraM2: 2, ballot: ["laundry", "social", "terrace", "hall", "lounge"], wishes: { corner: false, terrace: false, quiet: true  },
    cares: ["short walks", "light", "privacy", "shared space", "cost"] },
];

/** So the room is not silent when somebody walks into it. */
export const MESSAGES = [
  { who: "Ana", text: "I put the terrace on the south side, shout if that is wrong for anyone." },
  { who: "Karim", text: "Happy either way. I care more about the laundry being on my floor." },
  { who: "Freya", text: "Same. Terrace south is good, and can we keep one quiet stair?" },
];

/**
 * What the group is told about itself, as the LAST write of a fill (run 0043).
 *
 * A filled group is otherwise indistinguishable from a real one, which is the
 * point of filling through the store's public calls only. A recording of the
 * journey should still not be mistakable for twenty real people, so the group
 * says which it is. It is last so that a group half way through a fill never
 * carries the line.
 *
 * `FILLED_BY` is a name rather than the store's own voice, which is what an
 * empty `who` means (run 0036's "Ben left the group."). The store REFUSES an
 * empty `who` on `POST /messages`: `residentName` in src/session/store.ts:402
 * answers 400 for it, and the leave line is written inside the store rather
 * than posted. Verified live in run 0043 and pinned by
 * `scripts/store-roundtrip.mjs`. So the line is said by a name no resident can
 * be confused with, and giving the store's own voice a public door is a change
 * to the store, which run 0043 was told not to make.
 */
export const FILLED_BY = "The app";
export const FILLED_FOR_A_TEST = "This group was filled for a test, with twenty people who are not real.";

/**
 * The four who always change their mind once, on the round's first pair.
 *
 * Named here rather than picked at random so that two runs leave the same four
 * entries in a round's `replaced` list, and so that a `replaced` count of four
 * can be traced to a line in this file. Four of twenty is enough for a screen
 * to say "4 people changed their minds" and small enough that the count in
 * `votes` still reads as the rule's count.
 */
export const CHANGES_MIND = ["Bruno", "Elin", "Rosa", "Viktor"];

/**
 * THE PICK RULE, in one function.
 *
 * A pair names one dial, which is the reason its challenger was pushed on. If
 * that dial is one of the two things this person cares about most, they pick
 * the challenger, `b`, and tick the dial as their reason: the pair moved the
 * thing they came for. Otherwise they keep the building they had, `a`, and
 * tick their own first care, which is the thing this pair did not move.
 *
 * Pure, so `scripts/fillGroupTable.test.ts` can drive it over a round of five
 * pairs without a store. It reads nothing but the person's row and the pair's
 * dial, which is why the whole count is a property of this file.
 *
 * Two in five is what makes the room look like a room. A rule of "top one"
 * would split every pair 4 to 16 and "top three" 12 to 8; two gives 8 to 12,
 * and which eight it is changes with the dial.
 */
/**
 * WHAT A PERSON WANTS, before anybody has seen a count. Round 1 is this and
 * nothing else, so the first tally is a real disagreement.
 */
export function firstPreference(person, pair) {
  const rank = person.cares.indexOf(pair.dial);
  return rank === 0 || rank === 1
    ? { pick: "b", reasons: [pair.dial] }
    : { pick: "a", reasons: [person.cares[0]] };
}

/**
 * How likely somebody on the losing side is to come across, by round.
 *
 * Six in ten in round 2, nine in ten in round 3 and after. Over the eight who
 * want the challenger that is about three left in round 2 and about one in
 * round 3, so a group reaches three quarters in round 2 and stays there.
 * Settled with the building app on 9 September: a vote that never settles is a
 * vote the brief cannot use.
 */
export const FOLLOWS_THE_WINNER = { 2: 0.6 };
export const FOLLOWS_THE_WINNER_LATER = 0.9;
export function followChance(round) {
  if (round <= 1) return 0;
  return FOLLOWS_THE_WINNER[round] ?? FOLLOWS_THE_WINNER_LATER;
}

/**
 * One number in [0, 1) for this person and this dial, from the group code.
 *
 * FNV-1a over the three, which is a few lines and no dependency. Seeded by the
 * code so the same group votes the same way every time: a screenshot taken
 * today and one taken next week show the same count, which is the whole reason
 * the twenty are a fixed table.
 *
 * NO ROUND IN IT, on purpose. One number per person per dial, held for the
 * whole vote and compared against a chance that rises, is what makes somebody
 * who has come across STAY across. Drawing again each round let a settled
 * group come apart again: 2 for the challenger in round 3 and 4 in round 4,
 * which is not how a room behaves and which run 0044’s own test caught.
 *
 * The dial rather than the pair id, because a pair is built fresh every round
 * and carries a new id, and what a person is deciding about is the dial.
 */
export function chanceFor(seed, person, dial) {
  let h = 2166136261;
  for (const ch of `${seed}|${person}|${dial}`) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/**
 * WHO WINS ROUND 1 ON THIS DIAL, counted over the whole table.
 *
 * A property of `RESIDENTS` and the dial, so it needs no votes and no store.
 * On four of the five dials the challenger takes 7 of 20 and the building the
 * group has wins. On shared space the challenger takes 12 and wins, which is
 * what run 0045 rebalanced the `cares` column for: a vote that only ever
 * confirms the building it started with changes nothing.
 */
export function roundOneWinner(pair) {
  const wantB = RESIDENTS.filter((r) => firstPreference(r, pair).pick === "b").length;
  return wantB * 2 > RESIDENTS.length ? "b" : "a";
}

/**
 * THE PICK RULE, with the round in it.
 *
 * Round 1 is `firstPreference`, which is what a person wants before anybody has
 * seen a count. From round 2 a person who is on the losing side of round 1 has
 * watched their pick lose, and comes across with `followChance(round)`. Nobody
 * on the winning side moves, and the chance only rises, so the winning side
 * only ever grows and a settled group stays settled.
 *
 * The winner is counted from the table rather than remembered, which is why
 * this stays a pure function of the row, the pair, the round and the code. Run
 * 0044 assumed the loser was always the challenger, which was true while every
 * dial split 8 to 12. It is not true of shared space any more, and a rule that
 * assumed it carried the group away from the building it had just chosen.
 *
 * Somebody who comes across keeps their own first care as the reason. They are
 * not saying the dial moved them; they are saying the group has decided and
 * they still care about what they came for.
 */
export function voteFor(person, pair, round = 1, seed = "") {
  const first = firstPreference(person, pair);
  if (round <= 1) return first;
  const winner = roundOneWinner(pair);
  if (first.pick === winner) return first;
  const follows = chanceFor(seed, person.name, pair.dial) < followChance(round);
  if (!follows) return first;
  return winner === "b"
    ? { pick: "b", reasons: [pair.dial] }
    : { pick: "a", reasons: [person.cares[0]] };
}

/**
 * What one of the four says before they change their mind: the answer the rule
 * gives to somebody who cares the other way round. So a change of mind is a
 * real change of pick, never the same pick twice with a different reason.
 */
export function otherThought(person, pair, round = 1, seed = "") {
  return voteFor(person, pair, round, seed).pick === "b"
    ? { pick: "a", reasons: [person.cares[0]] }
    : { pick: "b", reasons: [pair.dial] };
}

/**
 * Every vote one person casts on one round, in the order they are cast.
 *
 * One per pair, plus one extra at the front for the four who change their
 * mind, marked `replaced: true` because the store supersedes it the moment the
 * next one lands. The change of mind is on ROUND 1's first pair only (run
 * 0045): a mind changes while a group is still making it up, and four people
 * changing their vote in a round where nineteen of twenty already agree reads
 * as noise. One
 * earlier vote each is enough to fill `replaced`, and changing on every pair
 * would put twenty entries in it and read as a fault rather than as a room.
 */
export function ballotFor(person, pairs, round = 1, seed = "") {
  const out = [];
  pairs.forEach((pair, i) => {
    if (i === 0 && round === 1 && CHANGES_MIND.includes(person.name)) {
      out.push({ pair: pair.id, ...otherThought(person, pair, round, seed), replaced: true });
    }
    out.push({ pair: pair.id, ...voteFor(person, pair, round, seed), replaced: false });
  });
  return out;
}

/**
 * The id a resident's own send would slug a flat's name to. The same rule as
 * `slugifyUnitName` in src/library/ids.ts, restated here rather than imported
 * because this file is plain Node beside a plain Node script and importing a
 * TypeScript module would need a build step to run one command.
 */
export function flatIdFor(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
