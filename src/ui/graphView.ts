import type { AdjacencyGraph, GraphNode } from "../core/adjacencyGraph";
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

/** Unordered node-id pair key, for matching highlighted adjacencies to edges. */
function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

const BG = "#e4e0d6"; // matches the 3D canvas background
const LINE = "#1a1a1a";

// Force-layout tuning (CSS-pixel space). Doesn't need to be physically perfect.
const REPULSION = 12000;
const SPRING_LEN = 140;
const SPRING_K = 0.02;
const GRAVITY = 0.012;
const DAMPING = 0.86;
const MAX_V = 30;

/**
 * Full-screen 2D bubble-diagram view of a floor's adjacency graph.
 *
 * Separate from the 3D configurator (its own canvas). Recomputes the active
 * floor's graph each frame while open (cheap for the handful of rooms here), so
 * it stays live as the layout changes. Node positions persist across recomputes
 * (keyed by node id) and settle under a hand-rolled force-directed layout —
 * repulsion between nodes, springs along edges, gentle gravity to centre.
 */
export class GraphView {
  visible = false;
  private positions = new Map<string, NodePos>();
  private g: CanvasRenderingContext2D;
  /** Validation overlay (set by Check Layout): node id → worst severity. */
  private nodeHi = new Map<string, Severity>();
  /** Validation overlay: offending adjacency key → severity. */
  private edgeHi = new Map<string, Severity>();

  constructor(
    private canvas: HTMLCanvasElement,
    private getGraph: () => AdjacencyGraph,
    private getFloorLabel: () => string,
    private floorLabelEl: HTMLElement
  ) {
    this.g = canvas.getContext("2d")!;
  }

  toggle(): void {
    this.visible ? this.hide() : this.show();
  }

  /** Install the validation overlay (worst severity per node, plus offending
   *  adjacencies). Positions persist by id, so highlights sit on existing nodes. */
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
    this.syncPositions(graph, w, h);
    this.step(graph, w, h);
    this.draw(graph, w, h);
    this.floorLabelEl.textContent = `${this.getFloorLabel()} — adjacency diagram`;
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

  /** Ensure every current node has a position; seed new ones near centre;
   *  drop positions for nodes that no longer exist. */
  private syncPositions(graph: AdjacencyGraph, w: number, h: number): void {
    const present = new Set(graph.nodes.map((n) => n.id));
    for (const id of [...this.positions.keys()])
      if (!present.has(id)) this.positions.delete(id);

    for (const node of graph.nodes) {
      if (this.positions.has(node.id)) continue;
      // Deterministic seed angle from the id so re-layouts don't jump around.
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

  private step(graph: AdjacencyGraph, w: number, h: number): void {
    const pos = this.positions;
    const nodes = graph.nodes;

    // Pairwise repulsion.
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

    // Springs along edges.
    for (const e of graph.edges) {
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

    // Gravity to centre + integrate.
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

  private draw(graph: AdjacencyGraph, w: number, h: number): void {
    const g = this.g;
    g.fillStyle = BG;
    g.fillRect(0, 0, w, h);

    if (graph.nodes.length === 0) {
      g.fillStyle = "#8a857c";
      g.font = "600 15px 'Helvetica Neue', Helvetica, Arial, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("No rooms on this floor yet — place some to see the diagram.", w / 2, h / 2);
      return;
    }

    // Edges first (under nodes). A flagged adjacency is drawn thick + coloured.
    for (const e of graph.edges) {
      const a = this.positions.get(e.a);
      const b = this.positions.get(e.b);
      if (!a || !b) continue;
      const sev = this.edgeHi.get(edgeKey(e.a, e.b));
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      if (sev) {
        g.strokeStyle = hex(SEVERITY_COLORS[sev]);
        g.lineWidth = 5;
      } else {
        g.strokeStyle = LINE;
        g.lineWidth = 2;
      }
      g.stroke();
    }

    // Nodes.
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const node of graph.nodes) {
      const p = this.positions.get(node.id)!;
      const r = nodeRadius(node);

      // Severity ring/glow underneath the node fill, when flagged.
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
      if (sev) {
        g.lineWidth = 4;
        g.strokeStyle = hex(SEVERITY_COLORS[sev]);
      } else {
        g.lineWidth = 2.5;
        g.strokeStyle = LINE;
      }
      g.stroke();

      // Label below the node, dark text on the off-white canvas.
      g.fillStyle = "#1a1a1a";
      g.font = "700 12px 'Helvetica Neue', Helvetica, Arial, sans-serif";
      g.fillText(node.label, p.x, p.y + r + 12);
    }
  }
}

function nodeRadius(node: GraphNode): number {
  // Mildly scale by footprint size so bigger rooms read as bigger bubbles.
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
