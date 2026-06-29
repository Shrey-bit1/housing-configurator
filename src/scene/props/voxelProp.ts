import counterJson from "./data/counter_run.json";
import overheadJson from "./data/overhead_cabinet.json";
import stoveJson from "./data/stove.json";
import sinkJson from "./data/sink.json";
import fridgeJson from "./data/fridge.json";

/**
 * Authored voxel-prop format (5 cm voxels). Loaded from JSON, not hardcoded.
 *
 * Coordinate convention (from the authoring tool):
 *  - integer voxel coords in 5 cm units; an integer `c` is the voxel's MIN
 *    corner, so the voxel occupies `[c, c+1]`.
 *  - x, z are centred on 0 (prop horizontally centred); y is floor-anchored
 *    (y=0 = ground, up positive). High-y props (overhead cabinet) bake their
 *    mounting height into the data — we never recompute it.
 *  - 12 voxels = one 0.6 m structural cell.
 */
export const VOXEL_SIZE = 0.05; // 5 cm
export const VOXELS_PER_CELL = 12; // 0.6 m / 0.05 m

export interface Voxel {
  x: number;
  y: number;
  z: number;
  color: number; // packed hex
}

export interface VoxelProp {
  name: string;
  size: [number, number, number];
  voxels: Voxel[];
  /** Max z voxel index = the +z (back/wall) extreme, used to seat against walls. */
  maxZ: number;
}

interface RawProp {
  name: string;
  size: [number, number, number];
  voxels: { x: number; y: number; z: number; color: string }[];
}

function parseProp(raw: RawProp): VoxelProp {
  let maxZ = -Infinity;
  const voxels: Voxel[] = raw.voxels.map((v) => {
    if (v.z > maxZ) maxZ = v.z;
    return { x: v.x, y: v.y, z: v.z, color: parseInt(v.color.slice(1), 16) };
  });
  return { name: raw.name, size: raw.size, voxels, maxZ };
}

/** All authored props, keyed by their internal `name` (the reliable id). */
export const PROP_LIBRARY: Record<string, VoxelProp> = Object.fromEntries(
  [counterJson, overheadJson, stoveJson, sinkJson, fridgeJson].map((j) => {
    const p = parseProp(j as unknown as RawProp);
    return [p.name, p];
  })
);
