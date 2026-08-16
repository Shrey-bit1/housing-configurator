import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CELL_SIZE } from "../core/grid";
import type { ModuleDef } from "../core/modules";
import { STAIR_SPECS, planStair, spiralPlan, type StairPlan, type StairSpec } from "../core/stairSpec";

/**
 * Stair geometry for the four real types (run 0020). Every riser and every
 * tread is drawn at TRUE SIZE, so a flight reads correctly from the side and a
 * section through it is measurable rather than indicative.
 *
 * WHAT CHANGED, AND WHY IT MATTERS. The old dogleg was built once at a fixed
 * 3.0 m reference rise and then stretched by `group.scale.y` to whatever the
 * floor height was. That kept the landing at mid-height but it also stretched
 * every riser, so the risers a resident saw were never the risers the model
 * meant, and the 2R + T proportion drifted with the floor. The mesh is now
 * built AT THE FLOOR'S REAL HEIGHT, the same move walls made (PROJECT_STATE
 * §2b), and the riser count comes from that height through
 * {@link planStair}. Nothing is scaled; `scale.y` stays 1.
 *
 * All four types are solid to the ground rather than thin folded plates, so a
 * flight reads as grounded, and all four are built in the UN-rotated local
 * frame then placed in a subgroup rotated by −rotation·90°, which is the
 * convention props and the old dogleg already used.
 *
 * MIRRORING reflects the assembly across the local X axis, matching the
 * footprint's cx → −cx transform. It is done by NEGATING x centres and angles,
 * never by `scale.x = -1`, because a negative scale inverts triangle winding
 * and normals. Each extruded piece is a constant-cross-section prism, so
 * reflecting it is a pure translation of a symmetric prism and every face keeps
 * its CCW-outward winding.
 */

const CONCRETE = 0x8a8a8a;
const EDGE = 0x1a1a1a;
/** Shrinks a flight's drawn width so two flights side by side read separately. */
const STEP_INSET = 0.06;
/** Slab thickness under a spiral tread and under a landing, metres. */
const SLAB_T = 0.12;
/** Depth of a flight's raking soffit, measured vertically down from the pitch
 *  (see {@link flightProfile}). 180 mm reads as a real stair slab. */
const SOFFIT_T = 0.18;

/** Reference rise the OLD deprecated stair was built at, kept because
 *  `FloorManager` still imports it for the deprecated type's scale path. */
export const REFERENCE_STAIR_RISE = 3.0;

/**
 * Build one stair. `storeyHeightM` is the floor-to-floor height this stair
 * connects; the geometry is built to exactly that rise. Callers that do not
 * know it (the palette ghost before a floor is known) may omit it and get the
 * 3.0 m default, which the real placement then replaces.
 */
export function buildStairGroup(
  def: ModuleDef,
  rotation: number,
  ghost: boolean,
  mirrored = false,
  storeyHeightM = REFERENCE_STAIR_RISE
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

  // The spec drives the arithmetic. The DEPRECATED `stair` type has no spec —
  // it can no longer be placed, only loaded from an old file — so it falls back
  // to the tight dogleg's shape at its own 2-cell width.
  const spec: StairSpec = STAIR_SPECS[def.type] ?? {
    type: def.type,
    kind: "dogleg",
    widthCells: 2,
    lengthCells: 6,
    flightWidthM: CELL_SIZE,
    flights: 2,
  };
  const plan = planStair(spec, storeyHeightM);

  // Footprint extent in the un-rotated local frame.
  const minX = Math.min(...def.cells.map((c) => c.cx));
  const maxX = Math.max(...def.cells.map((c) => c.cx));
  const minZ = Math.min(...def.cells.map((c) => c.cz));
  const maxZ = Math.max(...def.cells.map((c) => c.cz));
  const H = CELL_SIZE / 2;
  const box = {
    x0: minX * CELL_SIZE - H,
    x1: maxX * CELL_SIZE + H,
    z0: minZ * CELL_SIZE - H,
    z1: maxZ * CELL_SIZE + H,
  };

  const geos =
    spec.kind === "straight"
      ? straightGeometry(plan, box, mirrored)
      : spec.kind === "dogleg"
        ? doglegGeometry(plan, box, mirrored)
        : spec.kind === "spiral"
          ? spiralGeometry(spec, plan, box, mirrored)
          : cGeometry(plan, box, mirrored);

  // `mergeGeometries` returns NULL when its inputs disagree on attributes or on
  // being indexed, and a null geometry only fails later inside `new Mesh`, with
  // a message about morph targets that names nothing useful. ExtrudeGeometry is
  // non-indexed and CylinderGeometry (the spiral's newel) is indexed, so
  // normalize before merging rather than requiring every builder to remember.
  const geo = mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)), false);
  if (!geo) throw new Error(`stair geometry for "${def.type}" failed to merge`);
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

  // What rise this geometry was built at, so FloorManager can tell when a
  // change of floor height has left it stale (see {@link rebuildStairRise}).
  group.userData.builtRise = storeyHeightM;
  group.userData.edgeMaterial = edgeMaterial;

  return group;
}

