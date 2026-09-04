#!/usr/bin/env node
/**
 * A flat from a graph.
 *
 *   node scripts/gen-flat.mjs scripts/flats/unit-8.flat.json [more...] [--out dir]
 *
 * Takes a bubble diagram — rooms, the rows they pack into, the edges that must
 * become doors, a target size — and writes a `dwelling-unit` v1 file. It writes
 * nothing to `public/units/`; the default output is `build/units/`, and putting
 * a flat in the library is a separate, deliberate copy.
 *
 * The point of the script is the second half. Packing rooms onto the grid is
 * arithmetic (scripts/flatLayout.ts). What makes a generated flat trustworthy is
 * that it is then loaded through the SAME code the browser runs: a real
 * FloorManager takes the project file, derives the walls, the windows, the
 * stair holes and the adjacency graph, and `validate()` runs the same rule set
 * Check Layout runs. A flat that passes on paper and fails there is a failure
 * here, printed with the rule ids, and the script exits non-zero.
 *
 * The app's core is written in TypeScript with extensionless imports, which Node
 * cannot resolve on its own. Rather than add a runner dependency, this boots the
 * Vite that the project already depends on in middleware mode and asks it for
 * the modules — the same transform the dev server and the test suite use.
 */

import { createServer } from "vite";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

// ---- Arguments --------------------------------------------------------------

const argv = process.argv.slice(2);
const outAt = argv.indexOf("--out");
const outDir = outAt >= 0 ? argv[outAt + 1] : "build/units";
const inputs = argv.filter((a, i) => !a.startsWith("--") && i !== outAt + 1);

if (inputs.length === 0) {
  console.error("usage: node scripts/gen-flat.mjs <diagram.json> [...] [--out dir]");
  process.exit(2);
}

// ---- The app's own core, through Vite ---------------------------------------

const server = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  logLevel: "error",
});
const load = (p) => server.ssrLoadModule(p);

const THREE = await import("three");
const { packStorey, deriveDoors, deriveEntrance, areaM2, widestGap, LayoutError } =
  await load("/scripts/flatLayout.ts");
const { FloorManager } = await load("/src/core/floorManager");
const { computeDwellingGraph } = await load("/src/core/adjacencyGraph");
const { validate } = await load("/src/core/rules");
const { buildUnitExport } = await load("/src/core/unitExport");
const { parseProject } = await load("/src/core/projectIO");
const { borderReachableEmpty } = await load("/src/core/expansion");

/**
 * The render layer's collaborators, none of which do anything without a canvas.
 * Same stubs as the slow test suite (src/core/libraryRoundTrip.slow.test.ts:24),
 * for the same reason: the geometry and the rules are wanted, the WebGL is not.
 */
function stubDeps() {
  const sink = () => ({ clear() {}, deselect() {} });
  return {
    picker: {},
    ghost: sink(),
    groupGhost: sink(),
    dragDrop: {},
    selection: sink(),
    groundPlane: new THREE.Object3D(),
    sizeGroundPlane: () => {},
  };
}

// ---- One flat ---------------------------------------------------------------

/**
 * A void only becomes floor area if the elastic room beside it can grow into
 * it, and that happens only where the empty cells cannot reach the grid border
 * (core/expansion.ts). A void that leaks to the outside stays empty, the room
 * stays at its seed size, and the flat quietly comes out small. This is the
 * same border flood fill the app runs, applied early enough to name the leak.
 *
 * A stairwell void is exempt. That one is the open well over the stair below,
 * which the app cuts and refuses to grow into, and it sits wherever the stair
 * sits, including on the flat's edge.
 */
function checkVoidsEnclosed(layout, grid) {
  const growth = layout.voids.filter((v) => !v.stairwell);
  if (growth.length === 0) return;
  const filled = new Set();
  for (const set of layout.cells.values()) for (const k of set) filled.add(k);
  const outside = borderReachableEmpty(
    { cols: grid.cols, rows: grid.rows, inBounds: (cx, cz) => cx >= 0 && cz >= 0 && cx < grid.cols && cz < grid.rows },
    (cx, cz) => !filled.has(`${cx},${cz}`)
  );
  const leaks = growth.filter((v) => outside.has(`${v.cx},${v.cz}`));
  if (leaks.length)
    throw new LayoutError(
      `${leaks.length} void cell(s) reach the grid border, starting at ` +
        `${leaks[0].cx},${leaks[0].cz} — nothing will grow into them`
    );
}

