import * as THREE from "three";
import { CELL_SIZE, type Grid } from "../core/grid";

/**
 * Renders the ground grid as dots at every cell intersection, sized exactly to
 * `cells * CELL_SIZE`. Rebuildable so it can follow grid resizes. Also keeps a
 * faint border line around the grid extent for legibility.
 */
export class GridView {
  private group = new THREE.Group();
  private points?: THREE.Points;
  private border?: THREE.LineSegments;

  constructor(container: THREE.Object3D, private grid: Grid) {
    container.add(this.group);
    this.rebuild();
  }

  /** Fade the grid dots/border for an inactive floor — opaque colour fade (no
   *  transparency, to stay free of depth-sort artifacts during orbit). */
  setDimmed(dimmed: boolean): void {
    const bg = new THREE.Color(0xe4e0d6);
    const dots = this.points?.material as THREE.PointsMaterial | undefined;
    if (dots) {
      dots.color.set(0xb0a99c);
      if (dimmed) dots.color.lerp(bg, 0.6);
    }
    const border = this.border?.material as THREE.LineBasicMaterial | undefined;
    if (border) {
      border.color.set(0x1a1a1a);
      if (dimmed) border.color.lerp(bg, 0.6);
    }
  }

  rebuild(): void {
    if (this.points) {
      this.group.remove(this.points);
      this.points.geometry.dispose();
      (this.points.material as THREE.Material).dispose();
    }
    if (this.border) {
      this.group.remove(this.border);
      this.border.geometry.dispose();
      (this.border.material as THREE.Material).dispose();
    }

    const { cols, rows } = this.grid;
    const halfW = (cols * CELL_SIZE) / 2;
    const halfD = (rows * CELL_SIZE) / 2;

    // Dots at each intersection: (cols+1) x (rows+1).
    const positions: number[] = [];
    for (let i = 0; i <= cols; i++) {
      for (let j = 0; j <= rows; j++) {
        positions.push(i * CELL_SIZE - halfW, 0.001, j * CELL_SIZE - halfD);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xb0a99c, // subtle grey dots on the off-white canvas
      size: 3.2,
      sizeAttenuation: false,
    });
    this.points = new THREE.Points(geom, mat);
    this.group.add(this.points);

    // Outer border.
    const b = new THREE.BufferGeometry();
    b.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          -halfW, 0.001, -halfD, halfW, 0.001, -halfD,
          halfW, 0.001, -halfD, halfW, 0.001, halfD,
          halfW, 0.001, halfD, -halfW, 0.001, halfD,
          -halfW, 0.001, halfD, -halfW, 0.001, -halfD,
        ],
        3
      )
    );
    this.border = new THREE.LineSegments(
      b,
      new THREE.LineBasicMaterial({ color: 0x1a1a1a })
    );
    this.group.add(this.border);
  }
}
