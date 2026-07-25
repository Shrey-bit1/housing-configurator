import * as THREE from "three";
import { type Grid, type Cell } from "../core/grid";
import { occupiedCells } from "../core/modules";
import { connectedComponents, clusterNodeId } from "../core/cluster";
import { edgeKey, SIDES, SIDE_DELTA } from "../core/exteriorEdges";
import { buildBoundaryWalls, RAILING_H, type BoundaryWallOpts } from "./moduleMesh";
import type { Floor } from "../core/floor";

const EDGE_COLOR = 0x1a1a1a;

/**
 * Merged cluster shells for connector pieces (Circulation / Outdoor).
 *
 * Connector instances render only a flat floor tile (moduleMesh). Their walls
 * are drawn HERE, once per cluster of orthogonally-adjacent SAME-TYPE pieces,
 * so a chained hallway/terrace reads as a single shell with walls only on its
 * outer perimeter — no walls between pieces in the same cluster.
 *
 * Rebuilt from scratch on every connector change (place/move/rotate/delete) via
 * the floor's store `onChange`, which correctly handles clusters growing,
 * shrinking, splitting, or merging. Per floor only; same-type only.
 *
 * Cluster detection: collect each connector's occupied cells keyed by
 * `def.cluster`; within a key, flood-fill 4-neighbour adjacency into connected
 * components; each component's outer boundary is walled with the SAME
 * {@link buildBoundaryWalls} clean-corner logic the room shells use (mapping
 * cells to world XZ via `gridToWorld`), extruded directly to `wallHeight` —
 * the floor's true floor-to-floor height (`FloorManager.floorHeight`), passed
 * in by the caller. No post-build rescale.
 *
 * `doors` is the ABSOLUTE edge-key set of interior door openings to cut in the
 * cluster's outer walls (a door on a room↔cluster or cluster↔cluster boundary —
 * the cluster side of that boundary). A floor-wide set is safe: an absolute edge
 * key only ever matches the one component whose cell + side it names.
 */
export function rebuildClusterShells(
  floor: Floor,
  grid: Grid,
  wallHeight: number,
  doors?: Set<string>
): void {
  const group = floor.clusterGroup;
  disposeChildren(group);

  // Connector cells grouped by cluster key (e.g. "circulation", "outdoor").
  const byKey = new Map<string, { color: number; cells: Map<string, Cell> }>();
  for (const inst of floor.store.instances.values()) {
    const k = inst.def.cluster;
    if (!k) continue;
    let entry = byKey.get(k);
    if (!entry) {
      entry = { color: inst.def.color, cells: new Map() };
      byKey.set(k, entry);
    }
    for (const c of occupiedCells(inst.def, inst.origin, inst.rotation, inst.mirrored))
      entry.cells.set(`${c.cx},${c.cz}`, c);
  }

  const centerX = (cx: number) => grid.gridToWorld(cx, 0).x;
  const centerZ = (cz: number) => grid.gridToWorld(0, cz).z;

  for (const [key, { color, cells }] of byKey) {
    // One merged shell per connected component (orthogonal adjacency only).
    for (const component of connectedComponents([...cells.values()])) {
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.65,
        metalness: 0.05,
      });
      material.userData.baseColor = color; // so Floor.setDimmed fades it by its own colour
      const edgeMaterial = new THREE.LineBasicMaterial({ color: EDGE_COLOR });

      // Same id the adjacency graph assigns this cluster, so rules-validation
      // 3D highlighting can locate the right shell meshes.
      const nodeId = clusterNodeId(key, component);
      for (const wall of buildBoundaryWalls(
        component,
        centerX,
        centerZ,
        wallHeight,
        material,
        edgeMaterial,
        undefined, // clusters never get windows
        undefined,
        doors,
        clusterWallOpts(floor, component, key)
      )) {
        wall.userData.clusterNodeId = nodeId;
        group.add(wall);
      }
    }
  }
}

/**
 * Per-edge treatment for a connector cluster component (visual batch, §2n).
 *
 * OUTDOOR (balcony / terrace):
 *  - facing open space (nothing occupies the neighbour) → a 900 mm RAILING
 *    instead of a full wall — a balcony reads as a balcony;
 *  - facing a ROOM or a CIRCULATION cluster → DISSOLVED (no cluster-side
 *    segment), matching the other side's own dissolve.
 *
 * CIRCULATION (corridor):
 *  - facing a ROOM, a STAIR, or an Outdoor cluster → DISSOLVED — the corridor
 *    flows into what it touches;
 *  - facing open space → a FULL-height wall stays (deliberately NO railing: a
 *    free-standing corridor edge is a solid wall exactly as before).
 *
 * Anything else (furniture) keeps a full wall. Uses EFFECTIVE occupancy, so a
 * grown elastic room dissolves exactly like a seed-sized one.
 */
function clusterWallOpts(floor: Floor, component: Cell[], key: string): BoundaryWallOpts {
  const outdoor = key === "outdoor";
  const skip = new Set<string>();
  const rails = new Set<string>();
  for (const c of component) {
    for (const side of SIDES) {
      const [dx, dz] = SIDE_DELTA[side];
      const nx = c.cx + dx;
      const nz = c.cz + dz;
      const ownerId = floor.effectiveOwnerAt(nx, nz);
      // "Open air" is the RULES' exterior test — empty of any SPACE and
      // reachable from the grid border (semiExterior.isOutside). Furniture is
      // transparent, so a cube parked at a balcony edge no longer grows a
      // full-height stub there; an enclosed void behind a balcony is NOT open
      // air and reads as walled.
      if (floor.semiExterior?.isOutside(nx, nz) ?? !ownerId) {
        // A balcony guards it with a railing; a corridor walls it.
        if (outdoor) rails.add(edgeKey(c.cx, c.cz, side));
        continue;
      }
      const def = ownerId ? floor.store.instances.get(ownerId)?.def : undefined;
      if (!def) continue;
      const isRoom = def.category === "room" && !def.cluster;
      const dissolves = outdoor
        ? isRoom || def.cluster === "circulation"
        : isRoom || def.category === "stair" || def.cluster === "outdoor";
      if (dissolves) skip.add(edgeKey(c.cx, c.cz, side));
    }
  }
  return { skip, rails, railHeight: RAILING_H };
}

function disposeChildren(group: THREE.Object3D): void {
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose());
    });
  }
}
