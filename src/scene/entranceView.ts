import * as THREE from "three";
import { CELL_SIZE, type Grid } from "../core/grid";
import { SIDE_DELTA, type Side } from "../core/exteriorEdges";
import type { Entrance } from "../core/entrance";

/**
 * Renders ground-floor entrance markers: a door-mark slab standing on the
 * exterior edge a given entrance binds to. Drawn in the floor's local frame
 * (via {@link Grid.gridToWorld}); rebuilt wholesale from the entrance list, the
 * same derived-from-data style as the cluster shells / hole view.
 */
const ACCENT = 0xe91e63; // vivid magenta — a colour no room type uses, so the
// door marker stays legible against any wall (incl. the red living room).
const EDGE = 0x1a1a1a;
const DIM_BG = new THREE.Color(0xe4e0d6);

const MARK_LEN = 0.44; // along the wall
const MARK_THICK = 0.16; // across the wall
const MARK_H = 1.3; // height — tall enough to read against 2.4 m room walls

/** Build a single entrance marker (also used translucent as a placement ghost). */
export function makeEntranceMesh(
  grid: Grid,
  cell: { cx: number; cz: number },
  side: Side,
  ghost = false
): THREE.Mesh {
  const [dx, dz] = SIDE_DELTA[side];
  const along = dz !== 0 ? "x" : "z"; // N/S walls run in x; E/W walls run in z
  const w = along === "x" ? MARK_LEN : MARK_THICK;
  const d = along === "x" ? MARK_THICK : MARK_LEN;

  const geo = new THREE.BoxGeometry(w, MARK_H, d);
  const mat = new THREE.MeshStandardMaterial({
    color: ACCENT,
    roughness: 0.6,
    metalness: 0.0,
    transparent: ghost,
    opacity: ghost ? 0.5 : 1,
  });
  mat.userData.baseColor = ACCENT; // so dimming fades by the marker's own colour
  const mesh = new THREE.Mesh(geo, mat);

  const c = grid.gridToWorld(cell.cx, cell.cz);
  const H = CELL_SIZE / 2;
  mesh.position.set(c.x + dx * H, MARK_H / 2, c.z + dz * H);
  mesh.castShadow = !ghost;
  mesh.userData.material = mat;

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: ghost ? 0xffffff : EDGE })
  );
  edges.raycast = () => {};
  mesh.add(edges);
  return mesh;
}

export class EntranceView {
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
      const base = (mat.userData.baseColor as number) ?? EDGE;
      mat.color.set(base);
      if (dimmed) mat.color.lerp(DIM_BG, 0.6);
    });
  }

  rebuild(entrances: Entrance[]): void {
    this.dispose();
    for (const e of entrances) {
      const mesh = makeEntranceMesh(this.grid, e.cell, e.side);
      mesh.userData.entranceId = e.id; // lets rules-validation highlight this marker (E2)
      this.group.add(mesh);
    }
    this.setDimmed(this.dimmed);
  }

  private dispose(): void {
    for (const child of [...this.group.children]) {
      this.group.remove(child);
      child.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose());
      });
    }
  }
}
