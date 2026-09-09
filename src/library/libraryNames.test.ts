import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseUnitLibraryIndex } from "./manifest";

/**
 * The library counts from one (run 0035). Every entry reads "Flat N", in the
 * manifest and in each file's own name field, and the numbers run in the order
 * Shrey settled: the twenty flats this project designed first, then the older
 * entries, then anything that arrived later.
 *
 * The ids are pinned as hard as the names. A file id is what the live store
 * references a flat by, so a rename that moved one would break links nothing in
 * this repository can see.
 *
 * Fast suite: this reads JSON off disk and checks strings. Whether those flats
 * pass the layout rules is a different question and lives in the slow suite,
 * in `src/core/libraryClean.slow.test.ts`.
 */

const DIR = new URL("../../public/units/", import.meta.url);
const manifest = parseUnitLibraryIndex(readFileSync(new URL("index.json", DIR), "utf8"));

/** The order the numbers run in, written out rather than derived, so a change
 *  to it has to be a deliberate edit here. */
const DESIGNED = Array.from({ length: 20 }, (_, i) => `unit-${i + 8}`);
const OLDER = [
  "flat-2-single-storey",
  "flat-3-terrace",
  "unit-1",
  "unit-2",
  "unit-3",
  "unit-4",
  "unit-5",
  "unit-6",
  "unit-7",
];
/** Saved from the app after run 0035's prompt was written. Neither belongs to
 *  a group above, so each takes the number after the last of them: `unit-29` on
 *  6 September and `unit-31` on 8 September, during Shrey's walkthrough.
 *
 *  This list is the deliberate edit the file's own note asks for. A row saved
 *  from the app is a real save and belongs here; what run 0043 fixed is the
 *  name it arrived under, which read `Unit 31` because the sink derived the id
 *  from the name and no one string could be both `Flat 31` and `unit-31`. */
const LATER = ["unit-29", "unit-31"];
const ORDER = [...DESIGNED, ...OLDER, ...LATER];

const nameOf = new Map(manifest.units.map((u) => [u.id, u.name]));

describe("the library's names", () => {
  it("holds one row for every id in the order, and no others", () => {
    expect([...nameOf.keys()].sort()).toEqual([...ORDER].sort());
  });

  it("numbers them Flat 1 upwards in that order", () => {
    expect(ORDER.map((id) => nameOf.get(id))).toEqual(ORDER.map((_, i) => `Flat ${i + 1}`));
  });

  it("gives the twenty designed flats the first twenty numbers", () => {
    expect(DESIGNED.map((id) => nameOf.get(id))).toEqual(
      DESIGNED.map((_, i) => `Flat ${i + 1}`)
    );
  });

  it("uses every number once", () => {
    expect(new Set(manifest.units.map((u) => u.name)).size).toBe(manifest.units.length);
  });

  it("leaves every id and filename alone, because the live store links by id", () => {
    for (const u of manifest.units) {
      expect(u.file).toBe(`${u.id}.json`);
      expect(u.preview).toBe(`${u.id}.jpg`);
      expect(u.id).not.toMatch(/^flat-\d+$/);
    }
    expect(manifest.units.filter((u) => u.id.startsWith("unit-"))).toHaveLength(29);
  });

  it("says the same name inside each file as in the manifest", () => {
    for (const u of manifest.units) {
      const file = JSON.parse(readFileSync(new URL(u.file, DIR), "utf8")) as { name: string };
      expect(file.name, `${u.file} carries its own name`).toBe(u.name);
    }
  });

  it("keeps no descriptor anywhere, because a row has nowhere to put one", () => {
    for (const u of manifest.units) expect(u.name).toMatch(/^Flat \d+$/);
  });
});
