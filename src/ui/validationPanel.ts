import type { DwellingGraph } from "../core/adjacencyGraph";
import {
  computeCirculationFraction,
  computeCirculationFractionByFloor,
  publicVsBedroomDepth,
  type Severity,
  type Violation,
} from "../core/rules";

/**
 * Renders the on-demand "Check Layout" report as the horizontal bottom sheet of
 * handoff Part 2, direction 1a. The sheet is 256px tall and spans the viewport.
 * Its header carries a proportional severity bar over the tier counts, then the
 * dwelling-wide metrics line and a close control. Under the header a
 * horizontally scrolling rail holds one card per violation, followed by the two
 * informational cards (glazing orientation, depth from entrance) that the
 * previous vertical panel carried as trailing sections.
 *
 * WHAT THIS REPLACED. Until this change the report was a 300px column pinned to
 * the top left of the viewport, scrolling vertically through grouped sections.
 * Everything it showed is still shown; the axis changed, and the metrics that
 * used to sit at the bottom of a long scroll now sit in the header where they
 * are read without scrolling at all.
 *
 * Pure DOM rendering. Orchestration — highlighting the diagram and the 3D view,
 * INCLUDING the hover emphasis — lives in main.ts; this file only fires
 * `onHoverViolation` on mouseenter/mouseleave.
 */

const SEVERITY_LABEL: Record<Severity, string> = {
  hard: "Hard",
  soft: "Soft",
  note: "Note",
};

/**
 * The suggested move a card offers beside its target chip.
 *
 * Display-only, and keyed by rule id ON PURPOSE. `RULES` describes what is
 * wrong; the advice about what to do next is chrome, so keeping it here leaves
 * `validate()`'s returned data untouched and keeps `rules.test.ts` blind to this
 * file. A rule with no entry renders no action line, which is the design
 * prototype's own empty-hint state, and it is the right state for the notes,
 * where the point is that there is nothing to do.
 */
const ACTION_BY_RULE: Record<string, string> = {
  E2: "clear whatever now sits against that edge",
  P1: "place a bathroom",
  P2: "place a kitchen",
  MB1: "add a bathroom on that floor",
  H1: "add a door on a route back to the entrance",
  H2: "add a second door that avoids the bathroom",
  H3: "add a second door that avoids the bedroom",
  H4: "move the door to the hall",
  H6: "add a door that stays inside",
  C1: "give it a door, or remove it",
  C2: "connect it to a second space",
  A1: "widen it by one cell",
  O1: "add a door onto it",
  OD1: "add a door on a route back to the entrance",
  ST3: "add a stair reaching that floor",
  ST1: "add a door at the missing end",
  ST2: "add a door on a route back to the entrance",
  D1: "move it to the perimeter",
  D2: "move it to the perimeter",
  W1: "widen its facade, or move it to a longer edge",
  OR1: "turn the project north, or move it to another edge",
  OR2: "turn the project north, or move it to another edge",
  G1: "give one bathroom a door off the hall",
  G2: "put a hall between the entrance and that room",
  S1: "close one of its doors",
  S2: "add a door to it",
  S3: "put a hall between them",
  AC1: "put a hall or a store between them",
  DP1: "add a door that shortens the route",
  N1: "absorb some corridor into the rooms beside it",
  PG1: "move the bedrooms deeper, or the living spaces shallower",
  F1: "add a door that shortens the route to an exit or a stair",
  WET1: "move the wet rooms together",
  FAC1: "square the facade line",
};

/** Populate `panel` with the report for `violations` (resolved against `graph`),
 *  plus the depth-from-entrance metric as pure information (not pass/fail). */
export function renderValidationPanel(
  panel: HTMLElement,
  graph: DwellingGraph,
  violations: Violation[],
  depths: Map<string, number>,
  onClose: () => void,
  onHoverViolation: (v: Violation | null) => void
): void {
  const multi = graph.floorCount > 1;
  const disambiguate = makeLabeller(graph);
  const labelById = new Map(graph.nodes.map((n) => [n.id, disambiguate(n)] as const));

  const hard = violations.filter((v) => v.severity === "hard");
  const soft = violations.filter((v) => v.severity === "soft");
  const notes = violations.filter((v) => v.severity === "note");

  panel.replaceChildren();
  panel.append(
    buildHeader(graph, depths, hard.length, soft.length, notes.length, clearRooms(graph, violations), onClose),
    buildRail(graph, depths, [...hard, ...soft, ...notes], labelById, multi, onHoverViolation)
  );
  panel.style.display = "flex";
}

