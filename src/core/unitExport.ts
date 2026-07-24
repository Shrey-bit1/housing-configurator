import { cellKey, type Cell } from "./grid";
import { CELL_SIZE } from "./grid";
import { exteriorEdges, edgeKey, type Side } from "./exteriorEdges";
import { occupiedCells } from "./modules";
import { buildSpaceTargets } from "./door";
import { computeWindows } from "./windows";
import { connectedComponents } from "./cluster";
import { computeDwellingGraph, dwellingEntranceId } from "./adjacencyGraph";
import { serializeProject, type ProjectFile } from "./projectIO";
import type { Floor } from "./floor";
import type { FloorManager } from "./floorManager";

/**
 * `dwelling-unit` v1 export — the flat → building bridge (see
 * docs/bridge-format.md, the format's source of truth).
 *
 * READ-ONLY: derives the unit envelope + classified exterior edges from the
 * same sources the rest of the app uses (occupancy via `buildSpaceTargets`,
 * entrance validity via the adjacency graph's re-validation, glazing via
 * `computeWindows`, open-air via Outdoor clusters) and embeds a verbatim
 * project save. No store mutation, no history commit — exporting is not an
 * action on the design.
 */

export type UnitEdgeClass = "entrance" | "glazed" | "open" | "blank";

/** Compact side letters used on the wire (bottom-up maps them to neighbour
 *  deltas; see the mapping table in docs/bridge-format.md). */
const SIDE_LETTER: Record<Side, "N" | "S" | "E" | "W"> = {
  north: "N",
  south: "S",
  east: "E",
  west: "W",
};

export interface UnitEdge {
  cell: [number, number];
  side: "N" | "S" | "E" | "W";
  class: UnitEdgeClass;
}

export interface UnitStorey {
  cells: [number, number][];
  edges: UnitEdge[];
  /** This storey's floor-to-floor height, meters. */
  height: number;
}

export interface DwellingUnitFile {
  format: "dwelling-unit";
  version: 1;
  name: string;
  color: string; // "#rrggbb" (bottom-up convention: hex STRING)
  cellSize: number; // 0.6, verbatim — the grid contract
  northAngle: number; // informational; see the orientation section of the spec
  storeys: UnitStorey[]; // index 0 = entry storey (floor 0)
  sourceProject: ProjectFile; // byte-identical to a normal save
}

export type UnitExportResult =
  | { ok: true; file: DwellingUnitFile }
  | { ok: false; reason: string };

/**
 * Build the export, or fail one of the two HARD gates (everything else about
 * the layout — rule violations, missing glazing — is advisory and must NOT
 * block; the caller may confirm-and-proceed on hard rule violations):
 *  1. at least one NON-blocked entrance on floor 0 (the building needs a
 *     corridor connection point), and
 *  2. every storey's footprint edge-connected (one component) and non-empty
 *     (trailing empty floors are simply trimmed).
 */
