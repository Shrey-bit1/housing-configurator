import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ModuleStore, ModuleInstance } from "../core/store";
import type { Cell } from "../core/grid";
import { occupiedCells } from "../core/modules";
import type { GhostPreview } from "../scene/ghostPreview";
import { GroupGhostPreview, type GroupGhostMember } from "../scene/groupGhostPreview";
import type { Picker } from "./picker";
import type { DragDropController } from "./dragDrop";
import { setSelected, setHovered } from "../scene/moduleMesh";

const DRAG_THRESHOLD_PX = 4;

/**
 * Adapter for edge-bound MARKER selection/deletion (entrances AND doors),
 * injected so the selection controller doesn't need to know their internals.
 * `pick` returns the marker id under the cursor (or null; the concrete impl gates
 * where relevant — entrances to floor 0, doors to the active floor); `setSelected`
 * applies/clears the marker highlight; `remove` deletes it and refreshes derived
 * state. Entrances and doors share this shape but are separate, mutually-exclusive
 * selections.
 */
export interface MarkerSelectionAdapter {
  pick(clientX: number, clientY: number): string | null;
  setSelected(id: string | null): void;
  remove(id: string): void;
}

/** @deprecated Use {@link MarkerSelectionAdapter}; kept as the historical name. */
export type EntranceSelectionAdapter = MarkerSelectionAdapter;

/**
 * Handles everything you can do to already-placed modules — SINGLE or
 * MULTIPLE at once:
 *  - click to select (replaces the selection with just that instance),
 *  - Shift-click to toggle an instance in/out of a multi-selection,
 *  - R to rotate / M to mirror the selection — only when EXACTLY ONE instance
 *    is selected (group re-pose is out of scope; a multi-selection no-ops and
 *    reports it via `onNoopHint`),
 *  - drag any selected member to move the WHOLE selection rigidly (relative
 *    offsets preserved) — a GROUP move, collision-checked with every moving
 *    member excluded from occupancy so the set can shuffle into each other's
 *    vacated cells (e.g. swapping two adjacent rooms in one gesture),
 *  - Delete / Backspace to remove the whole selection (one action),
 *  - Shift+D to duplicate the WHOLE selection (one instance or many) into a
 *    new placement ghost that follows the cursor (`GroupGhostPreview`, the
 *    same machinery group-move uses) and commits via `store.placeMany` on a
 *    click — one undo snapshot regardless of count. R/M work on the ghost
 *    only when duplicating a SINGLE instance (group re-pose is out of scope,
 *    same as elsewhere). NOT Ctrl/Cmd+D: that combo is reserved by the
 *    browser for bookmarking on most platforms, and the keydown often never
 *    reaches page JS at all — `preventDefault()` cannot override it.
 *
 * Also owns ENTRANCE selection (via {@link EntranceSelectionAdapter}). Entrances
 * are explicitly EXCLUDED from multi-select/group operations (moving them with
 * rooms could invalidate their exterior edge) — they remain singly selectable/
 * deletable, mutually exclusive with module selection.
 *
 * Multi-select is scoped to the ACTIVE FLOOR only (mirrors `store`, reassigned
 * by the FloorManager on floor switch).
 *
 * `onAfterAction` fires after any committed mutation (move/rotate/mirror/
 * delete of a module or modules, or entrance deletion) so the caller can
 * snapshot for undo/redo. `onSelectionChange` fires whenever the selection
 * (module set or entrance) changes, for a UI readout. `onNoopHint` fires when
 * R/M is pressed against a multi-selection (nothing happens; a brief message
 * explains why).
 *
 * Escape is arbitrated centrally by main.ts (gesture > selection > plan mode)
 * — this class does not listen for Escape itself; `deselect()` is called
 * directly by that handler (and by floor switches, imports, etc.).
 *
 * Left-drag on empty space falls through to OrbitControls; controls are
 * disabled only while actively dragging a module so the two don't fight. (A
 * marquee/rubber-band selection was considered but skipped: plain left-drag on
 * empty ground is already the camera-orbit gesture, and overriding it would
 * break that core navigation; shift-click covers multi-select instead.)
 */
export class SelectionController {
  /** Multi-selection of module instance ids, ACTIVE FLOOR only. */
  private selectedIds = new Set<string>();
  private selectedEntranceId: string | null = null;
  private selectedDoorId: string | null = null;
  private hoveredId: string | null = null;

