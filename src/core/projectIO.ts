import type { Floor } from "./floor";
import { SIDES, type Side } from "./exteriorEdges";

/**
 * Project save/load — serialize the whole design to a JSON file and back.
 *
 * SOURCE OF TRUTH ONLY. Everything else (cluster shells, adjacency graph, wall
 * geometry, prop placement) is derived and rebuilds on load from this data, so
 * none of it is serialized. A placed room, furniture module, and connector are
 * all the same thing in the model — a {@link import("./store").ModuleInstance}
 * (a `def.type` + grid origin + rotation) — so they all serialize uniformly;
 * `type` alone distinguishes a kitchen from a domino from a circulation piece.
 *
 * This is a DIFFERENT format from the voxel-prop JSON (a single prop, format
 * "voxel-prop"); {@link parseProject} rejects that and other non-project files.
 */

export const PROJECT_FORMAT = "flat-configurator-project";
/** Bump when the schema changes. Add a migration in {@link migrate} for any
 *  change that isn't purely additive/backward-compatible. */
export const APP_PROJECT_VERSION = 1;

/** Fallback grid size for a floor whose dimensions are missing/invalid. */
const DEFAULT_DIM = 16;

export interface InstanceData {
  type: string;
  cx: number;
  cz: number;
  rotation: number;
  /** Left/right footprint flip. ADDITIVE (v1): absent in older files → false,
   *  defaulted by {@link normalizeInstance}, so no version bump/migration. */
  mirrored?: boolean;
}

/** A ground-floor entrance: host cell + the exterior side it binds to. */
export interface EntranceData {
  cx: number;
  cz: number;
  side: Side;
}

/** An interior door: anchor cell + the side it binds to (2-edge span implied by
 *  the side's run direction). Same wire shape as an entrance. */
export interface DoorData {
  cx: number;
  cz: number;
  side: Side;
}

export interface FloorData {
  cols: number;
  rows: number;
  instances: InstanceData[];
  /** Entrances bound to exterior edges (floor 0 only, in practice). */
  entrances: EntranceData[];
  /** Interior doors bound to shared interior edges (any floor). ADDITIVE:
   *  absent in older files → empty, so pre-doors files load doorless. */
  doors: DoorData[];
}

export interface ProjectFile {
  format: string;
  version: number;
  floors: FloorData[];
}

/** How the file's version relates to the version this app understands. */
export type VersionStatus = "current" | "older" | "newer";

export interface ParsedProject {
  /** Normalized + migrated data, safe to hand to the loader. */
  data: ProjectFile;
  status: VersionStatus;
  fileVersion: number;
}

/** Thrown for anything that makes a file unloadable (bad JSON, wrong format). */
export class ProjectParseError extends Error {}

// ---- Serialize -------------------------------------------------------------

/** Capture the whole project (all floors, in order) as a plain JSON object. */
export function serializeProject(floors: Floor[]): ProjectFile {
  return {
    format: PROJECT_FORMAT,
    version: APP_PROJECT_VERSION,
    floors: floors.map((f) => ({
      cols: f.grid.cols,
      rows: f.grid.rows,
      instances: [...f.store.instances.values()].map((i) => ({
        type: i.def.type,
        cx: i.origin.cx,
        cz: i.origin.cz,
        rotation: i.rotation,
        mirrored: i.mirrored,
      })),
      entrances: f.entrances.map((e) => ({ cx: e.cell.cx, cz: e.cell.cz, side: e.side })),
      doors: f.doors.map((d) => ({ cx: d.cell.cx, cz: d.cell.cz, side: d.side })),
    })),
  };
}

// ---- Parse / validate ------------------------------------------------------

/**
 * Parse + validate raw file text into loadable project data. Throws
 * {@link ProjectParseError} (with a user-facing message) for non-project files.
 *
 * The loader is deliberately TOLERANT: any field a newer version might add that
 * an older file lacks defaults to absent/empty rather than crashing (missing
 * arrays → empty, missing dims → default). So an older, less feature-rich file
 * is a valid design and loads fine.
 */
