import type { DwellingGraph } from "../core/adjacencyGraph";
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

/** Populate `panel` with the report for `violations` (resolved against `graph`),
 *  plus the depth-from-entrance metric as pure information (not pass/fail). */
export function renderValidationPanel(
  panel: HTMLElement,
  graph: DwellingGraph,
  violations: Violation[],
  depths: Map<string, number>,
  title: string,
  onClose: () => void
): void {
  // Disambiguate same-named rooms across floors when the dwelling is multi-floor.
  const multi = graph.floorCount > 1;
  const labelById = new Map(
    graph.nodes.map((n) => [n.id, multi ? `${n.label} (F${n.floor})` : n.label] as const)
  );

  const hard = violations.filter((v) => v.severity === "hard");
  const soft = violations.filter((v) => v.severity === "soft");
  const notes = violations.filter((v) => v.severity === "note");
  const issueCount = hard.length + soft.length;

  panel.replaceChildren();

  // ---- Header ----
  const header = el("div", "vp-header");
  const titleEl = el("span", "vp-title");
  titleEl.textContent = `${title} — Layout Check`;
  const close = document.createElement("button");
  close.className = "vp-close";
  close.type = "button";
  close.textContent = "✕";
  close.title = "Dismiss";
  close.addEventListener("click", onClose);
  header.append(titleEl, close);
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

  // ---- Depth-from-entrance metric (informational, not a pass/fail list) ----
  appendDepthSection(panel, graph, depths, multi);

  panel.style.display = "block";
}

/** Space-syntax depth-from-entrance: a summary line + a compact per-room list.
 *  Pure information — DP1 (the ≥threshold flag) already lives in the issue
 *  groups above; this shows the full picture the metric describes. */
function appendDepthSection(
  panel: HTMLElement,
  graph: DwellingGraph,
  depths: Map<string, number>,
  multi: boolean
): void {
  const rooms = graph.nodes
    .filter((n) => n.kind === "room" && depths.has(n.id))
    .map((n) => ({
      label: multi ? `${n.label} (F${n.floor})` : n.label,
      depth: depths.get(n.id)!,
    }))
    .sort((a, b) => a.depth - b.depth || a.label.localeCompare(b.label));
  if (rooms.length === 0) return; // no entrance yet, or nothing reachable

  const h = el("div", "vp-group-heading");
  h.textContent = "Depth from entrance";
  panel.appendChild(h);

  const max = Math.max(...rooms.map((r) => r.depth));
  const mean = rooms.reduce((sum, r) => sum + r.depth, 0) / rooms.length;
  const summary = el("div", "vp-depth-summary");
  summary.textContent = `Max ${max} hop${max === 1 ? "" : "s"} · Mean ${mean.toFixed(1)} hops · ${rooms.length} room${rooms.length === 1 ? "" : "s"}`;
  panel.appendChild(summary);

  const list = el("div", "vp-depth-list");
  for (const r of rooms) {
    const row = el("div", "vp-depth-row");
    const name = el("span", "vp-depth-name");
    name.textContent = r.label;
    const val = el("span", "vp-depth-val");
    val.textContent = String(r.depth);
    row.append(name, val);
    list.appendChild(row);
  }
  panel.appendChild(list);
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
  if (v.layout) return "Whole dwelling";
  const names = v.nodeIds.map((id) => labelById.get(id) ?? id);
  if (names.length === 0) return "";
  return (v.edge ? "Between: " : "Room: ") + names.join(v.edge ? " ↔ " : ", ");
}

function el(tag: string, className: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  return e;
}
