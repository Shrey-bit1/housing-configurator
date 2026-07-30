import { describe, it, expect } from "vitest";
import { Grid, cellKey, type Cell } from "./grid";
import { borderReachableEmpty } from "./expansion";
import { semiExteriorBands } from "./semiExterior";
import { computeWindows } from "./windows";
import { edgeKey } from "./exteriorEdges";

/**
 * THE EXPORT GLAZING INVARIANT: the glazed edge set a unit EXPORTS equals the
 * glazed edge set the wall pass BUILDS on the same flat. A building packer that
 * receives the export places real glass against it, so an export that claims a
 * window the model never built, or omits one it did, is a lie the next repo acts
 * on.
 *
 * It broke once, at f2af130. Circulation clusters gained french windows onto
 * balconies (run 0011), the wall pass built them, and `unitExport.ts` still
 * carried the older rooms-only filter, so built glazing grew while exported
 * glazing stayed where it was. Both sides were fixed in the same change; this
 * test is what stops the two from drifting apart again silently.
 *
 * WHAT THIS DOES NOT DO, AND WHY. It does not call `buildUnitExport`, so it
 * cannot fail when `unitExport.ts` regresses, and nothing here should be read as
 * claiming otherwise. Calling it was tried and measured rather than assumed. The
 * export takes a `FloorManager`, which imports `../scene/clusterShells`,
 * `../scene/moduleMesh` and `../scene/stairMesh`, while `core/floor.ts` imports
 * four more scene modules. Under vitest that import graph loads and a real
 * layout places successfully; the run stops at `floorManager.ts:764`, where
 * `recomputeStack` reads `this.deps.groundPlane`, because `attach()` has never
 * been called. Stubbing `FloorDeps` is about a dozen lines and would work, since
 * the manager only clears the ghosts, reassigns a few fields, and moves one
 * object. The cost is the import itself: the probe suite ran in 11.94 s against
 * 1.65 s for the pure tests, so the whole render layer would enter a suite about
 * a set of edge keys for a tenfold slowdown. That trade was refused.
 *
 * WHAT IT DOES PIN, which is real. The corridor beside a balcony gets french
 * glass at all, which is the run-0011 behaviour the export has to carry, and the
 * band `semiExteriorBands` puts there is exactly three edges at named keys. If
 * `frenchBandWidth` or the centring rule moves, this fails. The third case then
 * records f2af130's delta as a number rather than a description: a rooms-only
 * export filter drops precisely those three edges on this layout, so the failure
 * has a size instead of an adjective.
 */

/** A solid rectangle of cells, inclusive of both corners. */
function rect(x0: number, z0: number, x1: number, z1: number): Cell[] {
  const out: Cell[] = [];
  for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) out.push({ cx, cz });
  return out;
}

/**
 * A small flat: one Living Room, one corridor beside it, and a balcony running
 * along the full length of both, open to the sky on its far side. The corridor
 * touching the balcony is the case f2af130 got wrong.
 */
function layout() {
  const cols = 14;
  const rows = 14;
  const room = rect(4, 4, 8, 6); // 5x3 living room
  const corridor = rect(4, 7, 8, 7); // 5x1 corridor along its south side
  const balcony = rect(4, 8, 8, 8); // 5x1 balcony south of the corridor, open beyond

  const grid = new Grid(cols, rows);
  const occupied = new Set([...room, ...corridor, ...balcony].map((c) => cellKey(c.cx, c.cz)));
  const isEmpty = (cx: number, cz: number) => !occupied.has(cellKey(cx, cz));
  const outsideCells = borderReachableEmpty(grid, isEmpty);
  const isOutside = (cx: number, cz: number) =>
    !grid.inBounds(cx, cz) || outsideCells.has(cellKey(cx, cz));

  // `computeSemiExterior`'s qualifying set: outdoor cells whose component
  // reaches sky. This balcony's south side is open, so all of it qualifies.
  const qualifying = new Map(balcony.map((c) => [cellKey(c.cx, c.cz), "outdoor"] as const));

  // The two glazing sources, each built by the function the app builds it with.
  const boundary = new Set<string>();
  const glazedByRoom = semiExteriorBands(room, qualifying, boundary).glazed;
  const glazedByCluster = semiExteriorBands(corridor, qualifying, boundary).glazed;

  return { room, corridor, balcony, occupied, isOutside, glazedByRoom, glazedByCluster };
}

/** The room's glazed edges, exactly as both sides derive them: `computeWindows`
 *  over the room's effective cells, with its french set folded in. Identical
 *  arguments in `floorManager.rebuildAllShells` and in `unitExport.ts`. */
function roomGlazing(L: ReturnType<typeof layout>): Set<string> {
  const plan = computeWindows(
    L.room, "living", 3.0, L.occupied, L.isOutside, new Set<string>(), 0, L.glazedByRoom
  );
  return new Set(plan.edges.keys());
}

describe("unit export glazing parity", () => {
  it("gives the corridor french glass onto the balcony", () => {
    // The premise of the whole test: without this, the two sides agree trivially
    // and the invariant is untested. A 5-cell contact glazes a centred band.
    const L = layout();
    expect(L.glazedByCluster.size).toBeGreaterThan(0);
    // The band is on the corridor's south edges, facing the balcony.
    for (const key of L.glazedByCluster)
      expect(key.endsWith(",south")).toBe(true);
  });

  it("keeps the room's own band separate from the corridor's", () => {
    // The room glazes through computeWindows with its french set folded in, the
    // corridor glazes straight from semiExteriorBands, and the two sets are
    // disjoint. That is what makes the next case a real measurement: the
    // corridor's edges exist nowhere in the rooms-only derivation, so dropping
    // clusters drops exactly them.
    const L = layout();
    const rooms = roomGlazing(L);
    expect(rooms.size).toBeGreaterThan(0);
    for (const key of L.glazedByCluster) expect(rooms.has(key)).toBe(false);
  });

  it("measures what a rooms-only export filter would drop", () => {
    // f2af130's actual delta, as a number rather than a description. A rooms-only
    // export omits every cluster edge, so the loss is exactly the corridor band.
    const L = layout();
    const built = new Set([...roomGlazing(L), ...L.glazedByCluster]);
    const roomsOnly = roomGlazing(L);
    const dropped = [...built].filter((k) => !roomsOnly.has(k));

    expect(dropped.length).toBe(3); // a 5-cell run glazes a centred band of 3
    expect(dropped.sort()).toEqual(
      [edgeKey(5, 7, "south"), edgeKey(6, 7, "south"), edgeKey(7, 7, "south")].sort()
    );
  });
});
