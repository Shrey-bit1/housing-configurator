import { describe, it, expect } from "vitest";
import * as W from "./words";
import { RULES } from "./rules";

/**
 * The guide's tells, read over every word the app says (run 0042).
 *
 * `_cowork/design/WRITING-GUIDE.md` lists the habits Shrey strikes out. Most of
 * them need a person to spot. Seven do not, and those seven are what this file
 * checks, over every string in `src/core/words.ts` and over every string the
 * templates there build when they are run across their own tables.
 *
 * The point is the next rewrite, not this one. A string added in six months by
 * a session that has not read the guide fails here on the way in.
 */

/** Every plain string the module exports, by its name. */
const PLAIN: [string, string][] = Object.entries(W)
  .filter(([, v]) => typeof v === "string")
  .map(([k, v]) => [k, v as string]);

/** Every string the rule table carries, including the ones a rule builds. */
const RULE_LINES: [string, string][] = [
  ...Object.entries(W.RULE_WORDS).map(([k, v]): [string, string] => [`RULE_WORDS.${k}`, v]),
  ...RULES.map((r): [string, string] => [`RULES.${r.id}`, r.description]),
];

/**
 * Every template, run over a table that covers what it will be handed: one and
 * many, empty and filled, so a plural or a missing half cannot hide.
 */
const BUILT: [string, string][] = [
  ["mustFixLabel(1)", W.mustFixLabel(1)],
  ["mustFixLabel(4)", W.mustFixLabel(4)],
  ["checkChipTooltip('')", W.checkChipTooltip("")],
  ["checkChipTooltip(fault)", W.checkChipTooltip("A flat needs a kitchen.")],
  ["recallLine(both)", W.recallLine("Ana", "room-42")],
  ["recallLine(name)", W.recallLine("Ana", "")],
  ["recallLine(code)", W.recallLine("", "room-42")],
  ["noSuchGroup", W.noSuchGroup("room-42")],
  ["storeNotRunning", W.storeNotRunning("npm run dev", "http://localhost:8888")],
  ["couldNotAnswer", W.couldNotAnswer("room-42")],
  ["selectionEntrance", W.selectionEntrance()],
  ["selectionDoor(0)", W.selectionDoor(0)],
  ["selectionDoor(2)", W.selectionDoor(2)],
  ["compassValue(0)", W.compassValue(0)],
  ["compassValue(180)", W.compassValue(180)],
  ["cannotOpenUpward", W.cannotOpenUpward("a bathroom")],
  ["floorResized(none)", W.floorResized(12, 10, 0)],
  ["floorResized(one)", W.floorResized(12, 10, 1)],
  ["floorResized(many)", W.floorResized(12, 10, 3)],
  ["whoLineText(both)", W.whoLineText("Ana", "room-42")],
  ["whoLineText(neither)", W.whoLineText("", "")],
  ["whoLineText(code)", W.whoLineText("", "room-42")],
  ["whoLineText(name)", W.whoLineText("Ana", "")],
  ["sessionLineText(both)", W.sessionLineText("Ana", "room-42")],
  ["sessionLineText(neither)", W.sessionLineText("", "")],
  ["sessionLineText(code)", W.sessionLineText("", "room-42")],
  ["sessionLineText(name)", W.sessionLineText("Ana", "")],
  ["sendAnyway(1)", W.sendAnyway(1)],
  ["sendAnyway(2)", W.sendAnyway(2)],
  ["itBecomes", W.itBecomes("Flat 7")],
  ["sentTo", W.sentTo("room-42", "Flat 7")],
  ["takeoverConfirm", W.takeoverConfirm("Ana")],
  ["declinedTakeover", W.declinedTakeover("Ana")],
  ["couldNotOpen", W.couldNotOpen(W.FILE_MAY_BE_DAMAGED)],
  ["roomsNotPlaced(1)", W.roomsNotPlaced(1)],
  ["roomsNotPlaced(5)", W.roomsNotPlaced(5)],
  ["olderFileOpened", W.olderFileOpened(1)],
  ["newerFileOpened", W.newerFileOpened(3, 2)],
  ["newerFileConfirm", W.newerFileConfirm(3)],
  ["renamed", W.renamed("unit-8", "Flat 8")],
  ["deleted(1)", W.deleted("Flat 8", 1)],
  ["deleted(3)", W.deleted("Flat 8", 3)],
  ["noSourceProject", W.noSourceProject("flat.json")],
  ["couldNotReadNamed", W.couldNotReadNamed("flat.json", "Unexpected end of input")],
  ["libraryReplaceConfirm", W.libraryReplaceConfirm("Flat 8", "unit-8", "2026-09-08")],
  ["bedroomDoors(1)", W.bedroomDoors(1)],
  ["bedroomDoors(3)", W.bedroomDoors(3)],
  ["floorHasNoBathroom", W.floorHasNoBathroom(1)],
  ["roomIsDeep", W.roomIsDeep(5)],
  ["roomIsFarFromAWayOut", W.roomIsFarFromAWayOut(4)],
  // The nine lines a rule builds about one room, one floor or one count. The
  // finishing pass found these on screen still saying what they used to.
  ["narrowCirculation(1)", W.narrowCirculation(1)],
  ["narrowCirculation(2)", W.narrowCirculation(2)],
  ["stairReachesNothing", W.stairReachesNothing("top and the bottom")],
  ["floorsNotReachable(one)", W.floorsNotReachable("Floor 1", false)],
  ["floorsNotReachable(many)", W.floorsNotReachable("Floors 1 and 2", true)],
  ["glazingFaces", W.glazingFaces("north + east")],
  ["roomIsThisDeep", W.roomIsThisDeep(6)],
  ["roomIsThisFar", W.roomIsThisFar(7)],
  ["circulationHeavy", W.circulationHeavy(41)],
  ["floorCirculationHeavy", W.floorCirculationHeavy(1, 52)],
  ["wetRoomsSplit", W.wetRoomsSplit(0, 2, "F0 and F1")],
  ["roomHasNoFacade", W.roomHasNoFacade("Living Room")],
];

