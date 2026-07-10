import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Floor } from "../core/floor";
import { CELL_SIZE, cellKey, type Cell } from "../core/grid";
import { SIDE_DELTA, type Side } from "../core/exteriorEdges";
import { doorEdges, doorId, doorOverlaps, resolveDoorSpaces, type Door } from "../core/door";
import { makeDoorMesh } from "../scene/doorView";
import type { Picker } from "./picker";

const VALID = 0x4fd08a; // green
const INVALID = 0xff5d5d; // red

/**
 * Places interior doors. The user picks the Door tool, then hovers a SHARED
 * interior boundary; a 2-edge ghost slides along the wall nearest the cursor,
 * green where it binds two distinct spaces (a valid door), red otherwise
 * (exterior edge, or a boundary that isn't a straight 2-cell span of the same
 * two spaces). A click commits a valid door; misses do nothing.
 *
 * Doors live on ANY floor — placement is always on the ACTIVE floor (`getFloor`),
 * whose door targets (`getTargets`, incl. stair holes projected up from the floor
 * below) decide validity. Escape is arbitrated centrally by main.ts, which calls
 * {@link cancel} directly rather than this class listening for Escape itself.
 */
export class DoorController {
  private activeMode = false;
  private preview: THREE.Mesh | null = null;
  private candidate: { door: Door; valid: boolean } | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private picker: Picker,
    private controls: OrbitControls,
    private getFloor: () => Floor,
    /** Cell → space token for the active floor (FloorManager.doorTargets). */
    private getTargets: () => Map<string, string>,
    private onPlaced: () => void
  ) {
    window.addEventListener("pointermove", (e) => this.onMove(e));
    window.addEventListener("pointerup", (e) => this.onUp(e));
  }

  get isActive(): boolean {
    return this.activeMode;
  }

  /** Enter door-placement mode. */
  start(): void {
    this.activeMode = true;
    this.candidate = null;
    this.controls.enabled = false;
  }

  /**
   * The candidate 2-edge door for the cursor: snap to the cell-boundary nearest
   * the cursor that borders at least one space, extend the second edge toward the
   * cursor along that wall, and test validity. Returns null only when the cursor
   * is off-canvas or in open field (no adjacent space on any side).
   */
  private candidateAt(clientX: number, clientY: number): { door: Door; valid: boolean } | null {
    const pt = this.picker.groundPoint(clientX, clientY);
    if (!pt) return null;
    const grid = this.getFloor().grid;
    const cell = grid.worldToGrid(pt.x, pt.z);
    const center = grid.gridToWorld(cell.cx, cell.cz);
    const H = CELL_SIZE / 2;
    const fx = (pt.x - (center.x - H)) / CELL_SIZE; // 0..1 within the cell
    const fz = (pt.z - (center.z - H)) / CELL_SIZE;

    const targets = this.getTargets();
    const targetAt = (cx: number, cz: number) => targets.get(cellKey(cx, cz)) ?? null;

    // Sides ordered by proximity to the cursor (a door snaps to the nearest wall).
    const bySide: [Side, number][] = [
      ["north", fz],
      ["south", 1 - fz],
      ["west", fx],
      ["east", 1 - fx],
    ];
    bySide.sort((a, b) => a[1] - b[1]);

    for (const [side] of bySide) {
      const door = this.doorForSide(cell, side, fx, fz);
      // Only offer a door where a space borders at least one of its edges, so the
      // ghost never floats in empty field (but DO show red on exterior/one-sided
      // boundaries so the user gets "can't place here" feedback near a wall).
      const bordersSpace = doorEdges(door).some((e) => {
        const [dx, dz] = SIDE_DELTA[e.side];
        return targetAt(e.cx, e.cz) !== null || targetAt(e.cx + dx, e.cz + dz) !== null;
      });
      if (!bordersSpace) continue;
      // Valid = binds two distinct spaces AND doesn't overlap an existing door
      // (no boundary carries two doors; red ghost + no-commit on an overlap).
      const valid =
        resolveDoorSpaces(door, targetAt) !== null && !doorOverlaps(door, this.getFloor().doors);
      return { door, valid };
    }
    return null;
  }

  /** Build the 2-edge door on `side`, extending the second edge toward whichever
   *  half of the cell the cursor is in (so it slides as the cursor moves). The
   *  anchor is always the lower-index end of the span. */
  private doorForSide(cell: Cell, side: Side, fx: number, fz: number): Door {
    const runX = side === "north" || side === "south";
    let anchor: Cell;
    if (runX) anchor = fx < 0.5 ? { cx: cell.cx - 1, cz: cell.cz } : { cx: cell.cx, cz: cell.cz };
    else anchor = fz < 0.5 ? { cx: cell.cx, cz: cell.cz - 1 } : { cx: cell.cx, cz: cell.cz };
    return { id: doorId(anchor, side), cell: anchor, side };
  }

  private onMove(e: PointerEvent): void {
    if (!this.activeMode) return;
    this.candidate = this.overCanvas(e) ? this.candidateAt(e.clientX, e.clientY) : null;
    this.showPreview();
  }

  private onUp(e: PointerEvent): void {
    if (!this.activeMode) return;
    const cand = this.overCanvas(e) ? this.candidateAt(e.clientX, e.clientY) : null;
    if (cand && cand.valid) {
      this.getFloor().addDoor(cand.door.cell, cand.door.side);
      this.onPlaced();
    }
    this.cancel();
  }

  private showPreview(): void {
    this.clearPreview();
    if (!this.candidate) return;
    const floor = this.getFloor();
    const mesh = makeDoorMesh(floor.grid, this.candidate.door, true);
    (mesh.userData.material as THREE.MeshStandardMaterial).color.setHex(
      this.candidate.valid ? VALID : INVALID
    );
    this.preview = mesh;
    floor.group.add(mesh);
  }

  private clearPreview(): void {
    if (this.preview) {
      this.preview.removeFromParent();
      this.preview.geometry.dispose();
      (this.preview.material as THREE.Material).dispose();
      this.preview = null;
    }
  }

  /** Leave placement mode (placement done or backed out via the central Escape
   *  arbitrator). Public so that handler can call it directly. */
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
