import type { DwellingGraph, GraphNode } from "./adjacencyGraph";

/**
 * Layout-rules validation — ADVISORY ONLY.
 *
 * Reads the whole-dwelling adjacency graph (computeDwellingGraph): all floors'
 * rooms/clusters/stairs, with TOUCH edges (physical adjacency) AND door-gated
 * ACCESS edges (`viaDoor`), and floor-0 entrances (re-validated every build)
 * marking entry roots. Reports issues; never blocks.
 *
 * Reachability is ENTRANCE-ROOTED, DOOR-BASED, and spans the whole dwelling
 * (across door-gated stairs): every room must be reachable from some entrance
 * by a path of DOORS — physical touch without a door is NOT a connection.
 * Corridors are not required as a room type, but a room does need a doored path
 * (which may run straight from a living room to a bedroom). The reachability
 * rules only run once a non-blocked entrance exists; otherwise a single
 * informational note is surfaced instead. A dwelling with rooms but no doors at
 * all gets the DR1 note explaining the resulting wall of orphaned-room flags.
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
 * TIER TAXONOMY (the definitive meaning of each severity — classify new rules by
 * it, and keep existing ones consistent):
 *  - **HARD** (red): renders the dwelling uninhabitable or violates near-universal
 *    building code — expert failure modes, program completeness, daylight physics,
 *    direct hygiene access.
 *  - **SOFT** (amber): deviates from empirical practice or comfort norms — backed
 *    by frequency data (House-GAN) or comfort/acoustic practice (SIA).
 *  - **NOTE** (green): characterization, not judgment — acknowledges a recognised
 *    typology (open-plan, en-suite, efficient services) so it reads as seen, not
 *    silently ignored.
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
  /** Undirected ACCESS adjacency (door edges only, incl. cross-floor door-gated
   *  stair links) — the reachability/connectivity graph. `reachableFrom`,
   *  `degree`, and the corridor/stair/depth rules all traverse THIS, so an
   *  undoored space is unreachable and an undoored corridor has degree 0. */
  adj: Map<string, Set<string>>;
  /** ACCESS adjacency of ONLY `viaStair` door edges (node id → ids) — lets a
   *  stair distinguish its door-gated "top-side" links from its "bottom-side"
   *  (same-floor) ones without re-scanning the edge list. */
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
  // ACCESS graph only: reachability and connectivity are door-based now, so a
  // TOUCH edge (viaDoor: false) contributes nothing to adjacency here. (Proximity
  // rules read the touch edges straight off graph.edges, see edgeViolations.)
  for (const e of graph.edges) {
    if (!e.viaDoor) continue;
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
    // Seeds are ALWAYS entered — `blocked` applies to INTERMEDIATE nodes only.
    // You reach the entrance's host node THROUGH the entrance by definition, so a
    // studio flat whose entrance sits on the (only) bedroom/bathroom/outdoor must
    // not detonate H3/H2/H6/G1 ("only reachable through a bedroom…") — dropping
    // the seed would leave those checks with zero roots and hard-flag every room.
    // The gentle G2 (soft, "entrance opens into a private room") is the signal for
    // that typology instead.
    for (const s of seeds) {
      const node = nodesById.get(s);
      if (!node || visited.has(s)) continue;
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
 * Space-syntax "depth from entrance": a multi-source shortest-path hop-count from
 * `entryIds` to every node, over ACCESS (door) edges only — depth is a
 * door-to-door walking metric now, so an undoored space simply has no depth.
 * Depth 0 = an entry node itself; a node with no door path from any entrance has
 * no entry in the map at all (H1/ST2 already flag those as a separate failure).
 *
 * STAIR-HOP WEIGHTING: a stair is a graph NODE (so it can be inspected), which
 * would make a floor transition room→stair→room cost TWO hops and drift a normal
 * multi-storey dwelling's upper rooms toward DP1's threshold by merely existing.
 * A floor transition should cost ONE hop, so ENTERING a stair costs 1 and LEAVING
 * one costs 0 (the hop is paid on the way in). Weights are 0/1, so this is a 0-1
 * BFS over a deque (0-cost relaxations to the front, 1-cost to the back). The
 * `DEEP_ROOM_THRESHOLD_HOPS` constant is unchanged — this restores its single-
 * floor meaning across floors.
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
    if (!e.viaDoor) continue; // depth follows door access, not physical touch
    adj.get(e.a)?.add(e.b);
    adj.get(e.b)?.add(e.a);
  }

  const isStair = new Set(graph.nodes.filter((n) => n.kind === "stair").map((n) => n.id));
  // Cost of the directed step from→to: entering a stair costs 1, leaving one
  // costs 0 (a floor transition = one hop), everything else costs 1.
  const stepCost = (from: string, to: string): number =>
    isStair.has(to) ? 1 : isStair.has(from) ? 0 : 1;

  const depth = new Map<string, number>();
  const deque: string[] = [];
  for (const id of graph.entryIds) {
    if (depth.has(id)) continue;
    depth.set(id, 0);
    deque.push(id);
  }
  while (deque.length) {
    const id = deque.shift()!;
    const d = depth.get(id)!;
    for (const nb of adj.get(id) ?? []) {
      const w = stepCost(id, nb);
      if (d + w < (depth.get(nb) ?? Infinity)) {
        depth.set(nb, d + w);
        if (w === 0) deque.unshift(nb);
        else deque.push(nb);
      }
    }
  }
  return depth;
}

