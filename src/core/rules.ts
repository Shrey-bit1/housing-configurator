import type { DwellingGraph, GraphNode } from "./adjacencyGraph";

/**
 * Layout-rules validation — ADVISORY ONLY.
 *
 * Reads the whole-dwelling adjacency graph (computeDwellingGraph): all floors'
 * rooms/clusters/stairs, intra-floor touch edges, and cross-floor `viaStair`
 * edges, with floor-0 entrances (re-validated every build) marking entry roots.
 * Reports issues; never blocks.
 *
 * Reachability is ENTRANCE-ROOTED and spans the whole dwelling (across stairs):
 * every room must be reachable from some entrance by ANY path of adjacencies —
 * corridors are NOT required (a living room wired straight to a bedroom is a
 * valid path). The reachability rules only run once a non-blocked entrance
 * exists; otherwise a single informational note is surfaced instead.
 *
 * MULTI-ENTRANCE SEMANTICS (deliberate, not accidental): `reachableFrom` seeds
 * a single multi-source BFS from ALL entry ids at once, so a node counts as
 * reachable if AT LEAST ONE entrance reaches it. For the "only through a
 * bathroom/bedroom/outdoor space" family (H2/H3/H6), the same multi-source BFS
 * is re-run with that room type blocked — a node survives (is NOT flagged) if
 * AT LEAST ONE entrance still reaches it via a path avoiding the blocked type.
 * With several entrances, ONE clean path from ANY of them is enough; a room
 * doesn't need to be independently reachable from every entrance.
 *
 * Two severity tiers — "hard" (red) / "soft" (amber) — plus "note" (neutral).
 * Rules are DATA ({@link RULES}); the engine is generic.
 */

export type Severity = "hard" | "soft" | "note";

/** A single flagged issue produced by a rule. */
export interface Violation {
  ruleId: string;
  severity: Severity;
  description: string;
  /** Node ids this issue implicates — highlighted in the diagram and 3D. */
  nodeIds: string[];
  /** The specific offending adjacency, for edge-based rules (unordered pair). */
  edge?: [string, string];
  /** Dwelling-scoped entrance ids this issue implicates (3D marker highlight). */
  entranceIds?: string[];
  /** Dwelling-level issue not tied to particular nodes (e.g. the no-entrance note). */
  layout?: boolean;
}

export interface Rule {
  id: string;
  severity: Severity;
  description: string;
  check: (graph: DwellingGraph, ctx: RuleContext) => Violation[];
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
  /** Undirected adjacency list incl. cross-floor stair edges (node id → ids). */
  adj: Map<string, Set<string>>;
  /** Undirected adjacency list of ONLY `viaStair` edges (node id → ids) — lets
   *  rules distinguish a stair's "top-side" neighbours from its "bottom-side"
   *  (same-floor, plain) ones without re-scanning the edge list. */
  viaStairAdj: Map<string, Set<string>>;
  degree: (id: string) => number;
  is: {
    circulation: (n: GraphNode) => boolean;
    outdoor: (n: GraphNode) => boolean;
    bathroom: (n: GraphNode) => boolean;
    bedroom: (n: GraphNode) => boolean;
    kitchen: (n: GraphNode) => boolean;
    living: (n: GraphNode) => boolean;
    recreation: (n: GraphNode) => boolean;
    /** A real room node (not a circulation/outdoor cluster, not a stair). */
    room: (n: GraphNode) => boolean;
    stair: (n: GraphNode) => boolean;
    /** A room OR a stair — the reachability-checkable target set for the
     *  "only reachable through X" family (H2/H3/H6): a stair is exactly as
     *  much of a "space you must pass through" as a room is. */
    roomOrStair: (n: GraphNode) => boolean;
    /** PUBLIC/SOCIAL rooms — Living Room and Recreation Room are the same
     *  category for privacy rules (Recreation is grouped with Living, not with
     *  Kitchen, which stays its own functional category). Reference this
     *  grouping in future rules rather than re-listing "living or recreation". */
    public: (n: GraphNode) => boolean;
    /** HABITABLE rooms — need daylight: bedrooms + public rooms (Living,
     *  Recreation). Kitchens are handled separately (D2, soft) since an
     *  internal kitchen is undesirable but more common than an internal
     *  bedroom/living room. */
    habitable: (n: GraphNode) => boolean;
  };
  /** Entry-root node ids (floor-0 nodes carrying a NON-BLOCKED entrance). */
  entryIds: string[];
  hasEntrance: boolean;
  /**
   * Ids reachable from `seeds` over edges, never entering nodes for which
   * `blocked` is true (the "remove all X, still reachable?" checks H2/H3/H6).
   * See the module doc comment for the any-entrance-suffices semantics.
   */
  reachableFrom: (seeds: string[], blocked?: (n: GraphNode) => boolean) => Set<string>;
}

