import * as THREE from "three";
import { CELL_SIZE, cellKey, type Grid, type Cell } from "./grid";
import { Floor } from "./floor";
import { MODULE_DEFS, occupiedCells, type ModuleDef } from "./modules";
import type { ProjectFile } from "./projectIO";
import { edgeKey, parseEdgeKey, SIDES, isFacadeEdge, type Side } from "./exteriorEdges";
import { computeWindows, type WindowVariant } from "./windows";
import {
  buildSpaceTargets,
  doorEdges,
  doorWallCuts,
  resolveDoorSpaces,
  computeDefaultSwing,
  DEFAULT_SWING,
  BELOW_PREFIX,
  type Door,
} from "./door";
import { computeDwellingGraph, dwellingNodeId } from "./adjacencyGraph";
import { computeEntranceDepths } from "./rules";
import { computeExpansion } from "./expansion";
import { computeSemiExterior } from "./semiExterior";
import { isElastic, isWet, isBedroom } from "./modules";
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

/**
 * THE bedroom-tint flag for the Interface view. Whether bedroom POSITIONS belong
 * in the binding level is still open: the 28 July meeting asked at 30:20 for a
 * view showing "only the outline and the units", while the export list for the
 * same meeting names bedroom positions among the things a unit communicates.
 * Flip this one line to settle it either way. `true` marks each bedroom with a
 * tinted plate; `false` leaves bedrooms indistinguishable from the open area.
 */
export const INTERFACE_TINT_BEDROOMS = true;

/** The neutral plate colour every stripped room falls back to in the Interface
 *  view, so the freed area reads as one continuous surface. */
const OPEN_PLATE = 0xd8d4cb;
/** The bedroom position tint, used only when {@link INTERFACE_TINT_BEDROOMS}. */
const BEDROOM_TINT = 0xa9bcd0;
/** The bare plate every non-fixed space falls back to in the Structure view.
 *  A touch darker than {@link OPEN_PLATE} so the two views never produce the
 *  same picture from a screenshot alone. */