/** Pack every storey, derive the doors and the entrance, return a ProjectFile. */
function buildProject(diagram) {
  const layouts = diagram.storeys.map(packStorey);
  for (const l of layouts) checkVoidsEnclosed(l, diagram.grid);

  // Room keys are unique across the whole flat, so a door may name rooms on
  // either storey and the lookup stays flat.
  const all = new Map();
  for (const l of layouts) for (const [k, v] of l.cells) all.set(k, v);

  const doors = deriveDoors(all, diagram.doors);
  const entrance = deriveEntrance(layouts[0].cells, diagram.entrance.key, diagram.entrance.side);

  // A door belongs to the storey whose cells it sits in.
  const floors = layouts.map((l, i) => ({
    cols: diagram.grid.cols,
    rows: diagram.grid.rows,
    instances: l.placements.map((p) => ({
      type: p.type,
      cx: p.cx,
      cz: p.cz,
      rotation: p.rotation,
    })),
    entrances: i === 0 ? [{ cx: entrance.cx, cz: entrance.cz, side: entrance.side }] : [],
    doors: doors
      .filter((d) => l.cells.has(d.between[0]))
      .map((d) => ({ cx: d.cx, cz: d.cz, side: d.side })),
  }));

  return {
    project: {
      format: "flat-configurator-project",
      version: 1,
      floors,
      northAngle: diagram.northAngle ?? 0,
    },
    layouts,
    doors,
    entrance,
  };
}

/** Load a project through the real FloorManager and report what the app sees. */
function inspect(project, diagram) {
  const fm = new FloorManager(new THREE.Scene(), diagram.grid.cols, diagram.grid.rows);
  fm.attach(stubDeps());
  const parsed = parseProject(JSON.stringify(project));
  if (parsed.status !== "current")
    throw new Error(`the generated project did not parse as current: ${parsed.status}`);
  const { skipped } = fm.loadProject(parsed.data);

  const graph = computeDwellingGraph(fm.floors);
  const violations = validate(graph, fm.orientationPreference ?? {});
  const counts = { hard: 0, soft: 0, note: 0 };
  for (const v of violations) counts[v.severity]++;

  const wanted = project.floors.reduce((n, f) => n + f.doors.length, 0);
  const kept = fm.floors.reduce((n, f) => n + f.doors.length, 0);

  return { fm, graph, violations, counts, skipped, wanted, kept };
}

// ---- Run --------------------------------------------------------------------

mkdirSync(resolve(outDir), { recursive: true });
let failures = 0;

for (const input of inputs) {
  // A leading BOM is what a Windows shell writes by default and what JSON.parse
  // refuses, with an error that points at the first character rather than at
  // the editor that put it there.
  const diagram = JSON.parse(readFileSync(input, "utf8").replace(/^﻿/, ""));
  console.log(`\n=== ${diagram.id} — ${diagram.name}  (${basename(input)})`);

  let built;
  try {
    built = buildProject(diagram);
  } catch (err) {
    failures++;
    console.log(err instanceof LayoutError ? `  LAYOUT: ${err.message}` : err);
    continue;
  }

  const seen = inspect(built.project, diagram);
  const cells = seen.fm.floors.reduce((n, f) => n + f.store.instances.size, 0);

  const result = buildUnitExport(seen.fm, diagram.name, diagram.color);
  if (!result.ok) {
    failures++;
    console.log(`  EXPORT REFUSED: ${result.reason}`);
    continue;
  }
  const unitCells = result.file.storeys.reduce((n, s) => n + s.cells.length, 0);
  const area = areaM2(unitCells);

  console.log(`  storeys ${result.file.storeys.length}   instances ${cells}   area ${area} m²`);
  console.log(`  doors written ${seen.wanted}, kept by the app ${seen.kept}   skipped placements ${seen.skipped}`);
  console.log(`  must fix ${seen.counts.hard}   worth a look ${seen.counts.soft}   note ${seen.counts.note}`);
  for (const v of seen.violations)
    console.log(`    ${v.severity === "hard" ? "!" : v.severity === "soft" ? "~" : "."} ${v.ruleId}  ${v.description}`);

  const wet = diagram.wetRooms ?? [];
  if (wet.length > 1) {
    const perStorey = built.layouts.map((l) => widestGap(l.cells, wet));
    console.log(`  wet rooms ${wet.join(", ")}   widest gap per storey ${perStorey.join(", ")} cells`);
  }

  const [lo, hi] = diagram.targetM2;
  if (area < lo || area > hi) {
    failures++;
    console.log(`  OFF TARGET: ${area} m² is outside ${lo}–${hi} m²`);
  }
  if (seen.skipped > 0) {
    failures++;
    console.log(`  PLACEMENTS REFUSED: ${seen.skipped} — two rooms want the same cells`);
  }
  if (seen.kept !== seen.wanted) {
    failures++;
    console.log(`  DOORS PRUNED: ${seen.wanted - seen.kept} did not bind two spaces`);
  }
  if (seen.counts.hard > 0) failures++;

  const path = join(resolve(outDir), `${diagram.id}.json`);
  writeFileSync(path, JSON.stringify(result.file, null, 2) + "\n");
  console.log(`  wrote ${path}`);
}

await server.close();
console.log(failures === 0 ? "\nall clean" : `\n${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