function buildContext(graph: DwellingGraph): RuleContext {
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n] as const));

  const adj = new Map<string, Set<string>>();
  const viaStairAdj = new Map<string, Set<string>>();
  for (const n of graph.nodes) {
    adj.set(n.id, new Set());
    viaStairAdj.set(n.id, new Set());
  }
  for (const e of graph.edges) {
    adj.get(e.a)?.add(e.b);
    adj.get(e.b)?.add(e.a);
    if (e.viaStair) {
      viaStairAdj.get(e.a)?.add(e.b);
      viaStairAdj.get(e.b)?.add(e.a);
    }
  }

  const isRoomType = (n: GraphNode, ...types: string[]) =>
    n.kind === "room" && types.includes(n.roomTypeId);

  const living = (n: GraphNode) => isRoomType(n, "living");
  const recreation = (n: GraphNode) => isRoomType(n, "recreation");
  const bedroom = (n: GraphNode) => isRoomType(n, "bedroom_small", "bedroom_large");
  const isPublic = (n: GraphNode) => living(n) || recreation(n);

  const is = {
    circulation: (n: GraphNode) => n.kind === "cluster" && n.roomTypeId === "circulation",
    outdoor: (n: GraphNode) => n.kind === "cluster" && n.roomTypeId === "outdoor",
    bathroom: (n: GraphNode) => isRoomType(n, "bathroom_small", "bathroom_large"),
    bedroom,
    kitchen: (n: GraphNode) => isRoomType(n, "kitchen"),
    living,
    recreation,
    room: (n: GraphNode) => n.kind === "room",
    stair: (n: GraphNode) => n.kind === "stair",
    roomOrStair: (n: GraphNode) => n.kind === "room" || n.kind === "stair",
    public: isPublic,
    habitable: (n: GraphNode) => bedroom(n) || isPublic(n),
  };

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
    viaStairAdj,
    degree: (id) => adj.get(id)?.size ?? 0,
    is,
    entryIds: graph.entryIds,
    hasEntrance: graph.entryIds.length > 0,
    reachableFrom,
  };
}

// ---- Space-syntax depth metric ---------------------------------------------

/**
 * Depth (in hops) from the entrance set at which a room is considered
 * "unusually deep" (DP1). A named, easily-tuned constant rather than a magic
 * number inline in the rule.
 */
export const DEEP_ROOM_THRESHOLD_HOPS = 5;

/**
 * Space-syntax "depth from entrance": a multi-source BFS hop-count from
 * `entryIds` to every node, over ALL adjacency edges (cross-floor stair hops
 * count exactly like same-floor hops — a stair is one hop, same as a wall).
 * Depth 0 = an entry node itself; a node with no path from any entrance has no
 * entry in the map at all (H1/ST2 already flag those as a separate failure).
 *
 * Kept STANDALONE and exported — this is a pure METRIC, not a pass/fail check.
 * DP1 consumes it to flag outliers, but the text report and the bubble diagram
 * also call it directly to surface the raw numbers as information, decoupled
 * from the violation list. The data may be reused by future rules/analysis.
 */
