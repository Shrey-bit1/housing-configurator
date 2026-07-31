import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ModuleStore } from "../core/store";
import { MODULE_DEFS, occupiedCells, type ModuleType } from "../core/modules";
import type { Cell } from "../core/grid";
import { settleDrop, type GhostPreview } from "../scene/ghostPreview";
import type { Picker } from "./picker";

/**
 * Palette → canvas placement, driven by pointer events (not native HTML5
 * drag-and-drop). Native DnD swallows keyboard events, so `R` couldn't rotate
 * the ghost mid-drag; pointer events let it work and unify this with the
 * move-a-placed-module gesture.
 *
 * Flow: pressing a palette entry calls {@link startPlacement}; moving the
 * pointer over the canvas shows a snapped ghost (ink = valid, accent red =
 * invalid); releasing over a valid cell commits the module. `R` rotates,
 * `M` mirrors (left/right flip). Escape is arbitrated centrally by main.ts
 * (see its keydown handler) rather than handled here, so cancelling a
 * placement never fires alongside clearing a selection or exiting plan mode
 * in the same keypress — it calls {@link cancelPlacement} directly.
 *
 * THE COMMIT IS GATED ON VALIDITY. Until run 0015 `onUp` called `store.place`
 * for whatever cell was under the pointer without re-asking whether the module
 * fitted, so a ghost showing red still placed and the user's own eyes were
 * wrong about what the app would do. `store.place` refuses an overlap on its
 * own, so nothing corrupt was ever written, but the gesture lied. The controller
 * now remembers the last validity it computed and bails on release when it is
 * false (see {@link onUp}).
 *
 * The controller also reports the gesture to whoever is drawing its chrome, via
 * {@link onGesture}. It deliberately owns no DOM: the cursor chip, the validity
 * label, the sidebar's dimmed source tile and the grid emphasis are all somebody
 * else's job, and this only says what is happening.
 */

/** What the chrome needs to draw the gesture, emitted on every change. */
export interface DragGestureState {
  type: ModuleType;
  /** Snapped cell under the pointer, or null when off-canvas. */
  cell: Cell | null;
  /** Whether a release right now would place. False whenever `cell` is null. */
  valid: boolean;
  /** Viewport coordinates, for the cursor chip. */
  pointer: { x: number; y: number };
}
export class DragDropController {
  private activeType: ModuleType | null = null;
  private rotation = 0;
  private mirrored = false;
  private lastCell: Cell | null = null;
  /** The validity of {@link lastCell}, recomputed on every move. THE COMMIT
   *  GATE: `onUp` refuses to place when this is false. */
  private lastValid = false;
  /** Last pointer position in viewport coordinates, so the chrome can follow
   *  the pointer without listening for its own pointer events. */
  private pointer = { x: 0, y: 0 };
  /** Fired on start, on every move, and once with null when the gesture ends.
   *  Assigned by main.ts after construction. */
  onGesture?: (state: DragGestureState | null) => void;

  constructor(
    private canvas: HTMLCanvasElement,
    private picker: Picker,
    private ghost: GhostPreview,
    /** Active floor's store — reassigned by the FloorManager on floor switch. */
    public store: ModuleStore,
    private controls: OrbitControls,
    /** Fired after a placement gesture ends (for undo/redo snapshots). */
    private onAfterAction?: () => void
  ) {
    this.install();
  }

  /** True while a palette placement is in progress. */
  get isDragging(): boolean {
    return this.activeType !== null;
  }

  /** Begin placing `type`. Called by the palette on pointer-down of an entry. */
  startPlacement(type: ModuleType): void {
    this.startPlacementFrom(type, 0, false);
  }

  /** Begin placing a NEW instance of `type`, pre-posed at `rotation`/`mirrored`
   *  instead of the identity pose. Currently only reached via
   *  {@link startPlacement} (identity pose); kept parameterised for a pre-posed
   *  palette placement. (Duplicate — Ctrl/Cmd+D / Shift+D — no longer routes
   *  through here; it uses `GroupGhostPreview`/`store.placeMany` in
   *  `SelectionController` so one or many instances clone uniformly.) */
  startPlacementFrom(type: ModuleType, rotation: number, mirrored: boolean): void {
    this.activeType = type;
    this.rotation = rotation;
    this.mirrored = mirrored;
    this.lastCell = null;
    this.lastValid = false;
    this.controls.enabled = false; // don't orbit while placing
    this.ghost.begin(MODULE_DEFS[type], rotation, mirrored);
    this.emit();
  }