export function parseProject(text: string): ParsedProject {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ProjectParseError("This file isn't valid JSON.");
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new ProjectParseError("This file isn't a recognised project file.");

  const obj = raw as Record<string, unknown>;
  if (obj.format !== PROJECT_FORMAT) {
    if (obj.format === "voxel-prop")
      throw new ProjectParseError(
        "That's a voxel-prop file (a single furniture prop), not a project file."
      );
    throw new ProjectParseError(
      "This file isn't a flat-configurator project file (wrong or missing format identifier)."
    );
  }

  const fileVersion = typeof obj.version === "number" ? obj.version : 0;
  const status: VersionStatus =
    fileVersion === APP_PROJECT_VERSION
      ? "current"
      : fileVersion < APP_PROJECT_VERSION
        ? "older"
        : "newer";

  const data = migrate(normalize(obj), fileVersion);
  return { data, status, fileVersion };
}

/**
 * FUTURE MIGRATION HOOK.
 *
 * For an older file (`fileVersion < APP_PROJECT_VERSION`) whose data SHAPE
 * differs from current, transform it up to current here — one guarded step per
 * version bump, e.g.:
 *
 *   if (fileVersion < 2) data = v1ToV2(data);
 *   if (fileVersion < 3) data = v2ToV3(data);
 *
 * v1 is the only version today, so this is a pass-through. Purely additive
 * features (case 2 backward-compat) need NO migration — the tolerant
 * {@link normalize} already defaults their absent fields. Only a genuine
 * breaking change to an EXISTING field would add a step here. Newer-than-app
 * files are passed through unchanged (the caller warns the user instead).
 */
function migrate(data: ProjectFile, _fileVersion: number): ProjectFile {
  return data;
}

// ---- Tolerant normalization (defaults for everything that may be absent) ----

function normalize(obj: Record<string, unknown>): ProjectFile {
  const floorsRaw = Array.isArray(obj.floors) ? obj.floors : [];
  return {
    format: PROJECT_FORMAT,
    version: APP_PROJECT_VERSION,
    floors: floorsRaw.map(normalizeFloor),
  };
}

function normalizeFloor(raw: unknown): FloorData {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const instRaw = Array.isArray(o.instances) ? o.instances : [];
  const entRaw = Array.isArray(o.entrances) ? o.entrances : [];
  const doorRaw = Array.isArray(o.doors) ? o.doors : [];
  return {
    cols: clampDim(num(o.cols, DEFAULT_DIM)),
    rows: clampDim(num(o.rows, DEFAULT_DIM)),
    instances: instRaw
      .map(normalizeInstance)
      .filter((i): i is InstanceData => i !== null),
    entrances: entRaw
      .map(normalizeEdgeBound)
      .filter((e): e is EntranceData => e !== null),
    doors: doorRaw
      .map(normalizeEdgeBound)
      .filter((d): d is DoorData => d !== null),
  };
}

/** Both entrances and doors are (cell, side) edge-bound records with the same
 *  wire shape, so one tolerant reader serves both. */
function normalizeEdgeBound(raw: unknown): { cx: number; cz: number; side: Side } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!SIDES.includes(o.side as Side)) return null;
  return { cx: Math.round(num(o.cx, 0)), cz: Math.round(num(o.cz, 0)), side: o.side as Side };
}

function normalizeInstance(raw: unknown): InstanceData | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.type !== "string") return null; // can't place a typeless instance
  return {
    type: o.type,
    cx: Math.round(num(o.cx, 0)),
    cz: Math.round(num(o.cz, 0)),
    rotation: (((Math.round(num(o.rotation, 0)) % 4) + 4) % 4),
    mirrored: o.mirrored === true, // absent/older files → false
  };
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function clampDim(v: number): number {
  return Math.max(1, Math.min(100, Math.round(v)));
}