// ---- Circulation efficiency (net-to-gross) ---------------------------------

/** Above this whole-dwelling circulation fraction, N1 flags "circulation-heavy".
 *  Efficient flats run ~10–15% circulation; every circulation m² is cost without
 *  habitable benefit, so a quarter of the interior is a generous ceiling. */
export const CIRCULATION_FRACTION_MAX = 0.25;

/**
 * Whole-dwelling circulation fraction: (circulation-cluster cells + stair
 * footprint cells) ÷ (all occupied interior cells). OUTDOOR cells are excluded
 * from BOTH numerator and denominator — a balcony/terrace is neither served
 * (habitable) area nor circulation, so it must not dilute the ratio either way.
 * Furniture isn't a graph node, so it's naturally out. Null if there's no
 * interior area yet. (Per-floor fractions aren't surfaced — only the
 * whole-dwelling figure drives the report line + N1; noted as an intentional
 * scope choice.)
 */
export function computeCirculationFraction(graph: DwellingGraph): number | null {
  let circ = 0;
  let denom = 0;
  for (const n of graph.nodes) {
    if (n.kind === "cluster" && n.roomTypeId === "outdoor") continue; // excluded both sides
    denom += n.cells.length;
    const isCirculation = n.kind === "cluster" && n.roomTypeId === "circulation";
    if (isCirculation || n.kind === "stair") circ += n.cells.length;
  }
  return denom > 0 ? circ / denom : null;
}

// ---- Privacy gradient (space syntax) ---------------------------------------

/** Mean entrance-depth of PUBLIC rooms (Living/Recreation) vs BEDROOMS, over only
 *  the nodes that HAVE a depth (are reachable). Null if either set is empty (or
 *  has no reachable member) — PG1 and the depth-section line both consume this,
 *  so the "inverted gradient" test and its info line agree. Hillier & Hanson,
 *  *The Social Logic of Space*: the canonical genotype is public shallow, private
 *  deep — an inversion (bedrooms shallower than living) is the flagged anomaly. */
