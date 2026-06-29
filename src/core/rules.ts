import type { AdjacencyGraph, GraphNode } from "./adjacencyGraph";

/**
 * Layout-rules validation — ADVISORY ONLY.
 *
 * Reads the already-computed per-floor adjacency graph (computeAdjacencyGraph)
 * and reports issues. It never blocks, prevents, or auto-corrects placement;
 * the user can build anything and this just describes what's problematic.
 *
 * Two severity tiers:
 *  - "hard"  — architect-rated failure modes (rendered red).
 *  - "soft"  — atypical-but-not-wrong, frequency-based advice (rendered amber).
 * Plus "note" — neutral/positive informational items (e.g. open-plan kitchen).
 *
 * Rules are DATA ({@link RULES}) separated from the engine: each rule is an id +
 * severity + human description + a pure `check(graph, ctx)`. Add / edit / remove
 * entries in the table without touching the engine. `ctx` carries the shared,
 * pre-computed graph machinery (adjacency list, degrees, type predicates, BFS)
 * so individual rules stay tiny.
 */

export type Severity = "hard" | "soft" | "note";

/** A single flagged issue produced by a rule. */
export interface Violation {
  ruleId: string;
  severity: Severity;
  /** Human-readable explanation (shown in the text report). */
  description: string;
  /** Node ids this issue implicates — highlighted in both the diagram and 3D. */
  nodeIds: string[];
  /** The specific offending adjacency, for edge-based rules (unordered pair). */
  edge?: [string, string];
  /** Floor-level issue not tied to particular nodes (e.g. H5). */
  layout?: boolean;
}

/** A rule = metadata + a pure check over the graph. Edit these freely. */
export interface Rule {
  id: string;
  severity: Severity;
  description: string;
  check: (graph: AdjacencyGraph, ctx: RuleContext) => Violation[];
}

/** Severity → highlight colour (packed hex), shared by the diagram and 3D. */
export const SEVERITY_COLORS: Record<Severity, number> = {
  hard: 0xd32f2f, // Bauhaus red
  soft: 0xe6a100, // amber
  note: 0x2e7d32, // neutral/positive green
};

const SEVERITY_RANK: Record<Severity, number> = { hard: 3, soft: 2, note: 1 };

/** The more serious of two severities (treating `undefined` as "none"). */
export function worstSeverity(a: Severity | undefined, b: Severity): Severity {
  if (!a) return b;
  return SEVERITY_RANK[b] > SEVERITY_RANK[a] ? b : a;
}

// ---- Shared per-validation context -----------------------------------------

interface RuleContext {
  nodesById: Map<string, GraphNode>;
  /** Undirected adjacency list (node id → neighbour ids). */
  adj: Map<string, Set<string>>;
  degree: (id: string) => number;
  is: {
    circulation: (n: GraphNode) => boolean;
    outdoor: (n: GraphNode) => boolean;
    bathroom: (n: GraphNode) => boolean;
    bedroom: (n: GraphNode) => boolean;
    kitchen: (n: GraphNode) => boolean;
    living: (n: GraphNode) => boolean;
    /** A real room node (not a circulation/outdoor cluster). */
    room: (n: GraphNode) => boolean;
  };
  circulationIds: string[];
  /**
   * Ids reachable from `seeds` over edges, never entering nodes for which
   * `blocked` is true (used for the "remove all X, is it still connected?"
   * path checks H2/H3). Seeds that are themselves blocked are dropped.
   */
  reachableFrom: (seeds: string[], blocked?: (n: GraphNode) => boolean) => Set<string>;
}

