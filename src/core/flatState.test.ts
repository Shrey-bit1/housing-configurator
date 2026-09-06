import { describe, it, expect } from "vitest";
import {
  flatPhase,
  canSend,
  showsDropHint,
  checksRun,
  showsLanding,
  sendButtonLabel,
  staleNotice,
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

describe("sendButtonLabel", () => {
  it("reads the send text before a send", () => {
    expect(sendButtonLabel("never")).toBe("Send it");
    expect(sendButtonLabel("never")).toBe(SEND_IT);
  });

  it("reads the group text after a send", () => {
    expect(sendButtonLabel("sent")).toBe("Go to your group");
    expect(sendButtonLabel("sent")).toBe(GO_TO_GROUP);
  });

  it("reads the send text again once the flat has been edited", () => {
    expect(sendButtonLabel("edited")).toBe(SEND_IT);
  });

  it("says where it goes rather than saying next", () => {
    expect(GO_TO_GROUP.toLowerCase()).not.toBe("next");
    expect(GO_TO_GROUP).toContain("group");
  });
});

/**
 * What step 02 says under its button (run 0035), over the four moments a flat
 * passes through. The state is one value, so the four moments are just the
 * three states plus the transition back into `sent`.
 */

describe("the sentence under step 02's button", () => {
  it("says nothing before a send, however much the flat is edited", () => {
    expect(staleNotice("never")).toBe("");
    expect(staleNotice(afterEdit("never"))).toBe("");
    expect(staleNotice(afterEdit(afterEdit("never")))).toBe("");
  });

  it("says nothing after a send with no edit", () => {
    expect(staleNotice("sent")).toBe("");
  });

  it("says the group has the older one after a send and an edit", () => {
    expect(staleNotice(afterEdit("sent"))).toBe(GROUP_HAS_OLDER);
    expect(GROUP_HAS_OLDER).toBe(
      "Your group still has this flat as you sent it. Sending again replaces it."
    );
  });

  it("says nothing again after a second send", () => {
    // The edit put it in `edited`; the send puts it back in `sent`, which is
    // the only way out of `edited` and is what main.ts does on a 200.
    expect(staleNotice(afterEdit("sent"))).toBe(GROUP_HAS_OLDER);
    expect(staleNotice("sent")).toBe("");
  });

  it("keeps saying it while the resident goes on editing", () => {
    expect(staleNotice(afterEdit(afterEdit("sent")))).toBe(GROUP_HAS_OLDER);
  });

  it("turns the button back into the send button in the same breath", () => {
    expect(sendButtonLabel("sent")).toBe(GO_TO_GROUP);
    expect(sendButtonLabel(afterEdit("sent"))).toBe(SEND_IT);
  });
});
