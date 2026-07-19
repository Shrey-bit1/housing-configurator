import { norm360 } from "../core/orientation";

/**
 * The compass DIAL control — drag its needle to set the project north.
 *
 * It's a TOP-DOWN reference frame (screen up = world −Z = grid north), so the
 * needle's clockwise-from-up screen angle IS the `northAngle` (see
 * orientation.ts's convention: north = −Z rotated clockwise by northAngle). In
 * plan view this frame matches the screen exactly; the separate camera-aware
 * north arrow (main.ts) shows the true on-screen north in the oblique axo view.
 *
 * Two callbacks so the caller can honour the "commit on release" rule: `onInput`
 * fires continuously during a drag (update the live arrow, cheaply), `onCommit`
 * fires once on release (re-derive windows + push one undo snapshot).
 */
export interface CompassDial {
  /** Root element to place in the DOM. */
  readonly el: HTMLElement;
  /** Set the displayed angle WITHOUT firing callbacks — for load/undo sync. */
  setAngle: (deg: number) => void;
}

const SVGNS = "http://www.w3.org/2000/svg";

function svg(tag: string, attrs: Record<string, string>): SVGElement {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

export function createCompassDial(opts: {
  onInput: (deg: number) => void;
  onCommit: (deg: number) => void;
}): CompassDial {
  const el = document.createElement("div");
  el.id = "compass-dial";

  const root = svg("svg", { viewBox: "0 0 100 100", width: "72", height: "72" });

  // Fixed ring + 8 tick marks (every 45°), in the dial's own frame.
  root.appendChild(svg("circle", { cx: "50", cy: "50", r: "44", class: "cd-ring" }));
  for (let i = 0; i < 8; i++) {
    const a = (i * 45 * Math.PI) / 180;
    const sin = Math.sin(a);
    const cos = Math.cos(a);
    const inner = i % 2 === 0 ? 37 : 40; // cardinals longer than inter-cardinals
    root.appendChild(
      svg("line", {
        x1: String(50 + sin * inner),
        y1: String(50 - cos * inner),
        x2: String(50 + sin * 44),
        y2: String(50 - cos * 44),
        class: "cd-tick",
      })
    );
  }
  // A subtle fixed reference notch at screen-top: "up = plan north (−Z)".
  root.appendChild(svg("circle", { cx: "50", cy: "6", r: "1.8", class: "cd-ref" }));

  // The rotating needle: a north-pointing arrowhead + tail, with an N at the tip.
  const needle = svg("g", { class: "cd-needle" });
  needle.appendChild(svg("polygon", { points: "50,12 44,52 56,52", class: "cd-arrow" }));
  needle.appendChild(svg("line", { x1: "50", y1: "50", x2: "50", y2: "82", class: "cd-tail" }));
  const nLabel = svg("text", { x: "50", y: "26", class: "cd-n" });
  nLabel.textContent = "N";
  needle.appendChild(nLabel);
  root.appendChild(needle);

  el.appendChild(root);

  const caption = document.createElement("div");
  caption.className = "cd-caption";
  el.appendChild(caption);

  let angle = 0;

  function render(): void {
    // CSS/SVG rotate is clockwise for positive degrees (screen y-down), matching
    // our clockwise-from-up bearing — so the needle points to `angle` directly.
    needle.setAttribute("transform", `rotate(${angle} 50 50)`);
    caption.textContent = `North ${Math.round(angle)}°`;
  }

  function angleFromPointer(e: PointerEvent): number {
    const r = root.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    // Clockwise angle from screen-up: up=(0,−dy>0)→0, right=(+dx)→90.
    return norm360((Math.atan2(dx, -dy) * 180) / Math.PI);
  }

  let dragging = false;
  root.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    dragging = true;
    root.setPointerCapture(e.pointerId);
    angle = angleFromPointer(e);
    render();
    opts.onInput(angle);
  });
  root.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    angle = angleFromPointer(e);
    render();
    opts.onInput(angle);
  });
  const end = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    try {
      root.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
    opts.onCommit(angle); // one snapshot + window re-derive per gesture
  };
  root.addEventListener("pointerup", end);
  root.addEventListener("pointercancel", end);

  render();

  return {
    el,
    setAngle(deg: number) {
      angle = norm360(deg);
      render();
    },
  };
}