const STRUCTURE_PLATE = 0xc9c5bb;

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
  /** "Show seeds" view flag (see {@link setSeedOutlinesVisible}). */
  private seedOutlinesVisible = false;
  /** "Structure" x-ray view flag (see {@link setStructureView}). */
  private structureView = false;

  /** "Interface view" flag (see {@link setInterfaceView}). */
  private interfaceView = false;

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
    floor.seedOutlines.visible = this.seedOutlinesVisible;
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

    // Derive the elastic-room EFFECTIVE footprints (expansion.ts) — after
    // holes (rooms never grow over the stairwell void), BEFORE door pruning
    // and the shell rebuild, both of which read effective space.
    this.recomputeExpansion();
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
      // The room↔outdoor half of the facade test, read off the derived
      // semi-exterior plan so a SEALED COURTYARD (an outdoor cluster that
      // reaches no sky) confers nothing here either.
      const isSemiExterior = (x: number, z: number, s: Side) =>
        floor.semiExterior?.boundary.has(edgeKey(x, z, s)) ?? false;

      floor.windowStats.clear();
      const seedRects: { min: Cell; max: Cell }[] = [];
      for (const inst of floor.store.instances.values()) {
        if (inst.def.category !== "room" || inst.def.cluster) continue; // shells only
        // EFFECTIVE footprint (expansion.ts): elastic rooms grow into claimed
        // gap cells; fixed rooms pass through as their seed. Walls, slab, and
        // windows all build on this shape.
        const seedCells = occupiedCells(inst.def, inst.origin, inst.rotation, inst.mirrored);
        const cells = floor.effectiveCells.get(inst.id) ?? seedCells; // absolute
        // French windows on this room's semi-exterior (balcony) boundary are
        // placed by construction; the band generator then only makes up the
        // shortfall (§2o).
        const french = floor.semiExterior?.glazedByRoom.get(inst.id);
        const plan = computeWindows(
          cells, inst.def.type, height, occupied, floor.isOutside,
          entranceEdges, this.northAngle, french
        );
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
        // Elastic rooms: walls + slab rebuild on the effective LOCAL cells
        // (absolute − origin); the "Show seeds" outline records the authored
        // minimum. Fixed rooms keep the untouched original path.
        const elastic = isElastic(inst.def);
        // NOTE: rooms keep ALL their own walls. The dissolve (§2n) is ONE-SIDED
        // — only the Outdoor/Circulation CLUSTER drops its boundary segment
        // (clusterShells), so the doubled back-to-back wall becomes the room's
        // single wall face and the connector reads as open to it.
        rebuildRoomWalls(
          inst.group, inst.def, inst.rotation, height, localWindows, inst.mirrored,
          roomDoors.get(inst.id), // LOCAL door-edge keys for this room (or undefined)
          elastic
            ? cells.map((c) => ({ cx: c.cx - inst.origin.cx, cz: c.cz - inst.origin.cz }))
            : undefined,
          // INTERFACE VIEW: dissolve this room's INTERIOR partitions and keep the
          // segments that sit on the flat's outer boundary, so the perimeter and
          // its glazing survive while the inside opens up. Reuses the `skip` set
          // the Outdoor dissolve already introduced, which is why the view needs
          // no new geometry path (see setInterfaceView).
          this.interfaceView && !isWet(inst.def)
            ? { skip: this.partitionEdges(cells, occupied, inst.origin, floor.isOutside, isSemiExterior) }
            : undefined
        );
        if (elastic) {
          const xs = seedCells.map((c) => c.cx);
          const zs = seedCells.map((c) => c.cz);
          seedRects.push({
            min: { cx: Math.min(...xs), cz: Math.min(...zs) },
            max: { cx: Math.max(...xs), cz: Math.max(...zs) },
          });
        }
      }
      floor.rebuildSeedOutlines(seedRects);
      // The entrance leaf's second cell is derived from the same occupancy the
      // walls just used, so it re-derives here rather than only at placement.
      floor.refreshEntranceMarkers();
    });
    // Walls are brand-new meshes after this pass — re-apply the x-ray view.
    this.applyStructureView();
  }

  /**
   * The LOCAL edge keys of `cells` that are NOT facade, which is exactly the set
   * of interior partitions the interface view dissolves. Facade is decided by
   * {@link isFacadeEdge}, the one definition this and the room-has-facade rule
   * (F2) both use, so the drawing and the check can never disagree about where
   * the enclosure runs.
   *
   * A balcony boundary is facade and stays. The first version tested only
   * whether the neighbour cell was occupied, which dissolved the wall between a
   * room and its balcony along with its french-window glazing, because an
   * outdoor cell is occupied like any other. An edge onto CIRCULATION is
   * interior and still dissolves.
   *
   * Walls are only ever built where a room's own footprint ends, so classifying
   * the neighbour is enough to cover every segment that exists. Local keys,
   * because walls are built in the room's local frame (absolute − origin),
   * matching the window and door key convention.
   */
  private partitionEdges(
    cells: Cell[],
    occupied: Set<string>,
    origin: Cell,
    isOutside: (cx: number, cz: number) => boolean,
    isSemiExterior: (cx: number, cz: number, side: Side) => boolean
  ): Set<string> {
    const skip = new Set<string>();
    for (const c of cells)
      for (const side of SIDES) {
        if (isFacadeEdge(c.cx, c.cz, side, occupied, isOutside, isSemiExterior)) continue;
        skip.add(edgeKey(c.cx - origin.cx, c.cz - origin.cz, side));
      }
    return skip;
  }


  /**
   * INTERFACE VIEW (view state, never serialized). The thesis reads a unit at
   * two levels: the binding one, which is where the wet cells, the stair, the
   * balconies, the entrance and the facade sit, and the exchangeable one, which
   * is how the rest of the interior is divided. This view shows only the first.
   *
   * With it on, wet rooms, stairs, balconies, terraces and the entrance marker
   * are untouched, and every other room loses its interior partitions, its
   * furniture, its interior door markers and its own colour, so the freed area
   * reads as one open plate inside a perimeter that stays standing. Bedrooms
   * keep a tinted plate marking position, behind {@link INTERFACE_TINT_BEDROOMS}.
   *
   * Two mechanisms, both filters rather than model changes. Walls go through the
   * shell rebuild, because a room's wall meshes are merged one-per-direction and
   * a single mesh therefore holds both facade and partition segments, so mesh
   * visibility cannot separate them. Furniture, colour and door markers are
   * plain visibility and material state, applied here.
   */
  setInterfaceView(on: boolean): void {
    // Mutually exclusive with the Structure view — see setStructureView for why.
    if (on && this.structureView) this.setStructureView(false);
    this.interfaceView = on;
    this.rebuildAllShells();  // walls: partitions dissolve, perimeter stays
    this.applyInterfaceView(); // furniture, colour, door markers
  }

  private applyInterfaceView(): void {
    const on = this.interfaceView;
    for (const floor of this.floors) {
      for (const inst of floor.store.instances.values()) {
        if (inst.def.category !== "room" || inst.def.cluster) continue;
        const stripped = on && !isWet(inst.def);
        for (const child of inst.group.children)
          if (child.userData.props) child.visible = !stripped;
        // Colour goes through `baseColor`, which the dim pass already treats as
        // authoritative (floor.ts `fade`), so the view composes with dimming and
        // with the cutaway instead of fighting them for the same material.
        const mat = inst.group.userData.material as THREE.Material | undefined;
        if (mat) {
          const tint = INTERFACE_TINT_BEDROOMS && isBedroom(inst.def);
          if (stripped) mat.userData.baseColor = tint ? BEDROOM_TINT : OPEN_PLATE;
          else delete mat.userData.baseColor;
        }
      }
      floor.refreshColors();      // re-run `fade` so the baseColor change lands
      floor.doorView.setVisible(!on);
    }
  }

  /**
   * STRUCTURE VIEW (view state, never serialized): the FIXED LAYER of a unit,
   * meaning the parts whose position is decided by servicing and by the section
   * rather than by how a household chooses to live. Bathrooms, kitchens and
   * stairs render exactly as built, walls and furniture included. Everything
   * else, which is the dry rooms and the circulation and outdoor clusters
   * alike, drops to a bare neutral plate with no walls and no furniture, so the
   * fixed parts stand alone on the footprint they have to hold.
   *
   * WHAT THIS REPLACED. Until this change the view was an elastic x-ray: it hid
   * the wall and glazing meshes of instances passing {@link isElastic}, which is
   * Living Room, Bedroom and Recreation Room, and touched nothing else. That
   * left corridor and balcony walls standing, because cluster walls are built
   * once per merged component into `floor.clusterGroup` and were never in the
   * loop, and it left every stripped room in its own colour, so the picture read
   * as a partly demolished flat rather than as a layer. The new filter is by
   * FIXEDNESS instead of by elasticity, which is why a Kitchen, which is neither
   * elastic nor previously special-cased here, now survives whole.
   *
   * Two mechanisms, mirroring {@link setInterfaceView}. Room walls, glazing and
   * cluster shells hide by mesh visibility, which works here where it did not
   * work for the interface view, because this view removes a stripped space's
   * walls WHOLE and never has to split one merged mesh into facade and
   * partition. Furniture and plate colour are visibility and material state.
   * `structureHidden` is also what tells the cutaway pass to leave a hidden wall
   * alone (see scene/cutaway.ts), so the two never fight over the same mesh.
   *
   * Mutually exclusive with the interface view rather than composing: both
   * express a stripped room through `material.userData.baseColor`, so a shared
   * on/off would have one view's exit clear the other's tint, and the overlap
   * itself answers no question, since one view asks what the building fixes and
   * the other asks what the unit contract binds.
   */
  setStructureView(on: boolean): void {
    if (on && this.interfaceView) this.setInterfaceView(false);
    this.structureView = on;
    this.applyStructureView();
  }

  /** Whether the structure view is on, so the UI can drop the other toggle's
   *  active state when one view turns the other off. */
  get structureViewOn(): boolean {
    return this.structureView;
  }
  get interfaceViewOn(): boolean {
    return this.interfaceView;
  }

  /** The FIXED layer: what the structure view renders as built. Wet rooms are
   *  fixed because their drains bind them to a stack, and stairs because the
   *  section binds them to the floor above. */
  private isFixedLayer(def: ModuleDef): boolean {
    return def.category === "stair" || isWet(def);
  }

  private applyStructureView(): void {
    const on = this.structureView;
    for (const floor of this.floors) {
      for (const inst of floor.store.instances.values()) {
        // Furniture modules are neither a space nor its contents, so the view
        // has nothing to say about them and leaves them exactly as placed.
        if (inst.def.category !== "room") continue;
        const stripped = on && !this.isFixedLayer(inst.def);
        for (const child of inst.group.children) {
          if (child.userData.isWall) {
            child.userData.structureHidden = stripped;
            child.visible = !stripped;
          } else if (child.userData.props) {
            child.visible = !stripped;
          }
        }
        const mat = inst.group.userData.material as THREE.Material | undefined;
        if (mat) {
          if (stripped) mat.userData.baseColor = STRUCTURE_PLATE;
          else delete mat.userData.baseColor;
        }
      }
      // Circulation and outdoor walls are merged per component into the floor's
      // cluster group, not into any instance, so they are stripped here. Their
      // floor tiles live on the instances above and stay, which is what makes a
      // corridor read as bare plate rather than disappear.
      for (const child of floor.clusterGroup.children) {
        child.userData.structureHidden = on;
        child.visible = !on;
      }
      floor.refreshColors(); // re-run `fade` so the baseColor change lands
    }
    markCutawayDirty(); // let the cutaway pass re-take control of what's shown
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
      // EFFECTIVE occupancy: a door on an expanded boundary must cut the
      // elastic room's wall — its edge cells are claimed, not seed cells.
      (cx, cz) => floor.effectiveOwnerAt(cx, cz),
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

  /** Fill in a DEFAULT `swing` for any door that lacks one (freshly placed, or
   *  loaded from a pre-swing file). Builds the dwelling graph + entrance depths
   *  ONCE (only if some door actually needs a default) so the "deeper-from-
   *  entrance = more private" rule can run; circulation-adjacency and the
   *  hinge-corner rule are local. Rebuilds the door markers/arcs on floors it
   *  changed. Called after door placement and after load. */
  assignDefaultSwings(): void {
    if (!this.floors.some((f) => f.doors.some((d) => d.swing === undefined))) return;
    const graph = computeDwellingGraph(this.floors);
    const depths = computeEntranceDepths(graph);
    const circ = new Set(
      graph.nodes.filter((n) => n.kind === "cluster" && n.roomTypeId === "circulation").map((n) => n.id)
    );
    this.floors.forEach((floor, fi) => {
      let changed = false;
      const targets = this.doorTargets(floor);
      const targetAt = (cx: number, cz: number) => targets.get(cellKey(cx, cz)) ?? null;
      // space token → dwelling node id (mirrors adjacencyGraph.toNode: a below-
      // floor stair hole's token resolves to the stair's node on floor fi-1).
      const nodeId = (tok: string) =>
        tok.startsWith(BELOW_PREFIX)
          ? dwellingNodeId(fi - 1, tok.slice(BELOW_PREFIX.length))
          : dwellingNodeId(fi, tok);
      for (const d of floor.doors) {
        if (d.swing !== undefined) continue;
        const spaces = resolveDoorSpaces(d, targetAt);
        d.swing = spaces
          ? computeDefaultSwing(
              d,
              spaces,
              (tok) => circ.has(nodeId(tok)),
              (tok) => depths.get(nodeId(tok)) ?? Infinity,
              targetAt
            )
          : DEFAULT_SWING;
        changed = true;
      }
      if (changed) floor.doorView.rebuild(floor.doors);
    });
  }

  /** Show/hide the plan-view door-swing arcs on every floor (main.ts toggles
   *  with plan/top view — arcs are a plan symbol). */
  setDoorArcsVisible(visible: boolean): void {
    for (const f of this.floors) f.doorView.setArcsVisible(visible);
  }

  /** Whether `door` currently binds a valid shared interior boundary on `floor`
   *  (both edges join the same two distinct spaces). Deliberately unchanged by
   *  the semi-exterior pass: a door AUTHORED on a room↔balcony boundary before
   *  french windows existed stays valid, keeps rendering, and is never pruned —
   *  old files lose nothing. Only NEW authoring is blocked, see
   *  {@link isDoorAuthorable}. */
  isDoorValid(floor: Floor, door: Door): boolean {
    const targets = this.doorTargets(floor);
    return resolveDoorSpaces(door, (cx, cz) => targets.get(cellKey(cx, cz)) ?? null) !== null;
  }

  /** May a NEW door be authored here? Valid, and not on a SEMI-EXTERIOR
   *  boundary — a room↔balcony boundary is already a french window, and the
   *  glass IS the door (core/semiExterior.ts), so a second one is meaningless. */
  isDoorAuthorable(floor: Floor, door: Door): boolean {
    if (!this.isDoorValid(floor, door)) return false;
    return !this.isSemiExteriorDoor(floor, door);
  }

  /** True when ANY of `door`'s edges lies on a qualifying room↔outdoor
   *  boundary (either cell/side representation). Drives the placement hint. */
  isSemiExteriorDoor(floor: Floor, door: Door): boolean {
    const boundary = floor.semiExterior?.boundary;
    if (!boundary || boundary.size === 0) return false;
    return doorEdges(door).some((e) => boundary.has(edgeKey(e.cx, e.cz, e.side)));
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
    this.recomputeExpansion(); // cheap + idempotent; occupancy rarely changed here
    this.rebuildAllShells();
    markCutawayDirty();
  }

  /** Re-derive every floor's effective footprints (see core/expansion.ts) and,
   *  on top of them, its semi-exterior plan (core/semiExterior.ts — french
   *  windows onto qualifying balconies). Strictly per-floor; both are pure
   *  functions of the placed seeds + holes, and neither is ever serialized. */
  private recomputeExpansion(): void {
    for (const floor of this.floors) floor.setEffective(computeExpansion(floor));
    // Semi-exterior derives FROM the effective footprints (a grown elastic room
    // gets french windows on whatever boundary it grew into contact with), so
    // it runs in a second pass, after every floor's expansion is settled.
    for (const floor of this.floors)
      floor.semiExterior = computeSemiExterior(floor, this.floorBelow(floor));
  }

  /** Show/hide the elastic seed-rectangle outlines on every floor ("Show
   *  seeds" — view state, never serialized; new floors follow the flag). */
  setSeedOutlinesVisible(visible: boolean): void {
    this.seedOutlinesVisible = visible;
    for (const f of this.floors) f.seedOutlines.visible = visible;
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

  /** Public read of {@link floorHeight} — the unit exporter carries per-storey
   *  heights in the bridge file (docs/bridge-format.md). */
  floorHeightOf(floor: Floor): number {
    return this.floorHeight(floor);
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
   *
   * Returns how many saved instances could NOT be placed (collision /
   * out-of-bounds under the CURRENT preset footprints — e.g. an old file whose
   * L-shaped rooms interlocked where today's rectangles collide). Tolerant by
   * design: what fits is placed through the normal paths, the rest is dropped;
   * the import UI surfaces the count as a toast (no silent loss). Same-session
   * snapshots (undo/redo) can never skip — their footprints match by
   * construction.
   */
  loadProject(data: ProjectFile): { skipped: number } {
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
    let skipped = 0;
    const created = floorsData.map((fd) => this.createFloor(fd.cols, fd.rows));
    created.forEach((floor, k) => {
      for (const inst of floorsData[k].instances) {
        if (!MODULE_DEFS[inst.type]) {
          console.warn(`Skipping unknown module type "${inst.type}" while loading.`);
          continue;
        }
        const placed = floor.store.place(
          inst.type, { cx: inst.cx, cz: inst.cz }, inst.rotation, inst.mirrored ?? false
        );
        if (!placed) skipped++;
      }
      // Entrances + doors are authored data (not in the store); restore them.
      // Doors go on after all this floor's instances (and, by the create-all-
      // floors-first order above, after the floor below's stair) so their two
      // spaces already exist to bind.
      for (const ent of floorsData[k].entrances)
        floor.addEntrance({ cx: ent.cx, cz: ent.cz }, ent.side);
      for (const d of floorsData[k].doors)
        floor.addDoor({ cx: d.cx, cz: d.cz }, d.side, d.swing); // swing absent → default filled below
    });

    // Cut door openings (and prune any door that doesn't bind two live spaces —
    // tolerant of hand-edited files) now that every floor is fully populated;
    // the per-place onChange fired during the loop rebuilt walls doorless.
    this.syncStairsAndHoles();
    this.assignDefaultSwings(); // fill swing for pre-swing files (kept for files that had it)
    this.setActive(0);
    return { skipped };
  }
}
