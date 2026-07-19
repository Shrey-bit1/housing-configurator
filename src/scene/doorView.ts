import * as THREE from "three";
import { CELL_SIZE, type Grid } from "../core/grid";
import { SIDE_DELTA } from "../core/exteriorEdges";
import { doorEdges, DEFAULT_SWING, type Door } from "../core/door";

/**
 * Renders interior-door markers: a thin floor-threshold strip laid across each
 * door's 2-edge opening, in the floor's local frame (via {@link Grid.gridToWorld}),
 * rebuilt wholesale from the door list — the same derived-from-data style as the
 * entrance markers / cluster shells.
 *
 * The strip is the door's unambiguous read in PLAN / top view (where walls are
 * edge-on and the opening in the wall is invisible) and is ALSO the door's click
 * target for selection/deletion. A distinct accent (violet) from the entrance's
 * magenta so the two marker families never read as the same thing.
 */
const ACCENT = 0x7c4dff; // violet — distinct from entrance magenta and every room colour
const EDGE = 0x1a1a1a;
const DIM_BG = new THREE.Color(0xe4e0d6);

/** Matches moduleMesh's FLOOR_H so the threshold sits on top of the floor slab. */
const SLAB_TOP = 0.15;
const STRIP_LEN = 2 * CELL_SIZE - 0.1; // along the wall (2 cells minus a small inset)
const STRIP_THICK = 0.22; // across the wall (a touch wider than WALL_T so it reads both sides)
const STRIP_H = 0.06; // low threshold slab

/** Build a single door threshold marker (also used translucent as a placement
 *  ghost). Spans the door's two consecutive edges, centred on the boundary. */
