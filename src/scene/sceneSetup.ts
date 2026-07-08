import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/** "axo" = the default axonometric working angle; "top" = straight down, for
 *  the plan/top view. */
export type ViewDirection = "axo" | "top";

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  /** Invisible plane on y=0 used as the raycast target for the ground. */
  groundPlane: THREE.Mesh;
  /** Re-fit the camera frustum to the canvas size. Call on resize. */
  handleResize: () => void;
  /**
   * Point the camera at `direction`, framing `box` (world-space content
   * bounds) with a comfortable margin — "zoom to extent". Used for the
   * initial view, Reset View, and entering/re-framing the plan view. Always
   * resets zoom to 1 (any manual scroll-zoom is folded back into the fit).
   */
  frameBox: (box: THREE.Box3, direction: ViewDirection) => void;
}

/** Standard isometric viewing angle (~35.264° elevation, 45° azimuth). */
const ISO_ELEVATION = Math.atan(1 / Math.SQRT2); // 35.264°
const ISO_AZIMUTH = Math.PI / 4; // 45°
/** Breathing room around the framed content, as a fraction of the tight fit. */
const FRAME_MARGIN = 1.15;
/** Camera distance along the view direction; content just needs to fit inside
 *  the 0.1..1000 near/far planes, so any comfortably large value works. */
const FRAME_DIST = 100;

/**
 * Build the renderer, an orthographic camera, soft lighting with basic
 * shadows, and orbit controls. The camera starts at the origin with a
 * placeholder frustum — the caller frames it onto real content via
 * {@link SceneContext.frameBox} immediately after setup.
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
  // Both are placeholders — frameBox() sets the real values before first use.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  (camera as any).viewSize = 12;
  camera.position.set(0, 50, 100);
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

  // ---- Orbit controls ----
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);

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

  function frameBox(box: THREE.Box3, direction: ViewDirection): void {
    const center = box.getCenter(new THREE.Vector3());

    const dir =
      direction === "axo"
        ? new THREE.Vector3(
            Math.cos(ISO_ELEVATION) * Math.sin(ISO_AZIMUTH),
            Math.sin(ISO_ELEVATION),
            Math.cos(ISO_ELEVATION) * Math.cos(ISO_AZIMUTH)
          )
        : new THREE.Vector3(0, 1, 0); // straight down

    // Looking straight down is a singularity for OrbitControls when its "up"
    // reference is also (0,1,0) (position-target ∥ up). Use world -Z ("north")
    // as up for the top view instead — perpendicular to a vertical look
    // direction, so the spherical math stays well-defined, and it reads as a
    // conventional north-up plan.
    camera.up.set(0, direction === "axo" ? 1 : 0, direction === "axo" ? 0 : -1);

    // Project the box's 8 corners onto this view's right/up axes to find the
    // half-extents the frustum must cover — handles the axo case, where the
    // box is seen at an angle, not just face-on.
    const xAxis = new THREE.Vector3().crossVectors(camera.up, dir).normalize();
    const yAxis = new THREE.Vector3().crossVectors(dir, xAxis).normalize();

    let halfW = 0.5;
    let halfH = 0.5;
    const corner = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      corner
        .set(
          i & 1 ? box.max.x : box.min.x,
          i & 2 ? box.max.y : box.min.y,
          i & 4 ? box.max.z : box.min.z
        )
        .sub(center);
      halfW = Math.max(halfW, Math.abs(corner.dot(xAxis)));
      halfH = Math.max(halfH, Math.abs(corner.dot(yAxis)));
    }

    const aspect = canvas.clientWidth / (canvas.clientHeight || 1) || 1;
    (camera as any).viewSize = Math.max(halfH, halfW / aspect) * FRAME_MARGIN;
    camera.zoom = 1;

    camera.position.copy(center).addScaledVector(dir, FRAME_DIST);
    controls.target.copy(center);
    camera.lookAt(center);
    handleResize();
    controls.update();
  }

  return { scene, camera, renderer, controls, groundPlane, handleResize, frameBox };
}
