/**
 * Unit ids for the library (docs/library-format.md).
 *
 * An id is the lowercase slug of the display name, with a numeric suffix on
 * collision, and files are named by id — so two saves under one display name
 * get two ids and two file pairs instead of overwriting each other (the old
 * Unit_2 name clash). The dev save endpoint (vite.config.ts) and the
 * production download fallback (main.ts) both assign ids through here, and the
 * id-collision test pins the behaviour.
 *
 * Self-contained on purpose: no imports, no DOM — this module runs in the
 * browser and inside the Vite dev server alike.
 */

/** Lowercase ASCII slug of a display name: `[a-z0-9-]` runs only, never empty.
 *  "Flat 2 — single storey" → "flat-2-single-storey"; an all-symbol name
 *  falls back to "unit". */
export function slugifyUnitName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unit";
}

/**
 * The id for a new save: the name's slug if free, otherwise the first free
 * `<slug>-N` counting from 2. `taken` is every id already in the manifest.
 * Deterministic: the same name against the same manifest always yields the
 * same id.
 */
export function assignUnitId(name: string, taken: Iterable<string>): string {
  const slug = slugifyUnitName(name);
  const used = new Set(taken);
  if (!used.has(slug)) return slug;
  for (let n = 2; ; n++) {
    const candidate = `${slug}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
}
