import {
  parseDwellingNodeId,
  type DwellingGraph,
  type GraphEdge,
  type GraphNode,
} from "../core/adjacencyGraph";
import {
  SEVERITY_COLORS,
  worstSeverity,
  type Severity,
  type Violation,
} from "../core/rules";

/** Per-node layout state for the force-directed diagram. */
interface NodePos {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** A cross-floor stair connection shown as a stub on the active floor. */
interface StairStub {
  localId: string;
  dir: "up" | "down";
  otherFloor: number;
  /** True when a door gates this cross-floor link (solid); false = physical
   *  stair-over touch only (dashed). */
  viaDoor: boolean;
}

/** Unordered node-id pair key, for matching highlighted adjacencies to edges. */
function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

const BG = "#e4e0d6"; // matches the 3D canvas background
const LINE = "#1a1a1a"; // ACCESS (doored) edge — solid, reads as "connected"
const TOUCH = "#b9b3a7"; // TOUCH-only edge — faint dashed, reads as "adjacent, no door"
const ENTRY = "#2e7d32"; // entry-node marker (green, reads as "in")
const STAIR = "#5a5a5a";
const DOOR_STAIR = "#7c4dff"; // door-gated cross-floor stub (matches the 3D door marker)

// Force-layout tuning (CSS-pixel space). Doesn't need to be physically perfect.
const REPULSION = 12000;
const SPRING_LEN = 140;
const SPRING_K = 0.02;
const GRAVITY = 0.012;
const DAMPING = 0.86;
const MAX_V = 30;

/**
 * Full-screen 2D bubble-diagram view. The dwelling graph spans all floors; this
 * shows ONE floor at a time (the active floor) with:
 *  - room/cluster nodes + their same-floor adjacencies,
 *  - entry markers on nodes that carry an entrance,
 *  - "↑/↓ Floor N" stubs where a stair links a node to another floor.
 * Recomputed each frame while open; node positions persist by id and settle
 * under a hand-rolled force-directed layout.
 */
export class GraphView {
  visible = false;
  private positions = new Map<string, NodePos>();
  private g: CanvasRenderingContext2D;
  /** Validation overlay (set by Check Layout): node id → worst severity. */
  private nodeHi = new Map<string, Severity>();
  /** Validation overlay: offending adjacency key → severity. */
  private edgeHi = new Map<string, Severity>();
  /** Space-syntax depth-from-entrance (set by Check Layout): node id → hops. */
  private depths = new Map<string, number>();

  constructor(
    private canvas: HTMLCanvasElement,
    private getGraph: () => DwellingGraph,
    private getActiveFloor: () => number,
    private floorLabelEl: HTMLElement
  ) {
    this.g = canvas.getContext("2d")!;
  }

  toggle(): void {
    this.visible ? this.hide() : this.show();
  }

  setHighlights(violations: Violation[]): void {
    this.nodeHi.clear();
    this.edgeHi.clear();
    for (const v of violations) {
      for (const id of v.nodeIds)
        this.nodeHi.set(id, worstSeverity(this.nodeHi.get(id), v.severity));
      if (v.edge) {
        const k = edgeKey(v.edge[0], v.edge[1]);
        this.edgeHi.set(k, worstSeverity(this.edgeHi.get(k), v.severity));
      }
    }
  }

  clearHighlights(): void {
    this.nodeHi.clear();
    this.edgeHi.clear();
    this.depths.clear();
  }

  /** Install the depth-from-entrance metric (node id → hop count) so each
   *  node can show a small depth badge. Purely informational — unrelated to
   *  pass/fail severity. */
  setDepths(depths: Map<string, number>): void {
    this.depths = depths;
  }

  show(): void {
    this.visible = true;
    this.canvas.style.display = "block";
    this.floorLabelEl.style.display = "block";
  }

  hide(): void {
    this.visible = false;
    this.canvas.style.display = "none";
    this.floorLabelEl.style.display = "none";
  }

  /** Run one layout step and redraw. Call each frame while {@link visible}. */
  frame(): void {
    const { w, h } = this.fitCanvas();
    const graph = this.getGraph();
    const active = this.getActiveFloor();

    const nodes = graph.nodes.filter((n) => n.floor === active);
    const ids = new Set(nodes.map((n) => n.id));
    const edges = graph.edges.filter((e) => !e.viaStair && ids.has(e.a) && ids.has(e.b));
    const stubs = this.stairStubs(graph, ids, active);

    this.syncPositions(nodes, w, h);
    this.step(nodes, edges, w, h);
    this.draw(nodes, edges, stubs, w, h);
    this.floorLabelEl.textContent = `Floor ${active} — adjacency diagram`;
  }

