import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CELL_SIZE, type Cell } from "../core/grid";
import { rotatedCells, type ModuleDef } from "../core/modules";
import { PROP_BUILDERS } from "./props";

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
export function buildModuleMesh(def: ModuleDef, rotation: number, ghost = false): THREE.Group {
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
    buildConnectorTile(group, def, rotation, material, edgeMaterial);
  } else if (asShell) {
    buildRoomShell(group, def, rotation, material, edgeMaterial);
  } else {
    const { box, edges: edgeGeometry } = cellGeometry(def.height);
    const centerY = (def.height * CELL_SIZE) / 2;

    for (const cell of rotatedCells(def, rotation)) {
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
      const props = buildProps();
      props.rotation.y = -rotation * (Math.PI / 2);
      group.add(props);
    }
  }

  return group;
}

/** Wall/floor thickness for the hollow-shell room rendering. */
export const WALL_T = 0.1;
export const FLOOR_H = 0.15;

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
 * Returns up to four merged meshes, one per OUTWARD normal (±x, ±z), each tagged
 * with `userData.wallNormal` so the cutaway pass can hide camera-facing walls.
 */
export function buildBoundaryWalls(
  cells: Cell[],
  centerX: (cx: number) => number,
  centerZ: (cz: number) => number,
  fullH: number,
  material: THREE.Material,
  edgeMaterial: THREE.Material
): THREE.Mesh[] {
  const key = (x: number, z: number) => `${x},${z}`;
  const occupied = new Set(cells.map((c) => key(c.cx, c.cz)));
  const H = CELL_SIZE / 2;

  const walls = {
    nx: [] as THREE.BufferGeometry[],
    px: [] as THREE.BufferGeometry[],
    nz: [] as THREE.BufferGeometry[],
    pz: [] as THREE.BufferGeometry[],
  };

  const wallBox = (xMin: number, xMax: number, zMin: number, zMax: number) => {
    const g = new THREE.BoxGeometry(xMax - xMin, fullH, zMax - zMin);
    g.translate((xMin + xMax) / 2, fullH / 2, (zMin + zMax) / 2);
    return g;
  };

  for (const c of cells) {
    const x = centerX(c.cx);
    const z = centerZ(c.cz);

    const emptyN = !occupied.has(key(c.cx, c.cz - 1)); // -z edge
    const emptyS = !occupied.has(key(c.cx, c.cz + 1)); // +z edge
    const emptyW = !occupied.has(key(c.cx - 1, c.cz)); // -x edge
    const emptyE = !occupied.has(key(c.cx + 1, c.cz)); // +x edge

    // E/W walls run in z, inset in x, trimmed in z at convex ends so the
    // perpendicular N/S wall of this cell owns the corner.
    const zMin = z - H + (emptyN ? WALL_T : 0);
    const zMax = z + H - (emptyS ? WALL_T : 0);
    if (emptyW) walls.nx.push(wallBox(x - H, x - H + WALL_T, zMin, zMax));
    if (emptyE) walls.px.push(wallBox(x + H - WALL_T, x + H, zMin, zMax));

    // N/S walls run in x at full cell length (own the corners), inset in z.
    if (emptyN) walls.nz.push(wallBox(x - H, x + H, z - H, z - H + WALL_T));
    if (emptyS) walls.pz.push(wallBox(x - H, x + H, z + H - WALL_T, z + H));
  }

  const dirs: Array<{ geos: THREE.BufferGeometry[]; normal: THREE.Vector3 }> = [
    { geos: walls.nx, normal: new THREE.Vector3(-1, 0, 0) },
    { geos: walls.px, normal: new THREE.Vector3(1, 0, 0) },
    { geos: walls.nz, normal: new THREE.Vector3(0, 0, -1) },
    { geos: walls.pz, normal: new THREE.Vector3(0, 0, 1) },
  ];
  const meshes: THREE.Mesh[] = [];
  for (const { geos, normal } of dirs) {
    if (!geos.length) continue;
    const wallMesh = new THREE.Mesh(mergeGeometries(geos, false), material);
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
  return meshes;
}

/**
 * A hollow, open-top room shell for ONE room instance: a thin floor slab under
 * every footprint cell plus the perimeter walls (via {@link buildBoundaryWalls}).
 * Built from the already-rotated footprint in the room's local frame (cell (0,0)
 * at local origin); the room group is not rotated, so wall normals are
 * world-axis-aligned.
 */
function buildRoomShell(
  group: THREE.Group,
  def: ModuleDef,
  rotation: number,
  material: THREE.Material,
  edgeMaterial: THREE.Material
): void {
  const cells = rotatedCells(def, rotation);
  const fullH = def.height * CELL_SIZE;

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
    fullH,
    material,
    edgeMaterial
  ))
    group.add(wall);
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
  edgeMaterial: THREE.Material
): void {
  const tiles = rotatedCells(def, rotation).map((c) => {
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
