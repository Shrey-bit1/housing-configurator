import * as THREE from "three";
import { type Grid, type Cell } from "../core/grid";
import { occupiedCells } from "../core/modules";
import { connectedComponents, clusterNodeId } from "../core/cluster";
import { buildBoundaryWalls } from "./moduleMesh";
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
        doors
      )) {
        wall.userData.clusterNodeId = nodeId;
        group.add(wall);
      }
    }
  }
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