/** The shortcut panel's rows, which are a table of their own. */
const SHORTCUTS: [string, string][] = W.SHORTCUT_ROWS.map((r): [string, string] => [
  `SHORTCUT_ROWS.${r.keys}`,
  r.what,
]);

const EVERY = [...PLAIN, ...RULE_LINES, ...BUILT, ...SHORTCUTS];

describe("every word the app says", () => {
  it("is there, and there are a lot of them", () => {
    // A floor rather than an exact number, so adding a string does not fail a
    // test that is about how the strings read.
    expect(EVERY.length).toBeGreaterThan(180);
    expect(PLAIN.length).toBeGreaterThan(60);
    expect(RULE_LINES.length).toBe(41 + RULES.length);
  });

  it("uses no em dash, because the guide asks for two sentences instead", () => {
    // `DASH` is the one em dash the app shows on purpose. It is not glue: it
    // stands in a number's place while there is nothing to measure, the way a
    // blank would, and a person reads it as "no number yet".
    for (const [name, text] of EVERY) {
      if (name === "DASH") continue;
      expect(text.includes("—"), `${name}: ${text}`).toBe(false);
    }
  });

  it("uses no exclamation mark, because nothing here is exciting", () => {
    for (const [name, text] of EVERY) {
      expect(text.includes("!"), `${name}: ${text}`).toBe(false);
    }
  });

  it("carries none of the words the guide names", () => {
    // From the guide's Avoid list and its list of promotional words.
    const banned = [
      "genuinely",
      "honestly",
      "straightforward",
      "seamless",
      "leverage",
      "robust",
      "vibrant",
      "pivotal",
      "crucial",
      "testament",
      "delve",
      "showcase",
      "empower",
      "unlock",
    ];
    for (const [name, text] of EVERY) {
      for (const word of banned) {
        expect(new RegExp(`\\b${word}\\b`, "i").test(text), `${name} says "${word}": ${text}`).toBe(false);
      }
    }
  });

  it("builds no contrast construction", () => {
    // "not just x", "not only x", and "x, not y" with a comma before the not.
    for (const [name, text] of EVERY) {
      expect(/\bnot just\b/i.test(text), `${name}: ${text}`).toBe(false);
      expect(/\bnot only\b/i.test(text), `${name}: ${text}`).toBe(false);
      expect(/,\s+not\s+\w/i.test(text), `${name}: ${text}`).toBe(false);
    }
  });

  it("uses `rather than` only to compare two real things, never to negate one", () => {
    // The guide allows a plain comparison. What it strikes out is the shape
    // where the first half exists only to be denied, which reads as
    // "x rather than y" with nothing after y.
    for (const [name, text] of EVERY) {
      const at = text.toLowerCase().indexOf("rather than");
      if (at === -1) continue;
      const after = text.slice(at + "rather than".length).trim();
      expect(after.length, `${name} trails off after "rather than": ${text}`).toBeGreaterThan(4);
    }
  });

  it("writes no headline as a fragment with a full stop after it", () => {
    // "Three questions. The building follows." is the shape Shrey rejected on
    // 8 September: a fragment of three words or fewer, stopped, standing as a
    // headline. A sentence with a verb is fine at any length.
    const HEADLINES = [
      W.SEND_HEADLINE_1 + " " + W.SEND_HEADLINE_2,
      W.START_A_FLAT,
      W.BACK_TO_YOUR_FLAT,
      W.SEND_IT_TO_YOUR_GROUP,
      W.YOUR_GROUP_CODE,
      W.SHORTCUTS,
      W.DISPLAY,
      W.MORE,
    ];
    for (const line of HEADLINES) {
      for (const part of line.split(".").map((p) => p.trim()).filter(Boolean)) {
        const words = part.split(/\s+/).length;
        const hasVerb = line.includes(".") && words > 3;
        expect(
          words > 3 || !line.trim().endsWith("."),
          `"${line}" is a fragment of ${words} words with a full stop`
        ).toBe(hasVerb || !line.trim().endsWith("."));
      }
    }
  });

  it("gives every number a unit where the thing has one", () => {
    // A bare number is fine when it counts things the sentence names ("3 things
    // to fix", "20 residents"). A measurement is not: metres, square metres and
    // degrees are what this app measures in.
    const measured = [W.GRID_META, W.compassValue(90), W.RULE_WORDS.A1];
    for (const text of measured) {
      expect(/\d/.test(text), text).toBe(true);
      expect(/\d\s*(m²|m\b|°)/.test(text), `${text} carries a bare measurement`).toBe(true);
    }
  });

  it("says something in every string, and never leaves a template hole", () => {
    for (const [name, text] of EVERY) {
      expect(text.trim().length, `${name} is empty`).toBeGreaterThan(0);
      expect(text.includes("${"), `${name} carries an unfilled hole: ${text}`).toBe(false);
      expect(text.includes("undefined"), `${name}: ${text}`).toBe(false);
      expect(text.includes("NaN"), `${name}: ${text}`).toBe(false);
    }
  });

  it("carries no plural in brackets, because nobody reads storey(s)", () => {
    for (const [name, text] of EVERY) {
      expect(/\(s\)/.test(text), `${name}: ${text}`).toBe(false);
    }
  });

  it("names no field, parameter or button that is not on the screen", () => {
    // Settled in the brief on 8 September: "Nothing a resident reads names a
    // field, a parameter or a button that is not on their screen."
    for (const [name, text] of EVERY) {
      expect(/sourceProject|fileVersion|shareM2|sharedBuiltM2|localStorage/.test(text), `${name}: ${text}`).toBe(false);
    }
  });
});

