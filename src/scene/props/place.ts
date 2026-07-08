import * as THREE from "three";
import { CELL_SIZE, type Cell } from "../../core/grid";
import { VOXEL_SIZE, VOXELS_PER_CELL, type VoxelProp } from "./voxelProp";

/**
 * General voxel-prop placement, tiling, and rendering. Room-agnostic: a room's
 * furnishing module supplies a list of {@link Placement}s (which prop, which
 * cell, which wall it backs) and these helpers turn them into ONE merged
 * InstancedMesh — so other room types can reuse the exact same machinery.
 *
 * Everything is computed in the room's UN-rotated local frame (cell (cx,cz)
 * centre at `cx*CELL_SIZE, cz*CELL_SIZE`, matching moduleMesh). The whole props
 * group is rotated by moduleMesh to follow the room's 90° rotations, so wall
 * alignment is preserved automatically.
 */

/** Which wall a prop backs against. Props are authored backing a +z (south)
 *  wall; other walls are reached by rotating the prop in 90° steps. */
export type Facing = "south" | "west" | "north" | "east";
const FACING_ROT: Record<Facing, number> = { south: 0, west: 1, north: 2, east: 3 };

/** Rotate (x,z) by r 90° clockwise steps about the origin (matches rotateCell). */
function rot2(x: number, z: number, r: number): [number, number] {
  let a = x;
  let b = z;
  for (let i = 0; i < ((r % 4) + 4) % 4; i++) {
    const nx = -b;
    const nz = a;
    a = nx;
    b = nz;
  }
  return [a, b];
}

export interface Placement {
  prop: VoxelProp;
  /** Origin in cell units (prop x=0 maps to ox*CELL_SIZE). May be fractional
   *  (e.g. x.5 = centre of a 2-cell run pair). */
  ox: number;
  oz: number;
  facing: Facing;
  /** Keep only voxels with authored x in [min,max] — used to clip run remainders. */
  clipX?: [number, number];
}

/** Shell wall thickness (moduleMesh WALL_T 0.1 m). Walls are inset this far from
 *  the cell edge; prop voxels falling within a wall strip are clipped away. */
const WALL_T = 0.1;

/** Is world-local (x,z) inside a shell wall strip (within WALL_T, interior side,
 *  of a footprint boundary edge)? Used to clip prop voxels that would otherwise
 *  poke into/through walls — backs against the rear wall and run ends against
 *  perpendicular walls alike. */
function insideWall(x: number, z: number, occ: Set<string>): boolean {
  const H = CELL_SIZE / 2;
  const cx = Math.round(x / CELL_SIZE);
  const cz = Math.round(z / CELL_SIZE);
  const lx = x - cx * CELL_SIZE;
  const lz = z - cz * CELL_SIZE;
  if (Math.abs(lx) > H || Math.abs(lz) > H) return false; // overhang past a cell ≠ wall
  if (lx > H - WALL_T && !occ.has(`${cx + 1},${cz}`)) return true; // +x wall
  if (lx < -(H - WALL_T) && !occ.has(`${cx - 1},${cz}`)) return true; // -x wall
  if (lz > H - WALL_T && !occ.has(`${cx},${cz + 1}`)) return true; // +z wall
  if (lz < -(H - WALL_T) && !occ.has(`${cx},${cz - 1}`)) return true; // -z wall
  return false;
}

/** Append a placement's transformed voxels to flat position/colour arrays.
 *  Voxels landing inside a wall strip (`occ` = footprint) are clipped. When
 *  `mirror` is set, each voxel's local x is negated — a reflection across the
 *  room's local X axis (x = 0), the SAME axis the footprint mirrors about (cx →
 *  −cx). This rebuilds the merged prop cloud already flipped (no `scale.x = −1`,
 *  so the little cubes keep correct winding); `occ` must be the mirrored
 *  footprint so the wall-clip checks the right walls. */
function emit(
  p: Placement, pos: number[], col: number[], occ?: Set<string>, mirror = false
): void {
  const r = FACING_ROT[p.facing];
  const half = VOXELS_PER_CELL / 2; // 6 voxels = half a cell
  // Seat the prop's +z back face at the cell's +z edge; the wall clip below
  // trims whatever would enter the wall, leaving the back flush to the wall's
  // inner face. Depth past 12 overhangs into the room on the -z (front) side.
  const backShift = half - (p.prop.maxZ + 1);
  const originX = p.ox * CELL_SIZE;
  const originZ = p.oz * CELL_SIZE;
  for (const v of p.prop.voxels) {
    if (p.clipX && (v.x < p.clipX[0] || v.x > p.clipX[1])) continue;
    const vcx = v.x + 0.5; // voxel centre
    const vcz = v.z + 0.5 + backShift;
    const [rx, rz] = rot2(vcx, vcz, r);
    let wx = originX + rx * VOXEL_SIZE;
    const wz = originZ + rz * VOXEL_SIZE;
    if (mirror) wx = -wx; // reflect across local x = 0 (matches the cell mirror)
    if (occ && insideWall(wx, wz, occ)) continue;
    pos.push(wx, (v.y + 0.5) * VOXEL_SIZE, wz);
    col.push(v.color);
  }
}