  /** Tell the chrome what the gesture looks like now (or that it has ended). */
  private emit(): void {
    if (!this.activeType) {
      this.onGesture?.(null);
      return;
    }
    this.onGesture?.({
      type: this.activeType,
      cell: this.lastCell,
      valid: this.lastValid,
      pointer: { ...this.pointer },
    });
  }

  private install(): void {
    window.addEventListener("pointermove", (e) => this.onMove(e));
    window.addEventListener("pointerup", (e) => this.onUp(e));
    window.addEventListener("keydown", (e) => this.onKeyDown(e));
  }

  private onMove(e: PointerEvent): void {
    if (!this.activeType) return;
    this.pointer = { x: e.clientX, y: e.clientY };
    const cell = this.overCanvas(e)
      ? this.picker.cellAt(e.clientX, e.clientY)
      : null;
    this.lastCell = cell;
    // `ghost.update` already asks the store whether this footprint fits, so the
    // gate reuses its answer rather than running the same check twice and
    // risking the two disagreeing.
    this.lastValid = cell ? this.ghost.update(cell) : false;
    if (!cell) this.ghost.hide();
    this.emit();
  }

  private onUp(e: PointerEvent): void {
    if (!this.activeType) return;
    const cell = this.overCanvas(e)
      ? this.picker.cellAt(e.clientX, e.clientY)
      : null;
    // THE GATE. Re-ask rather than trusting `lastValid` alone, because a release
    // can land on a cell no move event reported: a click without motion never
    // fires pointermove, and the pointer can leave and re-enter the canvas
    // between the last move and the release.
    const cells = cell
      ? occupiedCells(MODULE_DEFS[this.activeType], cell, this.rotation, this.mirrored)
      : [];
    const valid =
      cell !== null && this.store.canPlaceInstance(MODULE_DEFS[this.activeType], cells);
    if (valid && cell) {
      const placed = this.store.place(this.activeType, cell, this.rotation, this.mirrored);
      // The settle is the only thing that says "this one just landed"; without
      // it a commit and a reload look identical.
      if (placed) settleDrop(placed.group);
    }
    this.cancelPlacement();
    // Snapshot after the placement gesture (no-op if nothing was placed —
    // released off-canvas or on an invalid cell — serialized state unchanged).
    this.onAfterAction?.();
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.activeType) return;
    // Rotating or mirroring can change whether the footprint fits, so both
    // refresh `lastValid` and re-emit. The gesture itself is unchanged; without
    // this the validity label would keep reporting the pose before the keypress.
    if (e.key === "r" || e.key === "R") {
      this.rotation = (this.rotation + 1) % 4;
      this.ghost.setRotation(this.rotation);
      if (this.lastCell) this.lastValid = this.ghost.update(this.lastCell); // keep it on-screen
      this.emit();
    } else if (e.key === "m" || e.key === "M") {
      this.mirrored = !this.mirrored;
      this.ghost.setMirror(this.mirrored);
      if (this.lastCell) this.lastValid = this.ghost.update(this.lastCell); // re-tint against the flip
      this.emit();
    }
  }

  private overCanvas(e: PointerEvent): boolean {
    const r = this.canvas.getBoundingClientRect();
    return (
      e.clientX >= r.left &&
      e.clientX <= r.right &&
      e.clientY >= r.top &&
      e.clientY <= r.bottom
    );
  }

  /** Cancel any in-progress placement (Escape, arbitrated centrally by
   *  main.ts) or reset after a commit. Public so the central Escape handler
   *  can call it directly. */
  cancelPlacement(): void {
    this.activeType = null;
    this.rotation = 0;
    this.mirrored = false;
    this.lastCell = null;
    this.lastValid = false;
    this.controls.enabled = true;
    this.ghost.clear();
    this.emit(); // activeType is already null, so this reports the end
  }
}
