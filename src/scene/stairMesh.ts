import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CELL_SIZE } from "../core/grid";
import type { ModuleDef } from "../core/modules";

/**
 * 180° dogleg stair geometry: two straight flights running side by side in
 * opposite directions, joined by a full-width half-landing at the far end (the
 * turn). Rises from floor N's level to the plate level of floor N+1.
 *
 * Real dimensions, grid-locked (footprint 2×6 cells = 1.2 m × 3.6 m):
 *  - 20 risers @ 150 mm total (3.0 m), split 10 + 10 by the half-landing at
 *    1.5 m (mid-height); 9 goings @ 300 mm per flight = 2.7 m run; landing
 *    900 mm deep, full 2-cell width.
 *
 * Handedness (un-rotated frame, "base" = the cz-min end you enter on):
 *  - FLIGHT 1 (lane A = cx 0) ascends base → far, ground → 1.5 m (solid).
 *  - LANDING (full width) at the far end turns you 180°.
 *  - FLIGHT 2 (lane B = cx 1) ascends far → base, 1.5 → 3.0 m, arriving at the
 *    plate at the base end in the adjacent lane.
 *
 * All three pieces are solid to the ground (a solid massing, not a thin folded
 * plate), so the upper flight reads as grounded rather than floating.
 *
 * Built in the UN-rotated local frame (run along z over the footprint) then put
 * in a subgroup rotated by `-rotation·90°` — same convention props use — so the
 * dogleg's handedness/landing rotate with the occupancy footprint.
 *
 * Built at a fixed {@link REFERENCE_STAIR_RISE} (= 2 × the half-rise); the
 * FloorManager scales `group.scale.y` to the floor's real height. Because the
 * landing sits at EXACTLY half the reference rise, uniform y-scaling keeps it at
 * the floor's true mid-height for any floor height (only riser heights stretch).
 */

const CONCRETE = 0x8a8a8a;
const EDGE = 0x1a1a1a;
const STEP_INSET = 0.06; // shrink lane widths so the two flights read separately

// Real dogleg dimensions.
const RISER_H = 0.15; // 150 mm
const GOING = 0.3; // 300 mm tread depth
const RISERS_PER_FLIGHT = 10;
const GOINGS_PER_FLIGHT = RISERS_PER_FLIGHT - 1; // 9 (last riser tops onto landing/plate)
const HALF_RISE = RISERS_PER_FLIGHT * RISER_H; // 1.5 m
const FLIGHT_RUN = GOINGS_PER_FLIGHT * GOING; // 2.7 m

/** Reference floor-to-floor rise the geometry is built at = 2 × the half-rise,
 *  so the landing is exactly mid-height. Matches the default floor height
 *  (DEFAULT_FLOOR_CELLS 4 + CLEARANCE_CELLS 1) × CELL_SIZE = 3.0 m; the
 *  FloorManager rescales to the real height regardless. */
export const REFERENCE_STAIR_RISE = HALF_RISE * 2; // 3.0 m