/**
 * How many rooms nothing was said about — the severity bar's fourth segment.
 *
 * Counting rooms rather than subtracting the violation total is what keeps the
 * segment meaningful: a dwelling can carry more violations than it has rooms
 * (flat-1 carries 17 across 13), and the subtraction would floor at zero exactly
 * on the layouts that need the reference length most. This never can: it is the
 * rooms that appear in no violation's `nodeIds`, so a clean dwelling reads as a
 * bar of plate and a bad one reads as a bar of colour.
 */
function clearRooms(graph: DwellingGraph, violations: Violation[]): number {
  const flagged = new Set<string>();
  for (const v of violations) for (const id of v.nodeIds) flagged.add(id);
  return graph.nodes.filter((n) => n.kind === "room" && !flagged.has(n.id)).length;
}

// ---------------------------------------------------------------- header ----

function buildHeader(
  graph: DwellingGraph,
  depths: Map<string, number>,
  hardCount: number,
  softCount: number,
  noteCount: number,
  clearCount: number,
  onClose: () => void
): HTMLElement {
  const head = el("div", "vs-head");

  const title = el("span", "vs-title");
  title.textContent = "Layout check";
  head.appendChild(title);

  // --- 340px summary block: the proportional bar over the counts ---
  const block = el("div", "vs-summary");

  // The fourth segment is what was NOT flagged, so a mostly-clean dwelling reads
  // as mostly plate rather than as a bar of three colours at full width.
  const bar = el("div", "vs-bar");
  bar.append(
    barSeg("hard", hardCount),
    barSeg("soft", softCount),
    barSeg("note", noteCount),
    barSeg("clear", clearCount)
  );
  block.appendChild(bar);

  const counts = el("div", "vs-counts");
  if (hardCount + softCount === 0) {
    const ok = el("span", "vs-ok");
    ok.textContent = "✓ No issues found — layout passes all rules.";
    counts.appendChild(ok);
    if (noteCount > 0) counts.appendChild(count(noteCount, SEVERITY_LABEL.note.toLowerCase()));
  } else {
    counts.append(
      count(hardCount, SEVERITY_LABEL.hard.toLowerCase()),
      count(softCount, SEVERITY_LABEL.soft.toLowerCase()),
      count(noteCount, SEVERITY_LABEL.note.toLowerCase())
    );
  }
  // Honest without a timer: the report is dropped on every layout change
  // (`floors.onLayoutChange` in main.ts), so a visible sheet is never stale, and
  // a ticking "3 min ago" would be motion after arrival for no information.
  const when = el("span", "vs-when");
  when.textContent = "checked just now";
  counts.appendChild(when);
  block.appendChild(counts);
  head.appendChild(block);

  const metrics = el("span", "vs-metrics");
  metrics.textContent = metricsLine(graph, depths);
  head.appendChild(metrics);

  const close = document.createElement("button");
  close.className = "vs-close";
  close.type = "button";
  close.textContent = "✕";
  close.title = "Dismiss";
  close.setAttribute("aria-label", "Dismiss");
  close.addEventListener("click", onClose);
  head.appendChild(close);

  return head;
}

function barSeg(tier: string, n: number): HTMLElement {
  const s = el("span", `vs-bar-seg ${tier}`);
  s.style.flex = String(n);
  return s;
}

function count(n: number, word: string): HTMLElement {
  const s = el("span", "vs-count");
  const strong = document.createElement("strong");
  strong.textContent = String(n);
  s.append(strong, ` ${word}`);
  return s;
}

/** One line of dwelling-wide numbers: circulation share (with the per-floor
 *  rider on a multi-floor dwelling), the depth summary, and the privacy
 *  gradient. These were three separate sections at the bottom of the old
 *  vertical panel's scroll. */
function metricsLine(graph: DwellingGraph, depths: Map<string, number>): string {
  const parts: string[] = [];

  const frac = computeCirculationFraction(graph);
  if (frac !== null) {
    let s = `Circulation ${Math.round(frac * 100)}% of interior`;
    if (graph.floorCount > 1) {
      const perFloor = [...computeCirculationFractionByFloor(graph)].sort((a, b) => a[0] - b[0]);
      if (perFloor.length) {
        s += ` (${perFloor.map(([f, v]) => `F${f} ${Math.round(v * 100)}%`).join(" · ")})`;
      }
    }
    parts.push(s);
  }

  const reached = graph.nodes.filter((n) => n.kind === "room" && depths.has(n.id));
  if (reached.length) {
    const ds = reached.map((n) => depths.get(n.id)!);
    const max = Math.max(...ds);
    const mean = ds.reduce((a, b) => a + b, 0) / ds.length;
    parts.push(`depth max ${max}, mean ${mean.toFixed(1)}`);
    const pg = publicVsBedroomDepth(graph, depths);
    if (pg) parts.push(`public ${pg.publicMean.toFixed(1)} vs beds ${pg.bedroomMean.toFixed(1)}`);
  }

  return parts.join(" · ");
}

