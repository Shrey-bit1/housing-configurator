import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CELL_SIZE, type Cell } from "../core/grid";
import { rotatedCells, type ModuleDef } from "../core/modules";
import { edgeKey } from "../core/exteriorEdges";
import { SILL_H, LINTEL_H, type WindowVariant } from "../core/windows";
import { DOOR_OPENING_H } from "../core/door";
import { PROP_BUILDERS } from "./props";
import { buildStairGroup } from "./stairMesh";

/** Inset so neighbouring cells in a multi-cell footprint read as separate. */
const CUBE_INSET = 0.04;
const CUBE = CELL_SIZE - CUBE_INSET;

/**
 * Per-cell box + edge geometry, cached by height (in cells). Furniture cells
 * are 1 tall (0.6 m cubes); room cells extrude to the room height. Each cell
 * sits on the ground: it spans y = INSET/2 .. heightCells*CELL - INSET/2.
 */
const geometryCache = new Map<
  number,
  { box: THREE.BoxGeometry; edges: THREE.EdgesGeometry }
>();

function cellGeometry(heightCells: number) {
  let g = geometryCache.get(heightCells);
  if (!g) {
    const boxHeight = heightCells * CELL_SIZE - CUBE_INSET;
    const box = new THREE.BoxGeometry(CUBE, boxHeight, CUBE);
    g = { box, edges: new THREE.EdgesGeometry(box) };
    geometryCache.set(heightCells, g);
  }
  return g;
}

/**
 * Build a Three.js group for a module instance. Cubes are positioned at the
 * module's rotated relative cells, so the mesh footprint always matches the
 * occupancy footprint. The group's origin (local 0,0,0) is the module's origin
 * cell centre — the caller positions the group via `Grid.gridToWorld(origin)`.
 *
 * `ghost` produces a translucent, depth-test-light version for drag previews.
 */
export function buildModuleMesh(
  def: ModuleDef,
  rotation: number,
  ghost = false,
  /** Wall height (world units) for a room shell — normally the floor's true
   *  floor-to-floor height (`FloorManager.floorHeight`), passed in via
   *  `ModuleStore.wallHeightProvider`. Falls back to the def's own nominal
   *  height when omitted (ghost preview, or any caller that doesn't care). */
  wallHeight?: number,
  /** Left/right footprint flip (mirror across local X, before rotation). Baked
   *  into the geometry — cells, walls, props, stairs — never a `scale.x = -1`
   *  (which would invert winding/normals). */
  mirrored = false
): THREE.Group {
  // Stairs are their own stepped geometry (placed and ghost alike), spanning up
  // to the floor above. No shell, no props, no per-cell cubes.
  if (def.category === "stair") return buildStairGroup(def, rotation, ghost, mirrored);

  const group = new THREE.Group();
  group.userData.moduleType = def.type;

  const material = new THREE.MeshStandardMaterial({
    color: def.color,
    roughness: 0.65,
    metalness: 0.05,
    transparent: ghost,
    opacity: ghost ? 0.45 : 1,
  });
  // Stash the base material on the group so selection/ghost tinting can find it.
  group.userData.material = material;

  const edgeMaterial = new THREE.LineBasicMaterial({
    color: ghost ? 0xffffff : 0x1a1a1a,
    transparent: ghost,
    opacity: ghost ? 0.6 : 1,
  });

  // Render mode (placed only — the drag ghost always stays a solid box preview):
  //  - connectors (Circulation/Outdoor) → a flat floor tile; their walls are
  //    drawn once per merged cluster (clusterShells.ts), never per piece.
  //  - any other room → a hollow open-top shell (floor + perimeter walls).
  //  - furniture modules → solid cube(s).
  // Purely visual; placement/occupancy/collision are unchanged.
  const isConnector = !!def.cluster;
  const asTile = !ghost && isConnector;
  const asShell = !ghost && def.category === "room" && !isConnector;

  if (asTile) {
    buildConnectorTile(group, def, rotation, material, edgeMaterial, mirrored);
  } else if (asShell) {
    // One glazing material per room group, reused across wall rebuilds. Windows
    // themselves are added by the FloorManager rebuild pass (which knows the
    // floor's occupancy/entrances), fired synchronously right after placement —
    // so the initial shell is built plain and immediately re-walled with windows.
    group.userData.glassMaterial = makeGlassMaterial();
    buildRoomShell(group, def, rotation, material, edgeMaterial, wallHeight ?? def.height * CELL_SIZE, mirrored);
  } else {
    const { box, edges: edgeGeometry } = cellGeometry(def.height);
    const centerY = (def.height * CELL_SIZE) / 2;

    for (const cell of rotatedCells(def, rotation, mirrored)) {
      const mesh = new THREE.Mesh(box, material);
      mesh.castShadow = !ghost;
      mesh.receiveShadow = !ghost;
      mesh.position.set(cell.cx * CELL_SIZE, centerY, cell.cz * CELL_SIZE);

      const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
      // Outlines are decorative only. Three.js raycasts lines with a ~1m default
      // threshold, which would let distant edges steal clicks — exclude them.
      edges.raycast = () => {};
      mesh.add(edges);

      group.add(mesh);
    }
  }

  // Interior props (e.g. Kitchen): decorative voxel-art rendered inside the
  // room footprint. Skipped for the drag ghost (keeps the preview a clean
  // footprint). Props are built in the room's un-rotated local frame, so the
  // whole props group is rotated to match the room — same pivot (local origin
  // = cell (0,0)) the cells rotate around. As children of `group` they move,
  // rotate, and get removed with the room automatically.
  if (!ghost) {
    const buildProps = PROP_BUILDERS[def.type];
    if (buildProps) {
      // Props are mirrored in their voxel DATA (see buildPropsMesh) — never via
      // a group scale — then this rotation follows, matching the cells'
      // mirror-then-rotate order.
      const props = buildProps(mirrored);
      props.rotation.y = -rotation * (Math.PI / 2);
      group.add(props);
    }
  }

  return group;
}

