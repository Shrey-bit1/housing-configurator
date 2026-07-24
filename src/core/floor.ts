import * as THREE from "three";
import { Grid, cellKey, CELL_SIZE, type Cell } from "./grid";
import { ModuleStore } from "./store";
import { GridView } from "../scene/gridView";
import { HoleView } from "../scene/holeView";
import { EntranceView } from "../scene/entranceView";
import { DoorView } from "../scene/doorView";
import type { Entrance } from "./entrance";
import { doorId, doorOverlaps, nextSwing, type Door, type DoorSwing } from "./door";
import { edgeKey, type Side } from "./exteriorEdges";
import type { GlazingStat } from "./windows";

/** Canvas background colour; dimmed floors fade toward it. Keep in sync with
 *  the scene background in sceneSetup.ts. */
const DIM_BG = new THREE.Color(0xe4e0d6);
/** How far an inactive floor's colours are pulled toward the background. */
const DIM_AMOUNT = 0.74;
/** Edge-outline colour at full strength (matches moduleMesh). */
const EDGE_COLOR = 0x1a1a1a;

/**
 * One level of the building. Each floor is fully self-contained: its own grid
 * (and occupancy map), its own ModuleStore (rooms + modules), its own grid
 * visual — all parented under a single {@link group} so the whole floor can be
 * offset vertically and dimmed by transforming/styling that one group.
 */
export class Floor {
  readonly group = new THREE.Group();
  readonly grid: Grid;
  readonly store: ModuleStore;
  readonly gridView: GridView;
  /** Renders stairwell openings cut into this floor's plate by stairs below. */
  readonly holeView: HoleView;
  /** Renders ground-floor entrance markers (only floor 0 uses these). */
  readonly entranceView: EntranceView;
  /** Renders interior-door threshold markers (any floor). */
  readonly doorView: DoorView;
  /** Holds merged connector-cluster wall shells (Circulation / Outdoor). */
  readonly clusterGroup = new THREE.Group();

  /** Ground-floor entrances bound to exterior edges (entry roots). */
  readonly entrances: Entrance[] = [];

  /** Authored interior doors bound to shared interior edges (any floor). Doors
   *  gate reachability (see adjacencyGraph.ts / rules.ts) and are serialized;
   *  stale ones are auto-removed by the FloorManager on layout change. */
  readonly doors: Door[] = [];

  /** Derived glazing achieved-vs-target per ROOM instance id, recomputed on
   *  every wall rebuild by the FloorManager (windows ride the wall pass). Read
   *  by the adjacency graph to expose on room nodes for the W1 rule. Not
   *  serialized (windows are derived). */
  readonly windowStats = new Map<string, GlazingStat>();

  /** DERIVED effective footprints (core/expansion.ts): every non-furniture
   *  instance id → its effective ABSOLUTE cells (elastic = seed + claimed;
   *  fixed = seed). Recomputed by the FloorManager on every layout change;
   *  never serialized. Consumers fall back to the raw seed footprint when an
   *  id is absent (e.g. mid-construction, before the first derive pass). */
  readonly effectiveCells = new Map<string, Cell[]>();
  private effectiveOwner = new Map<string, string>();
  /** Current dim state (see {@link setDimmed}) — rebuilt seed outlines read it. */
  private dimmed = false;

  /** Thin seed-rectangle outlines for elastic rooms ("Show seeds" view toggle
   *  — pure view state, never serialized). Rebuilt with the wall pass. */
  readonly seedOutlines = new THREE.Group();

  constructor(readonly id: number, cols: number, rows: number) {
    this.grid = new Grid(cols, rows);
    this.store = new ModuleStore(this.group, this.grid);
    this.gridView = new GridView(this.group, this.grid);
    this.holeView = new HoleView(this.group, this.grid);
    this.entranceView = new EntranceView(this.group, this.grid);
    this.doorView = new DoorView(this.group, this.grid);
    this.group.add(this.clusterGroup);
    this.seedOutlines.visible = false;
    this.group.add(this.seedOutlines);
  }

  /** Replace the derived effective footprints (see {@link effectiveCells}).
   *  Also rebuilds the cell→owner index behind {@link effectiveOwnerAt}. */
  setEffective(map: Map<string, Cell[]>): void {
    this.effectiveCells.clear();
    this.effectiveOwner.clear();
    for (const [id, cells] of map) {
      this.effectiveCells.set(id, cells);
      for (const c of cells) this.effectiveOwner.set(cellKey(c.cx, c.cz), id);
    }
  }