// ------------------------------------------------------------------ rail ----

function buildRail(
  graph: DwellingGraph,
  depths: Map<string, number>,
  ordered: Violation[],
  labelById: Map<string, string>,
  multi: boolean,
  onHoverViolation: (v: Violation | null) => void
): HTMLElement {
  const rail = el("div", "vs-rail");

  // Grouped duplicates: the design is silent on how `OR1 ×2` should read, and
  // MERGING them is the one option that cannot work — hover emphasis targets one
  // violation's rooms, so a merged card would have nothing single to point at.
  // Each violation keeps its own card and its own hover, and repeats carry an
  // ordinal on the rule chip so two OR1 cards read as two of a kind rather than
  // as a duplicate the report failed to collapse.
  const totalById = new Map<string, number>();
  for (const v of ordered) totalById.set(v.ruleId, (totalById.get(v.ruleId) ?? 0) + 1);
  const seen = new Map<string, number>();

  for (const v of ordered) {
    const nth = (seen.get(v.ruleId) ?? 0) + 1;
    seen.set(v.ruleId, nth);
    const of = totalById.get(v.ruleId)!;
    rail.appendChild(issueCard(v, of > 1 ? `${v.ruleId} (${nth}/${of})` : v.ruleId, labelById, onHoverViolation));
  }

  const glazing = glazingCard(graph);
  if (glazing) rail.appendChild(glazing);
  const depth = depthCard(graph, depths, multi);
  if (depth) rail.appendChild(depth);

  bindWheelToScroll(rail);
  return rail;
}

function issueCard(
  v: Violation,
  ruleLabel: string,
  labelById: Map<string, string>,
  onHoverViolation: (v: Violation | null) => void
): HTMLElement {
  const card = el("div", `vs-card ${v.severity}`);

  // Dwelling-level entries (G1, the P-rules, N1's layout line) have no node or
  // edge to point at — leave them non-interactive rather than wiring a hover
  // that would emphasize nothing.
  if (v.nodeIds.length > 0 || v.edge) {
    card.classList.add("hoverable");
    card.addEventListener("mouseenter", () => onHoverViolation(v));
    card.addEventListener("mouseleave", () => onHoverViolation(null));
  }

  const head = el("div", "vs-card-head");
  const tier = el("span", `vs-tier ${v.severity}`);
  tier.textContent = SEVERITY_LABEL[v.severity];
  const rule = el("span", "vs-rule");
  rule.textContent = ruleLabel;
  head.append(tier, rule);
  card.appendChild(head);

  const msg = el("div", "vs-msg");
  msg.textContent = v.description;
  card.appendChild(msg);

  const foot = el("div", "vs-card-foot");
  const who = involvedText(v, labelById);
  if (who) {
    const chip = el("span", "vs-where");
    chip.textContent = who;
    foot.appendChild(chip);
  }
  const action = ACTION_BY_RULE[v.ruleId];
  if (action) {
    const hint = el("span", "vs-action");
    hint.textContent = action;
    foot.appendChild(hint);
  }
  if (foot.childElementCount > 0) card.appendChild(foot);

  return card;
}

/** Per-room glazing orientation, e.g. "Living Room: S + E" — the derived compass
 *  sectors each room's windows face (most-southern first, from
 *  `node.glazing.sectors`, computed under the project north). Only rooms that
 *  actually have glazing are listed; a corner-wrapped band shows both its
 *  sectors. OR1 (lit only from the north) reads the same underlying data. */
function glazingCard(graph: DwellingGraph): HTMLElement | null {
  const disambiguate = makeLabeller(graph);
  const rooms = graph.nodes.filter(
    (n) => n.kind === "room" && n.glazing && n.glazing.sectors.length > 0
  );
  if (rooms.length === 0) return null;

  const card = infoCard("Glazing orientation");
  const list = el("div", "vs-list");
  for (const n of rooms) list.appendChild(listRow(disambiguate(n), n.glazing!.sectors.join(" + ")));
  card.appendChild(list);
  return card;
}