/** Wall/floor thickness for the hollow-shell room rendering. */
export const WALL_T = 0.1;
export const FLOOR_H = 0.15;

/** Glazing pane thickness (thinner than the wall, set into the reveal). */
const GLASS_T = 0.04;
/** Tiny y inset so glazing doesn't share an exact plane with the sill top /
 *  lintel bottom (avoids z-fighting on those horizontal faces). */
const GLASS_EPS = 0.004;
/** Subtle blue-gray glass tint. */
const GLASS_COLOR = 0x9fb8c8;

/**
 * A translucent glazing material — ONE per room group (created here, stashed on
 * `group.userData.glassMaterial`, reused across wall rebuilds). Per-group (not
 * shared globally) for the same reason the wall material is: `Floor.setDimmed`
 * mutates `material.color`, so each floor/room needs its own instance. Carries
 * `userData.baseColor` so the dim fade restores/fades it from its own tint.
 */
export function makeGlassMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color: GLASS_COLOR,
    roughness: 0.1,
    metalness: 0,
    transparent: true,
    opacity: 0.3,
    depthWrite: false, // don't occlude what's behind (other panes / interior)
    side: THREE.DoubleSide,
  });
  m.userData.baseColor = GLASS_COLOR;
  return m;
}

/**
 * Generate the perimeter wall meshes for an arbitrary set of occupied cells —
 * the shared boundary-tracing + clean-corner logic used by BOTH per-room shells
 * ({@link buildRoomShell}) and merged connector clusters (clusterShells.ts).
 *
 * `centerX(cx)` / `centerZ(cz)` map a cell index to its centre in the target
 * local frame (cell-relative for a room; world XZ via gridToWorld for a
 * cluster) — so the same logic serves both without a separate path.
 *
 * Corner handling: walls are inset to the INTERIOR side of their boundary line
 * (no protrusion). N/S walls (running in x) take full length and "own" the
 * corner squares; E/W walls (running in z) are trimmed by one wall thickness at
 * any end where this same cell also has a perpendicular boundary (a convex
 * corner). At concave corners the two walls belong to different cells and meet
 * edge-to-edge with no overlap — one clean edge everywhere.
 *
 * Returns merged meshes tagged with `userData.wallNormal` so the cutaway pass
 * can hide camera-facing walls. Up to four SOLID wall meshes (one per outward
 * normal ±x/±z) plus — when `windows` is supplied — up to four GLAZING meshes
 * (also `wallNormal`-tagged, so panels + glass hide together with their face).
 *
 * WINDOWS: a windowed exterior edge (its local `edgeKey` present in `windows`)
 * has its full-height solid segment replaced by a sill panel (0→{@link SILL_H}),
 * an optional lintel panel (framed variant: top {@link LINTEL_H}), and a
 * translucent glazing pane filling the gap. Sill/lintel are still SOLID wall
 * (same material, merged into the same per-normal wall mesh, so they tint/dim/
 * cutaway exactly like wall); glass uses `glassMaterial` in its own per-normal
 * mesh. Panel heights are absolute (stay fixed on taller floors; the glazing
 * gap absorbs the extra height). Windows are only ever passed for room shells;
 * cluster shells call without them.
 *
 * DOORS: a doored INTERIOR edge (its `edgeKey` present in `doors` — LOCAL for a
 * room, ABSOLUTE for a cluster, matching the `windows` key convention) gets an
 * OPENING from 0→{@link DOOR_OPENING_H} with a SOLID header panel above it up to
 * `fullH` — the INVERSE of a window (fixed 2100 mm opening, the panel grows on
 * taller floors). No sill, no glazing. Doors are checked before windows; the two
 * never coincide (windows are exterior-only, doors interior-only). A door onto a
 * stair cuts only the room/cluster side — the caller simply never adds the
 * stair side to `doors` (a stair has no shell wall).
 */
