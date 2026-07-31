import { describe, it, expect } from "vitest";
import { validate } from "./rules";
import type { DwellingGraph, GraphNode, GraphEdge, EntranceStatus } from "./adjacencyGraph";
import type { Cell } from "./grid";

/**
 * A FIRING and a SILENT case for each of the eleven rules this week's work
 * touched or leaned on: E1, E2, H1, C1, OD1, A1, N1, DP1, WET1, FAC1, ST3.
 *
 * The graphs are HAND-BUILT rather than derived from a `FloorManager`. That is
 * the whole reason this file is fast: `validate` consumes a `DwellingGraph`,
 * which is plain data (nodes with cells and flags, edges, entry ids, a floor
 * count), so a rule can be exercised without three.js, without a canvas, and
 * without the geometry pipeline that produces those numbers in the app.
 *
 * WHAT THAT DOES AND DOES NOT PROVE, stated plainly because the distinction
 * decides how much these tests are worth. It proves the rule LOGIC: given a
 * graph with these properties, this rule fires on exactly these nodes. It does
 * NOT prove that the app ever builds such a graph, so a bug in
 * `computeDwellingGraph` that mislabels `hasFacadeEdge` would leave every test
 * here green. The paired browser measurements in the run reports cover that
 * direction; these cover the direction a browser cannot, which is the negative
 * case and the boundary.
 *
 * Every case is MINIMAL: the smallest graph in which the rule can speak, so a
 * failure names one cause. Where current behaviour surprised the test, the
 * surprise is written into the test as a comment and reported, never quietly
 * adjusted away.
 */

// ---- Graph construction helpers --------------------------------------------

/** A solid rectangle of cells, inclusive of both corners. */
function rect(x0: number, z0: number, x1: number, z1: number): Cell[] {
  const out: Cell[] = [];
  for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) out.push({ cx, cz });
  return out;
}

/** One node. Defaults are the boring case: a facade-having, non-entry room on
 *  floor 0, so a test only states the property it is actually about. */
function node(
  id: string,
  roomTypeId: string,
  opts: Partial<GraphNode> = {}
): GraphNode {
  const kind: GraphNode["kind"] =
    roomTypeId === "stair" ? "stair" : roomTypeId === "circulation" || roomTypeId === "outdoor" ? "cluster" : "room";
  return {
    id,
    rawId: id.slice(id.indexOf("/") + 1),
    floor: Number(id.slice(0, id.indexOf("/"))),
    roomTypeId,
    label: `${roomTypeId} ${id}`,
    color: 0,
    kind,
    cells: rect(0, 0, 1, 1),
    hasExteriorEdge: true,
    hasTrueExteriorEdge: true,
    hasSemiExteriorEdge: false,
    hasFacadeEdge: true,
    ...opts,
  };
}

/** A door-gated ACCESS edge, which is what reachability traverses. */
function door(a: string, b: string, viaStair = false): GraphEdge {
  return { a, b, viaDoor: true, viaStair } as GraphEdge;
}

function graphOf(
  nodes: GraphNode[],
  edges: GraphEdge[] = [],
  opts: Partial<DwellingGraph> = {}
): DwellingGraph {
  const entryIds = nodes.filter((n) => n.isEntry).map((n) => n.id);
  return {
    nodes,
    edges,
    entryIds,
    entrances: [],
    floorCount: new Set(nodes.map((n) => n.floor)).size || 1,
    doorCount: edges.filter((e) => e.viaDoor).length,
    ...opts,
  };
}

/** Rule ids present in a validation run, for compact assertions. */
function ids(graph: DwellingGraph): string[] {
  return validate(graph).map((v) => v.ruleId);
}

/** The node ids a given rule fired on, sorted. */
function firedOn(graph: DwellingGraph, ruleId: string): string[] {
  return validate(graph)
    .filter((v) => v.ruleId === ruleId)
    .flatMap((v) => v.nodeIds)
    .sort();
}

/** A minimal dwelling that satisfies the presence rules (P1 bathroom, P2
 *  kitchen) and is fully reachable, so a test about one rule is not drowned in
 *  unrelated findings. Entry is the living room. */
function baseFlat(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const living = node("0/living", "living", { isEntry: true, cells: rect(0, 0, 3, 2) });
  const kitchen = node("0/kitchen", "kitchen", { cells: rect(4, 0, 6, 2) });
  const bath = node("0/bath", "bathroom_small", { cells: rect(7, 0, 8, 2) });
  return {
    nodes: [living, kitchen, bath],
    edges: [door("0/living", "0/kitchen"), door("0/living", "0/bath")],
  };
}

// ---- The pack --------------------------------------------------------------

describe("E1 — no entrance", () => {
  it("fires when nothing is an entry root", () => {
    const { nodes, edges } = baseFlat();
    nodes[0].isEntry = false;
    expect(ids(graphOf(nodes, edges))).toContain("E1");
  });
  it("is silent when an entry root exists", () => {
    const { nodes, edges } = baseFlat();
    expect(ids(graphOf(nodes, edges))).not.toContain("E1");
  });
});

