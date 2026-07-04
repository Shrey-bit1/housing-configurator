import * as THREE from "three";
import type { Floor } from "../core/floor";
import { parseDwellingNodeId } from "../core/adjacencyGraph";
import {
  SEVERITY_COLORS,
  worstSeverity,
  type Severity,
  type Violation,
} from "../core/rules";

/**
 * Rules-validation highlighting in the 3D view: tint the actual flagged room /
 * cluster / stair shells (and entrance markers) by the worst severity
 * implicating them, across ALL floors (the dwelling graph spans floors).
 * Violation node/entrance ids are dwelling-scoped (`<floor>/<rawId>`), resolved
 * here to the right floor + instance/cluster/marker.
 *
 * Tinting is an emissive overlay; the previous emissive is stashed
 * (`userData.hiPrev`) and restored on clear so a selected room keeps its glow.
 */

const EMISSIVE_INTENSITY = 0.55;

/** Apply highlights for `violations` to every floor's room/cluster/stair shells
 *  and any implicated entrance markers. */
export function applyRoomHighlights(floors: Floor[], violations: Violation[]): void {
  clearRoomHighlights(floors);

  // Worst severity per implicated dwelling node id (rooms/clusters/stairs).
  const sev = new Map<string, Severity>();
  for (const v of violations)
    for (const id of v.nodeIds) sev.set(id, worstSeverity(sev.get(id), v.severity));

  for (const [id, severity] of sev) {
    const { floor: fi, rawId } = parseDwellingNodeId(id);
    const floor = floors[fi];
    if (!floor) continue;
    const color = SEVERITY_COLORS[severity];

    // Room/stair node → tint its instance group's shared material (stairs are
    // ordinary ModuleInstances too, so this resolves them without extra code).
    const inst = floor.store.instances.get(rawId);
    if (inst) {
      const mat = inst.group.userData.material as THREE.MeshStandardMaterial | undefined;
      if (mat) tint(mat, color);
      continue;
    }

    // Cluster node → tint every wall mesh tagged with this cluster id (raw).
    floor.clusterGroup.traverse((o) => {
      if (o.userData.clusterNodeId !== rawId) return;
      const mat = (o as THREE.Mesh).material;
      if (mat && !Array.isArray(mat)) tint(mat as THREE.MeshStandardMaterial, color);
    });
  }

  // Worst severity per implicated dwelling ENTRANCE id (E2) — same encoding,
  // different id space, so resolved separately against each floor's markers.
  const entSev = new Map<string, Severity>();
  for (const v of violations)
    for (const id of v.entranceIds ?? [])
      entSev.set(id, worstSeverity(entSev.get(id), v.severity));

  for (const [id, severity] of entSev) {
    const { floor: fi, rawId } = parseDwellingNodeId(id);
    const floor = floors[fi];
    if (!floor) continue;
    const color = SEVERITY_COLORS[severity];
    floor.group.traverse((o) => {
      if (o.userData.entranceId !== rawId) return;
      const mat = (o as THREE.Mesh).material;
      if (mat && !Array.isArray(mat)) tint(mat as THREE.MeshStandardMaterial, color);
    });
  }
}

/** Restore every material tinted on any floor back to its prior look. */
export function clearRoomHighlights(floors: Floor[]): void {
  for (const floor of floors) {
    floor.group.traverse((o) => {
      const mat = (o as THREE.Mesh).material;
      if (!mat || Array.isArray(mat)) return;
      restore(mat as THREE.MeshStandardMaterial);
    });
  }
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
  mat.emissiveIntensity = prev ? 0.35 : 0;
  delete mat.userData.hiPrev;
}
