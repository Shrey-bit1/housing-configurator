/**
 * The naming convention (Shrey's, 10 August, amended by run 0035): a name is a
 * capitalised word, a space, and a number. Nothing else, no descriptive suffix.
 *
 *   a project file is `Flat 1`, `Flat 2`, …
 *   a unit file is `Unit 1`, `Unit 2`, …
 *   a library entry READS `Flat 1`, `Flat 2`, … and is filed under `unit-1`,
 *   `unit-2`, …
 *
 * ONE DESIGN CARRIES ONE NUMBER ACROSS ALL THREE: saving design 4 writes
 * `Flat 4` and `Unit 4` and files the library entry as `unit-4` reading
 * `Flat 4`. Ids follow from the unit name through `slugifyUnitName` exactly as
 * they already did, giving `flat-4` and `unit-4`.
 *
 * The library entry's name and its id come apart on purpose (run 0035). A
 * resident browsing the library reads flats, so every row reads `Flat N`; the
 * live store links a published flat by id, so every id stays `unit-N` and a
 * `flat-N` id would collide with the project file's own slug. Before run 0043
 * only the name was passed to the sink and the id was derived from it, so no
 * single string could satisfy both rules and every library save wrote a row
 * reading `Unit N`. {@link libraryNameFor} and {@link libraryIdFor} are the two
 * answers, and both are given to the sink.
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

/** The unit file's name for design `n`. */
export function unitNameFor(n: number): string {
  return `Unit ${n}`;
}

/**
 * What a library entry for design `n` READS, which is what a person browsing
 * the library sees. `Flat N`, the same as the project file, because a resident
 * browsing flats should read flats (run 0035, pinned by
 * `src/library/libraryNames.test.ts`).
 */
export function libraryNameFor(n: number): string {
  return projectNameFor(n);
}

/**
 * What a library entry for design `n` is FILED under. `unit-N`, never
 * `flat-N`: the live store links a published flat by this id, and `flat-N` is
 * already the project file's own slug.
 */
export function libraryIdFor(n: number): string {
  return slugifyUnitName(unitNameFor(n));
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
 * The LOWEST positive integer none of the given lists is using, counting both
 * ids and names so a renamed entry still holds its number (rename changes the
 * display name and leaves the id, see docs/library-format.md).
 *
 * Lowest-free rather than highest-plus-one, so a gap left by a deleted entry
 * is offered again rather than stranded: with `unit-1`, `unit-2` and `unit-4`
 * present the next save proposes 3. Re-proposing a number that is genuinely
 * still in use cannot happen, and the replace-or-new prompt covers the case
 * where the author deliberately types one back.
 *
 * Takes any number of lists so the number can be free across MORE than one
 * record of what has been saved (run 0024): with a session set, the save
 * dialog counts the library manifest AND the session's own published flats,
 * because a design number is also the flat's id in the session, and every
 * resident reading the same manifest would otherwise be offered the SAME
 * number. `nextFreeNumber(libraryEntries)` — one list — is the pre-0024 call
 * and behaves exactly as before.
 */
export function nextFreeNumber(...lists: readonly (readonly { id: string; name: string }[])[]): number {
  const taken = new Set<number>();
  for (const entries of lists) {
    for (const e of entries) {
      const fromId = numberFromName(e.id);
      if (fromId !== null) taken.add(fromId);
      const fromName = numberFromName(e.name);
      if (fromName !== null) taken.add(fromName);
    }
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
  name: string,
  id = slugifyUnitName(name)
): T | undefined {
  return entries.find((e) => e.id === id || e.name === name);
}
