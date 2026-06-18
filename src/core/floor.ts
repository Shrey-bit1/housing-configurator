import * as THREE from "three";
import { Grid } from "./grid";
import { ModuleStore } from "./store";
import { GridView } from "../scene/gridView";

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

  constructor(readonly id: number, cols: number, rows: number) {
    this.grid = new Grid(cols, rows);
    this.store = new ModuleStore(this.group, this.grid);
    this.gridView = new GridView(this.group, this.grid);
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
    for (const inst of this.store.instances.values()) {
      inst.group.traverse((o) => {
        const mat = (o as THREE.Mesh | THREE.LineSegments).material as
          | THREE.MeshStandardMaterial
          | THREE.LineBasicMaterial
          | (THREE.Material & { color?: THREE.Color })
          | undefined;
        if (!mat || !("color" in mat) || !mat.color) return;
        const base = (o as THREE.LineSegments).isLineSegments
          ? EDGE_COLOR
          : inst.def.color;
        mat.color.set(base);
        if (dimmed) mat.color.lerp(DIM_BG, DIM_AMOUNT);
      });
    }
    this.gridView.setDimmed(dimmed);
  }
}