export function computeEntranceDepths(graph: DwellingGraph): Map<string, number> {
  const adj = new Map<string, Set<string>>();
  for (const n of graph.nodes) adj.set(n.id, new Set());
  for (const e of graph.edges) {
    adj.get(e.a)?.add(e.b);
    adj.get(e.b)?.add(e.a);
  }

  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const id of graph.entryIds) {
    if (depth.has(id)) continue;
    depth.set(id, 0);
    queue.push(id);
  }
  while (queue.length) {
    const id = queue.shift()!;
    const d = depth.get(id)!;
    for (const nb of adj.get(id) ?? []) {
      if (depth.has(nb)) continue;
      depth.set(nb, d + 1);
      queue.push(nb);
    }
  }
  return depth;
}

// ---- The rules table — edit freely -----------------------------------------

export const RULES: Rule[] = [
  // ===== Entrance prerequisite / validity (informational + hard) =====
  {
    id: "E1",
    severity: "note",
    description: "Place an entrance to validate circulation/reachability.",
    check(graph, ctx) {
      if (ctx.hasEntrance) return [];
      // Distinguish "never placed one" from "placed one but it's now blocked" —
      // the latter is a more actionable message (E2 already explains why).
      const description =
        graph.entrances.length > 0
          ? "All entrances are blocked — none currently open to the outside. Reachability can't be validated."
          : RULES_BY_ID.E1.description;
      return [{ ruleId: "E1", severity: "note", description, nodeIds: [], layout: true }];
    },
  },
  {
    id: "E2",
    severity: "hard",
    description: "Entrance is blocked — its edge no longer faces outside.",
    check(graph) {
      return graph.entrances
        .filter((e) => e.blocked)
        .map((e) => ({
          ruleId: "E2",
          severity: "hard" as const,
          description: RULES_BY_ID.E2.description,
          nodeIds: e.hostId ? [e.hostId] : [],
          entranceIds: [e.id],
        }));
    },
  },

  // ===== Program completeness (dwelling-level node counts) =====
  {
    id: "P1",
    severity: "hard",
    description: "A dwelling needs a bathroom.",
    check(graph, ctx) {
      if (graph.nodes.some(ctx.is.bathroom)) return [];
      return [{ ruleId: "P1", severity: "hard", description: RULES_BY_ID.P1.description, nodeIds: [], layout: true }];
    },
  },
  {
    id: "P2",
    severity: "hard",
    description: "A dwelling needs a kitchen.",
    check(graph, ctx) {
      if (graph.nodes.some(ctx.is.kitchen)) return [];
      return [{ ruleId: "P2", severity: "hard", description: RULES_BY_ID.P2.description, nodeIds: [], layout: true }];
    },
  },
  {
    id: "P3",
    severity: "note",
    description: "More than one kitchen — atypical, but not a problem.",
    check(graph, ctx) {
      if (graph.nodes.filter(ctx.is.kitchen).length <= 1) return [];
      return [{ ruleId: "P3", severity: "note", description: RULES_BY_ID.P3.description, nodeIds: [], layout: true }];
    },
  },

  // ===== HARD: entrance-rooted reachability (whole dwelling, via stairs) =====
  {
    id: "H1",
    severity: "hard",
    description: "Orphaned room — no path of adjacencies (including stairs) reaches an entrance.",
    check(graph, ctx) {
      if (!ctx.hasEntrance) return []; // E1 covers the no-entrance case
      const reach = ctx.reachableFrom(ctx.entryIds);
      return graph.nodes
        .filter((n) => ctx.is.room(n) && !reach.has(n.id))
        .map((n) => violation("H1", "hard", n));
    },
  },
  {
    id: "H2",
    severity: "hard",
    description: "A room or stair reachable from an entrance only by passing through a bathroom.",
    check(graph, ctx) {
      if (!ctx.hasEntrance) return [];
      const full = ctx.reachableFrom(ctx.entryIds);
      const noBath = ctx.reachableFrom(ctx.entryIds, ctx.is.bathroom);
      return graph.nodes
        .filter(
          (n) =>
            ctx.is.roomOrStair(n) &&
            !ctx.is.bathroom(n) &&
            full.has(n.id) && // already connected (else H1/ST2 owns it)
            !noBath.has(n.id) // ...but only via a bathroom
        )
        .map((n) => violation("H2", "hard", n));
    },
  },
  {
    id: "H3",
    severity: "hard",
    description: "A room or stair reachable from an entrance only by passing through a bedroom.",
    check(graph, ctx) {
      if (!ctx.hasEntrance) return [];
      const full = ctx.reachableFrom(ctx.entryIds);
      const noBed = ctx.reachableFrom(ctx.entryIds, ctx.is.bedroom);
      return graph.nodes
        .filter(
          (n) => ctx.is.roomOrStair(n) && !ctx.is.bedroom(n) && full.has(n.id) && !noBed.has(n.id)
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
    id: "H6",
    severity: "hard",
    description: "A room or stair reachable from an entrance only by passing through an outdoor space.",
    check(graph, ctx) {
      if (!ctx.hasEntrance) return [];
      const full = ctx.reachableFrom(ctx.entryIds);
      const noOutdoor = ctx.reachableFrom(ctx.entryIds, ctx.is.outdoor);
      // No need to exclude outdoor nodes themselves from the target set: they
      // are kind "cluster", not "room"/"stair", so `roomOrStair` already
      // excludes them (mirrors why H2/H3 don't need to exclude bathrooms this
      // way — bathrooms/bedrooms ARE room-kind, so they need an explicit guard;
      // outdoor/circulation are cluster-kind, so they don't).
      return graph.nodes
        .filter((n) => ctx.is.roomOrStair(n) && full.has(n.id) && !noOutdoor.has(n.id))
        .map((n) => violation("H6", "hard", n));
    },
  },

  // ===== HARD/SOFT: corridor justification (circulation clusters) =====
  {
    id: "C1",
    severity: "hard",
    description: "Orphaned corridor — a circulation space connected to nothing (dead space).",
    check(graph, ctx) {
      return graph.nodes
        .filter((n) => ctx.is.circulation(n) && ctx.degree(n.id) === 0)
        .map((n) => violation("C1", "hard", n));
    },
  },
  {
    id: "C2",
    severity: "soft",
    description: "Under-used corridor — connects to only one space, so it doesn't circulate.",
    check(graph, ctx) {
      return graph.nodes
        .filter((n) => ctx.is.circulation(n) && ctx.degree(n.id) === 1)
        .map((n) => violation("C2", "soft", n));
    },
  },

  // ===== Stairs as checkable spaces =====
  {
    id: "ST1",
    severity: "soft",
    description: "Stair connects to nothing on one or both floors it should link.",
    check(graph, ctx) {
      const out: Violation[] = [];
      for (const n of graph.nodes) {
        if (!ctx.is.stair(n)) continue;
        const top = ctx.viaStairAdj.get(n.id)?.size ?? 0;
        const bottom = ctx.degree(n.id) - top; // non-viaStair edges = same-floor side
        const missing: string[] = [];
        if (bottom === 0) missing.push("bottom");
        if (top === 0) missing.push("top");
        if (missing.length)
          out.push({
            ruleId: "ST1",
            severity: "soft",
            description: `Stair connects to nothing at the ${missing.join(" and ")}.`,
            nodeIds: [n.id],
          });
      }
      return out;
    },
  },
  {
    id: "ST2",
    severity: "hard",
    description: "Stair not reachable from any entrance.",
    check(graph, ctx) {
      if (!ctx.hasEntrance) return [];
      const reach = ctx.reachableFrom(ctx.entryIds);
      return graph.nodes
        .filter((n) => ctx.is.stair(n) && !reach.has(n.id))
        .map((n) => violation("ST2", "hard", n));
    },
  },

  // ===== Daylight / ventilation (reuses exteriorEdges via GraphNode.hasExteriorEdge) =====
  {
    id: "D1",
    severity: "hard",
    description: "Room has no exterior wall — no daylight possible.",
    check(graph, ctx) {
      return graph.nodes
        .filter((n) => ctx.is.habitable(n) && !n.hasExteriorEdge)
        .map((n) => violation("D1", "hard", n));
    },
  },
  {
    id: "D2",
    severity: "soft",
    description: "Kitchen has no exterior wall — no natural ventilation.",
    check(graph, ctx) {
      return graph.nodes
        .filter((n) => ctx.is.kitchen(n) && !n.hasExteriorEdge)
        .map((n) => violation("D2", "soft", n));
    },
  },

  // ===== Privacy / access refinements =====
  {
    id: "G1",
    severity: "soft",
    description: "No bathroom is reachable without passing through a bedroom (guest access).",
    check(graph, ctx) {
      if (!ctx.hasEntrance) return [];
      const bathrooms = graph.nodes.filter(ctx.is.bathroom);
      if (bathrooms.length === 0) return []; // P1 already covers "no bathroom at all"
      const noBed = ctx.reachableFrom(ctx.entryIds, ctx.is.bedroom);
      const hasGuestBathroom = bathrooms.some((n) => noBed.has(n.id));
      if (hasGuestBathroom) return [];
      return [{ ruleId: "G1", severity: "soft", description: RULES_BY_ID.G1.description, nodeIds: [], layout: true }];
    },
  },
  {
    id: "G2",
    severity: "soft",
    description: "Entrance opens directly into a private room.",
    check(graph, ctx) {
      const out: Violation[] = [];
      for (const e of graph.entrances) {
        if (e.blocked || !e.hostId) continue; // E2 already flags blocked entrances
        const host = ctx.nodesById.get(e.hostId);
        if (!host || !(ctx.is.bedroom(host) || ctx.is.bathroom(host))) continue;
        out.push({
          ruleId: "G2",
          severity: "soft",
          description: RULES_BY_ID.G2.description,
          nodeIds: [host.id],
          entranceIds: [e.id],
        });
      }
      return out;
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
    description:
      "Bedroom directly adjacent to a kitchen, living room, or recreation room (privacy — prefer mediated access).",
    check(graph, ctx) {
      return edgeViolations(graph, ctx, "S3", "soft", (a, b) =>
        pair(ctx.is.bedroom, (n) => ctx.is.kitchen(n) || ctx.is.public(n), a, b)
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

  // ===== Space-syntax depth metric =====
  {
    id: "DP1",
    severity: "soft",
    description: `Room is unusually deep in the layout (≥${DEEP_ROOM_THRESHOLD_HOPS} hops from the entrance).`,
    check(graph, ctx) {
      if (!ctx.hasEntrance) return [];
      const depths = computeEntranceDepths(graph);
      const out: Violation[] = [];
      for (const n of graph.nodes) {
        if (!ctx.is.room(n)) continue;
        const d = depths.get(n.id);
        if (d !== undefined && d >= DEEP_ROOM_THRESHOLD_HOPS)
          out.push({
            ruleId: "DP1",
            severity: "soft",
            description: `Room is unusually deep in the layout (${d} hops from the entrance).`,
            nodeIds: [n.id],
          });
      }
      return out;
    },
  },
];

/** Rules indexed by id, for reusing a rule's canonical description. */
export const RULES_BY_ID: Record<string, Rule> = Object.fromEntries(
  RULES.map((r) => [r.id, r])
);

// ---- Engine ----------------------------------------------------------------

/** Run every rule over the dwelling `graph` and collect all violations. */
export function validate(graph: DwellingGraph): Violation[] {
  const ctx = buildContext(graph);
  const out: Violation[] = [];
  for (const rule of RULES) out.push(...rule.check(graph, ctx));
  return out;
}

// ---- Small shared helpers --------------------------------------------------

function violation(ruleId: string, severity: Severity, node: GraphNode): Violation {
  return { ruleId, severity, description: RULES_BY_ID[ruleId].description, nodeIds: [node.id] };
}

function pair(
  p: (n: GraphNode) => boolean,
  q: (n: GraphNode) => boolean,
  a: GraphNode,
  b: GraphNode
): boolean {
  return (p(a) && q(b)) || (p(b) && q(a));
}

function edgeViolations(
  graph: DwellingGraph,
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
