import * as THREE from "three";
import { CELL_SIZE, type Grid, type Cell } from "./grid";
import { Floor } from "./floor";
import { MODULE_DEFS, occupiedCells, type ModuleDef } from "./modules";
import type { ProjectFile } from "./projectIO";
import type { Picker } from "../interaction/picker";
import type { GhostPreview } from "../scene/ghostPreview";
import type { DragDropController } from "../interaction/dragDrop";
import type { SelectionController } from "../interaction/selection";
import { markCutawayDirty } from "../scene/cutaway";
import { rebuildClusterShells } from "../scene/clusterShells";
import { REFERENCE_STAIR_RISE } from "../scene/stairMesh";

/** Height (cells) assumed for a floor with no rooms yet, so spacing is stable. */
const DEFAULT_FLOOR_CELLS = 4;
/** Clearance above each floor's tallest room — the slab gap between floors. */
const CLEARANCE_CELLS = 1;

interface FloorDeps {
  picker: Picker;
  ghost: GhostPreview;
  dragDrop: DragDropController;
  selection: SelectionController;
  groundPlane: THREE.Object3D;
  /** Re-fit the raycast ground plane to the given (active) grid. */
  sizeGroundPlane: (grid: Grid) => void;
}

/**
 * Owns the stack of {@link Floor}s, the active-floor concept, and vertical
 * stacking. Exactly one floor is active (interactive); the rest render dimmed.
 *
 * Floor spacing is recomputed live: whenever a floor's contents change its
 * store fires `onChange`, which re-runs {@link recomputeStack}. A floor's
 * height = its tallest placed ROOM (default {@link DEFAULT_FLOOR_CELLS} when
 * empty) + {@link CLEARANCE_CELLS} slab gap.
 */
export class FloorManager {
  readonly floors: Floor[] = [];
  private activeIndex = 0;
  private nextId = 0;
  private deps!: FloorDeps;
  /** Fired after any floor's contents change (place/move/rotate/delete/reconcile).
   *  Used to invalidate a stale rules-validation report. */
  onLayoutChange?: (floor: Floor) => void;
  /** Fired when the floor STACK changes structurally (a stair auto-created a
   *  floor above). Lets main rebuild the sidebar floor tabs. */
  onStructureChange?: () => void;
  /** Re-entrancy guard for {@link syncStairsAndHoles}. */
  private syncing = false;

  constructor(
    private scene: THREE.Scene,
    private defaultCols: number,
    private defaultRows: number
  ) {
    // Floor 0 exists immediately so controllers can bind to its grid/store.
    this.createFloor(defaultCols, defaultRows);
  }

  /** Wire the interaction layer and activate floor 0. Call once after the
   *  controllers (which depend on floor 0's grid/store) are constructed. */
  attach(deps: FloorDeps): void {
    this.deps = deps;
    this.setActive(0);
  }

  get active(): Floor {
    return this.floors[this.activeIndex];
  }

  get activeIndexValue(): number {
    return this.activeIndex;
  }

  private createFloor(cols: number, rows: number): Floor {
    const floor = new Floor(this.nextId++, cols, rows);
    // A stair needs clear floor plate on the floor ABOVE to open into — the grid
    // alone can't see that, so the store consults the stack here. The topmost
    // floor is always allowed (a floor above is auto-created on placement).
    floor.store.extraPlacementCheck = (def: ModuleDef, cells: Cell[]) => {
      if (def.category !== "stair") return true;
      const above = this.floorAbove(floor);
      return above ? above.grid.plateAvailable(cells) : true;
    };
    floor.store.onChange = () => {
      rebuildClusterShells(floor, floor.grid); // connector clusters may have changed
      this.syncStairsAndHoles(); // also recomputes the vertical stack + stair rises
      markCutawayDirty(); // walls may have been added/removed/rebuilt
      this.onLayoutChange?.(floor);
    };
    this.scene.add(floor.group);
    this.floors.push(floor);
    return floor;
  }

  /** The floor directly above `floor` in the stack, or null if it's topmost. */
  floorAbove(floor: Floor): Floor | null {
    const i = this.floors.indexOf(floor);
    return i >= 0 && i + 1 < this.floors.length ? this.floors[i + 1] : null;
  }

  /** Absolute cells occupied by all stairs on `floor` (their footprints). */
  private stairCells(floor: Floor): Cell[] {
    const out: Cell[] = [];
    for (const inst of floor.store.instances.values())
      if (inst.def.category === "stair")
        out.push(...occupiedCells(inst.def, inst.origin, inst.rotation));
    return out;
  }

  /**
   * Reconcile everything derived from stairs: auto-create a floor above the top
   * one if it now holds a stair, recompute every floor's stairwell holes (each
   * floor's holes = the stairs on the floor directly below, projected straight
   * up), restack, and rescale stair geometry to each floor's height. Idempotent
   * and re-entrancy-guarded; safe to call from any store change or after resize.
   */
  syncStairsAndHoles(): void {
    if (this.syncing) return;
    this.syncing = true;

    let structureChanged = false;
    const top = this.floors[this.floors.length - 1];
    if (this.stairCells(top).length > 0) {
      // Topmost floor has a stair with nowhere to go — give it a floor above,
      // inheriting the grid size so the projected hole cell is guaranteed.
      this.createFloor(top.grid.cols, top.grid.rows);
      structureChanged = true;
    }

    for (let j = 0; j < this.floors.length; j++) {
      const below = j > 0 ? this.floors[j - 1] : null;
      this.floors[j].setHoles(below ? this.stairCells(below) : []);
    }

    this.recomputeStack();
    this.updateStairScales();

    if (structureChanged) {
      this.applyDim(); // the new floor renders dimmed (inactive)
      this.onStructureChange?.();
    }
    markCutawayDirty();
    this.syncing = false;
  }

