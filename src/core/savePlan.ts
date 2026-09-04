/**
 * What one Save writes — the pure decision layer behind the save dialog.
 *
 * The three outputs stay three separate things (PROJECT_STATE §11): a project
 * file is the whole design and the only thing that reopens for editing, a unit
 * file is the contract with the building (docs/bridge-format.md), and a library
 * entry is a unit plus a preview plus a manifest row (docs/library-format.md).
 * This module collapses only the DOING: it says which outputs a selection asks
 * for, what each one needs before it can be attempted, and what becomes of the
 * others when one of them fails.
 *
 * It is pure so the combination rules can be tested without a DOM, a canvas or
 * a dev server — `src/core/savePlan.test.ts` covers all eight selections and
 * both gate outcomes. `src/main.ts` is thin wiring over it.
 */

export type OutputKind = "project" | "unit" | "library" | "publish";

export interface SaveSelection {
  /** The project JSON download, `flat-<n>.json`. */
  project: boolean;
  /** The `dwelling-unit` JSON download, `unit-<n>.json`. */
  unit: boolean;
  /** The library entry: the same unit file plus a JPEG preview and a manifest row. */
  library: boolean;
  /** The same unit file, sent to the session store (docs/store.md) as `unit-<n>`. Run 0023. */
  publish: boolean;
}

export type OutputStatus = "pending" | "written" | "failed" | "skipped";

export interface OutputResult {
  kind: OutputKind;
  status: OutputStatus;
  /** One line of honest feedback: what was written and where, or why not. */
  detail: string;
}

/** Fixed display order, so the result block reads the same way every time. */
const ORDER: OutputKind[] = ["project", "unit", "library", "publish"];

/** The outputs a selection asks for, in display order. */
export function planOutputs(sel: SaveSelection): OutputKind[] {
  return ORDER.filter((k) => sel[k]);
}

/** Nothing ticked is not a save. The dialog disables its Save button on this. */
export function isEmptySelection(sel: SaveSelection): boolean {
  return planOutputs(sel).length === 0;
}

/**
 * Whether this selection has to run `buildUnitExport` at all. The unit file,
 * the library entry and the published flat are all built from that one
 * result; the project file is serialized independently and never touches it.
 * This is what makes a unit HARD GATE failure survivable: the project save
 * does not depend on it.
 */
export function needsUnitBuild(sel: SaveSelection): boolean {
  return sel.unit || sel.library || sel.publish;
}

/**
 * Whether to raise the advisory hard-rule confirm, and raise it ONCE. Rules
 * describe the dwelling the unit file promises to the building, so a project
 * save alone never asks. Three trips through the menu asked up to twice; one
 * dialog asks at most once.
 */
export function needsRuleConfirm(sel: SaveSelection, hardViolations: number): boolean {
  return needsUnitBuild(sel) && hardViolations > 0;
}

/**
 * The results when `buildUnitExport` refuses at a hard gate (no usable
 * entrance, disconnected footprint). The unit-derived outputs fail with the
 * gate's own reason and EVERY OTHER SELECTED OUTPUT IS UNAFFECTED — the
 * project file is still written, which is the whole point of returning results
 * per output rather than cancelling the save.
 */
export function unitGateResults(sel: SaveSelection, reason: string): OutputResult[] {
  return planOutputs(sel).map((kind) =>
    kind === "project"
      ? { kind, status: "pending" as const, detail: "" }
      : {
          kind,
          status: "failed" as const,
          detail: `not written — ${reason}`,
        }
  );
}

/** Human label for a result line's leading word. Words only (run 0026): a
 *  resident reads "Group", never "Session" — the `OutputKind` identifier
 *  keeps its name (`SaveSelection.publish`, `planOutputs`, …). */
export function outputLabel(kind: OutputKind): string {
  return kind === "project"
    ? "Project file"
    : kind === "unit"
      ? "Unit file"
      : kind === "library"
        ? "Library entry"
        : "Group";
}
