import * as THREE from "three";
import type { Grid, Cell } from "../core/grid";
import type { ModuleStore } from "../core/store";
import { occupiedCells, type ModuleDef } from "../core/modules";
import { buildModuleMesh, setGhostValidity } from "./moduleMesh";

/**
 * The translucent preview shown while dragging a module (either from the
 * palette or when moving a placed module). Knows how to snap itself to a cell
 * and colour itself green/red based on placement validity.
 */
export class GhostPreview {
  private group: THREE.Group | null = null;
  private def: ModuleDef | null = null;
  private rotation = 0;

  /** Parent container (the active floor's group), grid, and store — all swapped
   *  by the FloorManager when the active floor changes so the ghost previews on
   *  it (the store supplies cross-floor placement validity, e.g. for stairs). */
  constructor(
    public parent: THREE.Object3D,
    public grid: Grid,
    public store: ModuleStore
  ) {}

  /** Begin previewing `def` at the given rotation. */
  begin(def: ModuleDef, rotation = 0): void {
    this.clear();
    this.def = def;
    this.rotation = rotation;
    this.group = buildModuleMesh(def, rotation, true);
    this.group.visible = false;
    this.parent.add(this.group);
  }

  get isActive(): boolean {
    return this.group !== null;
  }

  setRotation(rotation: number): void {
    if (!this.def) return;
    this.rotation = rotation;
    this.begin(this.def, rotation);
  }

  get currentRotation(): number {
    return this.rotation;
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
    this.group.position.copy(world);

    const cells = occupiedCells(this.def, origin, this.rotation);
    const valid = this.store.canPlaceInstance(this.def, cells, excludeId);
    setGhostValidity(this.group, valid);
    return valid;
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
  }
}