/**
 * Tile a RUN prop (2-cell / 24-voxel wide) along an ordered straight wall run,
 * pair by pair. An odd leftover cell is filled with a CLIPPED prop (kept voxels
 * only — never scaled/squashed): clip to the run-axis half that lands on that
 * cell.
 */
export function tileRun(
  prop: VoxelProp,
  runCells: Cell[],
  axis: "x" | "z",
  facing: Facing,
  /** Cells to leave empty (e.g. a freestanding stove cell) — the run tiles the
   *  contiguous segments around them, cutting in a clipped half where a segment
   *  is an odd length. */
  skip?: Set<string>
): Placement[] {
  // Split into contiguous segments, dropping skipped cells.
  const segments: Cell[][] = [];
  let seg: Cell[] = [];
  for (const c of runCells) {
    if (skip?.has(`${c.cx},${c.cz}`)) {
      if (seg.length) segments.push(seg);
      seg = [];
    } else seg.push(c);
  }
  if (seg.length) segments.push(seg);

  const placements: Placement[] = [];
  for (const segment of segments) {
    for (let i = 0; i < segment.length; i += 2) {
      const a = segment[i];
      const b = segment[i + 1];
      if (b) {
        placements.push({ prop, ox: (a.cx + b.cx) / 2, oz: (a.cz + b.cz) / 2, facing });
      } else {
        // Remainder: place as the left cell of a notional pair and clip to its
        // 12-voxel (one-cell) half, so the prop fills exactly the leftover cell.
        placements.push({
          prop,
          ox: a.cx + (axis === "x" ? 0.5 : 0),
          oz: a.cz + (axis === "z" ? 0.5 : 0),
          facing,
          clipX: [-VOXELS_PER_CELL, -1],
        });
      }
    }
  }
  return placements;
}

/**
 * Find the longest unbroken straight run of occupied cells that all share a
 * wall on the same side — the natural host for a counter/cabinet run.
 */
export function findLongestWallRun(cells: Cell[]): {
  runCells: Cell[];
  axis: "x" | "z";
  facing: Facing;
} {
  const occ = new Set(cells.map((c) => `${c.cx},${c.cz}`));
  const has = (x: number, z: number) => occ.has(`${x},${z}`);
  const minX = Math.min(...cells.map((c) => c.cx));
  const maxX = Math.max(...cells.map((c) => c.cx));
  const minZ = Math.min(...cells.map((c) => c.cz));
  const maxZ = Math.max(...cells.map((c) => c.cz));

  let best: { runCells: Cell[]; axis: "x" | "z"; facing: Facing } = {
    runCells: [],
    axis: "x",
    facing: "south",
  };
  const consider = (run: Cell[], axis: "x" | "z", facing: Facing) => {
    if (run.length > best.runCells.length) best = { runCells: [...run], axis, facing };
  };

  // Runs along x (south = +z wall, north = -z wall).
  for (let z = minZ; z <= maxZ; z++) {
    for (const [facing, dz] of [["south", 1], ["north", -1]] as [Facing, number][]) {
      let run: Cell[] = [];
      for (let x = minX; x <= maxX; x++) {
        if (has(x, z) && !has(x, z + dz)) run.push({ cx: x, cz: z });
        else {
          consider(run, "x", facing);
          run = [];
        }
      }
      consider(run, "x", facing);
    }
  }
  // Runs along z (east = +x wall, west = -x wall).
  for (let x = minX; x <= maxX; x++) {
    for (const [facing, dx] of [["east", 1], ["west", -1]] as [Facing, number][]) {
      let run: Cell[] = [];
      for (let z = minZ; z <= maxZ; z++) {
        if (has(x, z) && !has(x + dx, z)) run.push({ cx: x, cz: z });
        else {
          consider(run, "z", facing);
          run = [];
        }
      }
      consider(run, "z", facing);
    }
  }
  return best;
}

const unitBox = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);

/**
 * Build ALL placements into a single InstancedMesh (one draw call) of 5 cm
 * cubes, coloured per-voxel via instanceColor. Returns a group ready to be
 * added to (and rotated with) the room.
 */
export function buildPropsMesh(
  placements: Placement[],
  footprint?: Cell[],
  mirror = false
): THREE.Group {
  const group = new THREE.Group();
  group.userData.props = true;

  // Mirror the footprint the same way the voxels are mirrored (cx → −cx), so the
  // wall-clip in emit() tests the reflected walls, not the originals.
  const occ = footprint
    ? new Set(footprint.map((c) => `${mirror ? -c.cx : c.cx},${c.cz}`))
    : undefined;
  const pos: number[] = [];
  const col: number[] = [];
  for (const p of placements) emit(p, pos, col, occ, mirror);
  const count = col.length;
  if (count === 0) return group;

  const material = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.05 });
  const mesh = new THREE.InstancedMesh(unitBox, material, count);
  // Shadows off for the dense voxel mesh: doubling tens of thousands of
  // instances through the shadow pass is costly for little visual gain (the
  // room shell already casts/receives). Keeps the frame light.
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.noDim = true; // multi-colour props aren't colour-faded when dimmed
  mesh.raycast = () => {}; // decorative — select the kitchen via its shell

  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    m.makeTranslation(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.setHex(col[i]));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();

  group.add(mesh);
  return group;
}
