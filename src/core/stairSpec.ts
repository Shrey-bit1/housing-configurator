import { CELL_SIZE } from "./grid";

/**
 * Stair proportions and per-type geometry arithmetic (run 0020).
 *
 * The 13 August supervisor meeting called the old one-cell stair illegal: a
 * 0.6 m flight is not a stair anyone can climb. This module holds the numbers
 * four real stairs are derived from, kept pure (no three.js, no DOM) so the
 * arithmetic is testable and so `stairMesh.ts` draws exactly what is reported.
 *
 * THE RULE. Riser target 170 mm, tread 270 mm, and the walking rule
 * 2R + T = 610 mm. The riser is NOT free: the storey height fixes the total
 * rise, so the riser count is chosen to land nearest the 170 mm target and the
 * exact riser that results is carried through as a number, never rounded to a
 * tidy figure for display. At the default 3.0 m storey that is 18 risers of
 * 166.667 mm, and 2R + T = 603.3 mm.
 *
 * THE TREAD holds at 270 mm wherever the footprint allows it, which at the
 * default storey height it always does; a flight that would overrun its
 * footprint compresses its tread to fit rather than growing through the wall,
 * and {@link StairPlan.treadCompressed} says so. Occupancy is the contract:
 * geometry never leaves the cells the stair claims.
 *
 * THE SPIRAL is the exception and is reported as one. Its going is measured
 * along a walking line, and inside a 2.4 m square no 18-riser spiral can reach
 * a 270 mm going there without exceeding a full turn. See {@link spiralPlan}.
 */

/** Target riser, millimetres. The riser count is chosen to land nearest this. */
export const RISER_TARGET_MM = 170;
/** Nominal tread (going), millimetres. */
export const TREAD_MM = 270;
/** The walking rule the pair is checked against: 2 × 170 + 270. */
export const RULE_2R_T_MM = 610;

/** How a type turns: one straight flight, a 180° dogleg, a continuous spiral,
 *  or three flights around a well. */
export type StairKind = "straight" | "dogleg" | "spiral" | "c";

export interface StairSpec {
  /** Module type id, the key in MODULE_DEFS. */
  type: string;
  kind: StairKind;
  /** Footprint in cells at rotation 0, x by z. */
  widthCells: number;
  lengthCells: number;
  /** Width of ONE flight, metres. The spiral reads this as its outer diameter. */
  flightWidthM: number;
  /** How many flights the risers split across. The spiral climbs continuously
   *  and reports 1. */
  flights: number;
}

/**
 * THE FOUR TYPES, with the footprints derived in `docs`-worthy detail below.
 * Every length here is checked against the arithmetic by `stairSpec.test.ts`,
 * so a footprint that stops fitting its own flights fails the suite.
 */
export const STAIR_SPECS: Record<string, StairSpec> = {
  // 18 risers, 17 goings × 270 = 4590 mm of run inside 8 cells (4800 mm); the
  // 210 mm left over reads as a threshold at the foot. 1.2 m wide, the width
  // the meeting asked for.
  stair_straight: { type: "stair_straight", kind: "straight", widthCells: 2, lengthCells: 8, flightWidthM: 1.2, flights: 1 },

  // Two flights of 9 risers, 8 goings × 270 = 2160 mm each, plus a 900 mm
  // half-landing = 3060 mm inside 6 cells (3600 mm). DEFAULT WIDTH IS THE
  // TIGHT ONE: two 0.9 m flights = 1.8 m, the standard domestic dogleg, which
  // is what a dwelling can actually spare.
  stair_dogleg: { type: "stair_dogleg", kind: "dogleg", widthCells: 3, lengthCells: 6, flightWidthM: 0.9, flights: 2 },

  // The generous variant of the same stair: two 1.2 m flights = 2.4 m.
  stair_dogleg_wide: { type: "stair_dogleg_wide", kind: "dogleg", widthCells: 4, lengthCells: 6, flightWidthM: 1.2, flights: 2 },

  // A circle in its square: 2.4 m outer diameter in 4×4 cells, 18 treads of
  // 20° making exactly one turn. See {@link spiralPlan} for what that costs.
  stair_spiral: { type: "stair_spiral", kind: "spiral", widthCells: 4, lengthCells: 4, flightWidthM: 2.4, flights: 1 },

  // Three flights of 6 risers around a well, 5 goings × 270 = 1350 mm each.
  // Derived footprint 2250 × 3150 mm (run + landing across, landing + run +
  // landing along), which lands on 4 × 6 cells = 2.4 × 3.6 m.
  stair_c: { type: "stair_c", kind: "c", widthCells: 4, lengthCells: 6, flightWidthM: 0.9, flights: 3 },
};

export interface StairPlan {
  spec: StairSpec;
  /** The storey height this plan was derived for, metres. */
  storeyHeightM: number;
  /** Total risers from floor to floor. */
  risers: number;
  /** The exact riser, millimetres. Carried unrounded; format at the edge. */
  riserMm: number;
  /** The tread actually drawn, millimetres. 270 unless compressed to fit. */
  treadMm: number;
  /** True when the footprint forced the tread below {@link TREAD_MM}. */
  treadCompressed: boolean;
  /** Risers per flight, earlier flights taking any remainder. */
  risersPerFlight: number[];
  /** Goings per flight: one fewer than its risers, the last riser topping out
   *  onto the landing or the floor above. */
  goingsPerFlight: number[];
  /** Run of each flight, metres. */
  flightRunM: number[];
  /** 2R + T for this plan, millimetres, against {@link RULE_2R_T_MM}. */
  walkingRuleMm: number;
}