  /** The instance owning (cx,cz) under the EFFECTIVE occupancy — a claimed
   *  cell resolves to its elastic room. Falls back to raw grid occupancy
   *  (covers furniture, and mid-construction states before the first derive
   *  pass). This is the "what space is here" lookup; PLACEMENT collision
   *  deliberately keeps reading the raw grid (seeds are hard, claims are
   *  soft — the two-tier contract). */
  effectiveOwnerAt(cx: number, cz: number): string | undefined {
    return this.effectiveOwner.get(cellKey(cx, cz)) ?? this.grid.ownerAt(cx, cz);
  }

  /** Rebuild the seed outlines: one thin rectangle per elastic instance's
   *  TRANSFORMED seed footprint (always a rectangle — presets are rects).
   *  Fresh materials re-apply the floor's current dim state (outlines rebuild
   *  on every wall pass — without this they'd pop back to full colour on a
   *  dimmed floor). */
  rebuildSeedOutlines(rects: { min: Cell; max: Cell }[]): void {
    for (const child of [...this.seedOutlines.children]) {
      this.seedOutlines.remove(child);
      (child as THREE.Line).geometry?.dispose();
      ((child as THREE.Line).material as THREE.Material)?.dispose();
    }
    const H = CELL_SIZE / 2;
    // Clear of the walls: WALL_T = 0.1 boxes start AT the cell boundary, so an
    // un-grown side's outline must sit past the wall's INNER face or it is
    // depth-buried inside the opaque wall (invisible / cutaway-popping).
    const INSET = 0.14;
    const y = 0.15 + 0.03; // slab top + a hair
    for (const r of rects) {
      const a = this.grid.gridToWorld(r.min.cx, r.min.cz);
      const b = this.grid.gridToWorld(r.max.cx, r.max.cz);
      const x0 = a.x - H + INSET, z0 = a.z - H + INSET;
      const x1 = b.x + H - INSET, z1 = b.z + H - INSET;
      const mat = new THREE.LineBasicMaterial({ color: EDGE_COLOR });
      mat.userData.baseColor = EDGE_COLOR;
      const line = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x0, y, z0),
          new THREE.Vector3(x1, y, z0),
          new THREE.Vector3(x1, y, z1),
          new THREE.Vector3(x0, y, z1),
        ]),
        mat
      );
      line.raycast = () => {};
      this.seedOutlines.add(line);
    }
    fade(this.seedOutlines, this.dimmed, EDGE_COLOR);
  }

  /**
   * Whether this floor renders at all. A separate concept from {@link setDimmed}:
   * dimming still draws a floor (colour-faded, for the "not the active edit
   * floor" reading); hidden means the floor's whole group — geometry, holes,
   * entrances, everything — is skipped by the renderer entirely, e.g. to see
   * a floor below without an upper floor in the way. Pure VIEW state (not
   * serialized — see projectIO.ts): always true again on a fresh load.
   */
  get visible(): boolean {
    return this.group.visible;
  }
  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  /** Add an entrance on the exterior edge (cell, side); rebuilds the markers.
   *  No-op if one already exists on that exact edge. */
  addEntrance(cell: Cell, side: Side): void {
    const id = edgeKey(cell.cx, cell.cz, side);
    if (this.entrances.some((e) => e.id === id)) return;
    this.entrances.push({ id, cell: { cx: cell.cx, cz: cell.cz }, side });
    this.entranceView.rebuild(this.entrances);
  }

  /** Replace the whole entrance list (used by load); rebuilds the markers. */
  setEntrances(list: Entrance[]): void {
    this.entrances.length = 0;
    this.entrances.push(...list);
    this.entranceView.rebuild(this.entrances);
  }

  /** Remove the entrance with `id`; rebuilds the markers. Returns true if one
   *  was removed. (Frees the edge — a window may reappear there; the caller
   *  triggers the wall/window refresh.) */
  removeEntrance(id: string): boolean {
    const i = this.entrances.findIndex((e) => e.id === id);
    if (i < 0) return false;
    this.entrances.splice(i, 1);
    this.entranceView.rebuild(this.entrances);
    return true;
  }

  /** Marker meshes for raycast picking (entrance selection). */
  get entranceMarkers(): THREE.Object3D[] {
    return this.entranceView.markers;
  }

  /** Apply the selection highlight to the entrance marker `id` (null clears). */
  setEntranceSelected(id: string | null): void {
    this.entranceView.setSelectedId(id);
  }

  /** Add an interior door anchored at (cell, side); rebuilds the markers.
   *  Returns false (no-op) if it OVERLAPS an existing door on any physical
   *  boundary edge — which covers both an exact duplicate placed from the other
   *  side AND a collinear door sharing a middle edge (see {@link doorOverlaps}),
   *  so a boundary never carries two doors. (Space validity — that both edges
   *  bound the same two spaces — is the caller's responsibility.) */
  addDoor(cell: Cell, side: Side, swing?: DoorSwing): boolean {
    const door: Door = { id: doorId(cell, side), cell: { cx: cell.cx, cz: cell.cz }, side, swing };
    if (doorOverlaps(door, this.doors)) return false;
    this.doors.push(door);
    this.doorView.rebuild(this.doors);
    return true;
  }

  /** Cycle the swing of door `id` to the next of its 4 states and redraw its
   *  marker/plan-arc. Returns true if the door exists. Mutating → the caller
   *  commits ONE history snapshot (S-key, main.ts). */
  cycleDoorSwing(id: string): boolean {
    const d = this.doors.find((x) => x.id === id);
    if (!d) return false;
    d.swing = nextSwing(d.swing);
    this.doorView.rebuild(this.doors);
    return true;
  }

  /** Replace the whole door list (used by load); rebuilds the markers. */
  setDoors(list: Door[]): void {
    this.doors.length = 0;
    this.doors.push(...list);
    this.doorView.rebuild(this.doors);
  }

  /** Remove the door with `id`; rebuilds the markers. Returns true if one was
   *  removed. (The caller triggers the wall/opening rebuild.) */
  removeDoor(id: string): boolean {
    const i = this.doors.findIndex((d) => d.id === id);
    if (i < 0) return false;
    this.doors.splice(i, 1);
    this.doorView.rebuild(this.doors);
    return true;
  }

  /** Marker meshes for raycast picking (door selection). */
  get doorMarkers(): THREE.Object3D[] {
    return this.doorView.markers;
  }

  /** Apply the selection highlight to the door marker `id` (null clears). */
  setDoorSelected(id: string | null): void {
    this.doorView.setSelectedId(id);
  }

  /** Set the stairwell-hole cells (from stairs on the floor below): updates both
   *  the occupancy block ({@link Grid.setHoles}) and the visual opening. */
  setHoles(cells: Cell[]): void {
    this.grid.setHoles(cells);
    this.holeView.rebuild(cells);
  }

  /**
   * Dim when inactive, full colour when active. Dimming fades each material's
   * COLOUR toward the canvas background while keeping geometry fully OPAQUE.
   *
   * (We deliberately don't use alpha transparency for this: a floor is many
   * overlapping cell-boxes, and translucent + depthWrite:false makes them
   * occlude each other inconsistently as the camera orbits — geometry appears
   * sliced, which reads exactly like near-plane clipping. Opaque colour-fade
   * has no depth-sort dependence, so it's stable at every angle.)
   *
   * Only placed rooms/modules and the grid are touched — the drag ghost (which
   * only ever lives on the active floor) is left alone.
   */
  setDimmed(dimmed: boolean): void {
    this.dimmed = dimmed; // remembered so rebuilt seed outlines re-apply it
    // Per-instance rooms/modules: fall back to the room colour.
    for (const inst of this.store.instances.values())
      fade(inst.group, dimmed, inst.def.color);
    // Merged connector-cluster walls: their materials carry their own baseColor.
    fade(this.clusterGroup, dimmed, EDGE_COLOR);
    fade(this.seedOutlines, dimmed, EDGE_COLOR);
    this.gridView.setDimmed(dimmed);
    this.holeView.setDimmed(dimmed);
    this.entranceView.setDimmed(dimmed);
    this.doorView.setDimmed(dimmed);
  }
}

/** Recolour every material under `root`, fading toward the background if dimmed.
 *  A material's own `userData.baseColor` wins; outlines use the edge colour;
 *  otherwise `fallback` (the room colour). */
function fade(root: THREE.Object3D, dimmed: boolean, fallback: number): void {
  root.traverse((o) => {
    if (o.userData.noDim) return; // e.g. multi-colour voxel props (instanceColor)
    const mat = (o as THREE.Mesh | THREE.LineSegments).material as
      | (THREE.Material & { color?: THREE.Color })
      | undefined;
    if (!mat || !("color" in mat) || !mat.color) return;
    const base =
      mat.userData?.baseColor ??
      ((o as THREE.LineSegments).isLineSegments ? EDGE_COLOR : fallback);
    mat.color.set(base);
    if (dimmed) mat.color.lerp(DIM_BG, DIM_AMOUNT);
  });
}