function buildContext(graph: AdjacencyGraph): RuleContext {
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n] as const));

  const adj = new Map<string, Set<string>>();
  for (const n of graph.nodes) adj.set(n.id, new Set());
  for (const e of graph.edges) {
    adj.get(e.a)?.add(e.b);
    adj.get(e.b)?.add(e.a);
  }

  const isRoomType = (n: GraphNode, ...types: string[]) =>
    n.kind === "room" && types.includes(n.roomTypeId);

  const is = {
    circulation: (n: GraphNode) => n.kind === "cluster" && n.roomTypeId === "circulation",
    outdoor: (n: GraphNode) => n.kind === "cluster" && n.roomTypeId === "outdoor",
    bathroom: (n: GraphNode) => isRoomType(n, "bathroom_small", "bathroom_large"),
    bedroom: (n: GraphNode) => isRoomType(n, "bedroom_small", "bedroom_large"),
    kitchen: (n: GraphNode) => isRoomType(n, "kitchen"),
    living: (n: GraphNode) => isRoomType(n, "living"),
    room: (n: GraphNode) => n.kind === "room",
  };

  const circulationIds = graph.nodes.filter(is.circulation).map((n) => n.id);

  const reachableFrom = (
    seeds: string[],
    blocked?: (n: GraphNode) => boolean
  ): Set<string> => {
    const visited = new Set<string>();
    const queue: string[] = [];
    for (const s of seeds) {
      const node = nodesById.get(s);
      if (!node || (blocked && blocked(node)) || visited.has(s)) continue;
      visited.add(s);
      queue.push(s);
    }
    while (queue.length) {
      const id = queue.shift()!;
      for (const nb of adj.get(id) ?? []) {
        if (visited.has(nb)) continue;
        const node = nodesById.get(nb);
        if (!node || (blocked && blocked(node))) continue;
        visited.add(nb);
        queue.push(nb);
      }
    }
    return visited;
  };

  return {
    nodesById,
    adj,
    degree: (id) => adj.get(id)?.size ?? 0,
    is,
    circulationIds,
    reachableFrom,
  };
}

// ---- The rules table (v1) — edit freely ------------------------------------

export const RULES: Rule[] = [
  // ===== HARD =====
  {
    id: "H1",
    severity: "hard",
    description: "Orphaned room — no path of adjacencies leads to any circulation space.",
    check(graph, ctx) {
      if (ctx.circulationIds.length === 0) return []; // H5 covers the no-circulation case
      const reach = ctx.reachableFrom(ctx.circulationIds);
      return graph.nodes
        .filter((n) => ctx.is.room(n) && !reach.has(n.id))
        .map((n) => violation("H1", "hard", n));
    },
  },
  {
    id: "H2",
    severity: "hard",
    description: "Room reachable from circulation only by passing through a bathroom.",
    check(graph, ctx) {
      if (ctx.circulationIds.length === 0) return [];
      const full = ctx.reachableFrom(ctx.circulationIds);
      const noBath = ctx.reachableFrom(ctx.circulationIds, ctx.is.bathroom);
      return graph.nodes
        .filter(
          (n) =>
            ctx.is.room(n) &&
            !ctx.is.bathroom(n) &&
            full.has(n.id) && // already connected (else H1 owns it)
            !noBath.has(n.id) // ...but only via a bathroom
        )
        .map((n) => violation("H2", "hard", n));
    },
  },
  {
    id: "H3",
    severity: "hard",
    description: "Room reachable from circulation only by passing through a bedroom.",
    check(graph, ctx) {
      if (ctx.circulationIds.length === 0) return [];
      const full = ctx.reachableFrom(ctx.circulationIds);
      const noBed = ctx.reachableFrom(ctx.circulationIds, ctx.is.bedroom);
      return graph.nodes
        .filter(
          (n) =>
            ctx.is.room(n) &&
            !ctx.is.bedroom(n) &&
            full.has(n.id) &&
            !noBed.has(n.id)
        )
        .map((n) => violation("H3", "hard", n));
    },
  },
  {
    id: "H4",
    severity: "hard",
    description: "Bathroom directly adjacent to a kitchen.",
    check(graph, ctx) {
      return edgeViolations(graph, ctx, "H4", "hard", (a, b) =>
        pair(ctx.is.bathroom, ctx.is.kitchen, a, b)
      );
    },
  },
  {
    id: "H5",
    severity: "hard",
    description: "More than two rooms but no circulation space anywhere on the floor.",
    check(graph, ctx) {
      const rooms = graph.nodes.filter(ctx.is.room).length;
      if (rooms > 2 && ctx.circulationIds.length === 0)
        return [
          {
            ruleId: "H5",
            severity: "hard",
            description: RULES_BY_ID.H5.description,
            nodeIds: [],
            layout: true,
          },
        ];
      return [];
    },
  },

  // ===== SOFT =====
  {
    id: "S1",
    severity: "soft",
    description: "Outdoor / balcony over-connected (more than two adjacencies) — usually a leaf space.",
    check(graph, ctx) {
      return graph.nodes
        .filter((n) => ctx.is.outdoor(n) && ctx.degree(n.id) > 2)
        .map((n) => violation("S1", "soft", n));
    },
  },
  {
    id: "S2",
    severity: "soft",
    description: "Living room under-connected (one or no adjacencies) — typically a social hub.",
    check(graph, ctx) {
      return graph.nodes
        .filter((n) => ctx.is.living(n) && ctx.degree(n.id) <= 1)
        .map((n) => violation("S2", "soft", n));
    },
  },
  {
    id: "S3",
    severity: "soft",
    description: "Bedroom directly adjacent to a kitchen or living room (privacy — prefer circulation-mediated access).",
    check(graph, ctx) {
      return edgeViolations(graph, ctx, "S3", "soft", (a, b) =>
        pair(ctx.is.bedroom, (n) => ctx.is.kitchen(n) || ctx.is.living(n), a, b)
      );
    },
  },
  {
    id: "S4",
    severity: "soft",
    description: "Two bedrooms directly adjacent.",
    check(graph, ctx) {
      return edgeViolations(graph, ctx, "S4", "soft", (a, b) =>
        ctx.is.bedroom(a) && ctx.is.bedroom(b)
      );
    },
  },
  {
    id: "S5",
    severity: "note",
    description: "Kitchen and living room adjacent — open-plan. Perfectly fine, noted for confirmation.",
    check(graph, ctx) {
      return edgeViolations(graph, ctx, "S5", "note", (a, b) =>
        pair(ctx.is.kitchen, ctx.is.living, a, b)
      );
    },
  },
];

