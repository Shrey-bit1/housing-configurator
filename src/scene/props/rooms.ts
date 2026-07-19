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
 * a mirrored room. Placements sit in the L-footprints' SOLID area (clear of the
 * notch); rotation follows automatically (moduleMesh rotates the group).
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

// Small 5×4 rect: bed head + nightstand on the north wall, wardrobe on the east.
export const buildBedroomSmallProps = (m = false): THREE.Group =>
  furnish("bedroom_small", [
    { prop: P.bed_single, ox: 1, oz: 0, facing: "north" },
    { prop: P.nightstand, ox: 3, oz: 0, facing: "north" },
    { prop: P.wardrobe, ox: 4, oz: 2, facing: "east" },
  ], m);

// Large 6×6 L (notch NE): double bed + flanking nightstands on the south wall,
// wardrobe on the east wall's lower (solid) half — all clear of the notch.
export const buildBedroomLargeProps = (m = false): THREE.Group =>
  furnish("bedroom_large", [
    { prop: P.bed_double, ox: 2, oz: 5, facing: "south" },
    { prop: P.nightstand, ox: 0, oz: 5, facing: "south" },
    { prop: P.nightstand, ox: 4, oz: 5, facing: "south" },
    { prop: P.wardrobe, ox: 5, oz: 4, facing: "east" },
  ], m);

// 7×6 L (notch NE): sofa on the south long wall facing the sideboard on the
// north (left, solid) wall, coffee table between, shelving on the east wall.
export const buildLivingProps = (m = false): THREE.Group =>
  furnish("living", [
    { prop: P.sofa, ox: 3, oz: 5, facing: "south" },
    { prop: P.sideboard, ox: 1, oz: 0, facing: "north" },
    { prop: P.coffee_table, ox: 3, oz: 3, facing: "south" },
    { prop: P.shelving, ox: 6, oz: 4, facing: "east" },
  ], m);

// 6×5 L (notch NE): central games table, two lounge chairs toward the south
// corners, shelving on the north (left, solid) wall.
export const buildRecreationProps = (m = false): THREE.Group =>
  furnish("recreation", [
    { prop: P.games_table, ox: 2, oz: 2, facing: "south" },
    { prop: P.lounge_chair, ox: 0, oz: 4, facing: "south" },
    { prop: P.lounge_chair, ox: 5, oz: 4, facing: "south" },
    { prop: P.shelving, ox: 1, oz: 0, facing: "north" },
  ], m);