export function makeDoorMesh(grid: Grid, door: Door, ghost = false): THREE.Mesh {
  const [dx, dz] = SIDE_DELTA[door.side];
  const along = dz !== 0 ? "x" : "z"; // north/south walls run in x; east/west in z

  // The 2-edge span covers the anchor cell + its run-neighbour; centre between them.
  const [e0, e1] = doorEdges(door);
  const c0 = grid.gridToWorld(e0.cx, e0.cz);
  const c1 = grid.gridToWorld(e1.cx, e1.cz);
  const midX = (c0.x + c1.x) / 2;
  const midZ = (c0.z + c1.z) / 2;
  const H = CELL_SIZE / 2;

  const w = along === "x" ? STRIP_LEN : STRIP_THICK;
  const d = along === "x" ? STRIP_THICK : STRIP_LEN;

  const geo = new THREE.BoxGeometry(w, STRIP_H, d);
  const mat = new THREE.MeshStandardMaterial({
    color: ACCENT,
    roughness: 0.55,
    metalness: 0.0,
    transparent: ghost,
    opacity: ghost ? 0.55 : 1,
  });
  mat.userData.baseColor = ACCENT; // so dimming fades by the marker's own colour
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(midX + dx * H, SLAB_TOP + STRIP_H / 2, midZ + dz * H);
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

/**
 * The standard architectural door-swing symbol for PLAN view: the leaf line
 * (open position) + a quarter-circle arc sweeping from open to closed, flat on
 * the floor, reflecting the door's `swing` (hinge end + which space it opens
 * into). Grid-absolute like the door itself, so it's correct through room
 * rotation/mirror and for stair-facing doors with no extra handling. A thin
 * decorative line (no picking); shown only in plan/top view (see
 * {@link DoorView.setArcsVisible}).
 */
function makeDoorArc(grid: Grid, door: Door): THREE.Line {
  const swing = door.swing ?? DEFAULT_SWING;
  const [dx, dz] = SIDE_DELTA[door.side];
  const runX = door.side === "north" || door.side === "south";
  const [e0, e1] = doorEdges(door);
  const c0 = grid.gridToWorld(e0.cx, e0.cz);
  const c1 = grid.gridToWorld(e1.cx, e1.cz);
  const H = CELL_SIZE / 2;
  const y = SLAB_TOP + STRIP_H + 0.005; // just above the threshold strip
  // boundary centre (on the wall line) + along-wall unit vector
  const bx = (c0.x + c1.x) / 2 + dx * H;
  const bz = (c0.z + c1.z) / 2 + dz * H;
  const ax = runX ? 1 : 0;
  const az = runX ? 0 : 1;
  const half = STRIP_LEN / 2;
  const endA = { x: bx - ax * half, z: bz - az * half };
  const endB = { x: bx + ax * half, z: bz + az * half };
  const hp = swing.hinge === "a" ? endA : endB; // hinge point
  const closed = swing.hinge === "a" ? endB : endA; // closed-leaf tip (along wall)
  const inSign = swing.into === "B" ? 1 : -1; // into neighbour (+normal) or cell (−normal)
  const L = STRIP_LEN; // leaf length ≈ opening width = |hp − closed|
  const openTip = { x: hp.x + dx * inSign * L, z: hp.z + dz * inSign * L };

  const pts: THREE.Vector3[] = [
    new THREE.Vector3(hp.x, y, hp.z),
    new THREE.Vector3(openTip.x, y, openTip.z), // the leaf, open
  ];
  // arc from open → closed around the hinge (short 90° sweep)
  const a0 = Math.atan2(openTip.z - hp.z, openTip.x - hp.x);
  const a1 = Math.atan2(closed.z - hp.z, closed.x - hp.x);
  let sweep = a1 - a0;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  while (sweep < -Math.PI) sweep += 2 * Math.PI;
  for (let i = 1; i <= 12; i++) {
    const t = a0 + (sweep * i) / 12;
    pts.push(new THREE.Vector3(hp.x + Math.cos(t) * L, y, hp.z + Math.sin(t) * L));
  }
  const mat = new THREE.LineBasicMaterial({ color: ACCENT });
  mat.userData.baseColor = ACCENT; // so setDimmed fades from the accent, not EDGE
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
  line.raycast = () => {};
  return line;
}

export class DoorView {
  private group = new THREE.Group();
  /** Plan-view swing arcs, in their own group so they toggle as one and never
   *  interfere with marker picking. Hidden by default (3D); shown in plan. */
  private arcs = new THREE.Group();
  private dimmed = false;
  private arcsVisible = false;

  constructor(container: THREE.Object3D, private grid: Grid) {
    container.add(this.group);
    this.arcs.visible = false;
    container.add(this.arcs);
  }

  /** Show/hide the plan-view swing arcs (main.ts toggles with plan/top view). */
  setArcsVisible(visible: boolean): void {
    this.arcsVisible = visible;
    this.arcs.visible = visible;
  }

  /** The marker meshes (for raycast picking / selection). */
  get markers(): THREE.Object3D[] {
    return [...this.group.children];
  }

  /** Emissive-highlight the marker for `id` (null clears all) — same selection
   *  look as placed modules / entrance markers. */
  setSelectedId(id: string | null): void {
    for (const m of this.group.children) {
      const mat = (m as THREE.Mesh).userData.material as
        | THREE.MeshStandardMaterial
        | undefined;
      if (!mat || !mat.emissive) continue;
      const on = m.userData.doorId === id;
      mat.emissive.setHex(on ? 0xffffff : 0x000000);
      mat.emissiveIntensity = on ? 0.5 : 0;
    }
  }

  setDimmed(dimmed: boolean): void {
    this.dimmed = dimmed;
    const fade = (o: THREE.Object3D) => {
      const mat = (o as THREE.Mesh | THREE.LineSegments).material as
        | (THREE.Material & { color?: THREE.Color })
        | undefined;
      if (!mat || !mat.color) return;
      const base = (mat.userData.baseColor as number) ?? EDGE;
      mat.color.set(base);
      if (dimmed) mat.color.lerp(DIM_BG, 0.6);
    };
    this.group.traverse(fade);
    this.arcs.traverse(fade);
  }

  rebuild(doors: Door[]): void {
    this.dispose();
    for (const d of doors) {
      const mesh = makeDoorMesh(this.grid, d);
      mesh.userData.doorId = d.id;
      this.group.add(mesh);
      this.arcs.add(makeDoorArc(this.grid, d));
    }
    this.arcs.visible = this.arcsVisible;
    this.setDimmed(this.dimmed);
  }

  private dispose(): void {
    for (const g of [this.group, this.arcs])
      for (const child of [...g.children]) {
        g.remove(child);
        child.traverse((o) => {
          const m = o as THREE.Mesh;
          m.geometry?.dispose();
          const mat = m.material as THREE.Material | THREE.Material[] | undefined;
          if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose());
        });
      }
  }
}
