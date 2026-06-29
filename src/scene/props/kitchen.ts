import * as THREE from "three";
import { MODULE_DEFS } from "../../core/modules";
import { PROP_LIBRARY } from "./voxelProp";
import {
  buildPropsMesh,
  findLongestWallRun,
  tileRun,
  type Placement,
} from "./place";

/**
 * Kitchen furnishing: places the 5 authored voxel props inside the (un-rotated)
 * kitchen footprint. moduleMesh rotates the returned group with the room, so
 * everything stays wall-aligned through 90° rotations.
 *
 * Layout (kitchen-specific, but built on the room-agnostic helpers in place.ts):
 *  - counter_run + overhead_cabinet tile the longest wall (the 5-cell south
 *    wall): two full 2-cell units + a clipped 1-cell remainder each.
 *  - stove sits among the counter (cell along that wall).
 *  - sink is a standalone block on the wall just north of the counter's end.
 *  - fridge sits near the NW corner so its 2-voxel width overflow spreads into
 *    open floor, not through a wall.
 */
export function buildKitchenProps(): THREE.Group {
  const cells = MODULE_DEFS.kitchen.cells; // un-rotated L footprint
  const run = findLongestWallRun(cells); // the 5-cell south (+z) wall

  // Freestanding stove in the middle of the counter wall — the counter tiles
  // around it (no overlap). Overhead still tiles the full wall (above, high y).
  const stoveCell = { cx: 2, cz: 3 };
  const skipStove = new Set([`${stoveCell.cx},${stoveCell.cz}`]);

  const placements: Placement[] = [
    ...tileRun(PROP_LIBRARY.counter_run, run.runCells, run.axis, run.facing, skipStove),
    ...tileRun(PROP_LIBRARY.overhead_cabinet, run.runCells, run.axis, run.facing),
    // Fixtures, once each, clear of the notch and of one another.
    { prop: PROP_LIBRARY.stove, ox: stoveCell.cx, oz: stoveCell.cz, facing: "south" },
    // Sink: standalone block backed against the outer east wall (faucet to wall).
    { prop: PROP_LIBRARY.sink, ox: 4, oz: 2, facing: "east" },
    { prop: PROP_LIBRARY.fridge, ox: 1, oz: 0, facing: "north" },
  ];

  return buildPropsMesh(placements, cells);
}
