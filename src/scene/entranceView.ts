import * as THREE from "three";
import { CELL_SIZE, type Cell, type Grid } from "../core/grid";
import { SIDE_DELTA, type Side } from "../core/exteriorEdges";
import { DOOR_OPENING_H } from "../core/door";
import type { Entrance } from "../core/entrance";

/**
 * Renders ground-floor entrance markers: a door LEAF standing in the exterior
 * wall a given entrance binds to, with a threshold strip on the floor and an
 * `Entry` label in the plane of the wall. Drawn in the floor's local frame (via
 * {@link Grid.gridToWorld}) and rebuilt wholesale from the entrance list, the
 * same derived-from-data style as the cluster shells / hole view.
 *
 * The drawing language is {@link import("./doorView").DoorView}'s: an interior
 * door is a 2-cell (1200 mm) opening with a low threshold strip, and the front
 * door now reads the same way at the same width, in its own magenta rather than
 * the interior violet. Height is {@link DOOR_OPENING_H}, so a person reads it
 * against the room walls at the height a door actually is.
 *
 * THE SECOND CELL IS DERIVED, NOT STORED. The model stays one cell plus one side
 * ({@link Entrance}), which is what E2 checks and what the project file holds, so
 * no saved project becomes invalid and nothing about reachability changes. The
 * marker asks its floor at draw time whether the next cell along the wall can
 * carry the other half of the leaf, and falls back to one cell when neither
 * neighbour can (see {@link entranceSpan}).
 */
const ACCENT = 0xe91e63; // vivid magenta — a colour no room type uses, so the
// door marker stays legible against any wall (incl. the red living room).
const EDGE = 0x1a1a1a;
const DIM_BG = new THREE.Color(0xe9e5dc);

/** Leaf thickness across the wall. A touch wider than WALL_T so it reads from
 *  both sides, matching doorView's STRIP_THICK reasoning. */
const LEAF_THICK = 0.16;
/** Inset taken off the span length, so the leaf sits inside its opening rather
 *  than running flush into the wall corners (doorView uses the same 0.1). */
const LEAF_INSET = 0.1;
/** Matches moduleMesh's FLOOR_H, so the threshold sits on top of the slab. */
const SLAB_TOP = 0.15;
/** Threshold slab height — low, and the marker's only PLAN read, because the
 *  leaf and the label are both in the wall plane and go edge-on from above. */
const SILL_H = 0.06;
/** Threshold overhang across the wall, so the strip reads on both sides. */
const SILL_THICK = 0.3;
/** Label plate height in world units; width follows the span. */
const LABEL_H = 0.3;
/** Label centre height on the leaf. */
const LABEL_Y = 1.35;

/**
 * How many cells of wall this entrance's leaf covers, and where it starts.
 *
 * A front door is 1200 mm like every interior door, which is two cells, but the
 * entrance model records one. The preferred second cell is the one further along
 * the wall's run direction, which is east on a north- or south-facing wall and
 * south on an east- or west-facing wall, matching the run direction doors
 * already use for their own second edge (core/door.ts). When that cell cannot
 * carry the leaf the marker tries the other side, and when neither can it stays
 * one cell wide, which is the pre-existing drawing and is always legal.
 *
 * `canWiden` answers whether a neighbour qualifies. It is
 * {@link import("../core/floor").Floor.canWidenEntrance}, which requires the
 * neighbour to be the same space (or another module of the same connector
 * cluster) and its own edge on this side to face open sky. Both tests matter: a
 * leaf that straddled two rooms would show one opening where the graph roots
 * reachability in a single node, and a leaf whose far half sat against a
 * neighbouring room would draw a door into a party wall.
 */
export function entranceSpan(
  cell: Cell,
  side: Side,
  canWiden?: (anchor: Cell, next: Cell, side: Side) => boolean
): { start: Cell; cells: number } {
  if (!canWiden) return { start: cell, cells: 1 };
  const runX = side === "north" || side === "south";
  const fwd: Cell = runX ? { cx: cell.cx + 1, cz: cell.cz } : { cx: cell.cx, cz: cell.cz + 1 };
  const back: Cell = runX ? { cx: cell.cx - 1, cz: cell.cz } : { cx: cell.cx, cz: cell.cz - 1 };
  if (canWiden(cell, fwd, side)) return { start: cell, cells: 2 };
  if (canWiden(cell, back, side)) return { start: back, cells: 2 };
  return { start: cell, cells: 1 };
}

