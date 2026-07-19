import type { Side } from "./exteriorEdges";

/**
 * The ONE place the project's north concept is defined. Everything that needs a
 * compass bearing — the window generator's south-bias, the OR1 orientation rule,
 * the report's orientation-mix line, the on-screen north arrow — goes through
 * the utilities here, so the convention is stated once and never re-derived.
 *
 * ── THE CONVENTION (precise) ────────────────────────────────────────────────
 * The geographic **north vector is world −Z rotated CLOCKWISE (viewed from
 * above, i.e. looking down the −Y axis) by `northAngle` degrees.** So at
 * `northAngle = 0`, north is world −Z (which is also grid "north", the −z edge
 * side, see exteriorEdges.ts); increasing `northAngle` swings north toward world
 * +X (east), because east is 90° clockwise from north on a compass.
 *
 * A wall's **compass bearing** is the clockwise angle (viewed from above) FROM
 * that north vector TO the wall's outward normal, normalized to `[0, 360)`:
 *   0 = N, 90 = E, 180 = S, 270 = W.
 *
 * Implementation: the clockwise-from-world-−Z angle of a normal `(nx, nz)` is
 * `atan2(nx, −nz)` (check: (0,−1)→0=N, (1,0)→90=E, (0,1)→180=S, (−1,0)→270=W).
 * Subtracting `northAngle` re-references it from world −Z to true north.
 */

/** Compass sectors, clockwise from north — the 8-wind rose. */
export const COMPASS_SECTORS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type CompassSector = (typeof COMPASS_SECTORS)[number];

/**
 * Half-width (degrees) of the "north" arc for the OR1 rule: a windowed edge
 * counts as north-facing when its bearing lies within this many degrees of due
 * north (0/360). 45° makes the north arc 90° wide — the full N sector plus half
 * of NE and NW — i.e. "no meaningful direct sun at this latitude". Tunable.
 */
export const NORTH_SECTOR_HALF_WIDTH = 45;

const DEG = 180 / Math.PI;

/** Outward normal (grid/world axes: north=−z, south=+z, east=+x, west=−x). */
const SIDE_NORMAL: Record<Side, [number, number]> = {
  north: [0, -1],
  south: [0, 1],
  east: [1, 0],
  west: [-1, 0],
};

/** Normalize any degree value into `[0, 360)`. */
export function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Compass bearing (see the convention above) of the outward normal `(nx, nz)`
 * under `northAngle`, in `[0, 360)`. The single normal→bearing mapping every
 * consumer uses — pass a wall's `userData.wallNormal` components, or a side's
 * normal via {@link sideBearing}.
 */
export function normalBearing(nx: number, nz: number, northAngle: number): number {
  return norm360(Math.atan2(nx, -nz) * DEG - northAngle);
}

/** Compass bearing of an edge on `side` under `northAngle`. */
export function sideBearing(side: Side, northAngle: number): number {
  const [nx, nz] = SIDE_NORMAL[side];
  return normalBearing(nx, nz, northAngle);
}

/** Nearest of the 8 compass sectors to `bearing`. */
export function bearingSector(bearing: number): CompassSector {
  return COMPASS_SECTORS[Math.round(norm360(bearing) / 45) % 8];
}

/** Angular distance (degrees, `[0, 180]`) from `bearing` to due SOUTH (180) —
 *  the window generator's south-bias score (smaller = sunnier). South is exactly
 *  180 and bearing ∈ [0,360), so the linear |180 − bearing| already equals the
 *  angular distance (it never wraps). */
export function southDistance(bearing: number): number {
  return Math.abs(180 - norm360(bearing));
}

/** Angular distance (degrees, `[0, 180]`) from `bearing` to due NORTH (0/360). */
export function northDistance(bearing: number): number {
  const b = norm360(bearing);
  return Math.min(b, 360 - b);
}

/** Whether `bearing` lies within {@link NORTH_SECTOR_HALF_WIDTH} of due north. */
export function isNorthLit(bearing: number): boolean {
  return northDistance(bearing) <= NORTH_SECTOR_HALF_WIDTH;
}

/** Order distinct sectors most-southern first (then clockwise) — the order the
 *  report lists a room's glazing in ("glazing S + E"), and a stable, meaningful
 *  ordering for any sector list. Bearing of a sector = its index × 45. */
export function sortSectorsBySouth(sectors: CompassSector[]): CompassSector[] {
  return [...sectors].sort((a, b) => {
    const ba = COMPASS_SECTORS.indexOf(a) * 45;
    const bb = COMPASS_SECTORS.indexOf(b) * 45;
    return southDistance(ba) - southDistance(bb) || ba - bb;
  });
}

/**
 * World-space direction (XZ, unit length) that geographic north points, under
 * `northAngle` — `(sin θ, −cos θ)` for θ in degrees (check: θ=0 → (0,−1) world
 * −Z; θ=90 → (1,0) world +X/east). Consumed by the on-screen north arrow, which
 * projects this through the camera; kept here so the arrow and the bearings can
 * never disagree about which way north is. Returns a plain object — this core
 * module stays free of Three.js.
 */
export function worldNorthDir(northAngle: number): { x: number; z: number } {
  const r = northAngle / DEG;
  return { x: Math.sin(r), z: -Math.cos(r) };
}
