import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  /** Invisible plane on y=0 used as the raycast target for the ground. */
  groundPlane: THREE.Mesh;
  /** Re-fit the camera frustum to the canvas size. Call on resize. */
  handleResize: () => void;
  /** Restore the camera to the default axonometric view (position/target/zoom). */
  resetView: () => void;
}

/** Standard isometric viewing angle (~35.264° elevation, 45° azimuth). */
const ISO_ELEVATION = Math.atan(1 / Math.SQRT2); // 35.264°
const ISO_AZIMUTH = Math.PI / 4; // 45°

/**
 * Build the renderer, an orthographic camera positioned at the classic
 * axonometric angle, soft lighting with basic shadows, and orbit controls.
 */
export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe4e0d6); // Bauhaus off-white canvas

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Orthographic camera: frustum width is derived in handleResize from the
  // canvas aspect ratio; `viewSize` sets the world-space vertical extent.
  const viewSize = 12; // ~20 cells tall by default; tweaked via zoom
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  (camera as any).viewSize = viewSize;

  // Place the camera along the iso direction, looking at the origin.
  const dist = 100;
  const dir = new THREE.Vector3(
    Math.cos(ISO_ELEVATION) * Math.sin(ISO_AZIMUTH),
    Math.sin(ISO_ELEVATION),
    Math.cos(ISO_ELEVATION) * Math.cos(ISO_AZIMUTH)
  );
  camera.position.copy(dir.multiplyScalar(dist));
  camera.lookAt(0, 0, 0);

  // ---- Lights ----
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(8, 16, 6);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  const s = 20;
  dirLight.shadow.camera.left = -s;
  dirLight.shadow.camera.right = s;
  dirLight.shadow.camera.top = s;
  dirLight.shadow.camera.bottom = -s;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 80;
  dirLight.shadow.bias = -0.0005;
  scene.add(dirLight);

  // A soft neutral fill from the opposite side so unlit faces aren't too dark.
  const fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(-6, 8, -8);
  scene.add(fill);

  // ---- Ground plane (invisible raycast target + shadow catcher) ----
  const groundGeo = new THREE.PlaneGeometry(1, 1);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.28 });
  const groundPlane = new THREE.Mesh(groundGeo, groundMat);
  groundPlane.receiveShadow = true;
  groundPlane.name = "ground";
  scene.add(groundPlane);

  // ---- Orbit controls (default view stays at the iso angle) ----
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);

  // Snapshot the default view so "Reset View" can always return to it,
  // however far the user has orbited/panned/zoomed.
  const home = {
    position: camera.position.clone(),
    target: controls.target.clone(),
    zoom: camera.zoom,
  };

  function resetView() {
    camera.position.copy(home.position);
    controls.target.copy(home.target);
    camera.zoom = home.zoom;
    camera.updateProjectionMatrix();
    controls.update();
  }

  function handleResize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    const vs = (camera as any).viewSize as number;
    camera.left = -vs * aspect;
    camera.right = vs * aspect;
    camera.top = vs;
    camera.bottom = -vs;
    camera.updateProjectionMatrix();
  }
  handleResize();

  return { scene, camera, renderer, controls, groundPlane, handleResize, resetView };
}
