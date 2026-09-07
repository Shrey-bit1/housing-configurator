import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { JOURNEY } from "./core/journey";

/**
 * The landing is ONE file that two repositories share (run 0037 / bottom-up
 * 0062), and this is what stops it drifting again.
 *
 * The two apps share no code. They share a folder,
 * `D:\\_Studies\\_DFAB\\DFAB\\_T3\\Context\\01-design\\landing\\`, and each
 * carries a byte-for-byte copy. A copy is a thing that can be edited, so each
 * app hashes its own copy and compares it to a line in the brief that both
 * apps read. If somebody edits a copy rather than the source, the app that
 * carries it fails here and says so.
 *
 * `interoperability`'s §3.5 is the shape: a shared store of record with copies
 * that check themselves against it, rather than a live link neither repository
 * can have. Its §1.4 names the loss this is against, semantic loss: two
 * landings that still LOOK like landings while having quietly stopped being
 * the same one.
 *
 * The hash normalises line endings on purpose. This repository checks the
 * files out with CRLF and the Context folder holds them with LF, so a hash
 * over raw bytes would report two identical files as different.
 */

const DIR = new URL("../_cowork/design/landing/", import.meta.url);
const BRIEF = new URL("../_cowork/design/DESIGN-BRIEF-3sep.md", import.meta.url);

/** Read with line endings normalised, which is what the fingerprint is over. */
function read(name: string): string {
  return readFileSync(new URL(name, DIR), "utf8").replace(/\r\n/g, "\n");
}

/** A selector, made safe to drop into a regular expression. */
const escape = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const html = read("landing.html");
const css = read("landing.css");

describe("the shared landing cannot drift", () => {
  it("hashes to what the brief records", () => {
    const recorded = /LANDING FINGERPRINT sha256 ([0-9a-f]{64})/.exec(
      readFileSync(BRIEF, "utf8")
    );
    expect(recorded, "the brief carries a LANDING FINGERPRINT line").not.toBe(null);
    const actual = createHash("sha256").update(html + css, "utf8").digest("hex");
    expect(
      actual,
      "the landing has drifted from the shared one: this app's copy of " +
        "landing.html and landing.css no longer hashes to the line in the " +
        "brief. Copy them again from Context\\01-design\\landing\\, or, if " +
        "the change was meant, make it there and update the brief."
    ).toBe(recorded![1]);
  });

  it("is the file both apps read, not a description of it", () => {
    // A guard against somebody "fixing" the fragment by making it app-specific.
    expect(html).toContain('data-app="flat"');
    expect(css).toContain('#landing[data-app="flat"]');
    expect(css).toContain('#landing[data-app="building"]');
  });
});

/** Which doors each value of the switch shows. The CSS hides by `data-for`, so
 *  the test reads the attribute the same way the rule does. */
