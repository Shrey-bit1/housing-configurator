/**
 * The twenty residents `scripts/fill-group.mjs` fills a group with.
 *
 * Its own file so it can be checked without being run: importing the runner
 * would fill a group. Same split as `scripts/flatLayout.ts` beside
 * `scripts/gen-flat.mjs`, and for the same reason.
 *
 * A FIXED TABLE, not random. Two runs give the same group, so a screenshot
 * taken today and one taken next week show the same room, and a number that
 * looks odd can be traced to a line here.
 *
 * The answers are spread on purpose. `shareM2` runs 3 to 12 and no two
 * neighbours share a figure; the ballots are different orderings of the five
 * shared spaces rather than one ordering twenty times; the wishes are set
 * every way round. A group where everybody wants the same thing tells the
 * building app nothing, and twenty identical answers are one person twenty
 * times.
 */

/** The five kinds of shared space (`_cowork/design/shared-space-method.md`). */
export const SHARED = ["hall", "terrace", "laundry", "lounge", "social"];

/** The lowest and highest square-metre figure this table uses. */
export const SHARE_MIN = 3;
export const SHARE_MAX = 12;

/** One per designed flat. `file` is the library file the flat comes from. */
export const RESIDENTS = [
  { name: "Ana",    file: "unit-8",  shareM2: 7,  extraM2: 4, ballot: ["hall", "terrace", "laundry", "lounge", "social"], wishes: { corner: true,  terrace: false, quiet: true  } },
  { name: "Bruno",  file: "unit-9",  shareM2: 4,  extraM2: 0, ballot: ["terrace", "lounge", "hall", "social", "laundry"], wishes: { corner: false, terrace: true,  quiet: false } },
  { name: "Mina",   file: "unit-10", shareM2: 11, extraM2: 6, ballot: ["social", "hall", "terrace", "laundry", "lounge"], wishes: { corner: true,  terrace: true,  quiet: false } },
  { name: "Leo",    file: "unit-11", shareM2: 6,  extraM2: 2, ballot: ["lounge", "laundry", "social", "hall", "terrace"], wishes: { corner: false, terrace: false, quiet: true  } },
  { name: "Sofia",  file: "unit-12", shareM2: 9,  extraM2: 5, ballot: ["laundry", "hall", "lounge", "terrace", "social"], wishes: { corner: true,  terrace: false, quiet: false } },
  { name: "Tomas",  file: "unit-13", shareM2: 3,  extraM2: 0, ballot: ["hall", "social", "terrace", "lounge", "laundry"], wishes: { corner: false, terrace: true,  quiet: true  } },
  { name: "Nadia",  file: "unit-14", shareM2: 12, extraM2: 8, ballot: ["terrace", "hall", "laundry", "social", "lounge"], wishes: { corner: true,  terrace: true,  quiet: true  } },
  { name: "Karim",  file: "unit-15", shareM2: 5,  extraM2: 1, ballot: ["lounge", "social", "hall", "laundry", "terrace"], wishes: { corner: false, terrace: false, quiet: false } },
  { name: "Elin",   file: "unit-16", shareM2: 8,  extraM2: 3, ballot: ["social", "laundry", "lounge", "terrace", "hall"], wishes: { corner: true,  terrace: false, quiet: true  } },
  { name: "Pavel",  file: "unit-17", shareM2: 10, extraM2: 0, ballot: ["laundry", "terrace", "hall", "lounge", "social"], wishes: { corner: false, terrace: true,  quiet: false } },
  { name: "Rosa",   file: "unit-18", shareM2: 6,  extraM2: 7, ballot: ["hall", "lounge", "social", "terrace", "laundry"], wishes: { corner: true,  terrace: true,  quiet: false } },
  { name: "Jonas",  file: "unit-19", shareM2: 4,  extraM2: 2, ballot: ["terrace", "social", "laundry", "hall", "lounge"], wishes: { corner: false, terrace: false, quiet: true  } },
  { name: "Yuki",   file: "unit-20", shareM2: 12, extraM2: 4, ballot: ["lounge", "hall", "terrace", "social", "laundry"], wishes: { corner: true,  terrace: false, quiet: false } },
  { name: "Milos",  file: "unit-21", shareM2: 7,  extraM2: 0, ballot: ["social", "terrace", "lounge", "laundry", "hall"], wishes: { corner: false, terrace: true,  quiet: true  } },
  { name: "Freya",  file: "unit-22", shareM2: 9,  extraM2: 6, ballot: ["laundry", "lounge", "hall", "social", "terrace"], wishes: { corner: true,  terrace: true,  quiet: true  } },
  { name: "Idris",  file: "unit-23", shareM2: 3,  extraM2: 1, ballot: ["hall", "laundry", "terrace", "lounge", "social"], wishes: { corner: false, terrace: false, quiet: false } },
  { name: "Lena",   file: "unit-24", shareM2: 11, extraM2: 5, ballot: ["terrace", "laundry", "social", "lounge", "hall"], wishes: { corner: true,  terrace: false, quiet: true  } },
  { name: "Omar",   file: "unit-25", shareM2: 5,  extraM2: 3, ballot: ["lounge", "terrace", "laundry", "hall", "social"], wishes: { corner: false, terrace: true,  quiet: false } },
  { name: "Greta",  file: "unit-26", shareM2: 8,  extraM2: 0, ballot: ["social", "lounge", "hall", "terrace", "laundry"], wishes: { corner: true,  terrace: true,  quiet: false } },
  { name: "Viktor", file: "unit-27", shareM2: 10, extraM2: 2, ballot: ["laundry", "social", "terrace", "hall", "lounge"], wishes: { corner: false, terrace: false, quiet: true  } },
];

/** So the room is not silent when somebody walks into it. */
export const MESSAGES = [
  { who: "Ana", text: "I put the terrace on the south side, shout if that is wrong for anyone." },
  { who: "Karim", text: "Happy either way. I care more about the laundry being on my floor." },
  { who: "Freya", text: "Same. Terrace south is good, and can we keep one quiet stair?" },
];

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
