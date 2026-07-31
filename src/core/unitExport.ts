import { cellKey, type Cell } from "./grid";
import { CELL_SIZE } from "./grid";
import { exteriorEdges, edgeKey, type Side } from "./exteriorEdges";
import { occupiedCells, MODULE_DEFS, type ModuleDef } from "./modules";
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

/** What a cell IS, so the building can show a balcony as a recess instead of
 *  solid mass. Parallel to {@link UnitStorey.cells}, index for index. */
export type UnitCellKind = "room" | "outdoor" | "circulation" | "stair";

/** One entry of the unit file's {@link DwellingUnitFile.roomTypes} legend: a
 *  module type id used by this unit, with the label and colour the CONFIGURATOR
 *  gives it. Carrying the legend in the file is what lets the building show a
 *  flat in its author's colours without knowing the configurator's catalog. */
export interface UnitRoomType {
  /** Module type id (`ModuleDef.type`) — the key `cellRooms` entries use. */
  id: string;
  name: string;
  /** "#rrggbb" — the bottom-up convention (see `color` above). */
  color: string;
}

/** `ModuleDef.color` (packed 0xRRGGBB) → the "#rrggbb" the wire format uses. */
function hexColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/** The COARSE cell kind implied by a module def — the classification `cellKinds`
 *  carries. Kept as one function so `cellKinds` and `cellRooms` are derived from
 *  the SAME owner lookup and cannot disagree (asserted in {@link buildStorey}). */
function kindOf(def: ModuleDef | undefined): UnitCellKind {
  if (!def) return "stair"; // only a below-floor stair projection resolves to no local instance
  if (def.cluster === "outdoor") return "outdoor";
  if (def.cluster === "circulation") return "circulation";
  if (def.category === "stair") return "stair";
  return "room";
}

