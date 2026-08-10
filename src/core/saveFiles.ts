import type { ProjectFile } from "./projectIO";
import type { DwellingUnitFile } from "./unitExport";
import { slugifyUnitName } from "../library/ids";
import { projectNameFor, unitNameFor } from "../library/naming";

/**
 * The BYTES each save writes, and the names they are written under.
 *
 * Split out of `src/main.ts` so the byte-identity guarantee is testable
 * (`src/core/saveFiles.test.ts`) rather than merely asserted: the two
 * serialization expressions below are the ones `exportProject` and
 * `exportUnit` used before run 0019, carried over character for character, so
 * the one save dialog writes what the three separate menu items wrote.
 *
 * Only the FILENAMES changed, and deliberately: they now follow the naming
 * convention (`flat-4.json`, `unit-4.json`) instead of carrying a timestamp.
 * The file CONTENTS are untouched, which is what a consumer of either format
 * actually reads.
 */

/** The project download's exact text. Was `JSON.stringify(data, null, 2)` in
 *  `exportProject`; it is the same expression, moved. */
export function projectFileText(data: ProjectFile): string {
  return JSON.stringify(data, null, 2);
}

/** The unit download's exact text. Was `JSON.stringify(result.file, null, 2)`
 *  in `exportUnit`; it is the same expression, moved. */
export function unitFileText(file: DwellingUnitFile): string {
  return JSON.stringify(file, null, 2);
}

/** `flat-4.json` for design 4 — the name's slug, exactly as library ids are
 *  derived, so a file on disk and an id in the manifest agree. */
export function projectFileName(n: number): string {
  return `${slugifyUnitName(projectNameFor(n))}.json`;
}

/** `unit-4.json` for design 4. */
export function unitFileName(n: number): string {
  return `${slugifyUnitName(unitNameFor(n))}.json`;
}