/**
 * Rebuild a placed stair's geometry at a NEW floor-to-floor height, in place.
 *
 * Rooms handle a height change through `rebuildRoomWalls`; stairs used to
 * handle it by stretching `scale.y`, which is exactly what run 0020 removed.
 * This is the replacement: same group, same material object (so a selection or
 * violation tint survives the swap, the property `rebuildRoomWalls` also
 * relies on), fresh geometry at the true rise. A no-op when the rise has not
 * moved, which is the common case.
 */
export function rebuildStairRise(
  group: THREE.Group,
  def: ModuleDef,
  rotation: number,
  mirrored: boolean,
  storeyHeightM: number
): void {
  if (group.userData.builtRise === storeyHeightM) return;
  const material = group.userData.material as THREE.Material | undefined;
  const edgeMaterial = group.userData.edgeMaterial as THREE.Material | undefined;

  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }

  const fresh = buildStairGroup(def, rotation, false, mirrored, storeyHeightM);
  // Adopt the fresh geometry but keep the ORIGINAL materials, so tinting that
  // is holding a reference to them keeps working.
  fresh.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && material) m.material = material;
    const l = o as THREE.LineSegments;
    if (l.isLineSegments && edgeMaterial) l.material = edgeMaterial;
  });
  for (const child of [...fresh.children]) group.add(child);
  group.userData.builtRise = storeyHeightM;
}