  /** Scale each stair's geometry so its rise matches its floor's actual height
   *  (built at {@link REFERENCE_STAIR_RISE}); ≈1 unless the floor holds a tall
   *  room. Cheap; rebuilt stair groups (on rotate) get re-scaled here too. */
  private updateStairScales(): void {
    for (const floor of this.floors) {
      const scale = this.floorHeight(floor) / REFERENCE_STAIR_RISE;
      for (const inst of floor.store.instances.values())
        if (inst.def.category === "stair") inst.group.scale.y = scale;
    }
  }

  /** Add a floor above the topmost one, inheriting its grid size; activate it. */
  addFloor(): void {
    const top = this.floors[this.floors.length - 1];
    this.createFloor(top.grid.cols, top.grid.rows);
    this.setActive(this.floors.length - 1);
  }

  /** Delete the active floor (never the last one). Floors above shift down. */
  deleteFloor(): void {
    if (this.floors.length <= 1) return;
    const [removed] = this.floors.splice(this.activeIndex, 1);
    // Clamp before disposing so any onChange during disposal sees a valid active.
    this.activeIndex = Math.min(this.activeIndex, this.floors.length - 1);
    this.disposeFloor(removed);
    // Holes/stairs may now be stale (a stair lost its floor above, or a floor's
    // hole source is gone); reconcile. If a stair is left on the new top floor,
    // this re-creates a floor above it (a stair always needs a destination).
    this.syncStairsAndHoles();
    this.setActive(this.activeIndex);
  }

  private disposeFloor(floor: Floor): void {
    floor.store.onChange = undefined; // avoid stack-recompute churn while clearing
    for (const id of [...floor.store.instances.keys()]) floor.store.remove(id);
    this.scene.remove(floor.group);
  }

  /** Make floor `index` the active/interactive one; rebind input + ghost to it. */
  setActive(index: number): void {
    this.deps.selection.deselect();
    this.deps.ghost.clear();
    this.activeIndex = Math.max(0, Math.min(index, this.floors.length - 1));

    const f = this.active;
    this.deps.picker.grid = f.grid;
    this.deps.dragDrop.store = f.store;
    this.deps.selection.store = f.store;
    this.deps.ghost.grid = f.grid;
    this.deps.ghost.parent = f.group;
    this.deps.ghost.store = f.store; // cross-floor stair validity for the ghost
    this.deps.sizeGroundPlane(f.grid);

    this.applyDim();
    this.recomputeStack();
  }

  private applyDim(): void {
    this.floors.forEach((f, i) => f.setDimmed(i !== this.activeIndex));
  }

  /** Floor height in world units: tallest room (or default) + slab clearance. */
  private floorHeight(floor: Floor): number {
    const base = Math.max(DEFAULT_FLOOR_CELLS, floor.store.maxRoomHeightCells);
    return (base + CLEARANCE_CELLS) * CELL_SIZE;
  }

  /** Stack floors bottom-up; park the ground raycast plane on the active floor. */
  recomputeStack(): void {
    let y = 0;
    for (const f of this.floors) {
      f.group.position.y = y;
      y += this.floorHeight(f);
    }
    this.deps.groundPlane.position.y = this.active.group.position.y;
  }

  /** Default grid size for new floors / reset (mirrors the app default). */
  get defaults(): { cols: number; rows: number } {
    return { cols: this.defaultCols, rows: this.defaultRows };
  }

  /**
   * Replace the entire floor stack with a loaded project. Tears down all
   * existing floors, rebuilds them in order, and re-places every saved instance
   * through the SAME {@link ModuleStore.place} path manual placement uses — so a
   * loaded design is byte-for-byte the same scene/occupancy/derived state (props,
   * shells, clusters all rebuild via the store's `onChange`) as a hand-built one.
   *
   * Unknown types (e.g. a room type added in a newer app version) are skipped
   * gracefully rather than crashing. Assumes `data` is already validated /
   * normalized by {@link import("./projectIO").parseProject}.
   */
  loadProject(data: ProjectFile): void {
    for (const f of [...this.floors]) this.disposeFloor(f);
    this.floors.length = 0;
    this.activeIndex = 0;

    const floorsData = data.floors.length
      ? data.floors
      : [{ cols: this.defaultCols, rows: this.defaultRows, instances: [], entrances: [] }];

    // Create ALL floors first, THEN place instances — so a stair on floor N sees
    // the (saved) floor N+1 already present and doesn't spuriously auto-create a
    // duplicate. Holes + stair rises rebuild reactively via store.onChange.
    const created = floorsData.map((fd) => this.createFloor(fd.cols, fd.rows));
    created.forEach((floor, k) => {
      for (const inst of floorsData[k].instances) {
        if (!MODULE_DEFS[inst.type]) {
          console.warn(`Skipping unknown module type "${inst.type}" while loading.`);
          continue;
        }
        floor.store.place(inst.type, { cx: inst.cx, cz: inst.cz }, inst.rotation);
      }
      // Entrances are derived only from save data (not the store); restore them.
      for (const ent of floorsData[k].entrances)
        floor.addEntrance({ cx: ent.cx, cz: ent.cz }, ent.side);
    });

    this.setActive(0);
  }
}
