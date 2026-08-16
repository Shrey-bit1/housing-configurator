import * as THREE from "three";
import { CELL_SIZE, type Grid, type Cell } from "../core/grid";
import { connectedComponents } from "../core/cluster";

/**
 * Renders the stairwell openings ("holes") on a floor: where a stair on the
 * floor below punches up, this floor's plate is voided so the stair arrives into
 * open space, not a ceiling. Drawn as a dark recessed panel + bold outline per
 * opening, at plate level (y≈0 in the floor's local frame).
 *
 * Purely visual; the occupancy side of a hole (blocking rooms) lives on the
 * Grid ({@link Grid.setHoles}). The FloorManager drives both via Floor.setHoles.
 * Openings are merged per connected component so a 1×3 stair reads as one
 * rectangle. Rebuilt wholesale on every change — same derived-from-occupancy
 * style as the cluster shells.
 */
const VOID_COLOR = 0x2a2a2a;
/** How solid the opening's wash is. An opening has to read as an opening when
 *  there is nothing below it, and get out of the way of whatever is below when
 *  there is: a stairwell has to show its flight (run 0020) and a double-height
 *  room has to show the room (run 0021). Low enough for both. */
const VOID_OPACITY = 0.18;
const OUTLINE_COLOR = 0x1a1a1a;
const DIM_BG = new THREE.Color(0xe9e5dc);

export class HoleView {
  private group = new THREE.Group();
  private dimmed = false;

  constructor(container: THREE.Object3D, private grid: Grid) {
    container.add(this.group);
  }

  setDimmed(dimmed: boolean): void {
    this.dimmed = dimmed;
    this.group.traverse((o) => {
      const mat = (o as THREE.Mesh | THREE.LineSegments).material as
        | (THREE.Material & { color?: THREE.Color })
        | undefined;
      if (!mat || !mat.color) return;
      const base = (mat.userData.baseColor as number) ?? VOID_COLOR;
      mat.color.set(base);
      if (dimmed) mat.color.lerp(DIM_BG, 0.6);
    });
  }

  /** Replace the rendered openings with those covering `cells`. */
  rebuild(cells: Cell[]): void {
    this.dispose();
    if (cells.length === 0) return;

    const H = CELL_SIZE / 2;
    for (const comp of connectedComponents(cells)) {
      const minX = Math.min(...comp.map((c) => c.cx));
      const maxX = Math.max(...comp.map((c) => c.cx));
      const minZ = Math.min(...comp.map((c) => c.cz));
      const maxZ = Math.max(...comp.map((c) => c.cz));
      const x0 = this.grid.gridToWorld(minX, 0).x - H;
      const x1 = this.grid.gridToWorld(maxX, 0).x + H;
      const z0 = this.grid.gridToWorld(0, minZ).z - H;
      const z1 = this.grid.gridToWorld(0, maxZ).z + H;

      // The opening, as a SEE-THROUGH shadow rather than a black hole. This
      // panel used to be an opaque dark plate, which is the one thing an
      // opening must not be. Runs 0020 and 0021 arrived at the same fix from
      // opposite ends: it hid the stair arriving through it, so the flight you
      // were connecting to was invisible from the floor it reached, and it hid
      // a double-height room, whose whole point is that you can see it from the
      // storey above. It is now a faint translucent wash that reads as a recess
      // while letting whatever is below show through, and it never writes
      // depth, so nothing underneath is culled behind it.
      const panelMat = new THREE.MeshBasicMaterial({
        color: VOID_COLOR,
        transparent: true,
        opacity: VOID_OPACITY,
        depthWrite: false,
      });
      panelMat.userData.baseColor = VOID_COLOR;
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), panelMat);
      panel.rotation.x = -Math.PI / 2;
      panel.position.set((x0 + x1) / 2, -0.02, (z0 + z1) / 2);
      panel.raycast = () => {};
      this.group.add(panel);

      // Bold outline at plate level.
      const outlineMat = new THREE.LineBasicMaterial({ color: OUTLINE_COLOR });
      outlineMat.userData.baseColor = OUTLINE_COLOR;
      const y = 0.012;
      const pts = [
        x0, y, z0, x1, y, z0,
        x1, y, z0, x1, y, z1,
        x1, y, z1, x0, y, z1,
        x0, y, z1, x0, y, z0,
      ];
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const outline = new THREE.LineSegments(g, outlineMat);
      outline.raycast = () => {};
      this.group.add(outline);
    }
    this.setDimmed(this.dimmed); // keep current dim state on the new meshes
  }

  private dispose(): void {
    for (const child of [...this.group.children]) {
      this.group.remove(child);
      const m = child as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose());
    }
  }
}
