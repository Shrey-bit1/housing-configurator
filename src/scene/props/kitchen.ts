import * as THREE from "three";
import { MODULE_DEFS } from "../../core/modules";
import { PROP_LIBRARY } from "./voxelProp";
import { buildPropsMesh, tileRun, type Placement } from "./place";

/**
 * Kitchen furnishing: places the 5 authored voxel props inside the (un-rotated)
 * 4×4 kitchen footprint. moduleMesh rotates the returned group with the room,
 * so everything stays wall-aligned through 90° rotations.
 *
 * Layout (kitchen-specific, but built on the room-agnostic helpers in place.ts):
 *  - counter_run + overhead_cabinet tile the NORTH wall (4 cells = two clean
 *    2-cell units, no clipped remainder). The north wall is chosen DELIBERATELY:
 *    the derived kitchen window (fixed one-band, south-biased — windows.ts) lands
 *    on the most-southern exterior wall, so counters and overhead cabinets never
 *    cover the glazing. (On a square footprint "longest wall" is a 4-way tie
 *    anyway — an explicit run beats relying on a tie-break.)
 *  - stove sits mid-counter (the counter tiles around it; overheads span above).
 *  - sink is a standalone block backed against the east wall.
 *  - fridge backs the west wall, its 2-voxel width overflow spreading into open
 *    floor, not through a wall.
 *
 * `mirrored` reflects the whole furnished layout across the room's local X axis
 * (handled entirely inside {@link buildPropsMesh} by flipping voxel x + the
 * wall-clip footprint), so the fixtures back against the reflected walls
 * automatically.
 */
export function buildKitchenProps(mirrored = false): THREE.Group {
  const cells = MODULE_DEFS.kitchen.cells; // un-rotated 4×4 footprint
  // North-wall counter run (see the doc comment for why not findLongestWallRun).
  const run = {
    runCells: [
      { cx: 0, cz: 0 },
      { cx: 1, cz: 0 },
      { cx: 2, cz: 0 },
      { cx: 3, cz: 0 },
    ],
    axis: "x" as const,
    facing: "north" as const,
  };

  // Freestanding stove in the counter wall — the counter tiles around it (no
  // overlap). Overhead still tiles the full wall (above, high y).
  const stoveCell = { cx: 2, cz: 0 };
  const skipStove = new Set([`${stoveCell.cx},${stoveCell.cz}`]);

  const placements: Placement[] = [
    ...tileRun(PROP_LIBRARY.counter_run, run.runCells, run.axis, run.facing, skipStove),
    ...tileRun(PROP_LIBRARY.overhead_cabinet, run.runCells, run.axis, run.facing),
    { prop: PROP_LIBRARY.stove, ox: stoveCell.cx, oz: stoveCell.cz, facing: "north" },
    // Sink: standalone block backed against the east wall (faucet to wall).
    { prop: PROP_LIBRARY.sink, ox: 3, oz: 2, facing: "east" },
    { prop: PROP_LIBRARY.fridge, ox: 0, oz: 2, facing: "west" },
  ];

  return buildPropsMesh(placements, cells, mirrored);
}
