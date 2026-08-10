import { describe, it, expect } from "vitest";
import {
  planOutputs,
  isEmptySelection,
  needsUnitBuild,
  needsRuleConfirm,
  unitGateResults,
  outputLabel,
  type SaveSelection,
} from "./savePlan";

/**
 * The checkbox combinations, all eight of them, and the rule that makes a
 * failed unit survivable. `savePlan.ts` is pure precisely so this can be
 * exhaustive without a DOM, a canvas or a dev server.
 */

/** Every selection, as `[project, unit, library]` bit patterns. */
const ALL: SaveSelection[] = [0, 1, 2, 3, 4, 5, 6, 7].map((bits) => ({
  project: Boolean(bits & 1),
  unit: Boolean(bits & 2),
  library: Boolean(bits & 4),
}));

const sel = (project: boolean, unit: boolean, library: boolean): SaveSelection => ({
  project,
  unit,
  library,
});

describe("planOutputs — the eight combinations", () => {
  it("returns exactly the ticked outputs, in display order", () => {
    expect(planOutputs(sel(false, false, false))).toEqual([]);
    expect(planOutputs(sel(true, false, false))).toEqual(["project"]);
    expect(planOutputs(sel(false, true, false))).toEqual(["unit"]);
    expect(planOutputs(sel(false, false, true))).toEqual(["library"]);
    expect(planOutputs(sel(true, true, false))).toEqual(["project", "unit"]);
    expect(planOutputs(sel(true, false, true))).toEqual(["project", "library"]);
    expect(planOutputs(sel(false, true, true))).toEqual(["unit", "library"]);
    expect(planOutputs(sel(true, true, true))).toEqual(["project", "unit", "library"]);
  });

  it("never invents an output nobody asked for", () => {
    for (const s of ALL)
      for (const kind of planOutputs(s)) expect(s[kind]).toBe(true);
  });

  it("counts the outputs it was given", () => {
    for (const s of ALL)
      expect(planOutputs(s).length).toBe(
        Number(s.project) + Number(s.unit) + Number(s.library)
      );
  });
});

describe("isEmptySelection", () => {
  it("is true only when nothing is ticked", () => {
    for (const s of ALL)
      expect(isEmptySelection(s)).toBe(!s.project && !s.unit && !s.library);
  });
});

describe("needsUnitBuild", () => {
  it("is true iff the unit file or the library entry is wanted", () => {
    for (const s of ALL) expect(needsUnitBuild(s)).toBe(s.unit || s.library);
  });

  it("is false for a project-only save, which is what keeps that save cheap", () => {
    expect(needsUnitBuild(sel(true, false, false))).toBe(false);
  });
});

describe("needsRuleConfirm", () => {
  it("asks once when a unit is being written and rules are failing", () => {
    expect(needsRuleConfirm(sel(false, true, false), 3)).toBe(true);
    expect(needsRuleConfirm(sel(false, false, true), 1)).toBe(true);
    expect(needsRuleConfirm(sel(true, true, true), 1)).toBe(true);
  });

  it("never asks for a project-only save — rules describe what the unit promises", () => {
    expect(needsRuleConfirm(sel(true, false, false), 12)).toBe(false);
  });

  it("never asks when nothing is failing", () => {
    for (const s of ALL) expect(needsRuleConfirm(s, 0)).toBe(false);
  });
});

describe("unitGateResults — a failed unit must not cancel the project", () => {
  const reason = "No usable entrance: the unit needs at least one NON-blocked entrance on floor 0";

  it("fails the unit-derived outputs and leaves the project pending", () => {
    const results = unitGateResults(sel(true, true, true), reason);
    expect(results.map((r) => r.kind)).toEqual(["project", "unit", "library"]);
    expect(results.find((r) => r.kind === "project")!.status).toBe("pending");
    expect(results.find((r) => r.kind === "unit")!.status).toBe("failed");
    expect(results.find((r) => r.kind === "library")!.status).toBe("failed");
  });

  it("carries the gate's own reason into both failed lines", () => {
    for (const r of unitGateResults(sel(false, true, true), reason))
      expect(r.detail).toContain(reason);
  });

  it("marks nothing failed that was never asked for", () => {
    const results = unitGateResults(sel(true, false, false), reason);
    expect(results).toEqual([{ kind: "project", status: "pending", detail: "" }]);
  });

  it("leaves the project row untouched in every selection that includes it", () => {
    for (const s of ALL.filter((s) => s.project)) {
      const project = unitGateResults(s, reason).find((r) => r.kind === "project")!;
      expect(project.status).not.toBe("failed");
      expect(project.status).not.toBe("skipped");
    }
  });
});

describe("outputLabel", () => {
  it("names each output the way the dialog does", () => {
    expect(outputLabel("project")).toBe("Project file");
    expect(outputLabel("unit")).toBe("Unit file");
    expect(outputLabel("library")).toBe("Library entry");
  });
});
