import * as THREE from "three";
import { CELL_SIZE } from "../core/grid";
import { rotatedCells, type ModuleDef } from "../core/modules";

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

  return group;
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