describe("E2 — blocked entrance", () => {
  const status = (blocked: boolean): EntranceStatus =>
    ({ id: "0/e1", blocked, hostId: "0/living" }) as EntranceStatus;

  it("fires for a blocked entrance", () => {
    const { nodes, edges } = baseFlat();
    const g = graphOf(nodes, edges, { entrances: [status(true)] });
    expect(ids(g)).toContain("E2");
  });
  it("is silent for an open entrance", () => {
    const { nodes, edges } = baseFlat();
    const g = graphOf(nodes, edges, { entrances: [status(false)] });
    expect(ids(g)).not.toContain("E2");
  });
});

describe("H1 — orphaned room", () => {
  it("fires on a room no door path reaches", () => {
    const { nodes, edges } = baseFlat();
    nodes.push(node("0/orphan", "bedroom_small", { cells: rect(0, 5, 2, 7) }));
    expect(firedOn(graphOf(nodes, edges), "H1")).toEqual(["0/orphan"]);
  });
  it("is silent when every room is reachable", () => {
    const { nodes, edges } = baseFlat();
    expect(firedOn(graphOf(nodes, edges), "H1")).toEqual([]);
  });
});

describe("C1 — orphaned corridor", () => {
  it("fires on a circulation cluster with no door at all", () => {
    const { nodes, edges } = baseFlat();
    nodes.push(node("0/corr", "circulation", { cells: rect(0, 5, 1, 6) }));
    expect(firedOn(graphOf(nodes, edges), "C1")).toEqual(["0/corr"]);
  });
  it("is silent for a corridor with two doors", () => {
    const { nodes, edges } = baseFlat();
    nodes.push(node("0/corr", "circulation", { cells: rect(0, 5, 1, 6) }));
    edges.push(door("0/living", "0/corr"), door("0/corr", "0/kitchen"));
    expect(firedOn(graphOf(nodes, edges), "C1")).toEqual([]);
  });
});

describe("OD1 — unreachable outdoor space", () => {
  it("fires on a balcony nothing opens onto", () => {
    const { nodes, edges } = baseFlat();
    nodes.push(node("0/balcony", "outdoor", { cells: rect(0, 5, 2, 5) }));
    expect(firedOn(graphOf(nodes, edges), "OD1")).toEqual(["0/balcony"]);
  });
  it("is silent for a balcony reached by a door", () => {
    const { nodes, edges } = baseFlat();
    nodes.push(node("0/balcony", "outdoor", { cells: rect(0, 5, 2, 5) }));
    edges.push(door("0/living", "0/balcony"));
    expect(firedOn(graphOf(nodes, edges), "OD1")).toEqual([]);
  });
});

describe("A1 — circulation narrower than 1.2 m", () => {
  it("fires on a one-cell-wide corridor", () => {
    const { nodes, edges } = baseFlat();
    // 1 cell = 0.6 m, so a single-cell run is 600 mm: below the 1.2 m minimum.
    nodes.push(node("0/corr", "circulation", { cells: rect(0, 5, 4, 5) }));
    edges.push(door("0/living", "0/corr"), door("0/corr", "0/kitchen"));
    expect(firedOn(graphOf(nodes, edges), "A1")).toEqual(["0/corr"]);
  });
  it("is silent on a two-cell-wide corridor", () => {
    const { nodes, edges } = baseFlat();
    nodes.push(node("0/corr", "circulation", { cells: rect(0, 5, 4, 6) }));
    edges.push(door("0/living", "0/corr"), door("0/corr", "0/kitchen"));
    expect(firedOn(graphOf(nodes, edges), "A1")).toEqual([]);
  });
});

describe("N1 — circulation-heavy layout", () => {
  it("fires when circulation exceeds a quarter of the interior", () => {
    // CIRCULATION_FRACTION_MAX = 0.25. 16 corridor cells against 16 room cells
    // is 50%, comfortably over.
    const living = node("0/living", "living", { isEntry: true, cells: rect(0, 0, 3, 3) });
    const kitchen = node("0/kitchen", "kitchen", { cells: rect(10, 10, 11, 11) });
    const bath = node("0/bath", "bathroom_small", { cells: rect(12, 12, 13, 13) });
    const corr = node("0/corr", "circulation", { cells: rect(4, 0, 7, 3) });
    const edges = [door("0/living", "0/corr"), door("0/corr", "0/kitchen"), door("0/corr", "0/bath")];
    expect(ids(graphOf([living, kitchen, bath, corr], edges))).toContain("N1");
  });
  it("is silent on a layout with almost no circulation", () => {
    const { nodes, edges } = baseFlat();
    nodes.push(node("0/corr", "circulation", { cells: rect(0, 5, 1, 5) }));
    edges.push(door("0/living", "0/corr"), door("0/corr", "0/kitchen"));
    expect(ids(graphOf(nodes, edges))).not.toContain("N1");
  });
});