/** Riser count for a storey: whichever count puts the riser nearest the
 *  170 mm target, never fewer than 2. */
export function riserCountFor(storeyHeightM: number): number {
  return Math.max(2, Math.round((storeyHeightM * 1000) / RISER_TARGET_MM));
}

/** Split `risers` across `flights`, giving any remainder to the EARLIER
 *  flights, so you climb the longer flight first and the shorter one last. */
export function splitRisers(risers: number, flights: number): number[] {
  const base = Math.floor(risers / flights);
  const extra = risers % flights;
  return Array.from({ length: flights }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Metres of run each flight of this spec has available inside its footprint,
 *  before any landing the type needs. */
function availableRunM(spec: StairSpec): number {
  const lengthM = spec.lengthCells * CELL_SIZE;
  switch (spec.kind) {
    case "straight":
      return lengthM;
    case "dogleg":
      // One landing at the turn, as deep as a flight is wide.
      return lengthM - spec.flightWidthM;
    case "c":
      // The middle flight runs the length between two landings.
      return lengthM - 2 * spec.flightWidthM;
    case "spiral":
      return lengthM; // not a straight run; see spiralPlan
  }
}

/**
 * The plan for one type at one storey height. Everything the mesh builder and
 * the report need, derived once so the two cannot disagree.
 */
export function planStair(spec: StairSpec, storeyHeightM: number): StairPlan {
  const risers = riserCountFor(storeyHeightM);
  const riserMm = (storeyHeightM * 1000) / risers;
  const risersPerFlight = splitRisers(risers, spec.flights);
  const goingsPerFlight = risersPerFlight.map((r) => Math.max(1, r - 1));

  // The tread holds at 270 unless the longest flight would overrun the
  // footprint, in which case every flight compresses together so the stair
  // still reads as one stair.
  const longestGoings = Math.max(...goingsPerFlight);
  const availableM = availableRunM(spec);
  const fitMm = (availableM * 1000) / longestGoings;
  const treadCompressed = spec.kind !== "spiral" && fitMm < TREAD_MM;
  const treadMm = treadCompressed ? fitMm : TREAD_MM;

  return {
    spec,
    storeyHeightM,
    risers,
    riserMm,
    treadMm,
    treadCompressed,
    risersPerFlight,
    goingsPerFlight,
    flightRunM: goingsPerFlight.map((g) => (g * treadMm) / 1000),
    walkingRuleMm: 2 * riserMm + treadMm,
  };
}

export interface SpiralPlan {
  /** Degrees turned per tread. 18 treads of 20° make exactly one turn. */
  degreesPerTread: number;
  /** Outer radius, metres: the circle inscribed in the square footprint. */
  outerRadiusM: number;
  /** The central newel's radius, metres. */
  newelRadiusM: number;
  /** Walking line radius, metres: half the clear width out from the newel,
   *  which is where a going is measured. */
  walkRadiusM: number;
  /** The going at that walking line, millimetres. */
  walkGoingMm: number;
  /** The going at the outer edge, millimetres. */
  outerGoingMm: number;
  /** Walking-line radius that WOULD give a 270 mm going at this tread angle,
   *  and the square it would need. Reported because the 4×4 spiral misses it. */
  radiusForTargetM: number;
  squareForTargetM: number;
}

/**
 * The spiral's own arithmetic, kept separate because a spiral is measured
 * differently and because it is the one type that cannot satisfy the walking
 * rule at the size asked for.
 *
 * A going on a spiral is an arc, so it depends on where it is measured. The
 * walking line sits half the clear width out from the newel. In a 2.4 m square
 * with a 100 mm newel the clear width is 1.1 m, putting the walking line at
 * 650 mm, and 18 treads of 20° give a 227 mm going there. That is short of the
 * 270 mm target, so 2R + T comes to 560.7 mm rather than 610 mm.
 *
 * Reaching 270 mm at 20° per tread needs a walking line at 773 mm, hence a
 * 2.65 m circle and a 3.0 m (5×5 cell) square. Both numbers are returned so
 * the choice between a smaller stair and a compliant one stays visible rather
 * than being silently made here.
 */
export function spiralPlan(spec: StairSpec, plan: StairPlan): SpiralPlan {
  const degreesPerTread = 360 / plan.risers;
  const radPerTread = (degreesPerTread * Math.PI) / 180;
  const outerRadiusM = spec.flightWidthM / 2;
  const newelRadiusM = 0.1;
  const walkRadiusM = newelRadiusM + (outerRadiusM - newelRadiusM) / 2;
  return {
    degreesPerTread,
    outerRadiusM,
    newelRadiusM,
    walkRadiusM,
    walkGoingMm: walkRadiusM * radPerTread * 1000,
    outerGoingMm: outerRadiusM * radPerTread * 1000,
    radiusForTargetM: TREAD_MM / 1000 / radPerTread,
    // Invert the walking line: outer = 2·walk − newel, and the square is twice
    // that. 773 mm walking line gives a 1.446 m outer radius, a 2.89 m square,
    // which is 5 cells at 0.6 m.
    squareForTargetM: 2 * (2 * (TREAD_MM / 1000 / radPerTread) - newelRadiusM),
  };
}

/** Every stair type id, in palette order. */
export const STAIR_TYPES = Object.keys(STAIR_SPECS);
