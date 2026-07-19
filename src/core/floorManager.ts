import * as THREE from "three";
import { CELL_SIZE, cellKey, type Grid, type Cell } from "./grid";
import { Floor } from "./floor";
import { MODULE_DEFS, occupiedCells, type ModuleDef } from "./modules";
import type { ProjectFile } from "./projectIO";
import { edgeKey, parseEdgeKey } from "./exteriorEdges";
import { computeWindows, type WindowVariant } from "./windows";
import {
  buildSpaceTargets,
  doorWallCuts,
  resolveDoorSpaces,
  type Door,
} from "./door";
import type { Picker } from "../interaction/picker";
import type { GhostPreview } from "../scene/ghostPreview";
import type { GroupGhostPreview } from "../scene/groupGhostPreview";
import type { DragDropController } from "../interaction/dragDrop";
import type { SelectionController } from "../interaction/selection";
import { markCutawayDirty } from "../scene/cutaway";
import { rebuildClusterShells } from "../scene/clusterShells";
import { rebuildRoomWalls } from "../scene/moduleMesh";
import { REFERENCE_STAIR_RISE } from "../scene/stairMesh";

/** Height (cells) assumed for a floor with no rooms yet, so spacing is stable. */
const DEFAULT_FLOOR_CELLS = 4;
/** Clearance above each floor's tallest room, added to reach the floor-to-floor
 *  height — this is also how far room/cluster walls now rise above the tallest
 *  room's nominal height, so they still meet the plate above with no gap. */
const CLEARANCE_CELLS = 1;