export interface UnitStorey {
  cells: [number, number][];
  /** OPTIONAL, purely ADDITIVE (see docs/bridge-format.md): one kind per cell,
   *  same order as `cells`. A reader that ignores it — every v1 importer
   *  written before this field existed — behaves exactly as before, which is
   *  why the format stays at version 1. Absent ⇒ treat every cell as "room". */
  cellKinds?: UnitCellKind[];
  /** OPTIONAL, purely ADDITIVE, index-parallel to `cells` exactly like
   *  {@link cellKinds}: the MODULE TYPE ID owning each cell ("living",
   *  "bathroom_large", "circulation_single", "outdoor_double", "stair", …).
   *
   *  The FINE layer to `cellKinds`' coarse one — they are derived from one
   *  owner lookup and must agree where they overlap (a cell whose kind is
   *  "outdoor" carries an outdoor type id). Elastic rooms label their GROWN
   *  cells with the owner's type: the effective occupancy is what exists, and
   *  the seed/claimed distinction is a configurator-internal matter that
   *  deliberately does not cross the bridge. Absent ⇒ the building knows only
   *  the coarse kinds, which is what it knew before this field existed. */
  cellRooms?: string[];
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
  /** OPTIONAL, purely ADDITIVE: the legend for every type id used by any
   *  storey's `cellRooms`, sorted by id so the file is byte-stable. Present iff
   *  `cellRooms` is. The building reads colours from HERE, never from a copy of
   *  the configurator's catalog — one app owns the palette, the other is told. */
  roomTypes?: UnitRoomType[];
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
    // `cellKinds` and `cellRooms` are index-parallel to `cells`, so translating
    // cells IN PLACE keeps all three aligned — never reorder one alone.
    s.cells = s.cells.map(([x, z]) => [x - minX, z - minZ]);
    s.edges = s.edges.map((e) => ({ ...e, cell: [e.cell[0] - minX, e.cell[1] - minZ] }));
  }

  // The coarse layer (`cellKinds`) and the fine one (`cellRooms`) come from ONE
  // owner lookup per cell, so they agree by construction. Assert it anyway: this
  // is the invariant the building relies on to render a balcony as a balcony
  // AND colour it from the legend, and a future edit that derives either layer
  // some other way must fail loudly here rather than ship a contradictory file.
  for (let i = 0; i < storeys.length; i++) {
    const s = storeys[i];
    for (let k = 0; k < s.cells.length; k++) {
      const id = s.cellRooms![k];
      const expected = kindOf(MODULE_DEFS[id]);
      if (expected !== s.cellKinds![k])
        return {
          ok: false,
          reason:
            `Internal: storey ${i} cell ${k} has kind "${s.cellKinds![k]}" but room type ` +
            `"${id}" (kind "${expected}") — cellKinds and cellRooms disagree. Please report this.`,
        };
    }
  }

  // Legend for every type id any storey uses, sorted by id so the file is
  // byte-stable. Built from MODULE_DEFS — the ids ARE catalog keys — so nothing
  // has to be threaded out of the per-storey pass.
  const usedIds = [...new Set(storeys.flatMap((s) => s.cellRooms ?? []))].sort();
  const roomTypes: UnitRoomType[] = usedIds.map((id) => {
    const def = MODULE_DEFS[id];
    return { id, name: def.name, color: hexColor(def.color) };
  });

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
      roomTypes,
      sourceProject: serializeProject(floors, fm.northAngle, fm.orientationPreference),
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
  // Per-cell kind + type id, index-parallel to `cells`, from ONE owner lookup —
  // the coarse and fine layers can't drift because neither is derived from the
  // other or from a second pass. A stairwell-hole projection from the floor
  // below is the void over a stair, so it reads as "stair" in both.
  const cellKinds: UnitCellKind[] = [];
  const cellRooms: string[] = [];
  for (const c of cells) {
    const owner = floor.effectiveOwnerAt(c.cx, c.cz);
    // The hole projection has no local def; it is the void over a stair, so the
    // fine layer names MODULE_DEFS.stair rather than inventing an id.
    const def = (owner ? floor.store.instances.get(owner)?.def : undefined) ?? MODULE_DEFS.stair;
    cellKinds.push(kindOf(def));
    cellRooms.push(def.type);
  }
  const height = fm.floorHeightOf(floor);

  // Entrance edges: NON-blocked authored entrances only (floor 0).
  const entranceKeys = new Set(openEntrances.map((e) => edgeKey(e.cell.cx, e.cell.cz, e.side)));

  // Glazed edges: the derived windows, re-run with EXACTLY the inputs the wall
  // pass uses (same occupied set, same open-sky test, same all-entrance skip
  // set, same height, north AND french-window set) — reuse of the same pure
  // function, not a parallel derivation.
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
    // …INCLUDING the room's french-window set: french glass counts against the
    // daylight target, so the band the generator adds on top is SMALLER for a
    // room that opens onto a balcony (§2o). Omitting it here exported a band the
    // wall pass never built — glazing the building would honour that does not
    // exist in the model.
    const plan = computeWindows(
      roomCells, inst.def.type, height, occupied, floor.isOutside,
      windowSkip, fm.northAngle, floor.semiExterior?.glazedByRoom.get(inst.id)
    );
    for (const key of plan.edges.keys()) glazedKeys.add(key);
  }
  // CIRCULATION clusters carry french glass too since run 0011, and the export
  // has to say so: the standing invariant is that exported glazing equals BUILT
  // glazing on the same flat, and the wall pass now builds these. They are not
  // re-derived through `computeWindows` because a corridor has no daylight
  // target to make up a shortfall against; the semi-exterior band IS the whole
  // of its glass. Absolute edge keys, the same space `glazedKeys` uses.
  for (const glazed of floor.semiExterior?.glazedByCluster.values() ?? [])
    for (const key of glazed) glazedKeys.add(key);

  // Open-air edges: exterior edges of Outdoor clusters (balconies/terraces).
  const outdoorCells = new Set<string>();
  for (const inst of floor.store.instances.values()) {
    if (inst.def.cluster !== "outdoor") continue;
    for (const c of occupiedCells(inst.def, inst.origin, inst.rotation, inst.mirrored))
      outdoorCells.add(cellKey(c.cx, c.cz));
  }

  // The envelope is the SAME exterior test the rules and windows use, sealed-void
  // gating included — a pocket the flat walls in is not facade, so its edges are
  // absent from the envelope entirely (not "blank": there is nothing there).
  const edges: UnitEdge[] = exteriorEdges(cells, occupied, floor.isOutside).map((e) => {
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

  return { cells: cells.map((c) => [c.cx, c.cz]), cellKinds, cellRooms, edges, height };
}
