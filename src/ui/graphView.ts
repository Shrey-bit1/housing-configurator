import type { DwellingGraph, GraphEdge, GraphNode } from "../core/adjacencyGraph";
import {
  SEVERITY_COLORS,
  worstSeverity,
  computeEntranceDepths,
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
const LINE = "#1a1a1a"; // ACCESS (doored) edge — solid, reads as "connected"
const TOUCH = "#b9b3a7"; // TOUCH-only edge — faint dashed, reads as "adjacent, no door"
const ENTRY = "#2e7d32"; // entry-node marker (green, reads as "in")
const SEPARATOR = "#cfc9bc"; // faint column-boundary rule
const HEADER_ACTIVE = "#d32f2f"; // active-floor column header (Bauhaus accent)
const HEADER_DIM = "#8a857c";
const HOVER_RING = "#ffffff"; // report-card hover emphasis (node ring + edge overlay)
const HOVER_OUTLINE = "#141414"; // dark outline under the white so it reads on any bg/node colour
const BADGE_BG = "#1e1e1e"; // depth-badge chip — fixed colours, independent of node fill
const BADGE_TEXT = "#ffffff";
const BADGE_BORDER = "#f4f1ea";

// Force-layout tuning (CSS-pixel space). Doesn't need to be physically perfect.
const REPULSION = 12000;
const SPRING_LEN = 140;
const SPRING_K = 0.02;
const GRAVITY = 0.012;
const DAMPING = 0.86;
const MAX_V = 30;
const MARGIN_Y = 60; // top/bottom keep-out, all columns
const COL_PAD = 60; // left/right keep-out from a column's own boundaries
const HEADER_H = 34; // column-header row height, reserved at the bottom

/**
 * Full-screen 2D bubble-diagram view of the WHOLE dwelling: one column per
 * floor (0 leftmost), all floors' nodes force-laid-out simultaneously but
 * each room/cluster clamped to its own floor's column. A stair — the only
 * node kind that spans two floors — renders ON the boundary line between its
 * own floor's column and the floor above's, its bottom (same-floor) edges
 * reaching left and its top (`viaStair`) edges reaching right; this is why
 * cross-floor edges need no special routing, just a normally-drawn line
 * between two normally-positioned nodes (see `computeDwellingGraph`'s doc
 * comment on why every cross-floor edge has exactly one stair endpoint).
 *
 * Nodes are draggable: pointer-drag pins a node (fixes its position; the
 * force sim still lets its unpinned neighbours respond to it as an anchor).
 * Room/cluster drag is free within its column; stair drag is vertical-only,
 * locked to its boundary line. "Re-layout" unpins everything.
 *
 * Recomputed each frame while open; node positions (and pin state) persist
 * by id across frames/resizes — pure view state, never serialized (matches
 * camera/active-floor/visibility, which are likewise excluded from project
 * JSON).
 */
export class GraphView {
  visible = false;
  private positions = new Map<string, NodePos>();
  private pinned = new Set<string>();
  private g: CanvasRenderingContext2D;
  /** Validation overlay (set by Check Layout): node id → worst severity. */
  private nodeHi = new Map<string, Severity>();
  /** Validation overlay: offending adjacency key → severity. */
  private edgeHi = new Map<string, Severity>();
  /** Space-syntax depth-from-entrance (set by Check Layout): node id → hops. */
  private depths = new Map<string, number>();
  /** Report-card hover emphasis (set by hovering a violation card): the
   *  hovered violation's target node(s) and/or edge, or empty/null when
   *  nothing is hovered. Layered on top of `nodeHi`/`edgeHi` at draw time —
   *  never mutates them, so unhover needs no re-derivation. */
  private hoverIds = new Set<string>();
  private hoverEdge: [string, string] | null = null;

  // Toggles (view state, default per spec: touch off, depth on).
  private showTouch = false;
  private showDepth = true;

  // Column-layout metrics, refreshed every `frame()` — cached so pointer
  // handlers (which fire outside the animation loop) can clamp consistently
  // with whatever was last drawn.
  private colWidth = 0;
  private canvasH = 0;
  private floorCount = 1;

  // Latest frame's nodes, for pointer hit-testing.
  private lastNodes: GraphNode[] = [];
  private nodesById = new Map<string, GraphNode>();

  private dragId: string | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private getGraph: () => DwellingGraph,
    private getActiveFloor: () => number,
    private titleEl: HTMLElement,
    private legendEl: HTMLElement,
    touchToggleEl: HTMLInputElement,
    depthToggleEl: HTMLInputElement,
    private relayoutBtn: HTMLButtonElement
  ) {
    this.g = canvas.getContext("2d")!;

    touchToggleEl.checked = this.showTouch;
    depthToggleEl.checked = this.showDepth;
    touchToggleEl.addEventListener("change", () => {
      this.showTouch = touchToggleEl.checked;
    });
    depthToggleEl.addEventListener("change", () => {
      this.showDepth = depthToggleEl.checked;
    });
    relayoutBtn.addEventListener("click", () => this.pinned.clear());

    // pointerdown is canvas-scoped (only starts a drag when the diagram is the
    // thing under the cursor); move/up are window-scoped so a drag survives
    // the pointer leaving canvas bounds mid-gesture. Both no-op immediately
    // when nothing is being dragged, so they're inert whenever the diagram
    // isn't visible (a hidden canvas never receives pointerdown to begin with).
    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("dblclick", this.onDblClick);
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
    this.hoverIds.clear();
    this.hoverEdge = null;
  }

  /** Report-card hover: emphasize `v`'s target node(s)/edge on top of the
   *  normal tier highlight (never replaces it — see `draw()`). Pass null on
   *  unhover. A dwelling-level violation (empty `nodeIds`, no `edge`)
   *  naturally emphasizes nothing — no fake target is invented. */
  setHover(v: Violation | null): void {
    this.hoverIds = new Set(v?.nodeIds ?? []);
    this.hoverEdge = v?.edge ?? null;
  }

  show(): void {
    this.visible = true;
    this.canvas.style.display = "block";
    this.titleEl.style.display = "block";
    this.legendEl.style.display = "block";
    // Explicit "inline-block", NOT "" — the button's stylesheet rule is
    // `#graph-relayout { display: none }` (hidden by default outside diagram
    // mode), so clearing the inline style would fall back to that `none` and
    // the button would never appear. Set a real value to override it (this is
    // the same inline-style-vs-stylesheet-default pitfall noted for
    // #selection-readout in §2h — a class toggle is the alternative).
    this.relayoutBtn.style.display = "inline-block";
  }

  hide(): void {
    this.visible = false;
    this.canvas.style.display = "none";
    this.titleEl.style.display = "none";
    this.legendEl.style.display = "none";
    this.relayoutBtn.style.display = "none";
    this.dragId = null;
  }

  /** Run one layout step and redraw. Call each frame while {@link visible}. */
  frame(): void {
    const { w, h } = this.fitCanvas();
    const graph = this.getGraph();

    this.floorCount = Math.max(1, graph.floorCount);
    this.colWidth = w / this.floorCount;
    this.canvasH = h;

    // Depth-from-entrance for the badges: computed HERE (per frame, from the
    // live graph) whenever the depth toggle is on — NOT dependent on Check
    // Layout having run. (Historically depths only arrived via Check Layout's
    // `setDepths`, so opening the diagram and toggling depth on showed no
    // badges until you also ran Check Layout — a silent hidden prerequisite.
    // The graph is already recomputed every frame, so this BFS is negligible;
    // it also keeps badges LIVE as the layout changes.) An empty entrance set
    // yields an empty map → no badges, which reads correctly ("nothing to
    // measure depth from yet").
    if (this.showDepth) this.depths = computeEntranceDepths(graph);

    const nodes = graph.nodes;
    this.lastNodes = nodes;
    this.nodesById = new Map(nodes.map((n) => [n.id, n]));
    // All edges (same-floor AND cross-floor) — a stair sitting on its column
    // boundary makes a cross-floor edge just an ordinary line to a normally-
    // positioned node; no stub/routing logic needed.
    const edges = graph.edges;

    this.syncPositions(nodes, h);
    this.step(nodes, edges, h);
    this.draw(nodes, edges, w, h);
    this.titleEl.textContent = "Adjacency diagram";
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

  // ---- Column geometry -------------------------------------------------------
  // The single source of truth for "where does floor N's column live" —
  // consumed by layout (step), drawing (headers/separators), and pointer
  // handlers alike, so a drag clamps to exactly the band a node is drawn in.

  private columnX0(floor: number): number {
    return floor * this.colWidth;
  }

  private columnCenterX(floor: number): number {
    return this.columnX0(floor) + this.colWidth / 2;
  }

  /** The vertical boundary line between floor `floor` and floor `floor+1` —
   *  where a stair rooted on `floor` (whose hole always projects onto
   *  `floor+1`; FloorManager guarantees a stair never lacks a floor above)
   *  renders and drags. */
  private stairBoundaryX(floor: number): number {
    return (floor + 1) * this.colWidth;
  }

  /** Inner keep-out band for a room/cluster node in floor `floor`'s column. */
  private columnBand(floor: number): { lo: number; hi: number } {
    const pad = clamp(COL_PAD, 4, this.colWidth / 2);
    const x0 = this.columnX0(floor);
    return { lo: x0 + pad, hi: x0 + this.colWidth - pad };
  }

  /** Clamp a candidate x for `node` into whatever it's allowed to occupy:
   *  a stair is pinned to its boundary line (x is not a range), a room or
   *  cluster is free within its own column's band. */
  private clampX(node: GraphNode, x: number): number {
    return node.kind === "stair"
      ? this.stairBoundaryX(node.floor)
      : clamp(x, this.columnBand(node.floor).lo, this.columnBand(node.floor).hi);
  }

  // ---- Layout --------------------------------------------------------------

  private syncPositions(nodes: GraphNode[], h: number): void {
    const present = new Set(nodes.map((n) => n.id));
    for (const id of [...this.positions.keys()])
      if (!present.has(id)) {
        this.positions.delete(id);
        this.pinned.delete(id);
      }

    for (const node of nodes) {
      if (this.positions.has(node.id)) continue;
      const a = (hash(node.id) % 360) * (Math.PI / 180);
      const r = 30 + (hash(node.id) % 40);
      const cx = node.kind === "stair" ? this.stairBoundaryX(node.floor) : this.columnCenterX(node.floor);
      this.positions.set(node.id, {
        x: this.clampX(node, cx + (node.kind === "stair" ? 0 : Math.cos(a) * r)),
        y: h / 2 + Math.sin(a) * r,
        vx: 0,
        vy: 0,
      });
    }
  }

  private step(nodes: GraphNode[], edges: GraphEdge[], h: number): void {
    const pos = this.positions;
    // Same-floor AND cross-floor edges all contribute springs uniformly —
    // spring length has no special-casing for a stair's fixed x, it just
    // pulls toward its (possibly off-column) other endpoint like any edge.

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
      const isStair = node.kind === "stair";
      const pinned = this.pinned.has(node.id);

      if (!pinned) {
        // Gravity pulls toward the node's OWN column centre (not the whole-
        // canvas centre) so floors don't all collapse toward the middle
        // column. A stair has no meaningful x-gravity — its x is a hard
        // constraint below, never velocity-driven — so only y is applied.
        if (!isStair) p.vx += (this.columnCenterX(node.floor) - p.x) * GRAVITY;
        p.vy += (h / 2 - p.y) * GRAVITY;
        p.vx = clamp(p.vx * DAMPING, -MAX_V, MAX_V);
        p.vy = clamp(p.vy * DAMPING, -MAX_V, MAX_V);
        if (!isStair) p.x += p.vx;
        p.y += p.vy;
      } else {
        // No velocity buildup while pinned (dragged or drag-released) — a
        // future unpin (Re-layout / double-click) should resume from rest,
        // not fling off with stale accumulated force.
        p.vx = 0;
        p.vy = 0;
      }

      // Hard positional constraint, every frame, pinned or not — the same
      // clamp a resize or a floor-count change must re-snap into, and the
      // same one drag input is clamped through (see onPointerMove).
      p.x = this.clampX(node, p.x);
      p.y = clamp(p.y, MARGIN_Y, h - MARGIN_Y);
    }
  }

  // ---- Pointer interaction (drag to pin) ------------------------------------

  private toCanvasXY(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /** Topmost node under (x,y), or null. Iterates latest-drawn-first (reverse
   *  of draw order) so overlapping circles hit the one visually on top. */
  private hitTest(x: number, y: number): GraphNode | null {
    for (let i = this.lastNodes.length - 1; i >= 0; i--) {
      const node = this.lastNodes[i];
      const p = this.positions.get(node.id);
      if (!p) continue;
      const r = nodeRadius(node);
      if ((x - p.x) ** 2 + (y - p.y) ** 2 <= r * r) return node;
    }
    return null;
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (!this.visible || e.button !== 0) return;
    const { x, y } = this.toCanvasXY(e);
    const node = this.hitTest(x, y);
    if (!node) return;
    e.preventDefault();
    this.dragId = node.id;
    this.pinned.add(node.id);
    const p = this.positions.get(node.id)!;
    p.x = this.clampX(node, x);
    p.y = clamp(y, MARGIN_Y, this.canvasH - MARGIN_Y);
    p.vx = 0;
    p.vy = 0;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragId) return;
    const node = this.nodesById.get(this.dragId);
    const p = this.positions.get(this.dragId);
    if (!node || !p) return;
    const { x, y } = this.toCanvasXY(e);
    // Stair: x is ignored entirely — vertical drag only, locked to its
    // boundary line. Room/cluster: x free within its own column band.
    p.x = this.clampX(node, x);
    p.y = clamp(y, MARGIN_Y, this.canvasH - MARGIN_Y);
    p.vx = 0;
    p.vy = 0;
  };

  private onPointerUp = (): void => {
    // The node stays pinned after release (that's the point) — only the
    // drag gesture itself ends.
    this.dragId = null;
  };

  private onDblClick = (e: MouseEvent): void => {
    if (!this.visible) return;
    const r = this.canvas.getBoundingClientRect();
    const node = this.hitTest(e.clientX - r.left, e.clientY - r.top);
    if (node) this.pinned.delete(node.id);
  };

  // ---- Drawing -------------------------------------------------------------

  private draw(nodes: GraphNode[], edges: GraphEdge[], w: number, h: number): void {
    const g = this.g;
    g.fillStyle = BG;
    g.fillRect(0, 0, w, h);

    this.drawColumns(h);

    if (nodes.length === 0) {
      g.fillStyle = "#8a857c";
      g.font = "600 15px 'Helvetica Neue', Helvetica, Arial, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("No rooms placed yet — place some to see the diagram.", w / 2, h / 2);
      return;
    }

    // Edges: ACCESS (doored) solid, TOUCH-only faint dashed and hidden unless
    // the "Show touching" toggle is on — UNLESS the touch edge itself carries
    // a violation, which must always be visible regardless of the toggle.
    // Where a pair has BOTH a door and a physical touch, the solid access
    // line already represents it, so the redundant dashed line is skipped
    // (again, unless flagged) whether or not touch edges are shown — this
    // applies uniformly to same-floor AND cross-floor (stair) edges, so the
    // old "could door here" stub's toggle behaviour just falls out of it.
    const accessPairs = new Set(edges.filter((e) => e.viaDoor).map((e) => edgeKey(e.a, e.b)));
    for (const e of edges) {
      const a = this.positions.get(e.a);
      const b = this.positions.get(e.b);
      if (!a || !b) continue;
      const k = edgeKey(e.a, e.b);
      const sev = this.edgeHi.get(k);
      if (!e.viaDoor) {
        if (!this.showTouch && !sev) continue;
        if (!sev && accessPairs.has(k)) continue;
      }
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

      // Report-card hover emphasis for an edge-based violation (H4/S3/S5/S6/
      // AC1...) — an outlined white overlay on the SAME path, drawn right
      // after the edge's normal stroke so it reads as "this edge" regardless
      // of which style (solid/dashed/severity) the base line used. Works
      // identically for cross-floor edges — they're drawn with the same
      // moveTo/lineTo as any other edge, just between a stair's boundary
      // position and a node in the neighbouring column.
      if (this.hoverEdge && edgeMatches(e, this.hoverEdge)) {
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.strokeStyle = HOVER_OUTLINE;
        g.lineWidth = 7;
        g.stroke();
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.strokeStyle = HOVER_RING;
        g.lineWidth = 3.5;
        g.stroke();
      }
    }

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

      // Report-card hover emphasis: an outlined white halo layered on top of
      // the tier ring/border above — it never replaces the severity colour,
      // just adds a "look here" glow, so hover can't fight the normal
      // post-check highlighting (see `setHover`'s doc comment).
      if (this.hoverIds.has(node.id)) {
        g.save();
        g.shadowColor = HOVER_RING;
        g.shadowBlur = 10;
        g.beginPath();
        g.arc(p.x, p.y, r + 9, 0, Math.PI * 2);
        g.strokeStyle = HOVER_OUTLINE;
        g.lineWidth = 7;
        g.stroke();
        g.beginPath();
        g.arc(p.x, p.y, r + 9, 0, Math.PI * 2);
        g.strokeStyle = HOVER_RING;
        g.lineWidth = 3.5;
        g.stroke();
        g.restore();
      }

      g.fillStyle = "#1a1a1a";
      g.font = "700 12px 'Helvetica Neue', Helvetica, Arial, sans-serif";
      g.fillText(shortLabel(node.label), p.x, p.y + r + 12);

      // Depth-from-entrance badge (space-syntax hop count): a small solid
      // chip with its OWN fixed colours (independent of the node's fill), so
      // it reads on every node colour — the old plain grey numeral drawn
      // directly on the node's edge was low-contrast and half-clipped by the
      // circle on light node colours (cream bathroom, white-ish walls).
      // Centred ON the node's rim at the bottom-right (45°) so it overlaps
      // the node slightly rather than floating free; drawn AFTER the
      // severity/hover rings above so it's never buried under either, even
      // on a flagged node. Governed by the same `showDepth` toggle as before.
      const depth = this.depths.get(node.id);
      if (this.showDepth && depth !== undefined) {
        const br = clamp(r * 0.32, 9, 13);
        const bx = p.x + r * Math.SQRT1_2;
        const by = p.y + r * Math.SQRT1_2;
        g.save();
        g.beginPath();
        g.arc(bx, by, br, 0, Math.PI * 2);
        g.fillStyle = BADGE_BG;
        g.fill();
        g.lineWidth = 1.5;
        g.strokeStyle = BADGE_BORDER;
        g.stroke();
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.font = `800 ${Math.round(br * 1.15)}px 'Helvetica Neue', Helvetica, Arial, sans-serif`;
        g.fillStyle = BADGE_TEXT;
        g.fillText(`${depth}`, bx, by + 0.5);
        g.restore();
      }
    }
  }

  /** Column separators + "Floor N" headers at the BOTTOM of each column. The
   *  active floor's header gets a cheap accent-colour emphasis (no other
   *  behaviour keys off "active" any more — the diagram always shows every
   *  floor). */
  private drawColumns(h: number): void {
    const g = this.g;
    const active = this.getActiveFloor();
    g.save();
    g.strokeStyle = SEPARATOR;
    g.lineWidth = 1;
    for (let i = 1; i < this.floorCount; i++) {
      const x = i * this.colWidth;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "800 12px 'Helvetica Neue', Helvetica, Arial, sans-serif";
    for (let i = 0; i < this.floorCount; i++) {
      g.fillStyle = i === active ? HEADER_ACTIVE : HEADER_DIM;
      g.fillText(`Floor ${i}`, this.columnCenterX(i), h - HEADER_H / 2 - 4);
    }
    g.restore();
  }
}

function nodeRadius(node: GraphNode): number {
  return clamp(16 + Math.sqrt(node.cells.length) * 3.2, 18, 46);
}

/** Strip a "— Variant" or "(variant)" suffix ("Bedroom — Large" → "Bedroom",
 *  "Stair (dogleg)" → "Stair") so the diagram shows the short type name only;
 *  size (via {@link nodeRadius}'s sqrt-of-cell-count scaling) is what
 *  distinguishes Small/Large instead. A label with neither pattern (e.g.
 *  "Kitchen", "Circulation") passes through unchanged. */
function shortLabel(label: string): string {
  return label.replace(/\s*[—(].*$/, "").trim();
}

/** Whether edge `e` connects the same unordered pair as `pair` (hover-target
 *  matching — an edge's `a`/`b` order isn't guaranteed to match `Violation.edge`'s). */
function edgeMatches(e: GraphEdge, pair: [string, string]): boolean {
  return (e.a === pair[0] && e.b === pair[1]) || (e.a === pair[1] && e.b === pair[0]);
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
