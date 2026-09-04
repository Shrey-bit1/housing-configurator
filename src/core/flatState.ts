/**
 * The two rules the flat app's chrome runs on (run 0027), as production
 * rules over ONE state value rather than as ifs scattered across main.ts.
 * `design-automation`'s §2.1 is the shape: IF the flat is in this phase
 * THEN the card, the button, the grid and the step tabs all read the same
 * answer, and there is exactly one place to change it.
 *
 * Rule one, the phase. A flat is `empty` before anything is placed,
 * `unready` once something is placed but the unit still cannot be built
 * (no usable entrance, an empty or disconnected storey), and `ready` when
 * `buildUnitExport` succeeds. Everything the chrome asks follows from it:
 *
 *   empty    numbers read dashes, the name reads "Untitled", the check
 *            line is a hint rather than an error, Send is asleep, the
 *            drop hint sits on the grid, step 02 is locked
 *   unready   numbers and the check line behave as they did before run
 *            0027, Send is asleep, step 02 is locked
 *   ready     everything live, Send awake, step 02 open
 *
 * Rule two, the arrival: whether a resident sees the landing screen at
 * all, decided by the URL alone.
 *
 * Pure: no DOM, no FloorManager, no imports. `flatState.test.ts` drives
 * both rules directly.
 */

export type FlatPhase = "empty" | "unready" | "ready";

/**
 * @param placedRooms how many module instances exist across every floor
 *   (`floors.floors` summed over `store.instances.size` in main.ts)
 * @param unitBuilds whether `buildUnitExport` returned `ok`
 */
export function flatPhase(placedRooms: number, unitBuilds: boolean): FlatPhase {
  if (placedRooms <= 0) return "empty";
  return unitBuilds ? "ready" : "unready";
}

/** Step 02 and the Send button open together, on the same answer: a flat
 *  the store would accept is a flat that has a way in and holds together. */
export function canSend(phase: FlatPhase): boolean {
  return phase === "ready";
}

/** The one ghost tile on the grid, and only before anything is placed. */
export function showsDropHint(phase: FlatPhase): boolean {
  return phase === "empty";
}

/** Whether the layout rules are worth running yet. Nothing is checked
 *  until a resident has placed something, so an untouched grid never
 *  reports a fault the resident has not had the chance to make. */
export function checksRun(phase: FlatPhase): boolean {
  return phase !== "empty";
}

/** What the flat's name reads before it is worth naming. */
export const UNTITLED = "Untitled";

/** What a number reads when there is nothing to count. */
export const DASH = "—";

/** The check line in the empty phase: a hint, carrying no fault. */
export const EMPTY_HINT = "Drag a room onto the grid to start. Nothing is checked until you do.";

/** Why step 02 is locked, said in the resident's own terms. */
export const NO_WAY_IN =
  "Place an entrance on an outside edge first, so the flat has a way in.";

/**
 * Whether the landing screen shows at all. A URL that already names a
 * project or a group belongs to a resident who is coming back, or to a
 * link someone passed them, so the app opens straight into the editor and
 * the landing would only be in the way.
 */
export function showsLanding(search: string): boolean {
  const params = new URLSearchParams(search);
  return !params.has("project") && !params.has("session");
}