function shownIn(app: "flat" | "building"): string[] {
  const out: string[] = [];
  const re = /<(?:button|p)[^>]*\bid="([^"]+)"[^>]*\bdata-for="(flat|building|both)"|<(?:button|p)[^>]*\bclass="([^"]*)"[^>]*\bdata-for="(flat|building|both)"/g;
  for (const m of html.matchAll(re)) {
    const id = m[1] ?? m[3];
    const forWhom = m[2] ?? m[4];
    if (forWhom === "both" || forWhom === app) out.push(id);
  }
  return out;
}

describe("the switch, door by door", () => {
  it("gives the flat app its four doors and the aside", () => {
    expect(shownIn("flat")).toEqual([
      "landing-start",
      "landing-new",
      "landing-join",
      "landing-open",
      "landing-aside",
    ]);
  });

  it("gives the building app its three, and none of the flat app's", () => {
    expect(shownIn("building")).toEqual([
      "landing-join",
      "landing-open-building",
      "landing-example",
    ]);
  });

  it("shares one Join a group door rather than carrying two", () => {
    expect(html.match(/data-for="both"/g)).toHaveLength(1);
    expect(html.match(/id="landing-join"/g)).toHaveLength(1);
  });

  it("hides the other app's doors with one rule over one attribute", () => {
    expect(css).toContain('#landing[data-app="flat"] [data-for="building"],');
    expect(css).toContain('#landing[data-app="building"] [data-for="flat"] {');
  });

  it("gives every door a stable id, so an app wires handlers without editing markup", () => {
    for (const id of [
      "landing-start",
      "landing-new",
      "landing-join",
      "landing-open",
      "landing-open-building",
      "landing-example",
      "landing-group",
    ]) {
      expect(html, `${id} is in the fragment`).toContain(`id="${id}"`);
    }
  });
});

describe("the switch, dot by dot", () => {
  it("carries all six steps, in JOURNEY's order and wording", () => {
    for (const step of JOURNEY) {
      expect(html).toContain(`id="journey-${step.id}" data-owner="${step.app}"`);
      expect(html).toContain(`>${step.label}</span>`);
    }
  });

  it("puts them in the fragment in the order JOURNEY has them", () => {
    // `journey-strip` is the container, not a step.
    const ids = [...html.matchAll(/class="journey-step" id="journey-([a-z-]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(JOURNEY.map((s) => s.id));
  });

  it("gives each app's own steps the ink and leaves the other's dim", () => {
    // `dim` is what a dot already is, so only the ink half needs a rule.
    expect(css).toContain('#landing[data-app="flat"] .journey-step[data-owner="flat"] .journey-dot,');
    expect(css).toContain('#landing[data-app="building"] .journey-step[data-owner="building"] .journey-dot {');
  });

  it("puts the red on each app's own first step", () => {
    expect(css).toContain('#landing[data-app="flat"] #journey-draw .journey-dot,');
    expect(css).toContain('#landing[data-app="building"] #journey-wishes .journey-dot {');
    expect(JOURNEY.find((s) => s.app === "flat")!.id).toBe("draw");
    expect(JOURNEY.find((s) => s.app === "building")!.id).toBe("wishes");
  });
});

describe("the arrival, in the shared file", () => {
  it("carries the eleven delays, and the doors take theirs by id", () => {
    for (const [selector, delay] of [
      ["#landing .landing-disc", "1000ms"],
      ["#landing .landing-title span:nth-child(1)", "1600ms"],
      ["#landing .landing-title span:nth-child(2)", "1750ms"],
      ["#landing .landing-title span:nth-child(3)", "1900ms"],
      ["#landing .landing-lead", "2200ms"],
      ['#landing[data-app="flat"] #landing-start', "2500ms"],
      ['#landing[data-app="flat"] #landing-new', "2600ms"],
      ['#landing[data-app="flat"] #landing-join', "2700ms"],
      ['#landing[data-app="flat"] #landing-open', "2800ms"],
      ['#landing[data-app="flat"] .landing-aside', "2900ms"],
      ["#landing .landing-journey", "3200ms"],
    ] as const) {
      // Some of these have a base rule as well as their delay, so every rule
      // with this selector is read and one of them must carry it.
      const blocks = [...css.matchAll(new RegExp(escape(selector) + " \\{([^}]*)\\}", "g"))].map(
        (m) => m[1]
      );
      expect(blocks.length, `${selector} has a rule`).toBeGreaterThan(0);
      expect(blocks.some((b) => b.includes(delay)), `${selector} is delayed ${delay}`).toBe(true);
    }
  });

  it("gives the building app's doors the same first three delays", () => {
    for (const [selector, delay] of [
      ['#landing[data-app="building"] #landing-open-building', "2500ms"],
      ['#landing[data-app="building"] #landing-join', "2600ms"],
      ['#landing[data-app="building"] #landing-example', "2700ms"],
    ] as const) {
      const at = css.indexOf(selector + " {");
      expect(at, `${selector} has a rule`).toBeGreaterThan(-1);
      expect(css.slice(at, at + 200)).toContain(delay);
    }
  });

  it("is honest if it never runs: every keyframe has a from and no to", () => {
    for (const name of ["landing-disc", "landing-arrive"]) {
      const at = css.indexOf(`@keyframes ${name} {`);
      expect(at).toBeGreaterThan(-1);
      const block = css.slice(at, css.indexOf("\n}", at));
      expect(block).toContain("from {");
      expect(block).not.toContain("to {");
    }
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});

describe("the fragment stands on its own", () => {
  it("declares every colour it uses rather than reading an app's :root", () => {
    const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]));
    const declared = new Set(
      [...css.matchAll(/^\s{2}(--[a-z0-9-]+):/gm)].map((m) => m[1])
    );
    for (const name of used) {
      expect(declared.has(name), `${name} is declared on #landing itself`).toBe(true);
    }
  });

  it("scopes every rule under #landing, so no app rule can reach it", () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors = [...bare.matchAll(/^([^@\s}][^{}]*)\{/gm)].map((m) => m[1].trim());
    for (const sel of selectors) {
      for (const part of sel.split(",")) {
        const t = part.trim();
        if (t === "" || /^\d+%$/.test(t) || t.startsWith("from") || t.startsWith("to")) continue;
        expect(t.startsWith("#landing"), `"${t}" is scoped under #landing`).toBe(true);
      }
    }
  });
});
