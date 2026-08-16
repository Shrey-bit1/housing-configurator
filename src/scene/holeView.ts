import * as THREE from "three";
import { CELL_SIZE, cellKey, type Grid, type Cell } from "../core/grid";

/**
 * Renders the stairwell openings ("holes") on a floor: where a stair on the
 * floor below punches up, this floor's plate is voided so the stair arrives into
 * open space, not a ceiling. Drawn as a dark recessed panel + bold outline per
 * opening, at plate level (y≈0 in the floor's local frame).
 *
 * Purely visual; the occupancy side of a hole (blocking rooms) lives on the
 * Grid ({@link Grid.setHoles}). The FloorManager drives both via Floor.setHoles.
 * Rebuilt wholesale on every change — same derived-from-occupancy style as the
 * cluster shells. Adjacent openings merge visually on their own, because a cell
 * edge is only outlined where the neighbour is not also open.
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

  /**
   * Replace the rendered openings with those covering `cells`.
   *
   * DRAWN CELL BY CELL, not as a bounding box. Each opening used to be one
   * rectangle spanning its connected component's extent, which is exact for a
   * stairwell, because a stair footprint is always a rectangle, and wrong for
   * anything else. A double-height room takes its EFFECTIVE footprint
   * (PROJECT_STATE §2u), and an elastic room that grew around an obstruction is
   * an L or a T; the bounding box then painted the notch as open floor when the
   * floor was really there. Measured on one such layout: 38 cells of genuine
   * opening drawn as a 42-cell rectangle.
   *
   * So the wash is a quad per cell merged into one geometry, and the outline is
   * every cell edge with no opening on the other side, which traces the true
   * boundary of any shape and still reads as one line around a plain rectangle.
   */
  rebuild(cells: Cell[]): void {
    this.dispose();
    if (cells.length === 0) return;

    const H = CELL_SIZE / 2;
    const open = new Set(cells.map((c) => cellKey(c.cx, c.cz)));

    const quads: number[] = [];
    const edges: number[] = [];
    const yPanel = -0.02;
    const yLine = 0.012;

    for (const c of cells) {
      const p = this.grid.gridToWorld(c.cx, c.cz);
      const x0 = p.x - H;
      const x1 = p.x + H;
      const z0 = p.z - H;
      const z1 = p.z + H;

      // Two triangles of wash. The material is DoubleSide, so winding is free.
      quads.push(
        x0, yPanel, z0, x0, yPanel, z1, x1, yPanel, z1,
        x0, yPanel, z0, x1, yPanel, z1, x1, yPanel, z0
      );

      // An edge belongs to the outline only where the neighbour is NOT open.
      if (!open.has(cellKey(c.cx, c.cz - 1))) edges.push(x0, yLine, z0, x1, yLine, z0);
      if (!open.has(cellKey(c.cx, c.cz + 1))) edges.push(x0, yLine, z1, x1, yLine, z1);
      if (!open.has(cellKey(c.cx - 1, c.cz))) edges.push(x0, yLine, z0, x0, yLine, z1);
      if (!open.has(cellKey(c.cx + 1, c.cz))) edges.push(x1, yLine, z0, x1, yLine, z1);
    }

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
      side: THREE.DoubleSide, // read from the storey below as well as above
    });
    panelMat.userData.baseColor = VOID_COLOR;
    const panelGeo = new THREE.BufferGeometry();
    panelGeo.setAttribute("position", new THREE.Float32BufferAttribute(quads, 3));
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.raycast = () => {};
    this.group.add(panel);

    const outlineMat = new THREE.LineBasicMaterial({ color: OUTLINE_COLOR });
    outlineMat.userData.baseColor = OUTLINE_COLOR;
    const outlineGeo = new THREE.BufferGeometry();
    outlineGeo.setAttribute("position", new THREE.Float32BufferAttribute(edges, 3));
    const outline = new THREE.LineSegments(outlineGeo, outlineMat);
    outline.raycast = () => {};
    this.group.add(outline);

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
