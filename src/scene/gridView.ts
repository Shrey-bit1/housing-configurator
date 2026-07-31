import * as THREE from "three";
import { CELL_SIZE, type Grid } from "../core/grid";

/**
 * Renders the ground grid as dots at every cell intersection, sized exactly to
 * `cells * CELL_SIZE`. Rebuildable so it can follow grid resizes. Also keeps a
 * faint border line around the grid extent for legibility.
 *
 * The dots gain EMPHASIS while a placement is live (see {@link setEmphasis}),
 * which is the design's "the grid rises to full over 260 ms". The dots here are
 * opaque rather than alpha-blended, deliberately, so emphasis is expressed as a
 * colour move toward ink instead of an opacity ramp; fading them in would
 * reintroduce the depth-sort artifacts `setDimmed` avoids.
 */
/** Resting dot colour, the value the grid has drawn at since it existed. */
const DOT_REST = 0xb0a99c;
/** Dot colour at full emphasis: the design system's `--ink`. */
const DOT_EMPHASIS = 0x141317;
/** `--dur-panel`, in seconds, for the emphasis ramp. */
const EMPHASIS_DUR = 0.26;

export class GridView {
  private group = new THREE.Group();
  private points?: THREE.Points;
  private border?: THREE.LineSegments;
  /** 0 at rest, 1 at full emphasis; eased toward {@link emphasisTarget}. */
  private emphasis = 0;
  private emphasisTarget = 0;
  /** Dimming and emphasis both own the dot colour, so the dim state is kept
   *  here and re-applied whenever emphasis recomputes it. */
  private dimmed = false;

  constructor(container: THREE.Object3D, private grid: Grid) {
    container.add(this.group);
    this.rebuild();
  }

  /** Fade the grid dots/border for an inactive floor — opaque colour fade (no
   *  transparency, to stay free of depth-sort artifacts during orbit). */
  setDimmed(dimmed: boolean): void {
    this.dimmed = dimmed;
    this.applyDotColor();
    const bg = new THREE.Color(0xe4e0d6);
    const border = this.border?.material as THREE.LineBasicMaterial | undefined;
    if (border) {
      border.color.set(0x1a1a1a);
      if (dimmed) border.color.lerp(bg, 0.6);
    }
  }

  /** Ask for emphasis (a placement is live) or release it. One transition each
   *  way, never a pulse: the target moves and {@link tick} eases toward it. */
  setEmphasis(on: boolean): void {
    this.emphasisTarget = on ? 1 : 0;
  }

  /** Advance the emphasis ramp. Called once per frame from the render loop with
   *  the frame's delta in seconds; a no-op once it has arrived. */
  tick(dt: number): void {
    if (this.emphasis === this.emphasisTarget) return;
    const step = dt / EMPHASIS_DUR;
    this.emphasis =
      this.emphasisTarget > this.emphasis
        ? Math.min(this.emphasisTarget, this.emphasis + step)
        : Math.max(this.emphasisTarget, this.emphasis - step);
    this.applyDotColor();
  }

  /** Dot colour from the two things that own it: emphasis, then dimming. */
  private applyDotColor(): void {
    const dots = this.points?.material as THREE.PointsMaterial | undefined;
    if (!dots) return;
    dots.color.set(DOT_REST).lerp(new THREE.Color(DOT_EMPHASIS), this.emphasis);
    if (this.dimmed) dots.color.lerp(new THREE.Color(0xe4e0d6), 0.6);
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
