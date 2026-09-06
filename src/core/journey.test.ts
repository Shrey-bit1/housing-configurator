import { describe, it, expect } from "vitest";
import { JOURNEY, journeyIndex, journeyTones } from "./journey";

/**
 * The journey the landing renders and the building app is expected to render
 * later. Pinned here because it is the one thing in this repo that two
 * separate apps are meant to agree on without sharing any code, so a change
 * to its order or its wording has to be a deliberate edit rather than a
 * silent drift.
 */

describe("JOURNEY", () => {
  it("is the six steps, in order, across the two apps", () => {
    expect(JOURNEY.map((s) => s.id)).toEqual([
      "draw",
      "send",
      "wishes",
      "group",
      "your-flat",
      "vote",
    ]);
  });

  it("gives the first two to the flat app and the rest to the building app", () => {
    expect(JOURNEY.filter((s) => s.app === "flat").map((s) => s.id)).toEqual(["draw", "send"]);
    expect(JOURNEY.filter((s) => s.app === "building")).toHaveLength(4);
  });

  it("carries a label for every step", () => {
    expect(JOURNEY.every((s) => s.label.length > 0)).toBe(true);
    expect(JOURNEY[0].label).toBe("Draw your flat");
    expect(JOURNEY[5].label).toBe("Vote");
  });
});

describe("journeyIndex", () => {
  it("finds a step by its id", () => {
    expect(journeyIndex("draw")).toBe(0);
    expect(journeyIndex("vote")).toBe(5);
  });

  it("answers -1 for an id nothing carries", () => {
    expect(journeyIndex("architect")).toBe(-1);
  });
});

describe("journeyTones", () => {
  it("gives the flat app its own two in ink and the building app's four dim", () => {
    expect(journeyTones("draw", "flat")).toEqual([
      "now",
      "here",
      "elsewhere",
      "elsewhere",
      "elsewhere",
      "elsewhere",
    ]);
  });

  it("gives the building app the mirror image", () => {
    expect(journeyTones("group", "building")).toEqual([
      "elsewhere",
      "elsewhere",
      "here",
      "now",
      "here",
      "here",
    ]);
  });

  it("marks no step as now when the current id is unknown", () => {
    expect(journeyTones("", "flat")).toEqual([
      "here",
      "here",
      "elsewhere",
      "elsewhere",
      "elsewhere",
      "elsewhere",
    ]);
  });

  it("returns one tone per step", () => {
    expect(journeyTones("send", "flat")).toHaveLength(JOURNEY.length);
  });
});
