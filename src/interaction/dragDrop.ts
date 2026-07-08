import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ModuleStore } from "../core/store";
import { MODULE_DEFS, type ModuleType } from "../core/modules";
import type { Cell } from "../core/grid";
import type { GhostPreview } from "../scene/ghostPreview";
import type { Picker } from "./picker";

/**
 * Palette → canvas placement, driven by pointer events (not native HTML5
 * drag-and-drop). Native DnD swallows keyboard events, so `R` couldn't rotate
 * the ghost mid-drag; pointer events let it work and unify this with the
 * move-a-placed-module gesture.
 *
 * Flow: pressing a palette entry calls {@link startPlacement}; moving the
 * pointer over the canvas shows a snapped ghost (green = valid, red =
 * invalid); releasing over a valid cell commits the module. `R` rotates,
 * `Esc` cancels.
 */
export class DragDropController {
  private activeType: ModuleType | null = null;
  private rotation = 0;
  private lastCell: Cell | null = null;

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
    this.activeType = type;
    this.rotation = 0;
    this.lastCell = null;
    this.controls.enabled = false; // don't orbit while placing
    this.ghost.begin(MODULE_DEFS[type], 0);
  }

  private install(): void {
    window.addEventListener("pointermove", (e) => this.onMove(e));
    window.addEventListener("pointerup", (e) => this.onUp(e));
    window.addEventListener("keydown", (e) => this.onKeyDown(e));
  }

  private onMove(e: PointerEvent): void {
    if (!this.activeType) return;
    const cell = this.overCanvas(e)
      ? this.picker.cellAt(e.clientX, e.clientY)
      : null;
    this.lastCell = cell;
    if (cell) this.ghost.update(cell);
    else this.ghost.hide();
  }

  private onUp(e: PointerEvent): void {
    if (!this.activeType) return;
    const cell = this.overCanvas(e)
      ? this.picker.cellAt(e.clientX, e.clientY)
      : null;
    if (cell) this.store.place(this.activeType, cell, this.rotation);
    this.cancel();
    // Snapshot after the placement gesture (no-op if nothing was placed —
    // released off-canvas or on an invalid cell — serialized state unchanged).
    this.onAfterAction?.();
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.activeType) return;
    if (e.key === "r" || e.key === "R") {
      this.rotation = (this.rotation + 1) % 4;
      this.ghost.setRotation(this.rotation);
      if (this.lastCell) this.ghost.update(this.lastCell); // keep it on-screen
    } else if (e.key === "Escape") {
      this.cancel();
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

  private cancel(): void {
    this.activeType = null;
    this.rotation = 0;
    this.lastCell = null;
    this.controls.enabled = true;
    this.ghost.clear();
  }
}
