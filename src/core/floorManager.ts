import * as THREE from "three";
import { CELL_SIZE, type Grid } from "./grid";
import { Floor } from "./floor";
import type { Picker } from "../interaction/picker";
import type { GhostPreview } from "../scene/ghostPreview";
import type { DragDropController } from "../interaction/dragDrop";
import type { SelectionController } from "../interaction/selection";
import { markCutawayDirty } from "../scene/cutaway";
import { rebuildClusterShells } from "../scene/clusterShells";

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
    floor.store.onChange = () => {
      this.recomputeStack();
      rebuildClusterShells(floor, floor.grid); // connector clusters may have changed
      markCutawayDirty(); // walls may have been added/removed/rebuilt
    };
    this.scene.add(floor.group);
    this.floors.push(floor);
    return floor;
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
}