export function buildUnitExport(
  fm: FloorManager,
  name: string,
  color: string
): UnitExportResult {
  const floors = fm.floors;

  // Entrance validity comes from the same re-validation the graph build does
  // (EntranceStatus.blocked) — never from the raw authored list.
  const graph = computeDwellingGraph(floors);
  const blockedById = new Map(graph.entrances.map((s) => [s.id, s.blocked]));
  const openEntrances = floors[0].entrances.filter(
    (e) => blockedById.get(dwellingEntranceId(0, e.id)) === false
  );
  if (openEntrances.length === 0) {
    return {
      ok: false,
      reason:
        "No usable entrance: the unit needs at least one NON-blocked entrance on floor 0 " +
        "(see rule E2 — a blocked entrance no longer faces the outside). Place or free one, then export.",
    };
  }

  // Per-floor envelope: the SAME single source of truth doors and windows use —
  // buildSpaceTargets = rooms + clusters + stairs + stair-hole projections.
  const storeys: UnitStorey[] = floors.map((floor, fi) =>
    buildStorey(fm, floor, fi, fi === 0 ? openEntrances : [])
  );

  // Trim trailing empty storeys (e.g. a manually added, never-used top floor);
  // any remaining empty or disconnected storey is a real gate failure.
  while (storeys.length > 1 && storeys[storeys.length - 1].cells.length === 0) storeys.pop();
  for (let i = 0; i < storeys.length; i++) {
    const cells = storeys[i].cells.map(([cx, cz]) => ({ cx, cz }));
    if (cells.length === 0)
      return { ok: false, reason: `Floor ${i} is empty — every storey needs a footprint.` };
    if (connectedComponents(cells).length !== 1)
      return {
        ok: false,
        reason: `Floor ${i}'s footprint is not edge-connected (one piece) — join it before exporting.`,
      };
  }

  // Normalization: ONE translation for the whole unit — the min corner over
  // the UNION of all storeys — applied to cells and edges alike, so storeys
  // keep their mutual registration (stair position). Never per-storey.
  let minX = Infinity;
  let minZ = Infinity;
  for (const s of storeys)
    for (const [x, z] of s.cells) {
      if (x < minX) minX = x;
      if (z < minZ) minZ = z;
    }
  for (const s of storeys) {
    s.cells = s.cells.map(([x, z]) => [x - minX, z - minZ]);
    s.edges = s.edges.map((e) => ({ ...e, cell: [e.cell[0] - minX, e.cell[1] - minZ] }));
  }

  return {
    ok: true,
    file: {
      format: "dwelling-unit",
      version: 1,
      name,
      color,
      cellSize: CELL_SIZE,
      northAngle: fm.northAngle,
      storeys,
      sourceProject: serializeProject(floors, fm.northAngle),
    },
  };
}

/** One storey's cells + every exterior edge, classified
 *  entrance > glazed > open > blank (priority per the spec). */
function buildStorey(
  fm: FloorManager,
  floor: Floor,
  fi: number,
  openEntrances: Floor["entrances"]
): UnitStorey {
  const targets = buildSpaceTargets(floor, fm.floorBelow(floor));
  const occupied = new Set(targets.keys());
  const cells: Cell[] = [...targets.keys()].map((k) => {
    const [cx, cz] = k.split(",").map(Number);
    return { cx, cz };
  });
  const height = fm.floorHeightOf(floor);

  // Entrance edges: NON-blocked authored entrances only (floor 0).
  const entranceKeys = new Set(openEntrances.map((e) => edgeKey(e.cell.cx, e.cell.cz, e.side)));

  // Glazed edges: the derived windows, re-run with EXACTLY the inputs the wall
  // pass uses (same occupied set, same all-entrance skip set, same height and
  // north) — reuse of the same pure function, not a parallel derivation.
  const windowSkip = new Set(
    fi === 0 ? floor.entrances.map((e) => edgeKey(e.cell.cx, e.cell.cz, e.side)) : []
  );
  const glazedKeys = new Set<string>();
  for (const inst of floor.store.instances.values()) {
    if (inst.def.category !== "room" || inst.def.cluster) continue;
    // EFFECTIVE footprint (expansion.ts) — the same cells the wall pass
    // windows, so the exported glazed edges match the grown room exactly.
    const roomCells =
      floor.effectiveCells.get(inst.id) ??
      occupiedCells(inst.def, inst.origin, inst.rotation, inst.mirrored);
    const plan = computeWindows(roomCells, inst.def.type, height, occupied, windowSkip, fm.northAngle);
    for (const key of plan.edges.keys()) glazedKeys.add(key);
  }

  // Open-air edges: exterior edges of Outdoor clusters (balconies/terraces).
  const outdoorCells = new Set<string>();
  for (const inst of floor.store.instances.values()) {
    if (inst.def.cluster !== "outdoor") continue;
    for (const c of occupiedCells(inst.def, inst.origin, inst.rotation, inst.mirrored))
      outdoorCells.add(cellKey(c.cx, c.cz));
  }

  const edges: UnitEdge[] = exteriorEdges(cells, occupied).map((e) => {
    const key = edgeKey(e.cx, e.cz, e.side);
    const cls: UnitEdgeClass = entranceKeys.has(key)
      ? "entrance"
      : glazedKeys.has(key)
        ? "glazed"
        : outdoorCells.has(cellKey(e.cx, e.cz))
          ? "open"
          : "blank";
    return { cell: [e.cx, e.cz], side: SIDE_LETTER[e.side], class: cls };
  });

  return { cells: cells.map((c) => [c.cx, c.cz]), edges, height };
}
