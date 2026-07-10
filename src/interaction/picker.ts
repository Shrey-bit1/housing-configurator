import * as THREE from "three";
import type { Grid, Cell } from "../core/grid";

/**
 * Shared raycasting helper. Converts pointer positions on the canvas into
 * either the hovered ground cell or the module group under the cursor.
 * Both drag-drop and selection go through this so the math lives in one place.
 */
export class Picker {
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: THREE.Camera,
    /** Active floor's grid — reassigned by the FloorManager on floor switch. */
    public grid: Grid,
    private groundPlane: THREE.Object3D
  ) {}

  /** Update internal NDC pointer from a DOM event. */
  private setPointer(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  /** The grid cell under the cursor (raycast onto the ground plane), or null. */
  cellAt(clientX: number, clientY: number): Cell | null {
    this.setPointer(clientX, clientY);
    const hit = this.raycaster.intersectObject(this.groundPlane, false)[0];
    if (!hit) return null;
    return this.grid.worldToGrid(hit.point.x, hit.point.z);
  }

  /** The world XZ point under the cursor on the ground plane, or null. Used by
   *  door placement to find which edge (and sub-cell side) the cursor is nearest,
   *  which `cellAt` alone (integer cell) can't express. */
  groundPoint(clientX: number, clientY: number): { x: number; z: number } | null {
    this.setPointer(clientX, clientY);
    const hit = this.raycaster.intersectObject(this.groundPlane, false)[0];
    if (!hit) return null;
    return { x: hit.point.x, z: hit.point.z };
  }

  /** The top-most module group hit under the cursor, or null. */
  groupAt(clientX: number, clientY: number, groups: THREE.Object3D[]): THREE.Object3D | null {
    if (groups.length === 0) return null;
    this.setPointer(clientX, clientY);
    const hits = this.raycaster.intersectObjects(groups, true);
    return hits.length ? hits[0].object : null;
  }
}
