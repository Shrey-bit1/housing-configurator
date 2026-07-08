import * as THREE from "three";
import { Grid, type Cell } from "./grid";
import {
  MODULE_DEFS,
  occupiedCells,
  type ModuleDef,
  type ModuleType,
} from "./modules";
import { buildModuleMesh, setSelected } from "../scene/moduleMesh";

/** A placed module: its type, current pose, and its rendered group. */
export interface ModuleInstance {
  id: string;
  def: ModuleDef;
  origin: Cell;
  rotation: number;
  group: THREE.Group;
}

/**
 * Owns every placed module and is the one place that mutates both the grid
 * occupancy map and the scene graph together, keeping them in lock-step.
 * All placement / move / rotate / delete flows go through here.
 */
export class ModuleStore {
  readonly instances = new Map<string, ModuleInstance>();
  private nextId = 1;

  /** Fired after any change that can affect this floor's height (place/remove/
   *  move/reconcile). Used to recompute vertical floor stacking. */
  onChange?: () => void;

  /**
   * Optional extra placement constraint beyond grid occupancy, keyed on the def.
   * Used for cross-floor rules the grid alone can't see — e.g. a stair needs
   * clear floor plate on the floor ABOVE. Returns false to block. Set by the
   * FloorManager (which knows the floor stack). */
  extraPlacementCheck?: (def: ModuleDef, cells: Cell[]) => boolean;

  /** Wall height (world units) a new/rebuilt room shell should build its
   *  walls to — the floor's true floor-to-floor height. Set by FloorManager
   *  (which knows it); `buildModuleMesh` falls back to the def's own nominal
   *  height when this is unset. */
  wallHeightProvider?: () => number;

  /**
   * @param container the THREE container (a floor's group) meshes are added to,
   *   so the whole floor can be offset/dimmed by transforming that one group.
   */
  constructor(private container: THREE.Object3D, private grid: Grid) {}

  /** Groups for raycasting against placed modules. */
  get groups(): THREE.Group[] {
    return [...this.instances.values()].map((i) => i.group);
  }

  /** Tallest placed ROOM height in cells (furniture ignored); 0 if no rooms. */
  get maxRoomHeightCells(): number {
    let h = 0;
    for (const i of this.instances.values())
      if (i.def.category === "room") h = Math.max(h, i.def.height);
    return h;
  }

  /** Full placement validity for a def at `cells`: grid occupancy/bounds/holes
   *  plus any {@link extraPlacementCheck} (cross-floor stair rules). Shared by
   *  place/move and the ghost preview so all three agree. */
  canPlaceInstance(def: ModuleDef, cells: Cell[], excludeId?: string): boolean {
    if (!this.grid.canPlace(cells, excludeId)) return false;
    return this.extraPlacementCheck ? this.extraPlacementCheck(def, cells) : true;
  }

  /** Resolve a group (or any descendant's group) back to its instance. */
  instanceFromObject(obj: THREE.Object3D | null): ModuleInstance | null {
    let o = obj;
    while (o) {
      for (const inst of this.instances.values()) {
        if (inst.group === o) return inst;
      }
      o = o.parent;
    }
    return null;
  }

  /** Place a new module if the cells are free & in bounds. Returns it or null. */
  place(type: ModuleType, origin: Cell, rotation: number): ModuleInstance | null {
    const def = MODULE_DEFS[type];
    const cells = occupiedCells(def, origin, rotation);
    if (!this.canPlaceInstance(def, cells)) return null;

    const id = `m${this.nextId++}`;
    const group = buildModuleMesh(def, rotation, false, this.wallHeightProvider?.());
    group.position.copy(this.grid.gridToWorld(origin.cx, origin.cz));
    this.container.add(group);

    this.grid.occupy(cells, id);
    const inst: ModuleInstance = { id, def, origin, rotation, group };
    this.instances.set(id, inst);
    this.onChange?.();
    return inst;
  }

  /** Move + optionally re-rotate an instance. Returns true if it committed. */
  move(id: string, origin: Cell, rotation: number): boolean {
    const inst = this.instances.get(id);
    if (!inst) return false;

    const cells = occupiedCells(inst.def, origin, rotation);
    // Test against everything except this instance's own current footprint.
    if (!this.canPlaceInstance(inst.def, cells, id)) return false;

    this.grid.free(id);
    this.grid.occupy(cells, id);
    inst.origin = origin;

    if (rotation !== inst.rotation) {
      // Rebuild the mesh so cube layout matches the new rotation exactly.
      const prevMat = inst.group.userData.material as
        | THREE.MeshStandardMaterial
        | undefined;
      const selected = !!prevMat && prevMat.emissive.getHex() !== 0;
      this.container.remove(inst.group);
      inst.group = buildModuleMesh(inst.def, rotation, false, this.wallHeightProvider?.());
      this.container.add(inst.group);
      inst.rotation = rotation;
      if (selected) setSelected(inst.group, true);
    }
    inst.group.position.copy(this.grid.gridToWorld(origin.cx, origin.cz));
    this.onChange?.();
    return true;
  }

  /** Rotate in place about the origin cell. Returns true if it fit. */
  rotate(id: string): boolean {
    const inst = this.instances.get(id);
    if (!inst) return false;
    return this.move(id, inst.origin, (inst.rotation + 1) % 4);
  }

  /** Remove an instance and free its cells. */
  remove(id: string): void {
    const inst = this.instances.get(id);
    if (!inst) return;
    this.grid.free(id);
    this.container.remove(inst.group);
    this.instances.delete(id);
    this.onChange?.();
  }

  /**
   * Re-validate every instance after a grid resize. Any module whose footprint
   * now falls outside the (possibly smaller) grid is removed and its cells
   * freed; survivors are re-occupied and repositioned because the world origin
   * shifts when the grid dimensions change. Returns the ids that were culled.
   */
  reconcileAfterResize(): string[] {
    const culled: string[] = [];
    for (const inst of [...this.instances.values()]) {
      const cells = occupiedCells(inst.def, inst.origin, inst.rotation);
      const fits = cells.every((c) => this.grid.inBounds(c.cx, c.cz));
      if (!fits) {
        this.remove(inst.id);
        culled.push(inst.id);
      } else {
        // Re-occupy (occupancy survives resize, but be safe) and reposition.
        this.grid.occupy(cells, inst.id);
        inst.group.position.copy(this.grid.gridToWorld(inst.origin.cx, inst.origin.cz));
      }
    }
    return culled;
  }
}
