import type { AdjacencyGraph } from "../core/adjacencyGraph";
import type { Severity, Violation } from "../core/rules";

/**
 * Renders the on-demand "Check Layout" report into a viewport panel: a grouped,
 * colour-coded list of issues (hard above soft above neutral notes) plus a clear
 * all-good state. Pure DOM rendering — orchestration (highlighting the diagram
 * and 3D view) lives in main.ts.
 */

const SEVERITY_LABEL: Record<Severity, string> = {
  hard: "Hard",
  soft: "Soft",
  note: "Note",
};

/** Populate `panel` with the report for `violations` (resolved against `graph`). */
export function renderValidationPanel(
  panel: HTMLElement,
  graph: AdjacencyGraph,
  violations: Violation[],
  floorLabel: string,
  onClose: () => void
): void {
  const labelById = new Map(graph.nodes.map((n) => [n.id, n.label] as const));

  const hard = violations.filter((v) => v.severity === "hard");
  const soft = violations.filter((v) => v.severity === "soft");
  const notes = violations.filter((v) => v.severity === "note");
  const issueCount = hard.length + soft.length;

  panel.replaceChildren();

  // ---- Header ----
  const header = el("div", "vp-header");
  const title = el("span", "vp-title");
  title.textContent = `${floorLabel} — Layout Check`;
  const close = document.createElement("button");
  close.className = "vp-close";
  close.type = "button";
  close.textContent = "✕";
  close.title = "Dismiss";
  close.addEventListener("click", onClose);
  header.append(title, close);
  panel.appendChild(header);

  // ---- Summary line ----
  const summary = el("div", "vp-summary");
  if (issueCount === 0) {
    summary.classList.add("ok");
    summary.textContent = "✓ No issues found — layout passes all rules.";
  } else {
    const bits: string[] = [];
    if (hard.length) bits.push(`${hard.length} hard`);
    if (soft.length) bits.push(`${soft.length} soft`);
    summary.textContent = `${issueCount} issue${issueCount > 1 ? "s" : ""} (${bits.join(", ")})`;
  }
  panel.appendChild(summary);

  // ---- Issue groups ----
  appendGroup(panel, "Hard — likely failures", hard, labelById);
  appendGroup(panel, "Soft — atypical, not wrong", soft, labelById);
  appendGroup(panel, "Notes", notes, labelById);

  panel.style.display = "block";
}

function appendGroup(
  panel: HTMLElement,
  heading: string,
  items: Violation[],
  labelById: Map<string, string>
): void {
  if (items.length === 0) return;
  const h = el("div", "vp-group-heading");
  h.textContent = heading;
  panel.appendChild(h);

  for (const v of items) {
    const row = el("div", `vp-item ${v.severity}`);

    const tag = el("span", `vp-tag ${v.severity}`);
    tag.textContent = `${v.ruleId} · ${SEVERITY_LABEL[v.severity]}`;
    row.appendChild(tag);

    const desc = el("div", "vp-desc");
    desc.textContent = v.description;
    row.appendChild(desc);

    const who = involvedText(v, labelById);
    if (who) {
      const sub = el("div", "vp-rooms");
      sub.textContent = who;
      row.appendChild(sub);
    }
    panel.appendChild(row);
  }
}

function involvedText(v: Violation, labelById: Map<string, string>): string {
  if (v.layout) return "Whole floor";
  const names = v.nodeIds.map((id) => labelById.get(id) ?? id);
  if (names.length === 0) return "";
  return (v.edge ? "Between: " : "Room: ") + names.join(v.edge ? " ↔ " : ", ");
}

function el(tag: string, className: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  return e;
}