  /** Stair edges that cross from the active floor to another floor → stubs.
   *  Deduped per (node, direction, other floor); a door-gated (access) link
   *  wins over a touch-only one so a doored connection always reads as solid. */
  private stairStubs(graph: DwellingGraph, activeIds: Set<string>, active: number): StairStub[] {
    const byKey = new Map<string, StairStub>();
    for (const e of graph.edges) {
      if (!e.viaStair) continue;
      const aIn = activeIds.has(e.a);
      const bIn = activeIds.has(e.b);
      if (aIn === bIn) continue; // both on/both off the active floor
      const localId = aIn ? e.a : e.b;
      const otherId = aIn ? e.b : e.a;
      const otherFloor = parseDwellingNodeId(otherId).floor;
      const stub: StairStub = {
        localId,
        dir: otherFloor > active ? "up" : "down",
        otherFloor,
        viaDoor: !!e.viaDoor,
      };
      const key = `${localId}|${stub.dir}|${otherFloor}`;
      const existing = byKey.get(key);
      if (!existing || (stub.viaDoor && !existing.viaDoor)) byKey.set(key, stub);
    }
    return [...byKey.values()];
  }

  // ---- Canvas sizing -------------------------------------------------------

  private fitCanvas(): { w: number; h: number } {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  // ---- Layout --------------------------------------------------------------

  private syncPositions(nodes: GraphNode[], w: number, h: number): void {
    const present = new Set(nodes.map((n) => n.id));
    for (const id of [...this.positions.keys()])
      if (!present.has(id)) this.positions.delete(id);

    for (const node of nodes) {
      if (this.positions.has(node.id)) continue;
      const a = (hash(node.id) % 360) * (Math.PI / 180);
      const r = 60 + (hash(node.id) % 80);
      this.positions.set(node.id, {
        x: w / 2 + Math.cos(a) * r,
        y: h / 2 + Math.sin(a) * r,
        vx: 0,
        vy: 0,
      });
    }
  }

  private step(nodes: GraphNode[], edges: GraphEdge[], w: number, h: number): void {
    const pos = this.positions;

    for (let i = 0; i < nodes.length; i++) {
      const a = pos.get(nodes[i].id)!;
      for (let j = i + 1; j < nodes.length; j++) {
        const b = pos.get(nodes[j].id)!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          d2 = 1;
        }
        const f = REPULSION / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    for (const e of edges) {
      const a = pos.get(e.a);
      const b = pos.get(e.b);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const f = (d - SPRING_LEN) * SPRING_K;
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    for (const node of nodes) {
      const p = pos.get(node.id)!;
      p.vx += (w / 2 - p.x) * GRAVITY;
      p.vy += (h / 2 - p.y) * GRAVITY;
      p.vx = clamp(p.vx * DAMPING, -MAX_V, MAX_V);
      p.vy = clamp(p.vy * DAMPING, -MAX_V, MAX_V);
      p.x += p.vx;
      p.y += p.vy;
      const m = 60;
      p.x = clamp(p.x, m, w - m);
      p.y = clamp(p.y, m, h - m);
    }
  }

  // ---- Drawing -------------------------------------------------------------

  private draw(
    nodes: GraphNode[],
    edges: GraphEdge[],
    stubs: StairStub[],
    w: number,
    h: number
  ): void {
    const g = this.g;
    g.fillStyle = BG;
    g.fillRect(0, 0, w, h);

    if (nodes.length === 0) {
      g.fillStyle = "#8a857c";
      g.font = "600 15px 'Helvetica Neue', Helvetica, Arial, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("No rooms on this floor yet — place some to see the diagram.", w / 2, h / 2);
      return;
    }

    // Same-floor edges: ACCESS (doored) solid, TOUCH-only faint dashed, flagged
    // ones thick + coloured. Where a pair has BOTH a door and a physical touch,
    // the solid access line represents it — skip the redundant dashed touch line
    // (unless the touch edge itself is flagged, which must still show).
    const accessPairs = new Set(
      edges.filter((e) => e.viaDoor).map((e) => edgeKey(e.a, e.b))
    );
    for (const e of edges) {
      const a = this.positions.get(e.a);
      const b = this.positions.get(e.b);
      if (!a || !b) continue;
      const k = edgeKey(e.a, e.b);
      const sev = this.edgeHi.get(k);
      if (!e.viaDoor && !sev && accessPairs.has(k)) continue;
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      if (sev) {
        g.strokeStyle = hex(SEVERITY_COLORS[sev]);
        g.lineWidth = 5;
        g.setLineDash([]);
      } else if (e.viaDoor) {
        g.strokeStyle = LINE;
        g.lineWidth = 2.4;
        g.setLineDash([]);
      } else {
        g.strokeStyle = TOUCH;
        g.lineWidth = 1.5;
        g.setLineDash([5, 4]);
      }
      g.stroke();
      g.setLineDash([]);
    }

    // Stair stubs (grouped per node + direction so multiples fan out).
    this.drawStubs(stubs);

    // Legend — what solid vs dashed means (drawn last so it sits on top).
    this.drawLegend(h);

    // Nodes.
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const node of nodes) {
      const p = this.positions.get(node.id)!;
      const r = nodeRadius(node);

      const sev = this.nodeHi.get(node.id);
      if (sev) {
        const c = hex(SEVERITY_COLORS[sev]);
        g.save();
        g.shadowColor = c;
        g.shadowBlur = 18;
        g.beginPath();
        g.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
        g.fillStyle = c;
        g.fill();
        g.restore();
      }

      g.beginPath();
      g.arc(p.x, p.y, r, 0, Math.PI * 2);
      g.fillStyle = hex(node.color);
      g.fill();
      g.lineWidth = sev ? 4 : 2.5;
      g.strokeStyle = sev ? hex(SEVERITY_COLORS[sev]) : LINE;
      g.stroke();

      // Entry marker: a green ring + an "ENTRY" tag above the node.
      if (node.isEntry) {
        g.beginPath();
        g.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
        g.strokeStyle = ENTRY;
        g.lineWidth = 3;
        g.stroke();
        g.fillStyle = ENTRY;
        g.font = "800 10px 'Helvetica Neue', Helvetica, Arial, sans-serif";
        g.fillText("▶ ENTRY", p.x, p.y - r - 9);
      }

      g.fillStyle = "#1a1a1a";
      g.font = "700 12px 'Helvetica Neue', Helvetica, Arial, sans-serif";
      g.fillText(node.label, p.x, p.y + r + 12);

      // Depth-from-entrance badge (space-syntax hop count) — small, top-right
      // of the node circle. Purely informational, so it never affects colour.
      const depth = this.depths.get(node.id);
      if (depth !== undefined) {
        g.save();
        g.textAlign = "left";
        g.textBaseline = "middle";
        g.font = "800 10px 'Helvetica Neue', Helvetica, Arial, sans-serif";
        g.fillStyle = "#5a5a5a";
        g.fillText(`${depth}`, p.x + r * 0.55, p.y - r * 0.6);
        g.restore();
      }
    }
  }

  private drawStubs(stubs: StairStub[]): void {
    const g = this.g;
    // Group by node + direction so multiple stairs fan out instead of overlapping.
    const groups = new Map<string, StairStub[]>();
    for (const s of stubs) {
      const k = `${s.localId}|${s.dir}`;
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(s);
    }
    for (const list of groups.values()) {
      const p = this.positions.get(list[0].localId);
      if (!p) continue;
      const r = 30;
      list.forEach((s, i) => {
        const sign = s.dir === "up" ? -1 : 1;
        const fan = (i - (list.length - 1) / 2) * 26;
        const ex = p.x + fan;
        const ey = p.y + sign * (r + 22);
        // Door-gated cross-floor link → solid violet; physical stair-over touch
        // (no door yet) → dashed grey.
        const color = s.viaDoor ? DOOR_STAIR : STAIR;
        g.beginPath();
        g.moveTo(p.x, p.y + sign * 6);
        g.lineTo(ex, ey);
        g.strokeStyle = color;
        g.lineWidth = s.viaDoor ? 2.4 : 2;
        g.setLineDash(s.viaDoor ? [] : [4, 3]);
        g.stroke();
        g.setLineDash([]);
        const label = `${s.dir === "up" ? "↑" : "↓"} F${s.otherFloor}`;
        g.font = "800 11px 'Helvetica Neue', Helvetica, Arial, sans-serif";
        const tw = g.measureText(label).width + 10;
        g.fillStyle = color;
        g.fillRect(ex - tw / 2, ey - 9, tw, 18);
        g.fillStyle = "#f4f1ea";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(label, ex, ey);
      });
    }
  }

  /** Bottom-left key: solid = door (connected), dashed = touching (no door). */
  private drawLegend(h: number): void {
    const g = this.g;
    const x = 20;
    let y = h - 46;
    const sample = 26;
    g.save();
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.font = "600 12px 'Helvetica Neue', Helvetica, Arial, sans-serif";

    const row = (color: string, dash: number[], label: string) => {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + sample, y);
      g.strokeStyle = color;
      g.lineWidth = 2.4;
      g.setLineDash(dash);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = "#5a5a5a";
      g.fillText(label, x + sample + 8, y);
      y += 20;
    };
    row(LINE, [], "Door — connected");
    row(TOUCH, [5, 4], "Touching — no door");
    g.restore();
  }
}

function nodeRadius(node: GraphNode): number {
  return clamp(16 + Math.sqrt(node.cells.length) * 3.2, 18, 46);
}

function hex(color: number): string {
  return "#" + color.toString(16).padStart(6, "0");
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
