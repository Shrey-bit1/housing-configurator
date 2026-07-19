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

/** Every material belonging to dwelling node `id`: a room/stair instance's
 *  shared material, OR every wall mesh tagged with a cluster's node id (a
 *  cluster shell is several separate meshes, so this can return more than
 *  one). Shared by `applyRoomHighlights` and the hover-emphasis functions
 *  below so both resolve ids identically. */
function resolveNodeMaterials(floors: Floor[], id: string): THREE.MeshStandardMaterial[] {
  const { floor: fi, rawId } = parseDwellingNodeId(id);
  const floor = floors[fi];
  if (!floor) return [];

  const inst = floor.store.instances.get(rawId);
  if (inst) {
    const mat = inst.group.userData.material as THREE.MeshStandardMaterial | undefined;
    return mat ? [mat] : [];
  }

  const mats: THREE.MeshStandardMaterial[] = [];
  floor.clusterGroup.traverse((o) => {
    if (o.userData.clusterNodeId !== rawId) return;
    const mat = (o as THREE.Mesh).material;
    if (mat && !Array.isArray(mat)) mats.push(mat as THREE.MeshStandardMaterial);
  });
  return mats;
}

/** Every marker material belonging to dwelling entrance `id`. */
function resolveEntranceMaterials(floors: Floor[], id: string): THREE.MeshStandardMaterial[] {
  const { floor: fi, rawId } = parseDwellingNodeId(id);
  const floor = floors[fi];
  if (!floor) return [];

  const mats: THREE.MeshStandardMaterial[] = [];
  floor.group.traverse((o) => {
    if (o.userData.entranceId !== rawId) return;
    const mat = (o as THREE.Mesh).material;
    if (mat && !Array.isArray(mat)) mats.push(mat as THREE.MeshStandardMaterial);
  });
  return mats;
}

/** Apply highlights for `violations` to every floor's room/cluster/stair shells
 *  and any implicated entrance markers. */
export function applyRoomHighlights(floors: Floor[], violations: Violation[]): void {
  clearRoomHighlights(floors);

  // Worst severity per implicated dwelling node id (rooms/clusters/stairs).
  const sev = new Map<string, Severity>();
  for (const v of violations)
    for (const id of v.nodeIds) sev.set(id, worstSeverity(sev.get(id), v.severity));
  for (const [id, severity] of sev) {
    const color = SEVERITY_COLORS[severity];
    for (const mat of resolveNodeMaterials(floors, id)) tint(mat, color);
  }

  // Worst severity per implicated dwelling ENTRANCE id (E2) — same encoding,
  // different id space, so resolved separately against each floor's markers.
  const entSev = new Map<string, Severity>();
  for (const v of violations)
    for (const id of v.entranceIds ?? [])
      entSev.set(id, worstSeverity(entSev.get(id), v.severity));
  for (const [id, severity] of entSev) {
    const color = SEVERITY_COLORS[severity];
    for (const mat of resolveEntranceMaterials(floors, id)) tint(mat, color);
  }
}

/** Extra emissive-intensity boost layered on top of an ALREADY-active
 *  violation tint (see {@link tint}) — report-card hover reads as "brighter",
 *  never as a colour change, so it can never fight the tier colour or the
 *  eventual `restore()`. Only ever touches materials that are already tinted
 *  (`hiPrev` set): every id a report card can hover went through
 *  `applyRoomHighlights` first, so this should always hit; a stale/mismatched
 *  id is silently skipped rather than inventing a highlight on an unflagged
 *  room. */
const HOVER_EMPHASIS_INTENSITY = 1.0;
let hoverMats: THREE.MeshStandardMaterial[] = [];

/** Emphasize a hovered violation's targets (both node/cluster/stair shells
 *  and entrance markers) on top of the normal tier highlight. */
export function setHoverEmphasis(floors: Floor[], nodeIds: string[], entranceIds: string[]): void {
  clearHoverEmphasis();
  const mats = new Set<THREE.MeshStandardMaterial>();
  for (const id of nodeIds) for (const m of resolveNodeMaterials(floors, id)) mats.add(m);
  for (const id of entranceIds) for (const m of resolveEntranceMaterials(floors, id)) mats.add(m);
  for (const mat of mats) {
    if (!mat.emissive || mat.userData.hiPrev === undefined) continue;
    mat.emissiveIntensity = HOVER_EMPHASIS_INTENSITY;
    hoverMats.push(mat);
  }
}

/** Revert whatever {@link setHoverEmphasis} last boosted back to the normal
 *  tier intensity. Never touches `hiPrev`/colour, so it can't desync from
 *  {@link clearRoomHighlights}'s own restore — call this (not just rely on a
 *  later `clearRoomHighlights`) whenever hover ends, so no stale reference
 *  lingers past a `restore()` that already reset the material underneath it. */
export function clearHoverEmphasis(): void {
  for (const mat of hoverMats) mat.emissiveIntensity = EMISSIVE_INTENSITY;
  hoverMats = [];
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