/**
 * The `Entry` glyph plate, built once and shared by every marker. A canvas
 * texture because three.js has no text primitive, and a flat plane in the wall
 * rather than a camera-facing sprite because the label belongs to the facade and
 * should foreshorten with it.
 *
 * Returns null where there is no DOM, which is every non-browser host: vitest
 * runs `core/floor.ts` in plain Node, and `Floor.addEntrance` reaches this
 * through `EntranceView.rebuild`. Nothing else in the marker needs a document,
 * so the leaf, its threshold and its outline still build and the label is simply
 * absent. The alternative, letting `document.createElement` throw, made placing
 * an entrance impossible outside a browser, which is a testability cost this
 * label was never worth.
 */
let labelTexture: THREE.CanvasTexture | null = null;
function entryLabel(): THREE.CanvasTexture | null {
  if (labelTexture) return labelTexture;
  if (typeof document === "undefined") return null;
  const w = 512;
  const h = 128;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, w, h);
  g.fillStyle = "#ffffff";
  g.font = `700 ${Math.round(h * 0.72)}px "Segoe UI", system-ui, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.letterSpacing = "10px"; // wide tracking reads better at small on-screen size
  g.fillText("ENTRY", w / 2, h / 2 + 4);
  labelTexture = new THREE.CanvasTexture(c);
  labelTexture.anisotropy = 8;
  labelTexture.colorSpace = THREE.SRGBColorSpace;
  return labelTexture;
}

/** One label plate, facing `outward` along the wall normal. Two are built per
 *  marker (one each way) so the word reads the right way round from the street
 *  and from inside, instead of appearing mirrored on one of them. */
function labelPlate(width: number, runX: boolean, outward: 1 | -1): THREE.Mesh | null {
  const map = entryLabel();
  if (!map) return null; // no DOM: the marker builds without its label
  const mat = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
  });
  mat.userData.baseColor = 0xffffff; // dimming fades the glyphs, not the plate
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, LABEL_H), mat);
  // PlaneGeometry faces +Z. A north/south wall runs in x, so its face already
  // points the right way and only needs flipping for the far side; an east/west
  // wall needs a quarter turn about y.
  if (runX) mesh.rotation.y = outward === 1 ? 0 : Math.PI;
  else mesh.rotation.y = outward * (Math.PI / 2);
  mesh.raycast = () => {};
  return mesh;
}

/**
 * Build a single entrance marker (also used translucent as a placement ghost).
 * Returns the leaf mesh with the threshold, outline and labels parented to it,
 * so callers keep treating one object as the marker. Only the leaf and the
 * threshold are pickable; the outline and the labels opt out of raycasting.
 */
export function makeEntranceMesh(
  grid: Grid,
  cell: Cell,
  side: Side,
  ghost = false,
  canWiden?: (anchor: Cell, next: Cell, side: Side) => boolean
): THREE.Mesh {
  const [dx, dz] = SIDE_DELTA[side];
  const runX = side === "north" || side === "south"; // N/S walls run in x; E/W in z
  const { start, cells } = entranceSpan(cell, side, canWiden);

  const span = cells * CELL_SIZE - LEAF_INSET;
  const w = runX ? span : LEAF_THICK;
  const d = runX ? LEAF_THICK : span;

  const geo = new THREE.BoxGeometry(w, DOOR_OPENING_H, d);
  const mat = new THREE.MeshStandardMaterial({
    color: ACCENT,
    roughness: 0.6,
    metalness: 0.0,
    transparent: ghost,
    opacity: ghost ? 0.5 : 1,
  });
  mat.userData.baseColor = ACCENT; // so dimming fades by the marker's own colour
  const mesh = new THREE.Mesh(geo, mat);

  // Centre of the span, pushed out to the wall line. With one cell this is the
  // old position exactly; with two it slides half a cell along the run.
  const a = grid.gridToWorld(start.cx, start.cz);
  const b = grid.gridToWorld(start.cx + (runX ? cells - 1 : 0), start.cz + (runX ? 0 : cells - 1));
  const H = CELL_SIZE / 2;
  mesh.position.set(
    (a.x + b.x) / 2 + dx * H,
    DOOR_OPENING_H / 2,
    (a.z + b.z) / 2 + dz * H
  );
  mesh.castShadow = !ghost;
  mesh.userData.material = mat;

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: ghost ? 0xffffff : EDGE })
  );
  edges.raycast = () => {};
  mesh.add(edges);

  // Threshold strip on the floor, the same symbol an interior door uses. The
  // leaf and the label are both in the wall plane, so from directly above they
  // are edge-on and this strip is what carries the entrance in plan view.
  const sillGeo = new THREE.BoxGeometry(
    runX ? span : SILL_THICK,
    SILL_H,
    runX ? SILL_THICK : span
  );
  const sillMat = new THREE.MeshStandardMaterial({
    color: ACCENT,
    roughness: 0.55,
    transparent: ghost,
    opacity: ghost ? 0.55 : 1,
  });
  sillMat.userData.baseColor = ACCENT;
  const sill = new THREE.Mesh(sillGeo, sillMat);
  // Child of the leaf, so positions are relative to the leaf's own centre.
  sill.position.set(0, SLAB_TOP + SILL_H / 2 - DOOR_OPENING_H / 2, 0);
  mesh.add(sill);

  const labelW = span * 0.92;
  const off = LEAF_THICK / 2 + 0.012; // clear of the leaf face, no z-fighting
  for (const outward of [1, -1] as const) {
    const plate = labelPlate(labelW, runX, outward);
    if (!plate) continue;
    plate.position.set(
      runX ? 0 : outward * off,
      LABEL_Y - DOOR_OPENING_H / 2,
      runX ? outward * off : 0
    );
    mesh.add(plate);
  }

  return mesh;
}

export class EntranceView {
  private group = new THREE.Group();
  private dimmed = false;
  private selectedId: string | null = null;
  /** Set by {@link rebuild}; kept so a re-derive after a layout change asks the
   *  same floor again (see FloorManager.rebuildAllShells). */
  private canWiden?: (anchor: Cell, next: Cell, side: Side) => boolean;

  constructor(container: THREE.Object3D, private grid: Grid) {
    container.add(this.group);
  }

  /** The marker meshes (for raycast picking / selection). */
  get markers(): THREE.Object3D[] {
    return [...this.group.children];
  }

  /** Emissive-highlight the marker for `id` (null clears all) — the selection
   *  look, matching how placed modules highlight (see moduleMesh.setSelected). */
  setSelectedId(id: string | null): void {
    this.selectedId = id;
    for (const m of this.group.children) {
      const mat = (m as THREE.Mesh).userData.material as
        | THREE.MeshStandardMaterial
        | undefined;
      if (!mat || !mat.emissive) continue;
      const on = m.userData.entranceId === id;
      mat.emissive.setHex(on ? 0xffffff : 0x000000);
      mat.emissiveIntensity = on ? 0.5 : 0;
    }
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

  rebuild(
    entrances: Entrance[],
    canWiden?: (anchor: Cell, next: Cell, side: Side) => boolean
  ): void {
    if (canWiden) this.canWiden = canWiden;
    this.dispose();
    for (const e of entrances) {
      const mesh = makeEntranceMesh(this.grid, e.cell, e.side, false, this.canWiden);
      // Every descendant carries the id, because picking reads it off whichever
      // object the ray hit (main.ts's entrance adapter) and the threshold strip
      // is a legitimate hit in plan view.
      mesh.traverse((o) => (o.userData.entranceId = e.id));
      this.group.add(mesh);
    }
    this.setDimmed(this.dimmed);
    this.setSelectedId(this.selectedId);
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