describe("the templates over their tables", () => {
  it("says one thing and many things correctly", () => {
    expect(W.mustFixLabel(1)).toBe("1 thing to fix");
    expect(W.mustFixLabel(4)).toBe("4 things to fix");
    expect(W.roomsNotPlaced(1)).toBe("1 room could not be placed.");
    expect(W.roomsNotPlaced(5)).toBe("5 rooms could not be placed.");
    expect(W.bedroomDoors(1)).toBe("This bedroom has 1 door. A private room usually has one.");
    expect(W.bedroomDoors(3)).toBe("This bedroom has 3 doors. A private room usually has one.");
    expect(W.sendAnyway(1)).toContain("1 thing to look at");
    expect(W.sendAnyway(2)).toContain("2 things to look at");
  });

  it("leaves the resize line at one sentence when nothing was removed", () => {
    expect(W.floorResized(12, 10, 0)).toBe("The floor is now 12 by 10 cells.");
    expect(W.floorResized(12, 10, 1)).toBe(
      "The floor is now 12 by 10 cells. 1 thing no longer fitted and was removed."
    );
    expect(W.floorResized(12, 10, 3)).toBe(
      "The floor is now 12 by 10 cells. 3 things no longer fitted and were removed."
    );
  });

  it("reads as a sentence in all four of the who-line's cases", () => {
    expect(W.whoLineText("Ana", "room-42")).toBe("As Ana, to room-42.");
    expect(W.whoLineText("", "")).toBe("You have not said who you are or which group.");
    expect(W.whoLineText("", "room-42")).toBe("To room-42, but you have not said who you are.");
    expect(W.whoLineText("Ana", "")).toBe("As Ana, but you have not joined a group.");
  });

  it("reads as a sentence in all three of the recall line's cases", () => {
    expect(W.recallLine("Ana", "room-42")).toBe(
      "You were here before, as Ana in room-42. Change either one if that is not you."
    );
    expect(W.recallLine("Ana", "")).toBe("You were here before, as Ana. Change it if that is not you.");
    expect(W.recallLine("", "room-42")).toBe("You were here before, in room-42. Change it if that is not you.");
  });

  it("keeps the check chip's tooltip a sentence with or without a fault", () => {
    expect(W.checkChipTooltip("")).toBe("Open the layout report");
    expect(W.checkChipTooltip("A flat needs a kitchen.")).toBe(
      "A flat needs a kitchen. Open the layout report."
    );
  });
});

describe("the rules keep their thresholds", () => {
  it("says the same number the rule checks against", () => {
    const dp1 = RULES.find((r) => r.id === "DP1")!;
    const f1 = RULES.find((r) => r.id === "F1")!;
    // The numbers come from the constants in rules.ts, so a retune moves the
    // sentence with it. These two are what those constants are today.
    expect(dp1.description).toContain("5 rooms or more");
    expect(f1.description).toContain("more than 4 rooms");
    expect(W.RULE_WORDS.A1).toContain("1.2 m");
  });

  it("gives every rule a line, and every line is a sentence", () => {
    for (const r of RULES) {
      expect(r.description.length, r.id).toBeGreaterThan(20);
      expect(r.description.trim().endsWith("."), `${r.id} ends without a full stop`).toBe(true);
      expect(/^[A-Z]/.test(r.description), `${r.id} starts lowercase`).toBe(true);
    }
  });
});
