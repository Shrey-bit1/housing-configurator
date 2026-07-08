import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Floor } from "../core/floor";
import { opposite, SIDE_DELTA, type Side } from "../core/exteriorEdges";
import { makeEntranceMesh } from "../scene/entranceView";
import type { Picker } from "./picker";

/**
 * Places ground-floor entrances. The user picks the Entrance tool, then clicks
 * an EMPTY cell just outside a room/cluster's exterior wall; the entrance binds
 * to that wall edge (the room cell + the side facing the clicked cell). A green
 * ghost previews valid edges; red/none means no exterior wall there.
 *
 * Only floor 0 hosts entrances — `getFloor` always returns the ground floor and
 * the caller guarantees it's active before {@link start}.
 *
 * Escape is arbitrated centrally by main.ts's keydown handler (so cancelling
 * placement mode never fires alongside clearing a selection or exiting plan
 * mode in the same keypress) — it calls {@link cancel} directly rather than
 * this class listening for Escape itself.
 */
export class EntranceController {
  private activeMode = false;
  private preview: THREE.Mesh | null = null;
  private candidate: { cell: { cx: number; cz: number }; side: Side } | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private picker: Picker,
    private controls: OrbitControls,
    private getFloor: () => Floor,
    private onPlaced: () => void
  ) {
    window.addEventListener("pointermove", (e) => this.onMove(e));
    window.addEventListener("pointerup", (e) => this.onUp(e));
  }

  get isActive(): boolean {
    return this.activeMode;
  }

  /** Enter entrance-placement mode. */
  start(): void {
    this.activeMode = true;
    this.candidate = null;
    this.controls.enabled = false;
  }

  /**
   * Exterior edge to attach to for the cell under the cursor: the clicked cell
   * must be empty, and a neighbour must be a room/cluster — the edge is on that
   * neighbour, facing back toward the clicked cell.
   */
  private edgeAt(clientX: number, clientY: number): { cell: { cx: number; cz: number }; side: Side } | null {
    const floor = this.getFloor();
    const cell = this.picker.cellAt(clientX, clientY);
    if (!cell) return null;
    // Clicked cell must not itself be a room/cluster (we attach from outside).
    if (this.roomClusterOwner(floor, cell.cx, cell.cz)) return null;

    for (const side of ["north", "south", "east", "west"] as Side[]) {
      const [dx, dz] = SIDE_DELTA[side];
      const owner = this.roomClusterOwner(floor, cell.cx + dx, cell.cz + dz);
      if (owner) return { cell: { cx: cell.cx + dx, cz: cell.cz + dz }, side: opposite(side) };
    }
    return null;
  }

  /** The room/cluster instance id owning (cx,cz), if any (furniture/stairs ignored). */
  private roomClusterOwner(floor: Floor, cx: number, cz: number): string | undefined {
    const id = floor.grid.ownerAt(cx, cz);
    if (!id) return undefined;
    const inst = floor.store.instances.get(id);
    return inst && inst.def.category === "room" ? id : undefined;
  }

  private onMove(e: PointerEvent): void {
    if (!this.activeMode) return;
    this.candidate = this.overCanvas(e) ? this.edgeAt(e.clientX, e.clientY) : null;
    this.showPreview();
  }

  private onUp(e: PointerEvent): void {
    if (!this.activeMode) return;
    const cand = this.overCanvas(e) ? this.edgeAt(e.clientX, e.clientY) : null;
    if (cand) {
      this.getFloor().addEntrance(cand.cell, cand.side);
      this.onPlaced();
    }
    this.cancel();
  }

  private showPreview(): void {
    this.clearPreview();
    if (!this.candidate) return;
    const floor = this.getFloor();
    this.preview = makeEntranceMesh(floor.grid, this.candidate.cell, this.candidate.side, true);
    floor.group.add(this.preview);
  }

  private clearPreview(): void {
    if (this.preview) {
      this.preview.removeFromParent();
      this.preview.geometry.dispose();
      (this.preview.material as THREE.Material).dispose();
      this.preview = null;
    }
  }

  /** Leave placement mode, whether a placement just succeeded or the user
   *  backed out (Escape, arbitrated centrally by main.ts). Public so that
   *  central handler can call it directly. */
  cancel(): void {
    this.activeMode = false;
    this.candidate = null;
    this.clearPreview();
    this.controls.enabled = true;
  }

  private overCanvas(e: PointerEvent): boolean {
    const r = this.canvas.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }
}
