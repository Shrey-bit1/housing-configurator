import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ModuleStore, ModuleInstance } from "../core/store";
import type { Cell } from "../core/grid";
import type { GhostPreview } from "../scene/ghostPreview";
import type { Picker } from "./picker";
import type { DragDropController } from "./dragDrop";
import { setSelected } from "../scene/moduleMesh";

const DRAG_THRESHOLD_PX = 4;

/**
 * Adapter for entrance selection/deletion, injected so the selection controller
 * doesn't need to know entrance internals. `pick` returns the entrance id under
 * the cursor (or null; the concrete impl gates this to when floor 0 is active);
 * `setSelected` applies/clears the marker highlight; `remove` deletes the
 * entrance and refreshes its derived state.
 */
export interface EntranceSelectionAdapter {
  pick(clientX: number, clientY: number): string | null;
  setSelected(id: string | null): void;
  remove(id: string): void;
}

/**
 * Handles everything you can do to an already-placed module:
 *  - click to select (emissive highlight),
 *  - R to rotate the selection 90° about its origin cell,
 *  - drag a placed module to a new cell (ghost preview, collision-checked),
 *  - Delete / Backspace to remove it.
 *
 * Also owns ENTRANCE selection (via {@link EntranceSelectionAdapter}), so that
 * module and entrance selection are mutually exclusive and share Delete/Escape.
 * Entrances aren't draggable — clicking one just selects it.
 *
 * `onAfterAction` fires after any committed mutation (move/rotate/delete of a
 * module, or entrance deletion) so the caller can snapshot for undo/redo.
 *
 * Left-drag on empty space falls through to OrbitControls; controls are
 * disabled only while actively dragging a module so the two don't fight.
 */
export class SelectionController {
  private selectedId: string | null = null;
  private selectedEntranceId: string | null = null;