  // Pointer-drag state.
  private pressed: ModuleInstance | null = null;
  /** True while an edge-bound marker (entrance or door) is pressed — it only
   *  selects (no move), and locks orbit for the press so a nudge doesn't pan. */
  private pressedMarker = false;
  /** The ids that will move together if this press turns into a drag — either
   *  the instance alone, or the whole multi-selection if the pressed instance
   *  was already part of one. Null when nothing is pressed. */
  private dragIds: Set<string> | null = null;
  private pressX = 0;
  private pressY = 0;
  private grabOffset: Cell = { cx: 0, cz: 0 };
  private moving = false;
  private moveRotation = 0;
  private moveMirrored = false;
  private lastMoveOrigin: Cell | null = null;
  /** Populated only for a GROUP move (dragIds.size > 1) — one entry per member. */
  private groupMembers: (GroupGhostMember & { id: string })[] = [];

  // Shift+D duplicate-placement state. Independent of the move-drag state
  // above — mutually exclusive by construction (duplicate mode is entered via
  // keydown, never mid-press).
  private duplicating = false;
  private duplicateTemplates: GroupGhostMember[] = [];
  private lastDuplicateCell: Cell | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private picker: Picker,
    private ghost: GhostPreview,
    private groupGhost: GroupGhostPreview,
    /** Active floor's store — reassigned by the FloorManager on floor switch. */
    public store: ModuleStore,
    private controls: OrbitControls,
    private dragDrop: DragDropController,
    /** Fired after a committed mutation (for undo/redo snapshots). */
    private onAfterAction?: () => void,
    /** Entrance select/delete adapter (entrances live on floor 0 only). */
    private entrances?: MarkerSelectionAdapter,
    /** Fired whenever the selection (module set or entrance) changes. */
    private onSelectionChange?: () => void,
    /** Fired when R/M is pressed against a multi-selection (no-op). */
    private onNoopHint?: (message: string) => void,
    /** Door select/delete adapter (doors live on any floor, active floor only). */
    private doors?: MarkerSelectionAdapter,
    /** True while a PLACEMENT tool (entrance/door mode) owns the canvas — the
     *  selection controller then stays out of the way entirely (that gesture's
     *  own click commits; a stray module select/move must not ride along). */
    private isToolActive?: () => boolean
  ) {
    this.install();
  }

  private install(): void {
    this.canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    this.canvas.addEventListener("pointermove", (e) => this.onPointerMove(e));
    this.canvas.addEventListener("pointerup", (e) => this.onPointerUp(e));
    this.canvas.addEventListener("pointerleave", () => this.setHover(null));
    window.addEventListener("keydown", (e) => this.onKeyDown(e));
  }

  /** True if anything (module(s), an entrance, or a door) is currently selected. */
  get hasSelection(): boolean {
    return this.selectedIds.size > 0 || this.selectedEntranceId !== null || this.selectedDoorId !== null;
  }

  /** The currently-selected module instances, resolved fresh from the store. */
  get selectedInstances(): ModuleInstance[] {
    const out: ModuleInstance[] = [];
    for (const id of this.selectedIds) {
      const inst = this.store.instances.get(id);
      if (inst) out.push(inst);
    }
    return out;
  }

  get selectedEntranceIdValue(): string | null {
    return this.selectedEntranceId;
  }

  get selectedDoorIdValue(): string | null {
    return this.selectedDoorId;
  }

  /** True while a Shift+D duplicate ghost is following the cursor, awaiting a
   *  click to commit. Checked by the central Escape arbitrator (main.ts). */
  get isDuplicating(): boolean {
    return this.duplicating;
  }

  /** Clear selection (module AND entrance) and any hover cue. Used across
   *  floor switches, resize culls, restores, imports, and the central Escape
   *  handler — called BEFORE the FloorManager reassigns `store` on a floor
   *  switch, so hover/selection cleanup always resolves against the correct
   *  (about-to-be-inactive) floor's instances. */
  deselect(): void {
    this.clearModuleSelection();
    this.setHover(null);
    if (this.selectedEntranceId) {
      this.entrances?.setSelected(null);
      this.selectedEntranceId = null;
    }
    if (this.selectedDoorId) {
      this.doors?.setSelected(null);
      this.selectedDoorId = null;
    }
    this.onSelectionChange?.();
  }

  /** Clear any selected edge-bound marker (entrance or door). */
  private clearMarkerSelection(): void {
    if (this.selectedEntranceId) {
      this.entrances?.setSelected(null);
      this.selectedEntranceId = null;
    }
    if (this.selectedDoorId) {
      this.doors?.setSelected(null);
      this.selectedDoorId = null;
    }
  }

  private clearModuleSelection(): void {
    for (const id of this.selectedIds) {
      const inst = this.store.instances.get(id);
      if (inst) setSelected(inst.group, false);
    }
    this.selectedIds.clear();
  }

  /** Replace the module selection wholesale (clears any prior set/marker). */
  private setSelection(ids: Iterable<string>): void {
    this.clearModuleSelection();
    this.clearMarkerSelection();
    this.selectedIds = new Set(ids);
    for (const id of this.selectedIds) {
      const inst = this.store.instances.get(id);
      if (inst) setSelected(inst.group, true);
    }
    this.onSelectionChange?.();
  }

  /** Plain click: select just this instance. */
  private select(id: string): void {
    this.setSelection([id]);
  }

  /** Shift-click: toggle membership in the multi-selection (a pure selection
   *  edit — no drag/move is initiated by this gesture). */
  private toggleModuleSelection(id: string): void {
    this.clearMarkerSelection();
    const inst = this.store.instances.get(id);
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
      if (inst) setSelected(inst.group, false);
    } else {
      this.selectedIds.add(id);
      if (inst) setSelected(inst.group, true);
    }
    this.onSelectionChange?.();
  }

  private selectEntrance(id: string): void {
    if (this.selectedEntranceId === id && this.selectedIds.size === 0) return;
    this.clearModuleSelection();
    this.clearMarkerSelection();
    this.selectedEntranceId = id;
    this.entrances?.setSelected(id);
    this.onSelectionChange?.();
  }

  private selectDoor(id: string): void {
    if (this.selectedDoorId === id && this.selectedIds.size === 0) return;
    this.clearModuleSelection();
    this.clearMarkerSelection();
    this.selectedDoorId = id;
    this.doors?.setSelected(id);
    this.onSelectionChange?.();
  }

  private setHover(id: string | null): void {
    if (this.hoveredId === id) return;
    if (this.hoveredId) {
      const prev = this.store.instances.get(this.hoveredId);
      if (prev) setHovered(prev.group, false, this.selectedIds.has(this.hoveredId));
    }
    this.hoveredId = id;
    if (id) {
      const inst = this.store.instances.get(id);
      if (inst) setHovered(inst.group, true, this.selectedIds.has(id));
    }
  }

  private updateHover(e: PointerEvent): void {
    // Ghost placement (palette drag / duplicate) already owns the cursor's
    // visual feedback — don't also light up whatever's underneath it.
    if (this.dragDrop.isDragging) {
      this.setHover(null);
      return;
    }
    const obj = this.picker.groupAt(e.clientX, e.clientY, this.store.groups);
    const inst = this.store.instanceFromObject(obj);
    this.setHover(inst ? inst.id : null);
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 || this.dragDrop.isDragging) return;
    if (this.isToolActive?.()) return; // entrance/door placement owns the canvas
    if (this.duplicating) return; // commits on release, see onPointerUp

    // Edge-bound MARKERS first: entrance (gated to floor 0) then door (active
    // floor). A door marker is a low strip sitting ON TOP of the room/cluster/
    // stair slabs it straddles, so a module is ALWAYS under the cursor too —
    // the marker is the intended click target, so it must win when the ray hits
    // it (picked before modules). Both only SELECT; they never move.
    const entId = this.entrances?.pick(e.clientX, e.clientY) ?? null;
    const doorHit = entId ? null : this.doors?.pick(e.clientX, e.clientY) ?? null;
    if (entId || doorHit) {
      if (entId) this.selectEntrance(entId);
      else this.selectDoor(doorHit!);
      // Lock orbit for this press so a small drag doesn't nudge the camera;
      // released on pointerup. No drag/move state.
      this.pressedMarker = true;
      this.controls.enabled = false;
      this.canvas.setPointerCapture(e.pointerId);
      return;
    }

    const obj = this.picker.groupAt(e.clientX, e.clientY, this.store.groups);
    const inst = this.store.instanceFromObject(obj);
    if (!inst) {
      // Empty space: deselect and let OrbitControls handle the drag (orbit —
      // see the class doc for why marquee-select isn't layered on top of this).
      this.deselect();
      return;
    }

    if (e.shiftKey) {
      this.toggleModuleSelection(inst.id);
      return;
    }

    // Plain press: figure out which ids would move TOGETHER if this becomes a
    // drag. Pressing an already-multi-selected member drags the whole set
    // (offsets preserved); otherwise it's just this one instance — so a
    // non-drag release still "just selects it", matching a plain click.
    this.dragIds =
      this.selectedIds.has(inst.id) && this.selectedIds.size > 1
        ? new Set(this.selectedIds)
        : new Set([inst.id]);

    this.pressed = inst;
    this.pressX = e.clientX;
    this.pressY = e.clientY;
    this.moving = false;
    this.moveRotation = inst.rotation;
    this.moveMirrored = inst.mirrored;

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
    if (this.isToolActive?.()) return; // placement tool owns the cursor
    if (this.duplicating) {
      this.refreshDuplicateGhost(this.picker.cellAt(e.clientX, e.clientY));
      return;
    }
    if (!this.pressed) {
      this.updateHover(e);
      return;
    }

    if (!this.moving) {
      const moved =
        Math.abs(e.clientX - this.pressX) > DRAG_THRESHOLD_PX ||
        Math.abs(e.clientY - this.pressY) > DRAG_THRESHOLD_PX;
      if (!moved) return;
      // Begin moving: hide the real module(s), show the ghost. (Controls were
      // already locked on pointerdown.)
      this.moving = true;
      this.setHover(null); // the drag now owns the cursor's visual feedback
      if (this.dragIds!.size > 1) {
        this.groupMembers = [...this.dragIds!].map((id) => {
          const m = this.store.instances.get(id)!;
          m.group.visible = false;
          return {
            id,
            def: m.def,
            rotation: m.rotation,
            mirrored: m.mirrored,
            relOffset: {
              cx: m.origin.cx - this.pressed!.origin.cx,
              cz: m.origin.cz - this.pressed!.origin.cz,
            },
          };
        });
        this.groupGhost.begin(this.groupMembers);
      } else {
        this.pressed.group.visible = false;
        this.ghost.begin(this.pressed.def, this.moveRotation, this.moveMirrored);
      }
    }

    const cell = this.picker.cellAt(e.clientX, e.clientY);
    if (cell) {
      const origin = {
        cx: cell.cx - this.grabOffset.cx,
        cz: cell.cz - this.grabOffset.cz,
      };
      this.lastMoveOrigin = origin;
      if (this.dragIds!.size > 1) {
        this.groupGhost.updatePositions(origin);
        const valid = this.groupMembers.every((m) => {
          const memberOrigin = { cx: origin.cx + m.relOffset.cx, cz: origin.cz + m.relOffset.cz };
          const cells = occupiedCells(m.def, memberOrigin, m.rotation, m.mirrored);
          return this.store.canPlaceInstance(m.def, cells, this.dragIds!);
        });
        this.groupGhost.setValidity(valid);
      } else {
        this.ghost.update(origin, this.pressed.id);
      }
    } else if (this.dragIds!.size > 1) {
      this.groupGhost.hide();
    } else {
      this.ghost.hide();
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.isToolActive?.()) return; // placement tool's own onUp commits
    if (this.duplicating) {
      // A click (any pointerup while duplicating — there's no press-and-hold
      // gesture here) commits at the ghost's last valid cursor position.
      this.commitDuplicate();
      return;
    }
    if (this.pressedMarker) {
      // Marker (entrance/door) click already selected on pointerdown; release lock.
      this.pressedMarker = false;
      this.canvas.releasePointerCapture?.(e.pointerId);
      this.controls.enabled = true;
      return;
    }
    if (!this.pressed) return;
    const inst = this.pressed;
    const dragIds = this.dragIds!;
    this.canvas.releasePointerCapture?.(e.pointerId);

    if (!this.moving) {
      // No drag happened → treat as a click-select (collapses to just this one).
      this.select(inst.id);
      this.controls.enabled = true;
      this.pressed = null;
      this.dragIds = null;
      return;
    }

    // Commit the move if the final cell is valid.
    const cell = this.picker.cellAt(e.clientX, e.clientY);
    let committed = false;
    if (cell && this.lastMoveOrigin) {
      if (dragIds.size > 1) {
        const moves = this.groupMembers.map((m) => ({
          id: m.id,
          origin: {
            cx: this.lastMoveOrigin!.cx + m.relOffset.cx,
            cz: this.lastMoveOrigin!.cz + m.relOffset.cz,
          },
        }));
        committed = this.store.moveMany(moves);
      } else {
        committed = this.store.move(inst.id, this.lastMoveOrigin, this.moveRotation, this.moveMirrored);
      }
    }

    if (dragIds.size > 1) {
      // Invalid drop leaves every member exactly where it was (moveMany is
      // all-or-nothing) — just restore visibility either way.
      for (const id of dragIds) {
        const fresh = this.store.instances.get(id);
        if (fresh) fresh.group.visible = true;
      }
      this.groupGhost.clear();
    } else if (!committed) {
      // Invalid drop: leave the module where it was.
      inst.group.visible = true;
      this.ghost.clear();
    } else {
      // move() may have rebuilt the group; make sure it's visible & selected.
      const fresh = this.store.instances.get(inst.id);
      if (fresh) fresh.group.visible = true;
      this.ghost.clear();
    }

    this.controls.enabled = true;
    this.moving = false;
    this.lastMoveOrigin = null;
    this.pressed = null;
    this.groupMembers = [];
    this.setSelection(dragIds); // re-apply the highlight (ids are unchanged by a move)
    this.dragIds = null;
    // One snapshot for the whole drag gesture (commit is a no-op if the move
    // was invalid / dropped on the same cell — serialized state unchanged).
    this.onAfterAction?.();
  }

  /** Begin duplicating `insts` (1 or many): builds a template per instance
   *  (its def/pose + cell offset from the FIRST instance, the anchor), clears
   *  the real selection, and starts a `GroupGhostPreview` that follows the
   *  cursor with no button held (unlike a group MOVE, there's no grab-offset —
   *  the ghost snaps directly to whatever cell is under the cursor). */
  private startDuplicate(insts: ModuleInstance[]): void {
    const anchor = insts[0];
    this.duplicateTemplates = insts.map((i) => ({
      def: i.def,
      rotation: i.rotation,
      mirrored: i.mirrored,
      relOffset: { cx: i.origin.cx - anchor.origin.cx, cz: i.origin.cz - anchor.origin.cz },
    }));
    this.deselect();
    this.duplicating = true;
    this.lastDuplicateCell = null;
    this.controls.enabled = false;
    this.groupGhost.begin(this.duplicateTemplates);
  }

  /** Reposition the duplicate ghost at `cell` (the anchor's target origin) and
   *  retint it valid/invalid as one unit — every template's cells must be
   *  free (no exclusion needed; these are all brand-new instances). */
  private refreshDuplicateGhost(cell: Cell | null): void {
    this.lastDuplicateCell = cell;
    if (!cell) {
      this.groupGhost.hide();
      return;
    }
    this.groupGhost.updatePositions(cell);
    const valid = this.duplicateTemplates.every((t) => {
      const origin = { cx: cell.cx + t.relOffset.cx, cz: cell.cz + t.relOffset.cz };
      const cells = occupiedCells(t.def, origin, t.rotation, t.mirrored);
      return this.store.canPlaceInstance(t.def, cells);
    });
    this.groupGhost.setValidity(valid);
  }

  /** Commit the duplicate at its last valid cursor cell — one `store.placeMany`
   *  call (all-or-nothing, single `onChange`) — then select the freshly
   *  placed set. A miss (no cell, or the batch didn't validate) places
   *  nothing; either way the gesture ends and fires one `onAfterAction`. */
  private commitDuplicate(): void {
    if (this.lastDuplicateCell) {
      const cell = this.lastDuplicateCell;
      const items = this.duplicateTemplates.map((t) => ({
        type: t.def.type,
        rotation: t.rotation,
        mirrored: t.mirrored,
        origin: { cx: cell.cx + t.relOffset.cx, cz: cell.cz + t.relOffset.cz },
      }));
      const placed = this.store.placeMany(items);
      if (placed) this.setSelection(placed.map((i) => i.id));
    }
    this.cancelDuplicate();
    this.onAfterAction?.();
  }

  /** Leave duplicate-placement mode without placing anything — Escape
   *  (arbitrated centrally by main.ts) calls this directly. */
  cancelDuplicate(): void {
    this.duplicating = false;
    this.duplicateTemplates = [];
    this.lastDuplicateCell = null;
    this.controls.enabled = true;
    this.groupGhost.clear();
  }

  private onKeyDown(e: KeyboardEvent): void {
    // Don't steal keys while typing in the sidebar inputs.
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    if (e.key === "r" || e.key === "R") {
      if (this.duplicating) {
        // Rotate the duplicate ghost — single-template only (group re-pose is
        // out of scope, same as everywhere else).
        if (this.duplicateTemplates.length === 1) {
          this.duplicateTemplates[0].rotation = (this.duplicateTemplates[0].rotation + 1) % 4;
          this.groupGhost.begin(this.duplicateTemplates); // rebuild at the new pose
          this.refreshDuplicateGhost(this.lastDuplicateCell);
        } else {
          this.onNoopHint?.("Rotate works with a single duplicate only.");
        }
      } else if (this.moving && this.pressed) {
        // Rotate the in-flight move ghost — single-instance moves only (group
        // re-pose is out of scope; a group move-drag silently ignores R).
        if (this.dragIds && this.dragIds.size === 1) {
          this.moveRotation = (this.moveRotation + 1) % 4;
          this.ghost.setRotation(this.moveRotation);
          if (this.lastMoveOrigin) this.ghost.update(this.lastMoveOrigin, this.pressed.id);
        }
      } else if (this.selectedIds.size === 1 && !this.dragDrop.isDragging) {
        const id = [...this.selectedIds][0];
        this.store.rotate(id);
        this.onAfterAction?.();
      } else if (this.selectedIds.size > 1) {
        this.onNoopHint?.("Rotate works with a single selection only.");
      }
    } else if (e.key === "m" || e.key === "M") {
      if (this.duplicating) {
        if (this.duplicateTemplates.length === 1) {
          this.duplicateTemplates[0].mirrored = !this.duplicateTemplates[0].mirrored;
          this.groupGhost.begin(this.duplicateTemplates);
          this.refreshDuplicateGhost(this.lastDuplicateCell);
        } else {
          this.onNoopHint?.("Mirror works with a single duplicate only.");
        }
      } else if (this.moving && this.pressed) {
        if (this.dragIds && this.dragIds.size === 1) {
          this.moveMirrored = !this.moveMirrored;
          this.ghost.setMirror(this.moveMirrored);
          if (this.lastMoveOrigin) this.ghost.update(this.lastMoveOrigin, this.pressed.id);
        }
      } else if (this.selectedIds.size === 1 && !this.dragDrop.isDragging) {
        const id = [...this.selectedIds][0];
        this.store.mirror(id);
        this.onAfterAction?.();
      } else if (this.selectedIds.size > 1) {
        this.onNoopHint?.("Mirror works with a single selection only.");
      }
    } else if (e.key === "d" || e.key === "D") {
      // Duplicate the WHOLE selection (one instance or many). Bound to BOTH
      // Ctrl/Cmd+D and Shift+D:
      //  - Ctrl/Cmd+D is the requested binding; its keydown DOES reach page JS
      //    and `preventDefault()` DOES suppress the browser's bookmark shortcut
      //    (Ctrl+D is interceptable, unlike the OS-level Ctrl+T/N/W). Verified
      //    in a real browser (§6).
      //  - Shift+D stays as a guaranteed-reliable fallback (matches Blender's
      //    duplicate convention and this app's R/M single-key style), for any
      //    environment where a Ctrl+D keydown is swallowed before the page.
      // A bare 'd' with no modifier does nothing.
      if (!(e.ctrlKey || e.metaKey || e.shiftKey)) return;
      e.preventDefault(); // must win over the browser bookmark shortcut
      if (this.selectedIds.size >= 1 && !this.moving && !this.dragDrop.isDragging && !this.duplicating) {
        const insts = this.selectedInstances;
        if (insts.length > 0) this.startDuplicate(insts);
      }
    } else if (e.key === "Delete" || e.key === "Backspace") {
      if (this.selectedIds.size > 0 && !this.moving) {
        const ids = [...this.selectedIds];
        this.selectedIds.clear(); // about to be destroyed — nothing left to re-tint
        if (this.hoveredId && ids.includes(this.hoveredId)) this.hoveredId = null;
        this.store.removeMany(ids);
        this.onSelectionChange?.();
        this.onAfterAction?.();
      } else if (this.selectedEntranceId && !this.moving) {
        const id = this.selectedEntranceId;
        this.selectedEntranceId = null;
        this.entrances?.remove(id); // deletes marker + refreshes derived state
        this.onSelectionChange?.();
        this.onAfterAction?.();
      } else if (this.selectedDoorId && !this.moving) {
        const id = this.selectedDoorId;
        this.selectedDoorId = null;
        this.doors?.remove(id); // deletes door + closes its opening
        this.onSelectionChange?.();
        this.onAfterAction?.();
      }
    }
  }
}