interface FloorDeps {
  picker: Picker;
  ghost: GhostPreview;
  /** Multi-instance ghost for a GROUP move (selection.ts) — kept in sync with
   *  the active floor exactly like `ghost`. */
  groupGhost: GroupGhostPreview;
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
  /** Project-level north direction, in degrees (see core/orientation.ts): the
   *  north vector is world −Z rotated clockwise (viewed from above) by this.
   *  Serialized (design state — it moves windows); biases window generation
   *  toward south and drives OR1 + the orientation report. Mutate via
   *  {@link setNorthAngle} so windows re-derive. */
  northAngle = 0;
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
    // A new/rebuilt room shell builds its walls directly at the floor's true
    // height — no post-build rescale (see rebuildWalls()).
    floor.store.wallHeightProvider = () => this.floorHeight(floor);
    floor.store.onChange = () => {
      // syncStairsAndHoles → rebuildAllShells rebuilds BOTH connector clusters
      // and room walls (with doors + windows) across every floor, prunes any
      // door a layout change just invalidated, and recomputes the stack + stair
      // rises. All synchronous, before the action's history commit — so a pruned
      // stale door lands in the SAME undo snapshot as the move that stranded it.
      this.syncStairsAndHoles();
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

  /** The floor directly below `floor` in the stack, or null if it's the ground.
   *  A stair on the floor below projects a hole up into this floor, which upper
   *  rooms can door onto — so door target/validity needs it. */
  floorBelow(floor: Floor): Floor | null {
    const i = this.floors.indexOf(floor);
    return i > 0 ? this.floors[i - 1] : null;
  }

  /** Absolute cells occupied by all stairs on `floor` (their footprints). */
  private stairCells(floor: Floor): Cell[] {
    const out: Cell[] = [];
    for (const inst of floor.store.instances.values())
      if (inst.def.category === "stair")
        out.push(...occupiedCells(inst.def, inst.origin, inst.rotation, inst.mirrored));
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

    this.pruneStaleDoors();
    this.recomputeStack();
    this.updateStairScales();
    this.rebuildAllShells();

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

  /** Rebuild every floor's SHELLS — merged connector clusters AND per-room wall
   *  meshes (in place — floor slab and props untouched, see
   *  {@link rebuildRoomWalls}) — extruded directly at that floor's true
   *  floor-to-floor height ({@link floorHeight}), not just their own room's
   *  nominal height, closing the gap to the plate above with real geometry (no
   *  scale hack). On the same pass it (re)generates:
   *   - DERIVED WINDOWS: which exterior edges are glazed, recomputed from room
   *     type + exterior edges ({@link computeWindows}), stashed on
   *     `floor.windowStats` for the W1 rule.
   *   - AUTHORED DOOR OPENINGS: each door cuts a 2100 mm opening in BOTH
   *     adjacent spaces' wall segments — room segments via LOCAL door edges,
   *     cluster segments via ABSOLUTE door edges ({@link doorWallCuts}).
   *  Both room walls AND cluster shells rebuild across ALL floors on every
   *  change (clusters are cheap) so a door referencing a stair on the floor
   *  below re-cuts correctly when that stair moves. Stairs are intentionally
   *  excluded — their scale-driven rise is unrelated (see
   *  {@link updateStairScales}). */
  private rebuildAllShells(): void {
    this.floors.forEach((floor, fi) => {
      const height = this.floorHeight(floor);
      const { rooms: roomDoors, clusters: clusterDoors } = this.doorWallSets(floor);

      // Merged connector clusters (Circulation / Outdoor), with any door openings.
      rebuildClusterShells(floor, floor.grid, height, clusterDoors);

      // The floor's occupied set — what makes an edge "exterior" (open sky) for
      // window generation. Sourced from the SAME `buildSpaceTargets` map the door
      // system + adjacency graph use (rooms + clusters + this-floor stairs + the
      // stair-HOLE PROJECTIONS from the floor below), so a room bordering the
      // stairwell void never windows onto it. One source of truth per convention.
      const occupied = new Set(buildSpaceTargets(floor, this.floorBelow(floor)).keys());
      // Entrance edges (floor 0 only) are skipped by windows — a door wins there.
      const entranceEdges = new Set(
        fi === 0 ? floor.entrances.map((e) => edgeKey(e.cell.cx, e.cell.cz, e.side)) : []
      );

      floor.windowStats.clear();
      for (const inst of floor.store.instances.values()) {
        if (inst.def.category !== "room" || inst.def.cluster) continue; // shells only
        const cells = occupiedCells(inst.def, inst.origin, inst.rotation, inst.mirrored); // absolute
        const plan = computeWindows(cells, inst.def.type, height, occupied, entranceEdges, this.northAngle);
        floor.windowStats.set(inst.id, {
          targetRatio: plan.targetRatio,
          achievedRatio: plan.achievedRatio,
          belowTarget: plan.belowTarget,
          sectors: plan.sectors, // derived glazing orientation (OR1 + report)
          northLit: plan.northLit,
        });
        // Absolute windowed edges → LOCAL edge keys (walls are built from the
        // mirrored+rotated LOCAL cells = absolute − origin; side is unchanged
        // since the room group carries no rotation/mirror transform — both are
        // baked into the cells, so the local frame stays world-axis-aligned).
        const localWindows = new Map<string, WindowVariant>();
        for (const [absKey, variant] of plan.edges) {
          const e = parseEdgeKey(absKey);
          localWindows.set(edgeKey(e.cx - inst.origin.cx, e.cz - inst.origin.cz, e.side), variant);
        }
        rebuildRoomWalls(
          inst.group, inst.def, inst.rotation, height, localWindows, inst.mirrored,
          roomDoors.get(inst.id) // LOCAL door-edge keys for this room (or undefined)
        );
      }
    });
  }

  /**
   * The per-space door openings for `floor`, split into room (LOCAL edge keys,
   * by instance id) and cluster (ABSOLUTE edge keys) sets, driving
   * {@link rebuildRoomWalls} and {@link rebuildClusterShells}. Resolves each door
   * edge's two sides via live grid occupancy; a door onto a stair cuts only the
   * room/cluster side (a stair owner classifies as "other" → no shell wall).
   */
  private doorWallSets(floor: Floor): { rooms: Map<string, Set<string>>; clusters: Set<string> } {
    return doorWallCuts(
      floor.doors,
      (cx, cz) => floor.grid.ownerAt(cx, cz),
      (id) => {
        const inst = floor.store.instances.get(id);
        if (!inst) return null;
        const kind = inst.def.cluster
          ? "cluster"
          : inst.def.category === "room"
            ? "room"
            : "other"; // stair / furniture — no shell wall to cut
        return { kind, origin: inst.origin };
      }
    );
  }

  /** Cell → space-token map for a floor (incl. stair holes projected from the
   *  floor below), the resolver door placement/validity and the adjacency graph
   *  share. Public so the door-placement controller can test candidate edges. */
  doorTargets(floor: Floor): Map<string, string> {
    return buildSpaceTargets(floor, this.floorBelow(floor));
  }

  /** Whether `door` currently binds a valid shared interior boundary on `floor`
   *  (both edges join the same two distinct spaces). */
  isDoorValid(floor: Floor, door: Door): boolean {
    const targets = this.doorTargets(floor);
    return resolveDoorSpaces(door, (cx, cz) => targets.get(cellKey(cx, cz)) ?? null) !== null;
  }

  /** Remove any door whose edges no longer bind two distinct spaces (a space
   *  moved/resized/was deleted, or the edge went exterior). Runs inside the
   *  synchronous store-change pass so the removal shares the triggering action's
   *  undo snapshot — one Ctrl+Z restores both the move and the door. Doors do
   *  NOT travel with rooms; they are absolute edge-bound and simply vanish when
   *  stranded. */
  private pruneStaleDoors(): void {
    for (const floor of this.floors) {
      if (floor.doors.length === 0) continue;
      const targets = this.doorTargets(floor);
      const targetAt = (cx: number, cz: number) => targets.get(cellKey(cx, cz)) ?? null;
      const stale = floor.doors.filter((d) => resolveDoorSpaces(d, targetAt) === null);
      for (const d of stale) floor.removeDoor(d.id);
    }
  }

  /** Public trigger for the shell rebuild pass, for changes that don't go
   *  through the store's `onChange` (placing/removing an entrance — a freed edge
   *  may regain a window — or placing/removing a door, which cuts/closes an
   *  opening in both adjacent shells). Does NOT prune (those callers never
   *  strand a door). */
  refreshWalls(): void {
    this.rebuildAllShells();
    markCutawayDirty();
  }

  /** Set the project north (degrees) and re-derive windows against it (they ride
   *  the wall pass). No-op if unchanged, so a click-without-drag on the dial
   *  costs nothing. Normalizes to [0,360). The caller commits history + syncs the
   *  dial/arrow display; this only owns the geometry re-derivation. */
  setNorthAngle(deg: number): void {
    const a = ((deg % 360) + 360) % 360;
    if (a === this.northAngle) return;
    this.northAngle = a;
    this.refreshWalls(); // seed-run south-bias re-scores → windows move
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
    this.deps.groupGhost.clear();
    this.activeIndex = Math.max(0, Math.min(index, this.floors.length - 1));

    const f = this.active;
    this.deps.picker.grid = f.grid;
    this.deps.dragDrop.store = f.store;
    this.deps.selection.store = f.store;
    this.deps.ghost.grid = f.grid;
    this.deps.ghost.parent = f.group;
    this.deps.ghost.store = f.store; // cross-floor stair validity for the ghost
    this.deps.groupGhost.grid = f.grid;
    this.deps.groupGhost.parent = f.group;
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

  /** Show/hide floor `i` entirely (see {@link Floor.setVisible}). Independent
   *  of the active-floor concept — the active floor can be hidden; its store
   *  stays bound to interaction regardless of whether it's drawn. */
  setFloorVisible(i: number, visible: boolean): void {
    this.floors[i]?.setVisible(visible);
  }
  isFloorVisible(i: number): boolean {
    return this.floors[i]?.visible ?? false;
  }

  /**
   * World-space bounding box of the current content — every placed room/
   * module/stair and merged connector-cluster shell, on every VISIBLE floor —
   * for camera "zoom to extent" framing. Falls back to the visible floors'
   * grid footprints if nothing is placed, and further to a small box at the
   * origin if no floor is visible at all (so framing is always well-defined).
   */
  contentBox(): THREE.Box3 {
    // Box3.setFromObject reads matrixWorld directly; force it fresh first so a
    // floor repositioned earlier in the SAME synchronous tick (e.g. a stack
    // recompute right before a caller asks for the extent) isn't measured at
    // its stale position — matrixWorld otherwise only updates on the next
    // render pass.
    this.scene.updateMatrixWorld(true);
    const box = new THREE.Box3();
    let any = false;
    for (const f of this.floors) {
      if (!f.visible) continue;
      for (const inst of f.store.instances.values()) {
        box.union(new THREE.Box3().setFromObject(inst.group));
        any = true;
      }
      if (f.clusterGroup.children.length > 0) {
        box.union(new THREE.Box3().setFromObject(f.clusterGroup));
        any = true;
      }
    }
    if (!any) {
      for (const f of this.floors) {
        if (!f.visible) continue;
        const halfW = f.grid.worldWidth / 2;
        const halfD = f.grid.worldDepth / 2;
        const y = f.group.position.y;
        box.union(
          new THREE.Box3(
            new THREE.Vector3(-halfW, y, -halfD),
            new THREE.Vector3(halfW, y + 0.01, halfD)
          )
        );
        any = true;
      }
    }
    if (!any)
      box.union(new THREE.Box3(new THREE.Vector3(-3, -0.1, -3), new THREE.Vector3(3, 0.1, 3)));
    return box;
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
    // North is project-level design state — restore it BEFORE any rebuild so the
    // window generator (which reads this.northAngle) re-derives against the
    // loaded angle. Tolerant: a pre-north file has no field → default 0.
    const rawNorth =
      typeof data.northAngle === "number" && Number.isFinite(data.northAngle) ? data.northAngle : 0;
    this.northAngle = ((rawNorth % 360) + 360) % 360;

    for (const f of [...this.floors]) this.disposeFloor(f);
    this.floors.length = 0;
    this.activeIndex = 0;

    const floorsData = data.floors.length
      ? data.floors
      : [{ cols: this.defaultCols, rows: this.defaultRows, instances: [], entrances: [], doors: [] }];

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
        floor.store.place(
          inst.type, { cx: inst.cx, cz: inst.cz }, inst.rotation, inst.mirrored ?? false
        );
      }
      // Entrances + doors are authored data (not in the store); restore them.
      // Doors go on after all this floor's instances (and, by the create-all-
      // floors-first order above, after the floor below's stair) so their two
      // spaces already exist to bind.
      for (const ent of floorsData[k].entrances)
        floor.addEntrance({ cx: ent.cx, cz: ent.cz }, ent.side);
      for (const d of floorsData[k].doors)
        floor.addDoor({ cx: d.cx, cz: d.cz }, d.side);
    });

    // Cut door openings (and prune any door that doesn't bind two live spaces —
    // tolerant of hand-edited files) now that every floor is fully populated;
    // the per-place onChange fired during the loop rebuilt walls doorless.
    this.syncStairsAndHoles();
    this.setActive(0);
  }
}