export function publicVsBedroomDepth(
  graph: DwellingGraph,
  depths: Map<string, number>
): { publicMean: number; bedroomMean: number } | null {
  const isRoomType = (n: GraphNode, ...types: string[]) =>
    n.kind === "room" && types.includes(n.roomTypeId);
  const meanOf = (pred: (n: GraphNode) => boolean): number | null => {
    const ds = graph.nodes.filter(pred).map((n) => depths.get(n.id)).filter((d): d is number => d !== undefined);
    return ds.length ? ds.reduce((s, d) => s + d, 0) / ds.length : null;
  };
  const publicMean = meanOf((n) => isRoomType(n, "living", "recreation"));
  const bedroomMean = meanOf((n) => isRoomType(n, "bedroom_small", "bedroom_large"));
  if (publicMean === null || bedroomMean === null) return null;
  return { publicMean, bedroomMean };
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

  // ===== Doors — the reachability prerequisite (informational cutover note) =====
  {
    // Reachability is strictly DOOR-based: physical touch without a door is not
    // a connection. A dwelling with rooms but zero doors therefore floods H1 (and
    // friends) with "orphaned" flags — intended, but a wall of red is confusing
    // without context. This ONE summarizing note explains it, shown alongside the
    // real flags (not instead of them). Once any door exists it disappears.
    id: "DR1",
    severity: "note",
    description: "No doors placed — reachability requires doors.",
    check(graph, ctx) {
      if (graph.doorCount > 0) return [];
      if (!graph.nodes.some((n) => ctx.is.room(n))) return []; // nothing to reach yet
      return [{ ruleId: "DR1", severity: "note", description: RULES_BY_ID.DR1.description, nodeIds: [], layout: true }];
    },
  },
  {
    // A bedroom with 3+ doors (access edges) is unusual — real bedrooms carry 1–2;
    // more erodes furnishability and privacy. Characterization only (NOTE), on
    // access degree. (Id DR2 — DR1 is the shipped no-doors summary note.)
    id: "DR2",
    severity: "note",
    description: "Bedroom has an unusual number of doors for a private room.",
    check(graph, ctx) {
      return graph.nodes
        .filter((n) => ctx.is.bedroom(n) && ctx.degree(n.id) >= 3)
        .map((n) => ({
          ruleId: "DR2",
          severity: "note" as const,
          description: `Bedroom has ${ctx.degree(n.id)} doors — unusual for a private room.`,
          nodeIds: [n.id],
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
  {
    // A sleeping floor with no toilet is the classic multi-storey miss — a
    // nighttime stair trip to the bathroom (comfort norm, SOFT). GATED on P1
    // being silent (some bathroom exists somewhere): a bathroom-less one-floor
    // flat is already P1 (hard), and MB1 must not double-fire on that same absence.
    id: "MB1",
    severity: "soft",
    description: "A floor has bedrooms but no bathroom.",
    check(graph, ctx) {
      if (!graph.nodes.some(ctx.is.bathroom)) return []; // P1 owns "no bathroom at all"
      const out: Violation[] = [];
      for (const f of new Set(graph.nodes.map((n) => n.floor))) {
        const onFloor = graph.nodes.filter((n) => n.floor === f);
        const beds = onFloor.filter(ctx.is.bedroom);
        if (beds.length && !onFloor.some(ctx.is.bathroom))
          out.push({
            ruleId: "MB1",
            severity: "soft",
            description: `Floor ${f} has bedrooms but no bathroom.`,
            nodeIds: beds.map((n) => n.id),
          });
      }
      return out;
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
      // BATHROOMS are EXEMPT: a bathroom reached only through a bedroom is the
      // en-suite typology (a bathroom intentionally serving its bedroom), not a
      // failure — acknowledged softly by S7, and the guest-access concern (a guest
      // crossing a bedroom to reach ANY bathroom) is carried by G1. H3 still fires
      // for every other room type AND for stairs (vertical circulation gated behind
      // a private bedroom is genuinely bad).
      return graph.nodes
        .filter(
          (n) =>
            ctx.is.roomOrStair(n) &&
            !ctx.is.bedroom(n) &&
            !ctx.is.bathroom(n) &&
            full.has(n.id) &&
            !noBed.has(n.id)
        )
        .map((n) => violation("H3", "hard", n));
    },
  },
  {
    // Hygiene is about ACCESS, not masonry: the failure is a DOOR directly between
    // food prep and a toilet, so H4 fires on the ACCESS edge. A shared WALL between
    // the two (no door) is the OPPOSITE — textbook services economy (back-to-back
    // wet rooms, stacked risers, short plumbing runs; standard practice) — and is
    // characterised positively by S6. (The House-GAN "closet inside a kitchen"
    // failure citation concerned CONTAINMENT, not adjacency; it never supported a
    // touch-based H4.)
    id: "H4",
    severity: "hard",
    description: "Direct door between a bathroom and a kitchen — food prep opening onto a toilet.",
    check(graph, ctx) {
      return edgeViolations(graph, ctx, "H4", "hard", (a, b) =>
        pair(ctx.is.bathroom, ctx.is.kitchen, a, b), true
      );
    },
  },
  {
    // The positive counterpart to H4: a bathroom and kitchen sharing a WALL (touch,
    // no door between them) is efficient services — back-to-back wet rooms let the
    // plumbing stack on one riser wall. Excludes any pair that H4 owns (a door
    // exists) so the two never both fire on one boundary. Grounding: plumbing
    // economy / stacked-services practice.
    id: "S6",
    severity: "note",
    description: "Shared wet wall between kitchen and bathroom — efficient services.",
    check(graph, ctx) {
      return edgeViolations(graph, ctx, "S6", "note", (a, b) =>
        pair(ctx.is.bathroom, ctx.is.kitchen, a, b), false, true
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
    // SOFT (not hard): a degree-0 corridor is dead space — a design flaw, not
    // uninhabitability. Matches O1 (the identical degree-0-cluster condition for
    // outdoor), which is soft; the two were inconsistent before this tier fix.
    id: "C1",
    severity: "soft",
    description: "Orphaned corridor — a circulation space connected to nothing (dead space).",
    check(graph, ctx) {
      return graph.nodes
        .filter((n) => ctx.is.circulation(n) && ctx.degree(n.id) === 0)
        .map((n) => violation("C1", "soft", n));
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
  {
    // The outdoor analogue of C1: post-doors an undoored balcony/terrace connects
    // to nothing, and no other rule sees it (H1 checks rooms; C1/C2 check
    // circulation). Zero ACCESS edges → unreachable. Distinct from S1 (which is
    // the OVER-connected outdoor smell).
    id: "O1",
    severity: "soft",
    description: "Outdoor space is unreachable — no door connects it to the dwelling.",
    check(graph, ctx) {
      return graph.nodes
        .filter((n) => ctx.is.outdoor(n) && ctx.degree(n.id) === 0)
        .map((n) => violation("O1", "soft", n));
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
  {
    // Consumes the derived window generator's achieved-vs-target glazing
    // (`node.glazing`, from `floor.windowStats`) — does NOT recompute windows.
    // `belowTarget` already covers the too-little-glazing-on-available-walls case.
    // GATED on `hasExteriorEdge`: a room with NO exterior wall at all is owned by
    // D1 (habitable, hard) / D2 (kitchen, soft) — firing W1 there too would be a
    // redundant double-flag on the same void-facing room (see the item-1 fix,
    // which stops void edges from counting as exterior in the first place).
    id: "W1",
    severity: "soft",
    description: "Room's glazing is below its daylight target.",
    check(graph) {
      return graph.nodes
        .filter((n) => n.hasExteriorEdge && n.glazing?.belowTarget)
        .map((n) => violation("W1", "soft", n));
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
  // S1/S2 count ACCESS (door) connections via `ctx.degree` (which is access-only,
  // see buildContext) — a hub is a *connected* hub, and a balcony with three DOORS
  // is the real smell, not one that merely abuts three rooms through sealed walls.
  // GROUNDING CAVEAT: the empirical anchors (House-GAN Table 1 connection counts)
  // were proximity-based, so these thresholds are approximate under door-based
  // access semantics. (ST1 is likewise access-based, per-end — correct as is.)
  {
    id: "S1",
    severity: "soft",
    description: "Outdoor / balcony over-connected (more than two doors) — usually a leaf space.",
    check(graph, ctx) {
      return graph.nodes
        .filter((n) => ctx.is.outdoor(n) && ctx.degree(n.id) > 2)
        .map((n) => violation("S1", "soft", n));
    },
  },
  {
    id: "S2",
    severity: "soft",
    description: "Living room under-connected (one or no doors) — typically a social hub.",
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
    // Replaces the old S4 ("two bedrooms touching"), which had no defensible
    // grounding — two quiet uses sharing a wall is standard everywhere. AC1 is the
    // real acoustic concern: a Bedroom sharing a WALL (touch) with a STAIR — impact
    // + airborne noise from stair use against a sleeping room. Grounding: SIA 181
    // (acoustic separation of noisy and quiet uses). Deliberately scoped to STAIRS
    // ONLY: bedroom↔Recreation touch is already carried by S3 (Recreation is
    // `is.public`), and double-flagging the same edge would break the ruleset's
    // no-double-fire principle.
    id: "AC1",
    severity: "soft",
    description: "Bedroom shares a wall with a stair — stair noise against a sleeping room.",
    check(graph, ctx) {
      return edgeViolations(graph, ctx, "AC1", "soft", (a, b) =>
        pair(ctx.is.bedroom, ctx.is.stair, a, b)
      );
    },
  },
  {
    // Keyed on the ACCESS (door) edge: a doored kitchen↔living connection reads
    // as open-plan; a merely-touching pair through a SEALED shared wall is not
    // open-plan, so it earns no note.
    id: "S5",
    severity: "note",
    description: "Kitchen and living room connected by a door — open-plan. Perfectly fine, noted for confirmation.",
    check(graph, ctx) {
      return edgeViolations(graph, ctx, "S5", "note", (a, b) =>
        pair(ctx.is.kitchen, ctx.is.living, a, b), true
      );
    },
  },
  {
    // Acknowledges the en-suite typology that H3 now EXEMPTS: a bathroom reachable
    // only through a bedroom is a bathroom serving its bedroom — intentional, not a
    // failure. No double-fire — H3 excludes exactly these bathrooms; this targets
    // exactly them. (The guest-access concern, "a guest must cross a bedroom to
    // reach ANY bathroom", is the dwelling-level G1, soft.)
    id: "S7",
    severity: "note",
    description: "En-suite bathroom (accessed via bedroom).",
    check(graph, ctx) {
      if (!ctx.hasEntrance) return [];
      const full = ctx.reachableFrom(ctx.entryIds);
      const noBed = ctx.reachableFrom(ctx.entryIds, ctx.is.bedroom);
      return graph.nodes
        .filter((n) => ctx.is.bathroom(n) && full.has(n.id) && !noBed.has(n.id))
        .map((n) => violation("S7", "note", n));
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
  {
    // Net-to-gross efficiency. The whole-dwelling circulation % is ALWAYS surfaced
    // as an informational line in the report (validationPanel, like the depth
    // summary); this rule adds the SOFT flag past CIRCULATION_FRACTION_MAX.
    id: "N1",
    severity: "soft",
    description: "Circulation-heavy layout — too much of the interior is circulation.",
    check(graph) {
      const f = computeCirculationFraction(graph);
      if (f === null || f <= CIRCULATION_FRACTION_MAX) return [];
      return [{
        ruleId: "N1",
        severity: "soft",
        description: `Circulation-heavy layout (${Math.round(f * 100)}% of interior area).`,
        nodeIds: [],
        layout: true,
      }];
    },
  },
  {
    // Space-syntax privacy gradient (Hillier & Hanson): the canonical genotype is
    // public shallow, private deep. If the mean depth of PUBLIC rooms exceeds the
    // mean depth of BEDROOMS, the gradient is inverted — bedrooms sit shallower
    // than the social rooms. Silent when either set is empty (publicVsBedroomDepth
    // returns null) and gated on an entrance existing, like all depth rules.
    id: "PG1",
    severity: "soft",
    description: "Inverted privacy gradient — bedrooms are shallower than living spaces.",
    check(graph, ctx) {
      if (!ctx.hasEntrance) return [];
      const means = publicVsBedroomDepth(graph, computeEntranceDepths(graph));
      if (!means || means.publicMean <= means.bedroomMean) return [];
      return [{ ruleId: "PG1", severity: "soft", description: RULES_BY_ID.PG1.description, nodeIds: [], layout: true }];
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

/** Unordered node-pair key (for matching a touch edge against the access set). */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function edgeViolations(
  graph: DwellingGraph,
  ctx: RuleContext,
  ruleId: string,
  severity: Severity,
  match: (a: GraphNode, b: GraphNode) => boolean,
  /** false (default) = physical TOUCH edges (proximity rules H4-touch families);
   *  true = door ACCESS edges (H4/S5 — a doored connection, not a sealed wall). */
  access = false,
  /** When iterating TOUCH edges, skip any pair that ALSO has an ACCESS edge — so
   *  a TOUCH-only characterization (S6: shared wet wall) never fires on a pair the
   *  ACCESS rule (H4: doored) already owns. */
  excludeAccessCovered = false
): Violation[] {
  const accessPairs =
    excludeAccessCovered
      ? new Set(graph.edges.filter((e) => e.viaDoor).map((e) => pairKey(e.a, e.b)))
      : null;
  const out: Violation[] = [];
  for (const e of graph.edges) {
    if (access ? !e.viaDoor : e.viaDoor) continue;
    if (accessPairs && accessPairs.has(pairKey(e.a, e.b))) continue;
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