/** Space-syntax depth-from-entrance, one row per reachable room. Pure
 *  information — DP1 (the ≥threshold flag) has its own card in the rail, and the
 *  max/mean summary is in the header's metrics line; this is the full picture
 *  behind both. */
function depthCard(
  graph: DwellingGraph,
  depths: Map<string, number>,
  _multi: boolean
): HTMLElement | null {
  const disambiguate = makeLabeller(graph);
  const rooms = graph.nodes
    .filter((n) => n.kind === "room" && depths.has(n.id))
    .map((n) => ({ label: disambiguate(n), depth: depths.get(n.id)! }))
    .sort((a, b) => a.depth - b.depth || a.label.localeCompare(b.label));
  if (rooms.length === 0) return null; // no entrance yet, or nothing reachable

  const card = infoCard(`Depth from entrance · ${rooms.length} rooms`);
  const list = el("div", "vs-list");
  for (const r of rooms) list.appendChild(listRow(r.label, String(r.depth)));
  card.appendChild(list);
  return card;
}

function infoCard(title: string): HTMLElement {
  const card = el("div", "vs-card info");
  const head = el("div", "vs-card-head");
  const tier = el("span", "vs-tier info");
  tier.textContent = title;
  head.appendChild(tier);
  card.appendChild(head);
  return card;
}

function listRow(name: string, value: string): HTMLElement {
  const row = el("div", "vs-list-row");
  const n = el("span", "vs-list-name");
  n.textContent = name;
  const v = el("span", "vs-list-val");
  v.textContent = value;
  row.append(n, v);
  return row;
}

/**
 * Vertical wheel scrolls the rail horizontally.
 *
 * `preventDefault` is called ONLY while the rail can still move in the direction
 * the wheel asks for. At either end the event falls through untouched, so a
 * trackpad's momentum never traps the page: scrolling past the last card behaves
 * exactly as if the rail were not there. A gesture that is already mostly
 * horizontal is left alone entirely — the browser's own horizontal scroll is
 * better than anything reimplemented here.
 */
function bindWheelToScroll(rail: HTMLElement): void {
  rail.addEventListener(
    "wheel",
    (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = rail.scrollWidth - rail.clientWidth;
      if (max <= 0) return;
      const roomLeft = e.deltaY > 0 ? max - rail.scrollLeft : rail.scrollLeft;
      if (roomLeft <= 0) return;
      rail.scrollLeft += e.deltaY;
      e.preventDefault();
    },
    { passive: false }
  );
}

// ----------------------------------------------------------------- shared ----

/**
 * THE label a violation message shows for a node, disambiguated only as far as it
 * has to be.
 *
 * The floor suffix separates rooms across floors when the dwelling is
 * multi-floor. Two rooms of the SAME type on the SAME floor still rendered
 * identically, so a report could say "Room: Bathroom — Small (F0)" twice and name
 * two different rooms with no way to tell them apart. Where a label collides, and
 * only there, the room's anchor cell is appended: `Bathroom — Small (F0, 8,14)`.
 * Labels that are already unique are untouched, so the common case reads exactly
 * as before.
 *
 * The anchor is the footprint's minimum cell: stable under redraw, and unlike an
 * instance id it is something the user can find on the grid.
 */
function makeLabeller(graph: DwellingGraph): (n: DwellingGraph["nodes"][number]) => string {
  const multi = graph.floorCount > 1;
  const base = (n: DwellingGraph["nodes"][number]) =>
    multi ? `${n.label} (F${n.floor})` : n.label;
  const counts = new Map<string, number>();
  for (const n of graph.nodes) counts.set(base(n), (counts.get(base(n)) ?? 0) + 1);
  return (n) => {
    const b = base(n);
    if ((counts.get(b) ?? 0) < 2) return b;
    const cx = Math.min(...n.cells.map((c) => c.cx));
    const cz = Math.min(...n.cells.map((c) => c.cz));
    return multi ? `${n.label} (F${n.floor}, ${cx},${cz})` : `${n.label} (${cx},${cz})`;
  };
}

function involvedText(v: Violation, labelById: Map<string, string>): string {
  if (v.layout) return "Whole dwelling";
  const names = v.nodeIds.map((id) => labelById.get(id) ?? id);
  if (names.length === 0) return "";
  return names.join(v.edge ? " ↔ " : ", ");
}

function el(tag: string, className: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  return e;
}
