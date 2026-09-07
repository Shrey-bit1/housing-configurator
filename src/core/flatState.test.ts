import { describe, it, expect } from "vitest";
import {
  flatPhase,
  canSend,
  showsDropHint,
  checksRun,
  showsLanding,
  sendButton,
  afterEdit,
  SEND_IT,
  GO_TO_GROUP,
  GROUP_HAS_OLDER,
  NO_WAY_IN,
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

/**
 * Run 0034. The readiness rule on its three cases, and the words step 02's
 * one button reads in its two moments.
 */

describe("the readiness rule, on its three cases", () => {
  it("says no when nothing is drawn", () => {
    expect(canSend(flatPhase(0, false))).toBe(false);
  });

  it("says no when something is drawn but there is no way in", () => {
    expect(canSend(flatPhase(6, false))).toBe(false);
  });

  it("says yes when something is drawn and there is a way in", () => {
    expect(canSend(flatPhase(6, true))).toBe(true);
  });

  it("carries the one sentence the asleep button says", () => {
    expect(NO_WAY_IN).toBe("Place an entrance to send the flat to the group.");
  });
});

/**
 * The whole button rule (run 0036), over its three facts. Every combination is
 * driven; `sendButton` is the only thing the screen reads, so a case missing
 * here is a case nothing checks.
 */

const READY = flatPhase(6, true);
const UNREADY = flatPhase(6, false);
const EMPTY = flatPhase(0, false);

describe("sendButton, while the flat is not ready", () => {
  it("is asleep and says what to do about it, whatever else is true", () => {
    for (const phase of [EMPTY, UNREADY]) {
      for (const state of ["never", "sent", "edited"] as const) {
        for (const complaints of [0, 1, 4]) {
          expect(sendButton(phase, state, complaints)).toEqual({
            label: SEND_IT,
            notice: NO_WAY_IN,
            awake: false,
          });
        }
      }
    }
  });
});

describe("sendButton, once the flat is ready", () => {
  it("says Send it when nothing has gone and nothing is wrong", () => {
    expect(sendButton(READY, "never", 0)).toEqual({ label: SEND_IT, notice: "", awake: true });
  });

  it("says it will send anyway, and counts what there is to look at", () => {
    expect(sendButton(READY, "never", 1).label).toBe("Send anyway \u00b7 1 thing to look at");
    expect(sendButton(READY, "never", 3).label).toBe("Send anyway \u00b7 3 things to look at");
  });

  it("stays awake with complaints, because the rules are advisory", () => {
    expect(sendButton(READY, "never", 9).awake).toBe(true);
  });

  it("becomes the way to the group after a send", () => {
    expect(sendButton(READY, "sent", 0)).toEqual({ label: GO_TO_GROUP, notice: "", awake: true });
  });

  it("stays the way to the group whatever the check says, because it no longer sends", () => {
    expect(sendButton(READY, "sent", 5).label).toBe(GO_TO_GROUP);
  });

  it("goes back to sending after an edit, and says what the group still has", () => {
    expect(sendButton(READY, "edited", 0)).toEqual({
      label: SEND_IT,
      notice: GROUP_HAS_OLDER,
      awake: true,
    });
  });

  it("carries both the count and the sentence when both apply", () => {
    const b = sendButton(READY, "edited", 2);
    expect(b.label).toBe("Send anyway \u00b7 2 things to look at");
    expect(b.notice).toBe(GROUP_HAS_OLDER);
    expect(b.awake).toBe(true);
  });

  it("treats a nonsense count as none rather than printing it", () => {
    expect(sendButton(READY, "never", -3).label).toBe(SEND_IT);
    expect(sendButton(READY, "never", 1.7).label).toBe("Send anyway \u00b7 1 thing to look at");
  });
});

describe("afterEdit", () => {
  it("leaves a flat nobody sent alone, however much it changes", () => {
    expect(afterEdit("never")).toBe("never");
    expect(afterEdit(afterEdit("never"))).toBe("never");
  });

  it("moves a sent flat to edited, and keeps it there", () => {
    expect(afterEdit("sent")).toBe("edited");
    expect(afterEdit("edited")).toBe("edited");
  });

  it("is what puts the sentence under the button", () => {
    expect(sendButton(READY, "sent", 0).notice).toBe("");
    expect(sendButton(READY, afterEdit("sent"), 0).notice).toBe(GROUP_HAS_OLDER);
  });
});