interface Box {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/**
 * One flight as a closed (run, height) profile: steps on top, a RAKING SOFFIT
 * underneath. `dir` is +1 when the flight climbs toward increasing run and −1
 * when it climbs back. The last riser tops out onto whatever comes next (a
 * landing or the floor above), which is why there is one fewer going than
 * risers.
 *
 * THE SOFFIT IS THE POINT. These profiles used to close straight down to the
 * ground, making every flight a solid mass from floor to underside. Two of
 * those side by side is not a dogleg, it is a 1.8 × 3.6 × 3.0 m block with
 * steps scratched into the top, and from most angles it reads as disjoint
 * lumps meeting at odd places rather than as a stair. A real flight is a slab
 * that rakes: you can see under the upper flight, and the underside is a
 * straight soffit from foot to landing. That is what this draws, and it is
 * what makes a dogleg legible from any angle.
 *
 * The soffit is measured VERTICALLY down from the pitch, so its perpendicular
 * thickness is slightly less; that is how stair soffits are actually set out.
 * At the foot it is clamped to the floor, so a ground-level flight sits on the
 * slab instead of sinking through it.
 */
function flightProfile(
  runStart: number,
  yStart: number,
  risers: number,
  riserM: number,
  treadM: number,
  dir: 1 | -1
): [number, number][] {
  const pts: [number, number][] = [];
  const goings = risers - 1;
  const runEnd = runStart + dir * goings * treadM;
  const yTop = yStart + risers * riserM;
  const footBottom = Math.max(0, yStart - SOFFIT_T);

  // Up the vertical face at the foot (degenerate, and skipped, when the flight
  // starts on the floor), then riser and tread alternating along the top.
  pts.push([runStart, footBottom]);
  if (yStart > footBottom) pts.push([runStart, yStart]);
  let y = yStart;
  for (let i = 0; i < risers; i++) {
    y += riserM;
    const r = runStart + dir * i * treadM;
    pts.push([r, y]); // the riser
    if (i < goings) pts.push([r + dir * treadM, y]); // the tread
  }
  // Down the back face by the soffit depth, then back along the rake.
  pts.push([runEnd, yTop - SOFFIT_T]);
  return pts;
}

/** A rectangular slab as a closed (run, height) profile. */
function slabProfile(r0: number, r1: number, yTop: number, thickness: number): [number, number][] {
  const yBot = Math.max(0, yTop - thickness);
  return [
    [r0, yBot],
    [r1, yBot],
    [r1, yTop],
    [r0, yTop],
  ];
}

/**
 * ONE STRAIGHT FLIGHT running the length of the footprint. 18 risers over a
 * 3.0 m storey give a 4.59 m run inside 4.8 m of footprint; the 210 mm left
 * over sits at the foot as a threshold.
 */
function straightGeometry(plan: StairPlan, box: Box, mirrored: boolean): THREE.BufferGeometry[] {
  const riserM = plan.riserMm / 1000;
  const treadM = plan.treadMm / 1000;
  const w = plan.spec.flightWidthM - STEP_INSET;
  const cx = centreX(box, mirrored);
  const prof = flightProfile(box.z0, 0, plan.risers, riserM, treadM, 1);
  return [profileGeometry(prof, w, cx)];
}

/**
 * TWO FLIGHTS side by side climbing in opposite directions, joined by a
 * half-landing at the far end. Lane A climbs base → far to the landing; lane B
 * climbs far → base and arrives at the floor above at the base end.
 */
function doglegGeometry(plan: StairPlan, box: Box, mirrored: boolean): THREE.BufferGeometry[] {
  const riserM = plan.riserMm / 1000;
  const treadM = plan.treadMm / 1000;
  const fw = plan.spec.flightWidthM;
  const laneW = fw - STEP_INSET;
  const c = centreX(box, mirrored);
  const mx = mirrored ? -1 : 1;
  // Two lanes filling the width, reflected together when mirrored.
  const laneA = c - mx * (fw / 2);
  const laneB = c + mx * (fw / 2);

  const [r1, r2] = plan.risersPerFlight;
  const midY = r1 * riserM;
  const run1 = (r1 - 1) * treadM;
  const zTurn = box.z0 + run1;

  const f1 = flightProfile(box.z0, 0, r1, riserM, treadM, 1);
  // Flight 2 starts at the landing level and climbs back toward the base.
  const f2 = flightProfile(zTurn, midY, r2, riserM, treadM, -1);
  const land = slabProfile(zTurn, box.z1, midY, SLAB_T);

  const fullW = box.x1 - box.x0 - STEP_INSET;
  return [
    profileGeometry(f1, laneW, laneA),
    profileGeometry(f2, laneW, laneB),
    profileGeometry(land, fullW, c),
  ];
}

/**
 * THREE FLIGHTS around a well, forming a C in plan. Flight 1 runs across the
 * near end, flight 2 down the far side, flight 3 back across the far end, with
 * a landing at each corner. Each flight is built as a straight profile in its
 * own frame and then rotated into place, which is why this returns geometries
 * with matrices already applied rather than one merged prism.
 */
function cGeometry(plan: StairPlan, box: Box, mirrored: boolean): THREE.BufferGeometry[] {
  const riserM = plan.riserMm / 1000;
  const treadM = plan.treadMm / 1000;
  const fw = plan.spec.flightWidthM;
  const laneW = fw - STEP_INSET;
  const mx = mirrored ? -1 : 1;
  const [n1, n2, n3] = plan.risersPerFlight;
  const y1 = n1 * riserM;
  const y2 = (n1 + n2) * riserM;
  const [run1, run2] = plan.flightRunM;

  // The three sides the flights hug. Flight 1 and flight 3 run across the
  // width on the near and far ends; flight 2 runs down the right side between
  // them. Whatever is left in the middle is the well.
  const xRight = box.x1 - fw / 2;
  const zNear = box.z0 + fw / 2;
  const zFar = box.z1 - fw / 2;

  return [
    // Flight 1: across the near end, climbing toward +x.
    alongX(flightProfile(box.x0, 0, n1, riserM, treadM, 1), laneW, zNear, mx),
    // Landing at the near-right corner, level with the top of flight 1.
    alongX(slabProfile(box.x0 + run1, box.x1, y1, SLAB_T), laneW, zNear, mx),
    // Flight 2: down the right side, climbing toward +z.
    alongZ(flightProfile(box.z0 + fw, y1, n2, riserM, treadM, 1), laneW, xRight, mx),
    // Landing at the far-right corner, level with the top of flight 2.
    alongZ(slabProfile(box.z0 + fw + run2, box.z1, y2, SLAB_T), laneW, xRight, mx),
    // Flight 3: back across the far end, climbing toward −x, arriving upstairs.
    alongX(flightProfile(box.x1, y2, n3, riserM, treadM, -1), laneW, zFar, mx),
  ];
}

/** Extrude a (run, height) profile whose run is world X, centred on world z. */
function alongX(
  points: [number, number][],
  width: number,
  zCentre: number,
  mx: number
): THREE.BufferGeometry {
  const pts: [number, number][] = points.map(([r, y]) => [r * mx, y]);
  const geo = extrudeProfile(pts, width);
  // extrudeProfile lays the run on world Z; turn it onto world X.
  geo.rotateY(Math.PI / 2);
  geo.translate(0, 0, zCentre);
  return geo;
}

/** Extrude a (run, height) profile whose run is world Z, centred on world x. */
function alongZ(
  points: [number, number][],
  width: number,
  xCentre: number,
  mx: number
): THREE.BufferGeometry {
  const geo = extrudeProfile(points, width);
  geo.translate(xCentre * mx, 0, 0);
  return geo;
}

/**
 * A SPIRAL of wedge treads around a central newel, exactly one turn. Each
 * tread is an annular sector of {@link spiralPlan}'s tread angle, a slab one
 * riser thick, so the step between consecutive treads IS the riser and reads
 * as one from the side.
 */
function spiralGeometry(
  spec: StairSpec,
  plan: StairPlan,
  box: Box,
  mirrored: boolean
): THREE.BufferGeometry[] {
  const sp = spiralPlan(spec, plan);
  const riserM = plan.riserMm / 1000;
  const cx = (box.x0 + box.x1) / 2;
  const cz = (box.z0 + box.z1) / 2;
  const step = (sp.degreesPerTread * Math.PI) / 180;
  const mx = mirrored ? -1 : 1;

  const out: THREE.BufferGeometry[] = [];

  // The newel, full height, so the spiral has something to wind around.
  const newel = new THREE.CylinderGeometry(sp.newelRadiusM, sp.newelRadiusM, plan.storeyHeightM, 16);
  newel.translate(cx, plan.storeyHeightM / 2, cz);
  out.push(newel);

  for (let i = 0; i < plan.risers; i++) {
    const yTop = (i + 1) * riserM;
    const a0 = mx * i * step;
    const a1 = mx * (i + 1) * step;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, sp.newelRadiusM, Math.min(a0, a1), Math.max(a0, a1), false);
    shape.absarc(0, 0, sp.outerRadiusM, Math.max(a0, a1), Math.min(a0, a1), true);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: riserM, bevelEnabled: false });
    // The shape is drawn in XY and extruded along +Z; lay it flat so the
    // extrusion becomes the tread's thickness in Y. After the rotation the
    // slab spans y ∈ [0, riser], so it is lifted by yTop MINUS one riser: the
    // WALKING SURFACE has to land on yTop, with the slab hanging below it.
    // Lifting by yTop instead put every tread a riser high and left the top of
    // the stair one riser above the floor it arrives at.
    geo.rotateX(-Math.PI / 2);
    geo.translate(cx, yTop - riserM, cz);
    out.push(geo);
  }
  return out;
}

/** Footprint centre in x, reflected when mirrored. */
function centreX(box: Box, mirrored: boolean): number {
  const c = (box.x0 + box.x1) / 2;
  return mirrored ? -c : c;
}

/**
 * Extrude a closed (run, height) profile across `width`, run on world Z and
 * height on world Y, centred on x = 0. Callers translate it into place.
 */
function extrudeProfile(points: [number, number][], width: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  // Extrude builds in XY along +Z. Re-orient: shape-x → world z (the run),
  // shape-y → world y (up), extrude-z → world x (the width).
  geo.rotateY(-Math.PI / 2);
  geo.translate(width / 2, 0, 0);
  return geo;
}

/**
 * Extrude a closed (run, height) profile across `width` in x, centred on `cx`.
 * The run becomes world z, matching the footprint's long axis.
 * {@link extrudeProfile} already centres the prism on x = 0, so this is a
 * single translation.
 */
function profileGeometry(
  points: [number, number][],
  width: number,
  cx: number
): THREE.BufferGeometry {
  const geo = extrudeProfile(points, width);
  geo.translate(cx, 0, 0);
  return geo;
}