export function buildBoundaryWalls(
  cells: Cell[],
  centerX: (cx: number) => number,
  centerZ: (cz: number) => number,
  fullH: number,
  material: THREE.Material,
  edgeMaterial: THREE.Material,
  windows?: Map<string, WindowVariant>,
  glassMaterial?: THREE.Material,
  doors?: Set<string>
): THREE.Mesh[] {
  const key = (x: number, z: number) => `${x},${z}`;
  const occupied = new Set(cells.map((c) => key(c.cx, c.cz)));
  const H = CELL_SIZE / 2;

  const walls = { nx: [], px: [], nz: [], pz: [] } as Record<string, THREE.BufferGeometry[]>;
  const glass = { nx: [], px: [], nz: [], pz: [] } as Record<string, THREE.BufferGeometry[]>;

  /** A box spanning an explicit y band (yMin..yMax). */
  const box = (
    xMin: number, xMax: number, zMin: number, zMax: number, yMin: number, yMax: number
  ) => {
    const g = new THREE.BoxGeometry(xMax - xMin, yMax - yMin, zMax - zMin);
    g.translate((xMin + xMax) / 2, (yMin + yMax) / 2, (zMin + zMax) / 2);
    return g;
  };

  /**
   * Emit one boundary edge into the given solid + glass arrays. Non-windowed →
   * one full-height box. Windowed → sill (+ optional lintel) as solid, plus a
   * glazing pane (thinner, centred in the wall thickness along `thin`).
   */
  const emit = (
    side: string,
    cx: number, cz: number,
    solid: THREE.BufferGeometry[], glazing: THREE.BufferGeometry[],
    xMin: number, xMax: number, zMin: number, zMax: number,
    thin: "x" | "z"
  ) => {
    // Door wins the edge: a fixed 0→DOOR_OPENING_H opening, solid header above.
    if (doors?.has(edgeKey(cx, cz, side as any))) {
      const top = Math.min(DOOR_OPENING_H, fullH);
      if (fullH - top > 0.001) solid.push(box(xMin, xMax, zMin, zMax, top, fullH));
      return;
    }
    const variant = windows?.get(edgeKey(cx, cz, side as any));
    if (!variant) {
      solid.push(box(xMin, xMax, zMin, zMax, 0, fullH));
      return;
    }
    // Sill (always) + lintel (framed only) — solid wall.
    solid.push(box(xMin, xMax, zMin, zMax, 0, SILL_H));
    const glassTop = variant === "framed" ? fullH - LINTEL_H : fullH;
    if (variant === "framed") solid.push(box(xMin, xMax, zMin, zMax, fullH - LINTEL_H, fullH));
    // Glazing pane in the gap — skip if the gap collapsed (never at real heights).
    if (glassMaterial && glassTop - SILL_H > 0.05) {
      let gxMin = xMin, gxMax = xMax, gzMin = zMin, gzMax = zMax;
      if (thin === "x") {
        const cxm = (xMin + xMax) / 2;
        gxMin = cxm - GLASS_T / 2;
        gxMax = cxm + GLASS_T / 2;
      } else {
        const czm = (zMin + zMax) / 2;
        gzMin = czm - GLASS_T / 2;
        gzMax = czm + GLASS_T / 2;
      }
      glazing.push(box(gxMin, gxMax, gzMin, gzMax, SILL_H + GLASS_EPS, glassTop - GLASS_EPS));
    }
  };

  for (const c of cells) {
    const x = centerX(c.cx);
    const z = centerZ(c.cz);

    const emptyN = !occupied.has(key(c.cx, c.cz - 1)); // -z edge (north)
    const emptyS = !occupied.has(key(c.cx, c.cz + 1)); // +z edge (south)
    const emptyW = !occupied.has(key(c.cx - 1, c.cz)); // -x edge (west)
    const emptyE = !occupied.has(key(c.cx + 1, c.cz)); // +x edge (east)

    // E/W walls run in z, inset in x, trimmed in z at convex ends so the
    // perpendicular N/S wall of this cell owns the corner.
    const zMin = z - H + (emptyN ? WALL_T : 0);
    const zMax = z + H - (emptyS ? WALL_T : 0);
    if (emptyW) emit("west", c.cx, c.cz, walls.nx, glass.nx, x - H, x - H + WALL_T, zMin, zMax, "x");
    if (emptyE) emit("east", c.cx, c.cz, walls.px, glass.px, x + H - WALL_T, x + H, zMin, zMax, "x");

    // N/S walls run in x at full cell length (own the corners), inset in z.
    if (emptyN) emit("north", c.cx, c.cz, walls.nz, glass.nz, x - H, x + H, z - H, z - H + WALL_T, "z");
    if (emptyS) emit("south", c.cx, c.cz, walls.pz, glass.pz, x - H, x + H, z + H - WALL_T, z + H, "z");
  }

  const dirs: Array<{ key: string; normal: THREE.Vector3 }> = [
    { key: "nx", normal: new THREE.Vector3(-1, 0, 0) },
    { key: "px", normal: new THREE.Vector3(1, 0, 0) },
    { key: "nz", normal: new THREE.Vector3(0, 0, -1) },
    { key: "pz", normal: new THREE.Vector3(0, 0, 1) },
  ];
  const meshes: THREE.Mesh[] = [];
  for (const { key: dk, normal } of dirs) {
    const solidGeos = walls[dk];
    if (solidGeos.length) {
      const wallMesh = new THREE.Mesh(mergeGeometries(solidGeos, false), material);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      wallMesh.userData.isWall = true;
      wallMesh.userData.wallNormal = normal;
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(wallMesh.geometry),
        edgeMaterial
      );
      edges.raycast = () => {};
      wallMesh.add(edges);
      meshes.push(wallMesh);
    }

    const glassGeos = glass[dk];
    if (glassGeos.length && glassMaterial) {
      const glassMesh = new THREE.Mesh(mergeGeometries(glassGeos, false), glassMaterial);
      glassMesh.userData.isWall = true; // hide with its face in the cutaway pass
      glassMesh.userData.wallNormal = normal;
      glassMesh.userData.isGlass = true;
      glassMesh.renderOrder = 1; // draw after opaque geometry
      glassMesh.raycast = () => {}; // don't steal picks from the room shell
      meshes.push(glassMesh);
    }
  }
  return meshes;
}

