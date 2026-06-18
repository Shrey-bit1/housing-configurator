import * as THREE from "three";

/** Size of one grid cell in metres / Three.js world units. The fundamental unit. */
export const CELL_SIZE = 0.6;

/** Integer cell coordinate on the ground grid. Origin (0,0) is one corner. */
export interface Cell {
  cx: number;
  cz: number;
}

/** `"cx,cz"` key used for the occupancy map. */
export function cellKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

/**
 * The ground grid: a `cols` x `rows` field of {@link CELL_SIZE} cells.
 *
 * Responsibilities:
 *  - own the grid dimensions,
 *  - be the single source of truth for cell occupancy,
 *  - centralise ALL cell<->world coordinate conversion.
 *
 * The grid is centred on the world origin so the camera framing stays put as
 * the grid grows/shrinks. Every other system must convert through
 * {@link Grid.gridToWorld} / {@link Grid.worldToGrid} rather than doing its own
 * arithmetic.
 */
export class Grid {
  cols: number;
  rows: number;

  /** Maps `"cx,cz"` -> the id of the module instance occupying that cell. */
  private occupancy = new Map<string, string>();

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
  }

  // ---- Coordinate conversion -------------------------------------------------

  /** Half-extent of the grid in world units, used to centre it on the origin. */
  private get halfWidth(): number {
    return (this.cols * CELL_SIZE) / 2;
  }
  private get halfDepth(): number {
    return (this.rows * CELL_SIZE) / 2;
  }

  /** World-space position of the CENTRE of cell (cx, cz), on the ground (y=0). */
  gridToWorld(cx: number, cz: number): THREE.Vector3 {
    const x = (cx + 0.5) * CELL_SIZE - this.halfWidth;
    const z = (cz + 0.5) * CELL_SIZE - this.halfDepth;
    return new THREE.Vector3(x, 0, z);
  }

  /** Integer cell that world point (wx, wz) falls inside. May be out of bounds. */
  worldToGrid(wx: number, wz: number): Cell {
    const cx = Math.floor((wx + this.halfWidth) / CELL_SIZE);
    const cz = Math.floor((wz + this.halfDepth) / CELL_SIZE);
    return { cx, cz };
  }

  // ---- Bounds & occupancy ----------------------------------------------------

  inBounds(cx: number, cz: number): boolean {
    return cx >= 0 && cz >= 0 && cx < this.cols && cz < this.rows;
  }

  /**
   * Can the given set of absolute cells be occupied?
   * Every cell must be in bounds and either free or already owned by
   * `excludeId` (so a module can be tested against its own current footprint
   * when moving/rotating).
   */
  canPlace(cells: Cell[], excludeId?: string): boolean {
    for (const { cx, cz } of cells) {
      if (!this.inBounds(cx, cz)) return false;
      const owner = this.occupancy.get(cellKey(cx, cz));
      if (owner !== undefined && owner !== excludeId) return false;
    }
    return true;
  }

  /** Mark every cell as owned by `id`. Assumes {@link canPlace} already passed. */
  occupy(cells: Cell[], id: string): void {
    for (const { cx, cz } of cells) this.occupancy.set(cellKey(cx, cz), id);
  }

  /** Free every cell currently owned by `id`. */
  free(id: string): void {
    for (const [key, owner] of this.occupancy) {
      if (owner === id) this.occupancy.delete(key);
    }
  }

  /** Resize the grid. Occupancy is left untouched here; the caller (store) is
   * responsible for culling/repositioning instances that no longer fit. */
  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
  }

  /** Total world dimensions, handy for sizing the grid helper / ground plane. */
  get worldWidth(): number {
    return this.cols * CELL_SIZE;
  }
  get worldDepth(): number {
    return this.rows * CELL_SIZE;
  }
}