describe("DP1 — unusually deep room", () => {
  it("fires at DEEP_ROOM_THRESHOLD_HOPS (5) from the entrance", () => {
    // A straight chain: living(0) → a(1) → b(2) → c(3) → d(4) → deep(5).
    const chain = ["a", "b", "c", "d", "deep"];
    const { nodes, edges } = baseFlat();
    let prev = "0/living";
    chain.forEach((name, i) => {
      nodes.push(node(`0/${name}`, "bedroom_small", { cells: rect(0, 10 + i * 3, 1, 11 + i * 3) }));
      edges.push(door(prev, `0/${name}`));
      prev = `0/${name}`;
    });
    expect(firedOn(graphOf(nodes, edges), "DP1")).toEqual(["0/deep"]);
  });
  it("is silent at 4 hops", () => {
    const chain = ["a", "b", "c", "d"];
    const { nodes, edges } = baseFlat();
    let prev = "0/living";
    chain.forEach((name, i) => {
      nodes.push(node(`0/${name}`, "bedroom_small", { cells: rect(0, 10 + i * 3, 1, 11 + i * 3) }));
      edges.push(door(prev, `0/${name}`));
      prev = `0/${name}`;
    });
    expect(firedOn(graphOf(nodes, edges), "DP1")).toEqual([]);
  });
});

describe("WET1 — split wet areas", () => {
  it("fires when a floor's wet rooms form two separate groups", () => {
    const { nodes, edges } = baseFlat();
    // baseFlat's kitchen (4..6) and bath (7..8) TOUCH, so they are one group.
    // Move the bath away to break the run.
    nodes[2].cells = rect(20, 20, 21, 21);
    expect(ids(graphOf(nodes, edges))).toContain("WET1");
  });
  it("is silent when the wet rooms touch", () => {
    const { nodes, edges } = baseFlat();
    expect(ids(graphOf(nodes, edges))).not.toContain("WET1");
  });
});

describe("FAC1 — habitable room without a facade", () => {
  it("fires on a habitable room with no facade edge", () => {
    const { nodes, edges } = baseFlat();
    nodes.push(
      node("0/inner", "bedroom_small", {
        cells: rect(0, 5, 2, 7),
        hasFacadeEdge: false,
        hasExteriorEdge: false,
        hasTrueExteriorEdge: false,
      })
    );
    edges.push(door("0/living", "0/inner"));
    expect(firedOn(graphOf(nodes, edges), "FAC1")).toEqual(["0/inner"]);
  });
  it("is silent when the room has a facade", () => {
    const { nodes, edges } = baseFlat();
    expect(firedOn(graphOf(nodes, edges), "FAC1")).toEqual([]);
  });
  it("stays silent for a KITCHEN with no facade, which D2 owns", () => {
    // Deliberate boundary: FAC1 is gated on `ctx.is.habitable`, which is
    // bedrooms plus public rooms. A kitchen without an exterior wall is D2's
    // subject and must not double-fire here.
    const { nodes, edges } = baseFlat();
    nodes[1].hasFacadeEdge = false;
    nodes[1].hasExteriorEdge = false;
    nodes[1].hasTrueExteriorEdge = false;
    expect(firedOn(graphOf(nodes, edges), "FAC1")).toEqual([]);
    expect(ids(graphOf(nodes, edges))).toContain("D2");
  });
});

describe("ST3 — a floor no stair reaches", () => {
  /** A two-floor dwelling; `linked` decides whether a door-gated stair edge
   *  joins them, which is the only thing that makes floor 1 reachable. */
  function twoFloors(linked: boolean) {
    const { nodes, edges } = baseFlat();
    nodes.push(node("0/stair", "stair", { cells: rect(0, 8, 1, 9) }));
    nodes.push(node("1/stair", "stair", { cells: rect(0, 8, 1, 9), floor: 1 }));
    nodes.push(node("1/bed", "bedroom_small", { cells: rect(3, 8, 5, 10), floor: 1 }));
    edges.push(door("0/living", "0/stair"), door("1/stair", "1/bed"));
    if (linked) edges.push(door("0/stair", "1/stair", true));
    return graphOf(nodes, edges);
  }

  it("fires once for the whole dwelling when a floor is cut off", () => {
    const found = validate(twoFloors(false)).filter((v) => v.ruleId === "ST3");
    expect(found.length).toBe(1);
    expect(found[0].description).toContain("Floor 1");
  });

  it("silences H1 on the cut-off floor rather than repeating the cause", () => {
    // The point of ST3: one root cause instead of one flag per stranded space.
    expect(firedOn(twoFloors(false), "H1")).toEqual([]);
  });

  it("is silent when a stair links the floors", () => {
    expect(ids(twoFloors(true))).not.toContain("ST3");
  });

  it("lets H1 speak again once the floors are linked but a room is not doored", () => {
    const g = twoFloors(true);
    g.nodes.push(node("1/orphan", "bedroom_small", { cells: rect(9, 9, 10, 10), floor: 1 }));
    expect(firedOn(g, "H1")).toEqual(["1/orphan"]);
  });
});
