import * as THREE from "three";
import type { Floor } from "../core/floor";
import {
  SEVERITY_COLORS,
  worstSeverity,
  type Severity,
  type Violation,
} from "../core/rules";

/**
 * Rules-validation highlighting in the 3D view: tint the actual flagged room (or
 * connector cluster) shells by the worst severity implicating them, so the user
 * sees WHICH rooms are problematic without translating from the abstract graph.
 *
 * Tinting is an emissive overlay on each shell's existing material. The previous
 * emissive is stashed on the material (`userData.hiPrev`) and restored on clear,
 * so a room that also happens to be selected keeps its selection glow afterward.
 */

const EMISSIVE_INTENSITY = 0.55;

/** Apply highlights for `violations` to the floor's room + cluster shells. */
export function applyRoomHighlights(floor: Floor, violations: Violation[]): void {
  clearRoomHighlights(floor);

  // Worst severity per implicated node id.
  const sev = new Map<string, Severity>();
  for (const v of violations)
    for (const id of v.nodeIds) sev.set(id, worstSeverity(sev.get(id), v.severity));

  for (const [id, severity] of sev) {
    const color = SEVERITY_COLORS[severity];

    // Room node → tint its instance group's shared material.
    const inst = floor.store.instances.get(id);
    if (inst) {
      const mat = inst.group.userData.material as THREE.MeshStandardMaterial | undefined;
      if (mat) tint(mat, color);
      continue;
    }

    // Cluster node → tint every wall mesh tagged with this cluster id.
    floor.clusterGroup.traverse((o) => {
      if (o.userData.clusterNodeId !== id) return;
      const mat = (o as THREE.Mesh).material;
      if (mat && !Array.isArray(mat)) tint(mat as THREE.MeshStandardMaterial, color);
    });
  }
}

/** Restore every material this module tinted on the floor back to its prior look. */
export function clearRoomHighlights(floor: Floor): void {
  floor.group.traverse((o) => {
    const mat = (o as THREE.Mesh).material;
    if (!mat || Array.isArray(mat)) return;
    restore(mat as THREE.MeshStandardMaterial);
  });
}

function tint(mat: THREE.MeshStandardMaterial, color: number): void {
  if (!mat.emissive) return;
  if (mat.userData.hiPrev === undefined) mat.userData.hiPrev = mat.emissive.getHex();
  mat.emissive.setHex(color);
  mat.emissiveIntensity = EMISSIVE_INTENSITY;
}

function restore(mat: THREE.MeshStandardMaterial): void {
  if (mat.userData.hiPrev === undefined || !mat.emissive) return;
  const prev = mat.userData.hiPrev as number;
  mat.emissive.setHex(prev);
  // A non-zero stash means the room was selected (white emissive) — keep that glow.
  mat.emissiveIntensity = prev ? 0.35 : 0;
  delete mat.userData.hiPrev;
}
