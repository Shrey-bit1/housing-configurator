import * as THREE from "three";

/**
 * Dollhouse cutaway: hide the wall segments standing between the camera and a
 * room's interior, so you can see inside at eye level as the camera orbits.
 *
 * Each shell wall mesh is tagged (in moduleMesh) with `userData.wallNormal`, its
 * outward-facing direction. A wall faces the camera when its outward normal
 * points toward the viewer — `normal · viewDir > THRESHOLD` — and is hidden.
 * The orthographic camera projects in parallel, so the view direction is the
 * same for every room; we compute it once and apply to all wall meshes. Floors,
 * props, and the grid have no `wallNormal` and are never touched.
 *
 * Recompute is throttled: it only runs when the camera has moved or when the
 * scene's wall set has changed (a room placed/moved/rotated/deleted calls
 * {@link markCutawayDirty}). Idle frames do no work.
 *
 * TOGGLEABLE ({@link setCutawayEnabled}): with cutaway OFF every wall renders
 * regardless of camera direction, so the building reads as a solid exterior
 * object (its facades — windows, corner windows — visible from outside). Pure
 * session VIEW state, never serialized; independent of plan view and per-floor
 * visibility/dimming (this pass only ever flips `wallNormal`-tagged meshes'
 * `.visible`, which plan view already leaves all-true and dimming never reads).
 */

/** Hide walls whose outward normal points within this dot-threshold of the view. */
const THRESHOLD = 0.12;

const viewDir = new THREE.Vector3();
const lastApplied = new THREE.Vector3(NaN, NaN, NaN);
let dirty = true;
let enabled = true;

/** Force a recompute on the next {@link updateCutaway} (e.g. rooms changed). */
export function markCutawayDirty(): void {
  dirty = true;
}

/** Turn the dynamic hiding pass on/off. OFF makes every wall visible (next
 *  frame) and suppresses hiding; ON restores camera-driven hiding. Idempotent. */
export function setCutawayEnabled(on: boolean): void {
  if (enabled === on) return;
  enabled = on;
  dirty = true; // reapply on the next frame (show-all when off, recompute when on)
}

/**
 * Update wall visibility for the current camera. Call once per frame after
 * `controls.update()`; it self-throttles.
 */
export function updateCutaway(
  scene: THREE.Object3D,
  cameraPosition: THREE.Vector3,
  target: THREE.Vector3
): void {
  // Cutaway OFF: show every wall, once, then idle until re-enabled or the wall
  // set changes (markCutawayDirty) — a newly placed room's walls must show too.
  if (!enabled) {
    if (!dirty) return;
    dirty = false;
    lastApplied.set(NaN, NaN, NaN); // force a full recompute when cutaway returns
    scene.traverse((o) => {
      if (o.userData.wallNormal) o.visible = true;
    });
    return;
  }

  viewDir.copy(cameraPosition).sub(target).normalize();
  if (!dirty && viewDir.distanceToSquared(lastApplied) < 1e-6) return;
  dirty = false;
  lastApplied.copy(viewDir);

  scene.traverse((o) => {
    const normal = o.userData.wallNormal as THREE.Vector3 | undefined;
    if (normal) o.visible = normal.dot(viewDir) <= THRESHOLD;
  });
}
