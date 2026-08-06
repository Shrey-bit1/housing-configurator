/**
 * The unit-library manifest — `units/index.json` (docs/library-format.md).
 *
 * One entry per saved unit, pointing at a `dwelling-unit` JSON and a JPEG
 * preview stored beside the manifest and named by the entry's id. The dev
 * save endpoint appends entries, the unit browser renders them, and the
 * manifest test validates the committed file through the same parser.
 *
 * Self-contained on purpose: no imports, no DOM, no app internals — the
 * bottom-up building repo is expected to read the same file through the same
 * schema.
 */

export interface UnitManifestEntry {
  /** Lowercase slug id, `[a-z0-9-]`, unique in the manifest; files are named by it. */
  id: string;
  /** Display name as typed in the export dialog. Not unique — ids are. */
  name: string;
  /** Unit colour, "#rrggbb" — the same value the unit file carries. */
  color: string;
  /** The `dwelling-unit` JSON, relative to the manifest's own URL: `<id>.json`. */
  file: string;
  /** The JPEG preview, relative to the manifest's own URL: `<id>.jpg`. */
  preview: string;
  /** Storey count, from the unit file's `storeys.length`. */
  storeys: number;
  /** Gross floor area over all storeys, m²: total cell count × cellSize². */
  areaM2: number;
  /** ISO 8601 timestamp of the save. */
  savedAt: string;
}

export interface UnitLibraryIndex {
  format: "unit-library";
  version: 1;
  units: UnitManifestEntry[];
}

/** The parse failure carries which entry and field broke, so a hand-edited
 *  manifest fails loudly rather than rendering half a library. */
export class ManifestParseError extends Error {}

const ID_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const COLOR_RE = /^#[0-9a-f]{6}$/i;

function fail(msg: string): never {
  throw new ManifestParseError(msg);
}

function checkEntry(raw: unknown, i: number): UnitManifestEntry {
  const at = `units[${i}]`;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    fail(`${at} is not an object`);
  const o = raw as Record<string, unknown>;

  for (const key of ["id", "name", "color", "file", "preview", "savedAt"] as const)
    if (typeof o[key] !== "string" || o[key] === "") fail(`${at}.${key} must be a non-empty string`);
  const id = o.id as string;
  if (!ID_RE.test(id)) fail(`${at}.id "${id}" is not a lowercase [a-z0-9-] slug`);
  if (!COLOR_RE.test(o.color as string)) fail(`${at}.color "${o.color}" is not "#rrggbb"`);
  if (o.file !== `${id}.json`) fail(`${at}.file "${o.file}" is not "${id}.json" — files are named by id`);
  if (o.preview !== `${id}.jpg`) fail(`${at}.preview "${o.preview}" is not "${id}.jpg" — files are named by id`);
  if (typeof o.storeys !== "number" || !Number.isInteger(o.storeys) || o.storeys < 1)
    fail(`${at}.storeys must be a positive integer`);
  if (typeof o.areaM2 !== "number" || !Number.isFinite(o.areaM2) || o.areaM2 <= 0)
    fail(`${at}.areaM2 must be a positive number`);
  if (Number.isNaN(Date.parse(o.savedAt as string)))
    fail(`${at}.savedAt "${o.savedAt}" is not a parseable timestamp`);

  return {
    id,
    name: o.name as string,
    color: o.color as string,
    file: o.file as string,
    preview: o.preview as string,
    storeys: o.storeys,
    areaM2: o.areaM2,
    savedAt: o.savedAt as string,
  };
}

/** Parse and validate a manifest. Throws {@link ManifestParseError} naming the
 *  first offending entry/field; never returns a partially valid index. */
export function parseUnitLibraryIndex(text: string): UnitLibraryIndex {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    fail(`manifest is not JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) fail("manifest is not an object");
  const o = raw as Record<string, unknown>;
  if (o.format !== "unit-library") fail(`format is "${o.format}", expected "unit-library"`);
  if (o.version !== 1) fail(`version is ${o.version}, expected 1`);
  if (!Array.isArray(o.units)) fail("units is not an array");

  const units = o.units.map(checkEntry);
  const seen = new Set<string>();
  for (const u of units) {
    if (seen.has(u.id)) fail(`duplicate id "${u.id}" — ids must be unique in the manifest`);
    seen.add(u.id);
  }
  return { format: "unit-library", version: 1, units };
}
