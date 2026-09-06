import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * That the bar's step 02 and step 01's forward button wake on the SAME call
 * (run 0034).
 *
 * This project's vitest setup has no jsdom, so the wiring in `main.ts` cannot
 * be driven and asked. What can be checked is the shape of the wiring itself:
 * `syncStepTabs` is the one function that answers "is this flat ready", it
 * calls `canSend` exactly once, and both controls read that one answer rather
 * than asking again. A second `canSend` call inside that function, or a
 * control reading anything but `open`, fails here.
 *
 * It is a test on source text, which makes it brittle to renaming. That is
 * deliberate: the thing being protected is that there is ONE readiness rule
 * with ONE call site driving both controls, and a rename that splits them is
 * exactly the change this should stop.
 */

/** Read with line endings normalised: this repo checks out CRLF on Windows
 *  and LF elsewhere, and the assertions below are about code, not newlines. */
function source(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

const MAIN = source("./main.ts");

/** The body of `syncStepTabs`, from its signature to the first line that
 *  closes at column 1. */
function syncStepTabsBody(): string {
  const at = MAIN.indexOf("function syncStepTabs(): void {");
  expect(at).toBeGreaterThan(-1);
  const end = MAIN.indexOf("\n}\n", at);
  expect(end).toBeGreaterThan(at);
  return MAIN.slice(at, end);
}

describe("one readiness rule, one call site", () => {
  it("asks canSend exactly once in syncStepTabs", () => {
    const body = syncStepTabsBody();
    expect(body.match(/canSend\(/g)).toHaveLength(1);
    expect(body).toContain("const open = canSend(phase);");
  });

  it("gives the bar's step 02 and the forward button that one answer", () => {
    const body = syncStepTabsBody();
    expect(body).toContain('forwardGoBtn.setAttribute("aria-disabled", String(!open));');
    expect(body).toContain('stepSendBtn.setAttribute("aria-disabled", String(!open));');
  });

  it("says why with the same sentence in both places", () => {
    const body = syncStepTabsBody();
    expect(body).toContain("forwardWhyEl.textContent = open ? \"\" : NO_WAY_IN;");
    expect(body).toContain("stepSendBtn.title = open ? \"\" : NO_WAY_IN;");
  });

  it("leaves nothing else on the screen that sends", () => {
    // The two `.btn-send` buttons in the editor are step 01's forward button
    // and step 02's send button, and style.css hides each in the other's
    // step, so exactly one is on screen at a time.
    const html = source("../index.html");
    const editor = html.slice(html.indexOf('<div id="app">'), html.indexOf('<div id="landing"'));
    expect(editor.match(/class="btn-send"/g)).toHaveLength(2);
    const css = source("./style.css");
    expect(css).toContain('body[data-step="send"] #forward,');
    expect(css).toContain('body[data-step="draw"] #save-column,');
  });
});

/**
 * Sending sends, and writes nothing to this machine (run 0036).
 *
 * Same reason as above for testing the source text: there is no jsdom here and
 * `runSend` cannot be driven and asked. What can be checked is that the
 * function which the button calls contains the publish and contains none of
 * the three writes, which is the whole of what the change promises.
 */

/** The body of a top-level function, from its signature to the first line that
 *  closes at column 1. */
function body(name: string): string {
  const at = MAIN.indexOf(`function ${name}(`);
  expect(at, `${name} exists`).toBeGreaterThan(-1);
  const end = MAIN.indexOf("\n}\n", at);
  expect(end).toBeGreaterThan(at);
  return MAIN.slice(at, end);
}

describe("what a send does", () => {
  it("publishes the flat", () => {
    expect(body("runSend")).toContain("await publishUnit(");
  });

  it("sends the picture with it", () => {
    expect(body("runSend")).toContain("publishPreview(");
  });

  it("downloads nothing", () => {
    expect(body("runSend")).not.toContain("downloadAs(");
    expect(body("runSend")).not.toContain("createObjectURL");
  });

  it("writes no library entry", () => {
    expect(body("runSend")).not.toContain("saveLibraryEntry(");
  });

  it("opens no browser dialog", () => {
    expect(body("runSend")).not.toContain("window.confirm");
  });

  it("never asks to replace, because the store decides that by itself", () => {
    expect(body("runSend")).toContain("publishUnit(doFetch, \"\", session, id, unitName, text, false)");
    expect(MAIN).not.toContain("saveReplaceInput");
    expect(MAIN).not.toContain("takeoverConfirmText");
  });
});

describe("what is left on the screen", () => {
  it("has no design number, no What-to-write boxes and no Replace tick", () => {
    const html = source("../index.html");
    for (const id of ["save-number", "save-what-project", "save-what-unit", "save-what-library", "save-what-publish", "save-replace"]) {
      expect(html, `${id} is gone`).not.toContain(`id="${id}"`);
    }
  });

  it("holds the colour and three named things under More", () => {
    const html = source("../index.html");
    const more = html.slice(html.indexOf('id="more-body"'), html.indexOf("</section>", html.indexOf('id="more-body"')));
    expect(more).toContain('id="save-color"');
    expect(more).toContain('id="save-project-copy"');
    expect(more).toContain('id="save-library"');
    expect(more).toContain('id="save-unit-file"');
  });

  it("keeps the two the deployed build cannot do out of it", () => {
    expect(MAIN).toContain("saveLibraryBtn.hidden = !import.meta.env.DEV;");
    expect(MAIN).toContain("saveUnitFileBtn.hidden = !import.meta.env.DEV;");
  });
});