/** Rules indexed by id, for reusing a rule's canonical description. */
export const RULES_BY_ID: Record<string, Rule> = Object.fromEntries(
  RULES.map((r) => [r.id, r])
);

// ---- Engine ----------------------------------------------------------------

/** Run every rule over `graph` and collect all violations (order = table order). */
export function validate(graph: AdjacencyGraph): Violation[] {
  const ctx = buildContext(graph);
  const out: Violation[] = [];
  for (const rule of RULES) out.push(...rule.check(graph, ctx));
  return out;
}

// ---- Small shared helpers --------------------------------------------------

/** Build a single-node violation reusing the rule's canonical description. */
function violation(ruleId: string, severity: Severity, node: GraphNode): Violation {
  return { ruleId, severity, description: RULES_BY_ID[ruleId].description, nodeIds: [node.id] };
}

/** True when the two predicates are satisfied by the pair in either order. */
function pair(
  p: (n: GraphNode) => boolean,
  q: (n: GraphNode) => boolean,
  a: GraphNode,
  b: GraphNode
): boolean {
  return (p(a) && q(b)) || (p(b) && q(a));
}

/** Emit one violation per edge whose endpoints satisfy `match`. */
function edgeViolations(
  graph: AdjacencyGraph,
  ctx: RuleContext,
  ruleId: string,
  severity: Severity,
  match: (a: GraphNode, b: GraphNode) => boolean
): Violation[] {
  const out: Violation[] = [];
  for (const e of graph.edges) {
    const a = ctx.nodesById.get(e.a);
    const b = ctx.nodesById.get(e.b);
    if (!a || !b || !match(a, b)) continue;
    out.push({
      ruleId,
      severity,
      description: RULES_BY_ID[ruleId].description,
      nodeIds: [a.id, b.id],
      edge: [a.id, b.id],
    });
  }
  return out;
}
