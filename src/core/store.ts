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
  /** Left/right flip of the footprint (mirror across local X, applied BEFORE
   *  rotation — see {@link occupiedCells}). Default false; chiral shapes
   *  (L-rooms, the dogleg stair) use it to reach their other handedness. */
  mirrored: boolean;
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
   *  place/move and the ghost preview so all three agree. `excludeId` may be a
   *  Set for a group move, excluding every moving member at once. */
  canPlaceInstance(def: ModuleDef, cells: Cell[], excludeId?: string | Set<string>): boolean {
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
  place(
    type: ModuleType,
    origin: Cell,
    rotation: number,
    mirrored = false
  ): ModuleInstance | null {
    const def = MODULE_DEFS[type];
    const cells = occupiedCells(def, origin, rotation, mirrored);
    if (!this.canPlaceInstance(def, cells)) return null;

    const id = `m${this.nextId++}`;
    const group = buildModuleMesh(def, rotation, false, this.wallHeightProvider?.(), mirrored);
    group.position.copy(this.grid.gridToWorld(origin.cx, origin.cz));
    this.container.add(group);

    this.grid.occupy(cells, id);
    const inst: ModuleInstance = { id, def, origin, rotation, mirrored, group };
    this.instances.set(id, inst);
    this.onChange?.();
    return inst;
  }

  /** Move + optionally re-pose (rotation and/or mirror) an instance. Returns
   *  true if it committed. `mirrored` defaults to the instance's current flip
   *  so a plain drag/move preserves handedness. */
  move(id: string, origin: Cell, rotation: number, mirrored?: boolean): boolean {
    const inst = this.instances.get(id);
    if (!inst) return false;
    const nextMirrored = mirrored ?? inst.mirrored;

    const cells = occupiedCells(inst.def, origin, rotation, nextMirrored);
    // Test against everything except this instance's own current footprint.
    if (!this.canPlaceInstance(inst.def, cells, id)) return false;

    this.grid.free(id);
    this.grid.occupy(cells, id);
    inst.origin = origin;

    if (rotation !== inst.rotation || nextMirrored !== inst.mirrored) {
      // Rebuild the mesh so cube/wall/prop layout matches the new pose exactly.
      // (Both rotation and mirror are baked into the geometry — never a group
      // transform — so a mesh rebuild is the only way to reflect a mirror flip.)
      const prevMat = inst.group.userData.material as
        | THREE.MeshStandardMaterial
        | undefined;
      const selected = !!prevMat && prevMat.emissive.getHex() !== 0;
      this.container.remove(inst.group);
      inst.group = buildModuleMesh(
        inst.def, rotation, false, this.wallHeightProvider?.(), nextMirrored
      );
      this.container.add(inst.group);
      inst.rotation = rotation;
      inst.mirrored = nextMirrored;
      if (selected) setSelected(inst.group, true);
    }
    inst.group.position.copy(this.grid.gridToWorld(origin.cx, origin.cz));
    this.onChange?.();
    return true;
  }

  /** Rotate in place about the origin cell (preserving mirror). Returns true if
   *  it fit. */
  rotate(id: string): boolean {
    const inst = this.instances.get(id);
    if (!inst) return false;
    return this.move(id, inst.origin, (inst.rotation + 1) % 4);
  }

  /** Flip the instance's handedness in place, pivoting about its ORIGIN cell
   *  (the same pivot rotation uses). Collision-checked via {@link move} — if the
   *  mirrored footprint doesn't fit, nothing changes and it returns false. */
  mirror(id: string): boolean {
    const inst = this.instances.get(id);
    if (!inst) return false;
    return this.move(id, inst.origin, inst.rotation, !inst.mirrored);
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

  /** Remove several instances as ONE action (single `onChange`, so downstream
   *  rebuilds — clusters, walls, stack — run once instead of per-id). Used by
   *  group delete. */
  removeMany(ids: Iterable<string>): void {
    for (const id of ids) {
      const inst = this.instances.get(id);
      if (!inst) continue;
      this.grid.free(id);
      this.container.remove(inst.group);
      this.instances.delete(id);
    }
    this.onChange?.();
  }

  /**
   * Move several instances RIGIDLY as one atomic action (a group move):
   * rotation/mirror are never touched here (group re-pose is out of scope), so
   * this is always a cheap position update, never a mesh rebuild. Every move is
   * validated first — with ALL moving ids excluded from occupancy, so members
   * can shuffle into each other's currently-occupied (about-to-be-vacated)
   * cells, e.g. swapping two adjacent rooms in a single gesture — and if ANY
   * member's target is invalid, NOTHING moves (all-or-nothing). On success,
   * every member's CURRENT footprint is freed first, then every member's NEW
   * footprint is occupied — so the free/occupy passes never race each other
   * regardless of how the moving set's positions overlap.
   */
  moveMany(moves: { id: string; origin: Cell }[]): boolean {
    const ids = new Set(moves.map((m) => m.id));
    const resolved: { inst: ModuleInstance; origin: Cell; cells: Cell[] }[] = [];
    for (const { id, origin } of moves) {
      const inst = this.instances.get(id);
      if (!inst) return false;
      const cells = occupiedCells(inst.def, origin, inst.rotation, inst.mirrored);
      if (!this.canPlaceInstance(inst.def, cells, ids)) return false;
      resolved.push({ inst, origin, cells });
    }
    for (const { inst } of resolved) this.grid.free(inst.id);
    for (const { inst, origin, cells } of resolved) {
      this.grid.occupy(cells, inst.id);
      inst.origin = origin;
      inst.group.position.copy(this.grid.gridToWorld(origin.cx, origin.cz));
    }
    this.onChange?.();
    return true;
  }

  /**
   * Place several NEW instances as one atomic action (a group duplicate):
   * validates every target's cells first — no exclusion is needed since none
   * of these ids exist yet — and if ANY is invalid, NOTHING is placed. (A
   * rigid translation of an already-non-overlapping template set can never
   * introduce a NEW overlap between the batch's own members, so only
   * EXISTING occupancy needs checking.) `onChange` is suppressed during the
   * loop and fired once at the end, so downstream rebuilds (clusters, walls,
   * stack) run once instead of per-item — same batching shape as
   * {@link moveMany}/{@link removeMany}. Returns the placed instances, or
   * null if the batch was rejected (nothing placed).
   */
  placeMany(
    items: { type: ModuleType; origin: Cell; rotation: number; mirrored: boolean }[]
  ): ModuleInstance[] | null {
    const defs = items.map((i) => MODULE_DEFS[i.type]);
    const cellsList = items.map((i, idx) => occupiedCells(defs[idx], i.origin, i.rotation, i.mirrored));
    for (let idx = 0; idx < items.length; idx++) {
      if (!this.canPlaceInstance(defs[idx], cellsList[idx])) return null;
    }
    const savedOnChange = this.onChange;
    this.onChange = undefined;
    const placed: ModuleInstance[] = [];
    try {
      for (const item of items) {
        const inst = this.place(item.type, item.origin, item.rotation, item.mirrored);
        if (inst) placed.push(inst); // always succeeds — pre-validated above
      }
    } finally {
      this.onChange = savedOnChange;
    }
    this.onChange?.();
    return placed;
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
      const cells = occupiedCells(inst.def, inst.origin, inst.rotation, inst.mirrored);
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