  // Pointer-drag state.
  private pressed: ModuleInstance | null = null;
  private pressedEntrance = false;
  private pressX = 0;
  private pressY = 0;
  private grabOffset: Cell = { cx: 0, cz: 0 };
  private moving = false;
  private moveRotation = 0;
  private lastMoveOrigin: Cell | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private picker: Picker,
    private ghost: GhostPreview,
    /** Active floor's store — reassigned by the FloorManager on floor switch. */
    public store: ModuleStore,
    private controls: OrbitControls,
    private dragDrop: DragDropController,
    /** Fired after a committed mutation (for undo/redo snapshots). */
    private onAfterAction?: () => void,
    /** Entrance select/delete adapter (entrances live on floor 0 only). */
    private entrances?: EntranceSelectionAdapter
  ) {
    this.install();
  }

  private install(): void {
    this.canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    this.canvas.addEventListener("pointermove", (e) => this.onPointerMove(e));
    this.canvas.addEventListener("pointerup", (e) => this.onPointerUp(e));
    window.addEventListener("keydown", (e) => this.onKeyDown(e));
  }

  /** Clear selection (module AND entrance). Used across floor switches, resize
   *  culls, restores, etc. */
  deselect(): void {
    if (this.selectedId) {
      const inst = this.store.instances.get(this.selectedId);
      if (inst) setSelected(inst.group, false);
      this.selectedId = null;
    }
    if (this.selectedEntranceId) {
      this.entrances?.setSelected(null);
      this.selectedEntranceId = null;
    }
  }

  private select(id: string): void {
    if (this.selectedId === id) return;
    this.deselect();
    this.selectedId = id;
    const inst = this.store.instances.get(id);
    if (inst) setSelected(inst.group, true);
  }

  private selectEntrance(id: string): void {
    if (this.selectedEntranceId === id) return;
    this.deselect();
    this.selectedEntranceId = id;
    this.entrances?.setSelected(id);
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 || this.dragDrop.isDragging) return;

    const obj = this.picker.groupAt(e.clientX, e.clientY, this.store.groups);
    const inst = this.store.instanceFromObject(obj);
    if (!inst) {
      // No module hit — try an entrance marker (adapter gates this to floor 0).
      const entId = this.entrances?.pick(e.clientX, e.clientY) ?? null;
      if (entId) {
        this.selectEntrance(entId);
        // Entrances don't move — lock orbit for this press so a small drag
        // doesn't nudge the camera; released on pointerup. No drag/move state.
        this.pressedEntrance = true;
        this.controls.enabled = false;
        this.canvas.setPointerCapture(e.pointerId);
        return;
      }
      // Empty space: deselect and let OrbitControls handle the drag.
      this.deselect();
      return;
    }

    // Pressed on a module: prepare for either a click-select or a move-drag.
    this.pressed = inst;
    this.pressX = e.clientX;
    this.pressY = e.clientY;
    this.moving = false;
    this.moveRotation = inst.rotation;

    const cell = this.picker.cellAt(e.clientX, e.clientY);
    this.grabOffset = cell
      ? { cx: cell.cx - inst.origin.cx, cz: cell.cz - inst.origin.cz }
      : { cx: 0, cz: 0 };

    // Pressing a module always belongs to us, not the camera — lock orbit now
    // so a click or short drag never nudges the view. Re-enabled on pointerup.
    this.controls.enabled = false;

    // We'll decide select-vs-move on move/up; capture the pointer meanwhile.
    this.canvas.setPointerCapture(e.pointerId);
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.pressed) return;

    if (!this.moving) {
      const moved =
        Math.abs(e.clientX - this.pressX) > DRAG_THRESHOLD_PX ||
        Math.abs(e.clientY - this.pressY) > DRAG_THRESHOLD_PX;
      if (!moved) return;
      // Begin moving: hide the real module, show the ghost. (Controls were
      // already locked on pointerdown.)
      this.moving = true;
      this.pressed.group.visible = false;
      this.ghost.begin(this.pressed.def, this.moveRotation);
    }

    const cell = this.picker.cellAt(e.clientX, e.clientY);
    if (cell) {
      const origin = {
        cx: cell.cx - this.grabOffset.cx,
        cz: cell.cz - this.grabOffset.cz,
      };
      this.lastMoveOrigin = origin;
      this.ghost.update(origin, this.pressed.id);
    } else {
      this.ghost.hide();
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.pressedEntrance) {
      // Entrance click already selected on pointerdown; just release the lock.
      this.pressedEntrance = false;
      this.canvas.releasePointerCapture?.(e.pointerId);
      this.controls.enabled = true;
      return;
    }
    if (!this.pressed) return;
    const inst = this.pressed;
    this.canvas.releasePointerCapture?.(e.pointerId);

    if (!this.moving) {
      // No drag happened → treat as a click-select.
      this.select(inst.id);
      this.controls.enabled = true;
      this.pressed = null;
      return;
    }

    // Commit the move if the final cell is valid.
    const cell = this.picker.cellAt(e.clientX, e.clientY);
    let committed = false;
    if (cell) {
      const origin = {
        cx: cell.cx - this.grabOffset.cx,
        cz: cell.cz - this.grabOffset.cz,
      };
      committed = this.store.move(inst.id, origin, this.moveRotation);
    }

    if (!committed) {
      // Invalid drop: leave the module where it was.
      inst.group.visible = true;
    } else {
      // move() may have rebuilt the group; make sure it's visible & selected.
      const fresh = this.store.instances.get(inst.id);
      if (fresh) fresh.group.visible = true;
    }

    this.ghost.clear();
    this.controls.enabled = true;
    this.moving = false;
    this.lastMoveOrigin = null;
    this.pressed = null;
    this.select(inst.id);
    // One snapshot for the whole drag gesture (commit is a no-op if the move
    // was invalid / dropped on the same cell — serialized state unchanged).
    this.onAfterAction?.();
  }

  private onKeyDown(e: KeyboardEvent): void {
    // Don't steal keys while typing in the sidebar inputs.
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    if (e.key === "r" || e.key === "R") {
      if (this.moving && this.pressed) {
        // Rotate the in-flight move ghost (not committed yet — no snapshot).
        this.moveRotation = (this.moveRotation + 1) % 4;
        this.ghost.setRotation(this.moveRotation);
        if (this.lastMoveOrigin)
          this.ghost.update(this.lastMoveOrigin, this.pressed.id);
      } else if (this.selectedId && !this.dragDrop.isDragging) {
        this.store.rotate(this.selectedId);
        this.onAfterAction?.();
      }
    } else if (e.key === "Delete" || e.key === "Backspace") {
      if (this.selectedId && !this.moving) {
        this.store.remove(this.selectedId);
        this.selectedId = null;
        this.onAfterAction?.();
      } else if (this.selectedEntranceId && !this.moving) {
        const id = this.selectedEntranceId;
        this.selectedEntranceId = null;
        this.entrances?.remove(id); // deletes marker + refreshes derived state
        this.onAfterAction?.();
      }
    } else if (e.key === "Escape") {
      this.deselect();
    }
  }
}