/**
 * A hollow, open-top room shell for ONE room instance: a thin floor slab under
 * every footprint cell plus the perimeter walls (via {@link buildBoundaryWalls},
 * extruded directly to `wallHeight` — no post-build rescale). Built from the
 * already-rotated footprint in the room's local frame (cell (0,0) at local
 * origin); the room group is not rotated, so wall normals are world-axis-aligned.
 */
function buildRoomShell(
  group: THREE.Group,
  def: ModuleDef,
  rotation: number,
  material: THREE.Material,
  edgeMaterial: THREE.Material,
  wallHeight: number,
  mirrored = false
): void {
  const cells = rotatedCells(def, rotation, mirrored);

  const floorGeos = cells.map((c) => {
    const g = new THREE.BoxGeometry(CELL_SIZE, FLOOR_H, CELL_SIZE);
    g.translate(c.cx * CELL_SIZE, FLOOR_H / 2, c.cz * CELL_SIZE);
    return g;
  });
  const floorMesh = new THREE.Mesh(mergeGeometries(floorGeos, false), material);
  floorMesh.castShadow = true;
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  for (const wall of buildBoundaryWalls(
    cells,
    (cx) => cx * CELL_SIZE,
    (cz) => cz * CELL_SIZE,
    wallHeight,
    material,
    edgeMaterial
  ))
    group.add(wall);
}

/**
 * Rebuild ONLY the wall meshes of an already-built room shell group, in
 * place, at `wallHeight` — used when a floor's true floor-to-floor height
 * changes (e.g. a taller room placed elsewhere on the same floor) so
 * existing rooms' walls still reach the plate above, and to (re)apply the
 * derived `windows` assignment (which edges are glazed). Leaves the floor
 * slab and any interior props untouched; reuses the group's existing shared
 * wall material (`userData.material`) and glazing material
 * (`userData.glassMaterial`), both set in {@link buildModuleMesh}, so
 * selection/dim tinting keeps working on the rebuilt walls. A fresh
 * edge-outline material is cheap to recreate (it carries no tinting state).
 *
 * `windows` keys are LOCAL edge keys (cell coords relative to the room origin,
 * matching the mirrored+rotated local cells the walls are built from) → variant.
 * Omit for a plain (windowless) rebuild. `doors` is the LOCAL edge-key set of
 * interior openings to cut in this room's walls (same local-key convention).
 */
