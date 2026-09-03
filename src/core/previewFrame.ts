/**
 * The fixed pose every flat preview is rendered from (run 0024): axonometric,
 * from the front-left and above — the same isometric angle the app's own
 * "zoom to extent" already uses (`ISO_ELEVATION`/`ISO_AZIMUTH`/`FRAME_MARGIN`
 * in `src/scene/sceneSetup.ts`, mirrored here as plain numbers so this stays
 * pure). One flat gets one look regardless of what view its author happened
 * to be in when they saved, which is the point: a library card and a session
 * card should read as the same kind of picture.
 *
 * Pulled out as pure math, no THREE, no DOM, no scene, so the pose and size
 * can be pinned against a known bounding box in `previewFrame.test.ts` — the
 * one thing about "the framing function" that is worth testing in isolation.
 * The real render (`src/main.ts`'s `captureFlatPreview`) applies the result to
 * the app's live camera; it does not reimplement this math.
 *
 * These three constants mirror `sceneSetup.ts`'s `ISO_ELEVATION`,
 * `ISO_AZIMUTH` and `FRAME_MARGIN` exactly. They are restated rather than
 * imported because `src/core/` stays free of the scene layer, and there are
 * only three numbers to keep in sync.
 */
const ISO_ELEVATION = Math.atan(1 / Math.SQRT2); // 35.264°
const ISO_AZIMUTH = Math.PI / 4; // 45°
const FRAME_MARGIN = 1.15;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Box3Like {
  min: Vec3;
  max: Vec3;
}

export interface PreviewFrame {
  /** Unit view direction, camera → target: `(1/√3, 1/√3, 1/√3)`, the
   *  standard isometric direction — a closed form of the elevation/azimuth
   *  pair above, restated because it is the easiest thing to pin exactly. */
  direction: Vec3;
  /** World-space up for this pose: straight up, `(0, 1, 0)`. */
  up: Vec3;
  /** The box's own centre — what the camera looks at. */
  center: Vec3;
  /** Half the frustum's vertical extent in world units, margin included —
   *  an orthographic camera's `viewSize` (`sceneSetup.ts`). */
  viewSize: number;
}

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: Vec3): number => Math.sqrt(dot(a, a));
const normalize = (a: Vec3): Vec3 => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

/**
 * The axo pose and the viewSize that frames `box` at `aspect` (width/height)
 * with `FRAME_MARGIN` of breathing room. Same box-corner projection as
 * `sceneSetup.ts`'s `frameBox`: project all 8 corners onto the view's own
 * right/up axes and take the largest half-extent, so an angled view of a
 * non-cubical box is still framed correctly, not just its face-on silhouette.
 */
export function axoFrame(box: Box3Like, aspect: number): PreviewFrame {
  const center: Vec3 = {
    x: (box.min.x + box.max.x) / 2,
    y: (box.min.y + box.max.y) / 2,
    z: (box.min.z + box.max.z) / 2,
  };
  const direction: Vec3 = {
    x: Math.cos(ISO_ELEVATION) * Math.sin(ISO_AZIMUTH),
    y: Math.sin(ISO_ELEVATION),
    z: Math.cos(ISO_ELEVATION) * Math.cos(ISO_AZIMUTH),
  };
  const up: Vec3 = { x: 0, y: 1, z: 0 };
  const xAxis = normalize(cross(up, direction));
  const yAxis = normalize(cross(direction, xAxis));

  let halfW = 0.5;
  let halfH = 0.5;
  for (let i = 0; i < 8; i++) {
    const corner = sub(
      { x: i & 1 ? box.max.x : box.min.x, y: i & 2 ? box.max.y : box.min.y, z: i & 4 ? box.max.z : box.min.z },
      center
    );
    halfW = Math.max(halfW, Math.abs(dot(corner, xAxis)));
    halfH = Math.max(halfH, Math.abs(dot(corner, yAxis)));
  }

  const viewSize = Math.max(halfH, halfW / aspect) * FRAME_MARGIN;
  return { direction, up, center, viewSize };
}