export function buildStairGroup(
  def: ModuleDef,
  rotation: number,
  ghost: boolean
): THREE.Group {
  const group = new THREE.Group();
  group.userData.moduleType = def.type;

  const material = new THREE.MeshStandardMaterial({
    color: CONCRETE,
    roughness: 0.85,
    metalness: 0.0,
    transparent: ghost,
    opacity: ghost ? 0.45 : 1,
  });
  group.userData.material = material; // selection/ghost/dim tinting find it here

  const edgeMaterial = new THREE.LineBasicMaterial({
    color: ghost ? 0xffffff : EDGE,
    transparent: ghost,
    opacity: ghost ? 0.6 : 1,
  });

  // Footprint extent (un-rotated). 2 cells wide (x: lanes A=cx0, B=cx1),
  // 6 cells long (z): flight run 4.5 cells + landing 1.5 cells.
  const minX = Math.min(...def.cells.map((c) => c.cx));
  const maxX = Math.max(...def.cells.map((c) => c.cx));
  const minZ = Math.min(...def.cells.map((c) => c.cz));
  const maxZ = Math.max(...def.cells.map((c) => c.cz));
  const H = CELL_SIZE / 2;

  const laneAx = minX * CELL_SIZE; // lane A centre (base→far, lower flight)
  const laneBx = maxX * CELL_SIZE; // lane B centre (far→base, upper flight)
  const laneW = CELL_SIZE - STEP_INSET;
  const fullW = (maxX - minX + 1) * CELL_SIZE - STEP_INSET;
  const fullCx = (laneAx + laneBx) / 2;

  const zBase = minZ * CELL_SIZE - H; // entry edge on floor N
  const zFar = maxZ * CELL_SIZE + H; // far edge (landing end)
  const zTurn = zBase + FLIGHT_RUN; // landing near edge / top of flight 1

  // --- Flight 1: base → far, ground → HALF_RISE, solid to the ground. ---
  const f1: [number, number][] = [[zBase, 0]];
  let y1 = 0;
  for (let i = 0; i < RISERS_PER_FLIGHT; i++) {
    y1 += RISER_H;
    const z = zBase + i * GOING;
    f1.push([z, y1]); // riser
    if (i < GOINGS_PER_FLIGHT) f1.push([z + GOING, y1]); // tread (toward far)
  }
  f1.push([zBase + FLIGHT_RUN, 0]); // drop to ground at the landing edge
  // Flight 1's walk (up the stepped side, drop, close along the ground) traces
  // its outline CLOCKWISE, opposite flight 2 and the landing below (both
  // counter-clockwise) — ExtrudeGeometry treats CCW as "outward", so a CW
  // profile comes out with inverted face normals (wrong-way lighting, only
  // hidden from culling by forcing double-sided material). Reverse the point
  // order — same boundary, opposite traversal — to match the other two pieces.
  f1.reverse();

  // --- Flight 2: far → base, HALF_RISE → 2·HALF_RISE, solid to the ground. ---
  const f2: [number, number][] = [[zTurn, 0]]; // far-bottom at ground
  f2.push([zTurn, HALF_RISE]); // up the far face to the landing level
  let y2 = HALF_RISE;
  for (let i = 0; i < RISERS_PER_FLIGHT; i++) {
    y2 += RISER_H;
    const z = zTurn - i * GOING;
    f2.push([z, y2]); // riser
    if (i < GOINGS_PER_FLIGHT) f2.push([z - GOING, y2]); // tread (toward base)
  }
  f2.push([zBase, 0]); // drop the base face to the ground (closePath runs the bottom)

  // --- Half-landing: full-width slab, far end, top at HALF_RISE. ---
  const land: [number, number][] = [
    [zTurn, 0],
    [zFar, 0],
    [zFar, HALF_RISE],
    [zTurn, HALF_RISE],
  ];

  const geos = [
    profileGeometry(f1, laneW, laneAx),
    profileGeometry(f2, laneW, laneBx),
    profileGeometry(land, fullW, fullCx),
  ];
  const geo = mergeGeometries(geos, false);

  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = !ghost;
  mesh.receiveShadow = !ghost;

  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMaterial);
  edges.raycast = () => {}; // decorative outline — never steals picks
  mesh.add(edges);

  const sub = new THREE.Group();
  sub.add(mesh);
  sub.rotation.y = -rotation * (Math.PI / 2);
  group.add(sub);

  return group;
}

/**
 * Extrude a closed (z, y) profile across `width` in x, centred on `cx`, in the
 * stair's local frame. The profile's x is the run (world z), y is up (world y);
 * the extrusion becomes the lane width (world x). Mirrors the orientation the
 * original straight stair used so the run aligns with the footprint.
 */
function profileGeometry(
  points: [number, number][],
  width: number,
  cx: number
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  // Extrude builds in XY extruded along +Z. Re-orient: shape-x → world z (run),
  // shape-y → world y (up), extrude-z → world x (lane width, centred on `cx`).
  geo.rotateY(-Math.PI / 2);
  geo.translate(width / 2 + cx, 0, 0);
  return geo;
}