export function rebuildRoomWalls(
  group: THREE.Group,
  def: ModuleDef,
  rotation: number,
  wallHeight: number,
  windows?: Map<string, WindowVariant>,
  mirrored = false,
  doors?: Set<string>
): void {
  const material = group.userData.material as THREE.Material;
  let glassMaterial = group.userData.glassMaterial as THREE.Material | undefined;
  if (!glassMaterial) {
    glassMaterial = makeGlassMaterial();
    group.userData.glassMaterial = glassMaterial;
  }
  // `isWall` tags both solid walls AND glazing panes, so both rebuild together.
  for (const child of [...group.children]) {
    if (!child.userData.isWall) continue;
    group.remove(child);
    disposeWallMesh(child as THREE.Mesh);
  }
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x1a1a1a });
  const cells = rotatedCells(def, rotation, mirrored);
  for (const wall of buildBoundaryWalls(
    cells,
    (cx) => cx * CELL_SIZE,
    (cz) => cz * CELL_SIZE,
    wallHeight,
    material,
    edgeMaterial,
    windows,
    glassMaterial,
    doors
  ))
    group.add(wall);
}

function disposeWallMesh(mesh: THREE.Mesh): void {
  mesh.geometry.dispose();
  for (const child of mesh.children) {
    const line = child as THREE.LineSegments;
    if (line.isLineSegments) line.geometry.dispose();
  }
}

/**
 * A connector piece (Circulation / Outdoor) renders as just a thin floor tile —
 * NO walls. Walls for connectors are drawn once per merged cluster of adjacent
 * same-type pieces (clusterShells.ts), so a chain reads as one shell with walls
 * only on its outer perimeter. The tile keeps the piece visible and selectable.
 */
function buildConnectorTile(
  group: THREE.Group,
  def: ModuleDef,
  rotation: number,
  material: THREE.Material,
  edgeMaterial: THREE.Material,
  mirrored = false
): void {
  const tiles = rotatedCells(def, rotation, mirrored).map((c) => {
    const g = new THREE.BoxGeometry(CELL_SIZE, FLOOR_H, CELL_SIZE);
    g.translate(c.cx * CELL_SIZE, FLOOR_H / 2, c.cz * CELL_SIZE);
    return g;
  });
  const tileMesh = new THREE.Mesh(mergeGeometries(tiles, false), material);
  tileMesh.castShadow = true;
  tileMesh.receiveShadow = true;
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(tileMesh.geometry),
    edgeMaterial
  );
  edges.raycast = () => {};
  tileMesh.add(edges);
  group.add(tileMesh);
}

/** Tint a ghost group to signal a valid (green) or invalid (red) drop. */
export function setGhostValidity(group: THREE.Group, valid: boolean): void {
  const mat = group.userData.material as THREE.MeshStandardMaterial;
  mat.color.setHex(valid ? 0x4fd08a : 0xff5d5d);
}

/** Toggle the selected look (emissive glow) on a placed module group. */
export function setSelected(group: THREE.Group, selected: boolean): void {
  const mat = group.userData.material as THREE.MeshStandardMaterial;
  mat.emissive.setHex(selected ? 0xffffff : 0x000000);
  mat.emissiveIntensity = selected ? 0.35 : 0;
}

/** Subtler emissive intensity than {@link setSelected}'s 0.35 — hover reads as
 *  a light cue, never competing with the selection glow. */
const HOVER_INTENSITY = 0.15;

/**
 * Toggle a subtle hover cue — distinct (lower-intensity) from the selection
 * glow, so click targets stay legible even with several instances selected.
 * Deliberately a no-op when `selected` is true (selection's own glow already
 * reads as "this is under focus"; hover shouldn't fight or double it) or when
 * a rules-violation tint currently owns this material (`userData.hiPrev` is
 * set by `highlight.ts` — that signal is rarer and more important than a
 * passing mouseover, so hover yields to it rather than clobbering it).
 */
export function setHovered(group: THREE.Group, hovered: boolean, selected: boolean): void {
  const mat = group.userData.material as THREE.MeshStandardMaterial | undefined;
  if (!mat || selected || mat.userData.hiPrev !== undefined) return;
  mat.emissive.setHex(hovered ? 0xffffff : 0x000000);
  mat.emissiveIntensity = hovered ? HOVER_INTENSITY : 0;
}
