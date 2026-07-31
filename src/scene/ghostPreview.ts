import * as THREE from "three";
import type { Grid, Cell } from "../core/grid";
import type { ModuleStore } from "../core/store";
import { occupiedCells, type ModuleDef } from "../core/modules";
import { buildModuleMesh, setGhostValidity } from "./moduleMesh";

/** Motion tokens, mirrored from `src/style.css` (`--dur-tap`, `--dur-panel`).
 *  Scene geometry cannot read CSS variables, so the two the gesture needs are
 *  carried here as numbers; keep them in step with the stylesheet by hand. */
const DUR_TAP = 0.15; // seconds — ghost snap
const DUR_PANEL = 0.26; // seconds — the drop settle
/** How far above its resting Y a committed module enters, in world units.
 *  22 screen px at the default framing, converted once rather than per drop. */
const SETTLE_RISE = 0.55;
/** Opacity a settling module starts at, per the design's `opacity .2`. */
const SETTLE_ALPHA = 0.2;

/** `cubic-bezier(.22,.9,.24,1)` closely enough for a 150–260 ms move. The real
 *  curve is a CSS easing and this is a render loop, so what matters is that it
 *  leaves fast and arrives slow, which this does. */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Modules currently playing the drop settle. Module-level rather than a field,
 *  because a settle outlives the ghost that caused it: the ghost is cleared the
 *  instant the placement commits, and the module keeps falling for 260 ms. */
interface Settle {
  group: THREE.Object3D;
  restY: number;
  t: number;
  mats: THREE.Material[];
}
const settling: Settle[] = [];

/**
 * Start the drop settle on a just-committed module: it enters {@link SETTLE_RISE}
 * above its resting Y at {@link SETTLE_ALPHA} and lands over `--dur-panel`. One
 * drop, then still. Safe to call on a group already settling; it restarts.
 */
export function settleDrop(group: THREE.Object3D): void {
  const mats: THREE.Material[] = [];
  group.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (m) (Array.isArray(m) ? m : [m]).forEach((x) => mats.push(x));
  });
  for (const m of mats) m.transparent = true;
  const existing = settling.findIndex((s) => s.group === group);
  if (existing >= 0) settling.splice(existing, 1);
  settling.push({ group, restY: group.position.y, t: 0, mats });
  group.position.y = group.position.y + SETTLE_RISE;
  for (const m of mats) m.opacity = SETTLE_ALPHA;
}

/**
 * Advance every scene animation this module owns by `dt` seconds. Called once
 * per frame from main's render loop, BEFORE the render, so a tween and the
 * frame that shows it never disagree. Cheap and a no-op when nothing is moving.
 */
export function tickGhostAnimations(dt: number): void {
  for (let i = settling.length - 1; i >= 0; i--) {
    const s = settling[i];
    s.t = Math.min(1, s.t + dt / DUR_PANEL);
    const k = easeOut(s.t);
    s.group.position.y = s.restY + SETTLE_RISE * (1 - k);
    const alpha = SETTLE_ALPHA + (1 - SETTLE_ALPHA) * k;
    for (const m of s.mats) m.opacity = alpha;
    if (s.t >= 1) {
      // Restore the resting state exactly rather than leaving the last frame's
      // arithmetic in place: a module at rest must be opaque and un-transparent,
      // or it sorts against the cutaway differently from its neighbours.
      s.group.position.y = s.restY;
      for (const m of s.mats) {
        m.opacity = 1;
        m.transparent = false;
      }
      settling.splice(i, 1);
    }
  }
}

/**
 * The translucent preview shown while dragging a module (either from the
 * palette or when moving a placed module). Knows how to snap itself to a cell
 * and colour itself by placement validity.
 *
 * The ghost SNAPS to whole cells but TWEENS between them: `update` sets a target
 * and `tick` eases the group toward it over `--dur-tap`. Before this the group's
 * position was assigned outright, and a drag across the plate read as a jitter
 * of discrete jumps rather than as a thing being carried. Nothing about which
 * cell is chosen changed; only how the preview travels to it.
 */
export class GhostPreview {
  private group: THREE.Group | null = null;
  private def: ModuleDef | null = null;
  private rotation = 0;
  private mirrored = false;
  /** Where the ghost is easing toward — the snapped cell's world position. */
  private target = new THREE.Vector3();
  /** False until the first `update`, so the ghost APPEARS at its first cell
   *  instead of sliding in from wherever the previous gesture left it. */
  private placed = false;

  /** Parent container (the active floor's group), grid, and store — all swapped
   *  by the FloorManager when the active floor changes so the ghost previews on
   *  it (the store supplies cross-floor placement validity, e.g. for stairs). */
  constructor(
    public parent: THREE.Object3D,
    public grid: Grid,
    public store: ModuleStore
  ) {}

  /** Begin previewing `def` at the given rotation + mirror. */
  begin(def: ModuleDef, rotation = 0, mirrored = false): void {
    this.clear();
    this.def = def;
    this.rotation = rotation;
    this.mirrored = mirrored;
    this.group = buildModuleMesh(def, rotation, true, undefined, mirrored);
    this.group.visible = false;
    this.parent.add(this.group);
  }

  get isActive(): boolean {
    return this.group !== null;
  }

  setRotation(rotation: number): void {
    if (!this.def) return;
    this.rotation = rotation;
    this.begin(this.def, rotation, this.mirrored);
  }

  /** Toggle/set the ghost's mirror state, rebuilding the preview mesh. */
  setMirror(mirrored: boolean): void {
    if (!this.def) return;
    this.mirrored = mirrored;
    this.begin(this.def, this.rotation, mirrored);
  }

  get currentRotation(): number {
    return this.rotation;
  }

  get currentMirror(): boolean {
    return this.mirrored;
  }

  /**
   * Move the ghost to `origin`, snapped to the grid, and recolour it based on
   * whether the module could legally be placed there. `excludeId` lets a moving
   * module ignore its own footprint. Returns the validity result.
   */
  update(origin: Cell, excludeId?: string): boolean {
    if (!this.group || !this.def) return false;
    this.group.visible = true;
    const world = this.grid.gridToWorld(origin.cx, origin.cz);
    this.target.copy(world);
    // First cell of a gesture lands outright; every later one is eased by
    // `tick`. Sliding in from the last gesture's cell would read as the ghost
    // travelling across the plate before the user had moved at all.
    if (!this.placed) {
      this.group.position.copy(world);
      this.placed = true;
    }

    const cells = occupiedCells(this.def, origin, this.rotation, this.mirrored);
    const valid = this.store.canPlaceInstance(this.def, cells, excludeId);
    setGhostValidity(this.group, valid);
    return valid;
  }

  /** Ease the ghost toward its target cell. Called once per frame from the
   *  render loop with the frame's delta in seconds. Frame-rate independent: the
   *  exponential form converges at the same wall-clock rate at any fps. */
  tick(dt: number): void {
    if (!this.group || !this.placed) return;
    const k = 1 - Math.exp((-dt / DUR_TAP) * 3);
    this.group.position.lerp(this.target, Math.min(1, k));
  }

  hide(): void {
    if (this.group) this.group.visible = false;
  }

  clear(): void {
    if (this.group) {
      this.group.removeFromParent();
      this.group = null;
    }
    this.def = null;
    this.rotation = 0;
    this.mirrored = false;
    this.placed = false;
  }
}
