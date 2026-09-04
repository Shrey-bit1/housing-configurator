import { describe, it, expect } from "vitest";
import {
  flatPhase,
  canSend,
  showsDropHint,
  checksRun,
  showsLanding,
  UNTITLED,
  DASH,
  EMPTY_HINT,
} from "./flatState";

/**
 * The two rules run 0027's chrome runs on, driven directly. Everything the
 * top bar, the send panel, the grid's drop hint and the step tabs ask comes
 * through these, so pinning them here pins all four at once without a DOM
 * (this project's vitest setup has no jsdom, and `main.ts` is wiring).
 */

describe("flatPhase", () => {
  it("is empty before anything is placed, whatever the build says", () => {
    expect(flatPhase(0, false)).toBe("empty");
    expect(flatPhase(0, true)).toBe("empty");
  });

  it("is unready once a room is placed but the unit will not build", () => {
    expect(flatPhase(1, false)).toBe("unready");
    expect(flatPhase(9, false)).toBe("unready");
  });

  it("is ready once a placed flat builds", () => {
    expect(flatPhase(1, true)).toBe("ready");
  });

  it("treats a negative count as empty rather than trusting it", () => {
    expect(flatPhase(-1, true)).toBe("empty");
  });
});

describe("the step gate", () => {
  it("locks step 02 while the flat has no way in, and opens it after", () => {
    // A flat with rooms but no usable entrance: `buildUnitExport` refuses it,
    // so the tab stays shut.
    expect(canSend(flatPhase(4, false))).toBe(false);
    // The same flat once an entrance is placed and the build succeeds.
    expect(canSend(flatPhase(4, true))).toBe(true);
  });

  it("never opens on an empty flat", () => {
    expect(canSend(flatPhase(0, true))).toBe(false);
  });
});

describe("the empty state", () => {
  it("shows the one drop hint only before anything is placed", () => {
    expect(showsDropHint(flatPhase(0, false))).toBe(true);
    expect(showsDropHint(flatPhase(1, false))).toBe(false);
    expect(showsDropHint(flatPhase(1, true))).toBe(false);
  });

  it("runs no check until the first room is placed", () => {
    expect(checksRun(flatPhase(0, false))).toBe(false);
    expect(checksRun(flatPhase(1, false))).toBe(true);
    expect(checksRun(flatPhase(1, true))).toBe(true);
  });

  it("carries the words the empty screen reads", () => {
    expect(UNTITLED).toBe("Untitled");
    expect(DASH).toBe("—");
    expect(EMPTY_HINT).toBe(
      "Drag a room onto the grid to start. Nothing is checked until you do."
    );
  });
});

describe("showsLanding", () => {
  it("shows the landing to a resident arriving cold", () => {
    expect(showsLanding("")).toBe(true);
    expect(showsLanding("?debug=1")).toBe(true);
  });

  it("skips it when the URL already names a project", () => {
    expect(showsLanding("?project=flat-2-single-storey.json")).toBe(false);
  });

  it("skips it when the URL already names a group", () => {
    expect(showsLanding("?session=room-42")).toBe(false);
  });

  it("skips it when the URL names both", () => {
    expect(showsLanding("?project=flat-1-two-storey.json&session=room-42")).toBe(false);
  });

  it("skips it on a bare parameter with no value, which still names one", () => {
    expect(showsLanding("?session=")).toBe(false);
  });
});
