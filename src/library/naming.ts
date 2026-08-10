/**
 * The naming convention (Shrey's, 10 August): a name is a capitalised word, a
 * space, and a number. Nothing else, no descriptive suffix.
 *
 *   a project file is `Flat 1`, `Flat 2`, …
 *   a unit and its library entry are `Unit 1`, `Unit 2`, …
 *
 * ONE DESIGN CARRIES ONE NUMBER ACROSS BOTH: saving design 4 writes `Flat 4`
 * and `Unit 4`, so the two files that describe the same dwelling can be paired
 * by eye. Ids follow from the names through `slugifyUnitName` exactly as they
 * already did, giving `flat-4` and `unit-4`.
 *
 * The library manifest is the only PERSISTENT record of what has been saved —
 * project and unit files are downloads that leave no trace the app can read —
 * so it is what {@link nextFreeNumber} counts against. A design saved without
 * a library entry therefore does not consume its number.
 *
 * Self-contained like the rest of `src/library/`: no DOM, and the one import
 * is the sibling that owns id derivation.
 */
import { slugifyUnitName } from "./ids";

/** The project file's name for design `n`. */
export function projectNameFor(n: number): string {
  return `Flat ${n}`;
}

/** The unit file's and library entry's name for design `n`. */
export function unitNameFor(n: number): string {
  return `Unit ${n}`;
}

/** The design number a `Unit N` name or a `unit-N` id carries, or null when
 *  the string does not follow the convention (the two pre-convention library
 *  entries, for instance, whose names are descriptive). */
export function numberFromName(name: string): number | null {
  const m = /^(?:unit|flat)[ -](\d+)$/i.exec(name.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/**
 * The LOWEST positive integer no library entry is using, counting both ids and
 * names so a renamed entry still holds its number (rename changes the display
 * name and leaves the id, see docs/library-format.md).
 *
 * Lowest-free rather than highest-plus-one, so a gap left by a deleted entry
 * is offered again rather than stranded: with `unit-1`, `unit-2` and `unit-4`
 * present the next save proposes 3. Re-proposing a number that is genuinely
 * still in use cannot happen, and the replace-or-new prompt covers the case
 * where the author deliberately types one back.
 */
export function nextFreeNumber(entries: readonly { id: string; name: string }[]): number {
  const taken = new Set<number>();
  for (const e of entries) {
    const fromId = numberFromName(e.id);
    if (fromId !== null) taken.add(fromId);
    const fromName = numberFromName(e.name);
    if (fromName !== null) taken.add(fromName);
  }
  for (let n = 1; ; n++) if (!taken.has(n)) return n;
}

/**
 * The library entry a save under `name` would collide with, if any: the one
 * whose id is what this name slugifies to, or whose display name matches
 * exactly. Matching the id as well as the name is what catches an entry that
 * has been RENAMED — `unit-4` renamed to "Studio A" still owns design 4, and
 * saving `Unit 4` again should offer to replace it rather than quietly making
 * `unit-4-2`.
 */
export function findLibraryEntry<T extends { id: string; name: string }>(
  entries: readonly T[],
  name: string
): T | undefined {
  const id = slugifyUnitName(name);
  return entries.find((e) => e.id === id || e.name === name);
}
