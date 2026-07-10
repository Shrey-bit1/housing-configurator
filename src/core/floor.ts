import * as THREE from "three";
import { Grid, type Cell } from "./grid";
import { ModuleStore } from "./store";
import { GridView } from "../scene/gridView";
import { HoleView } from "../scene/holeView";
import { EntranceView } from "../scene/entranceView";
import { DoorView } from "../scene/doorView";
import type { Entrance } from "./entrance";
import { doorId, doorOverlaps, type Door } from "./door";
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

  constructor(readonly id: number, cols: number, rows: number) {
    this.grid = new Grid(cols, rows);
    this.store = new ModuleStore(this.group, this.grid);
    this.gridView = new GridView(this.group, this.grid);
    this.holeView = new HoleView(this.group, this.grid);
    this.entranceView = new EntranceView(this.group, this.grid);
    this.doorView = new DoorView(this.group, this.grid);
    this.group.add(this.clusterGroup);
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
  addDoor(cell: Cell, side: Side): boolean {
    const door: Door = { id: doorId(cell, side), cell: { cx: cell.cx, cz: cell.cz }, side };
    if (doorOverlaps(door, this.doors)) return false;
    this.doors.push(door);
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
    // Per-instance rooms/modules: fall back to the room colour.
    for (const inst of this.store.instances.values())
      fade(inst.group, dimmed, inst.def.color);
    // Merged connector-cluster walls: their materials carry their own baseColor.
    fade(this.clusterGroup, dimmed, EDGE_COLOR);
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
