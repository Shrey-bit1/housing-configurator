import * as THREE from "three";
import { MODULE_DEFS } from "../../core/modules";
import { PROP_LIBRARY as P } from "./voxelProp";
import { buildPropsMesh, type Placement } from "./place";

/**
 * Baseline furnishing layouts for the remaining room types, built on the same
 * room-agnostic helpers as {@link import("./kitchen").buildKitchenProps}: each
 * layout is just a list of fixture {@link Placement}s (prop + cell + wall it
 * backs), turned into ONE merged InstancedMesh by {@link buildPropsMesh}, which
 * clips prop voxels that would poke into walls and reflects the whole layout for
 * a mirrored room. Placements are authored against each preset's rectangular
 * footprint; rotation follows automatically (moduleMesh rotates the group).
 *
 * These are recognizable-by-silhouette baselines to be re-authored per prop in
 * the voxel tool; swapping a single `data/<name>.json` needs no code change.
 */
function furnish(type: string, placements: Placement[], mirrored: boolean): THREE.Group {
  return buildPropsMesh(placements, MODULE_DEFS[type].cells, mirrored);
}

// Small 3×3: one fixture per wall, centre clear.
export const buildBathroomSmallProps = (m = false): THREE.Group =>
  furnish("bathroom_small", [
    { prop: P.toilet, ox: 1, oz: 0, facing: "north" },
    { prop: P.basin, ox: 0, oz: 1, facing: "west" },
    { prop: P.shower, ox: 1, oz: 2, facing: "south" },
  ], m);

// Large 4×4: + bathtub along the south wall.
export const buildBathroomLargeProps = (m = false): THREE.Group =>
  furnish("bathroom_large", [
    { prop: P.toilet, ox: 1, oz: 0, facing: "north" },
    { prop: P.basin, ox: 3, oz: 1, facing: "east" },
    { prop: P.shower, ox: 0, oz: 1, facing: "west" },
    { prop: P.bathtub, ox: 1.5, oz: 3, facing: "south" },
  ], m);

/*
 * THE TWO BATHROOMS OF RUN 0020, laid out against the props at their real
 * sizes. The voxel props are 5 cm cubes (props/voxelProp.ts VOXEL_SIZE), so a
 * prop's `size` in voxels IS its size in metres × 20:
 *
 *   WC       8 × 14 voxels  = 400 × 700 mm
 *   basin   10 ×  8 voxels  = 500 × 400 mm
 *   bathtub 34 × 15 voxels  = 1700 × 750 mm   (exactly the 170 × 75 asked for)
 *
 * Every clearance quoted below is the clear floor left in front of a fixture,
 * measured from its front face to the nearest obstruction, and every one of
 * them is checked by props/bathroomFit.test.ts against these same numbers.
 */

// MINIMAL WC, 2×3 cells = 1.2 × 1.8 m. The WC sits centred on the north end
// wall, 700 mm deep. The basin hangs on the west wall at the south end, 400 mm
// deep and 500 mm along the wall, so it never stands in front of the WC.
// Clear floor in front of the WC is 1.8 − 0.7 − 0.5 = 600 mm over the full
// 1.2 m width, which is the standard domestic cloakroom activity space, and
// the 800 mm clear width in front of the basin comes from the 1.2 m room less
// the basin's own 400 mm projection.
export const buildWcProps = (m = false): THREE.Group =>
  furnish("wc", [
    { prop: P.toilet, ox: 1, oz: 0, facing: "north" },
    { prop: P.basin, ox: 0, oz: 2, facing: "west" },
  ], m);

// FULL BATHROOM, 4×4 cells = 2.4 × 2.4 m. Bathtub along the north wall
// (1700 in a 2400 wall, 750 deep), WC on the south wall, basin on the east.
// Clear floor between the tub's front face and the WC's is 2400 − 750 − 700 =
// 950 mm, and the basin projects 400 mm into the east side of that band
// without meeting the WC, which sits at the west end of the south wall.
export const buildBathroomFullProps = (m = false): THREE.Group =>
  furnish("bathroom_full", [
    { prop: P.bathtub, ox: 1.5, oz: 0, facing: "north" },
    { prop: P.toilet, ox: 0.5, oz: 3, facing: "south" },
    { prop: P.basin, ox: 3, oz: 2, facing: "east" },
  ], m);

// FULL BATHROOM, COMPACT, 3×4 cells = 1.8 × 2.4 m. The same three fixtures.
// The tub is the binding dimension: 1700 mm of tub in an 1800 mm wall leaves
// 100 mm, which is real but tight, and is the number to argue with if this
// size is ever revisited. Clear floor in front of the tub is again 950 mm, and
// the WC keeps its 700 mm depth on the south wall with the basin on the east.
export const buildBathroomFullCompactProps = (m = false): THREE.Group =>
  furnish("bathroom_full_compact", [
    { prop: P.bathtub, ox: 1.5, oz: 0, facing: "north" },
    { prop: P.toilet, ox: 0.5, oz: 3, facing: "south" },
    { prop: P.basin, ox: 2, oz: 2, facing: "east" },
  ], m);

// Small 5×4 rect: bed head + nightstand on the north wall, wardrobe on the east.
export const buildBedroomSmallProps = (m = false): THREE.Group =>
  furnish("bedroom_small", [
    { prop: P.bed_single, ox: 1, oz: 0, facing: "north" },
    { prop: P.nightstand, ox: 3, oz: 0, facing: "north" },
    { prop: P.wardrobe, ox: 4, oz: 2, facing: "east" },
  ], m);

// Large 6×5 rect: double bed + flanking nightstands on the south wall,
// wardrobe mid-height on the east wall.
export const buildBedroomLargeProps = (m = false): THREE.Group =>
  furnish("bedroom_large", [
    { prop: P.bed_double, ox: 2, oz: 4, facing: "south" },
    { prop: P.nightstand, ox: 0, oz: 4, facing: "south" },
    { prop: P.nightstand, ox: 4, oz: 4, facing: "south" },
    { prop: P.wardrobe, ox: 5, oz: 2, facing: "east" },
  ], m);

// 7×5 rect: sofa on the south long wall facing the sideboard on the north
// wall, coffee table between, shelving mid-height on the east wall.
export const buildLivingProps = (m = false): THREE.Group =>
  furnish("living", [
    { prop: P.sofa, ox: 3, oz: 4, facing: "south" },
    { prop: P.sideboard, ox: 1, oz: 0, facing: "north" },
    { prop: P.coffee_table, ox: 3, oz: 2, facing: "south" },
    { prop: P.shelving, ox: 6, oz: 2, facing: "east" },
  ], m);

// 5×5 rect: central games table, two lounge chairs toward the south corners,
// shelving on the north wall.
export const buildRecreationProps = (m = false): THREE.Group =>
  furnish("recreation", [
    { prop: P.games_table, ox: 2, oz: 2, facing: "south" },
    { prop: P.lounge_chair, ox: 0, oz: 4, facing: "south" },
    { prop: P.lounge_chair, ox: 4, oz: 4, facing: "south" },
    { prop: P.shelving, ox: 1, oz: 0, facing: "north" },
  ], m);
