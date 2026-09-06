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

/**
 * How far this flat has got towards the group, in this visit (run 0035).
 *
 * ONE value rather than two booleans. Run 0034 had a single `hasSent` flag,
 * which cannot tell a flat that was never sent from one that was sent and
 * then edited, because both leave it false. Those two want different words
 * on the screen, so the flag grew a third state instead of gaining a
 * neighbour: two booleans would have four combinations and only three of
 * them mean anything.
 *
 *   never    nothing has gone to the group yet
 *   sent     the group has this flat, exactly as it is here
 *   edited   the group has an older version of this flat
 */
export type SendState = "never" | "sent" | "edited";

/**
 * Step 02's one red button, in its two moments (run 0034). Before a flat
 * has reached the group it is the send button; after, it is the way to the
 * group, where the resident goes on with the same flat. One button rather
 * than two, so the screen never offers a choice a resident has no way to
 * make. A flat edited after a send is a flat with something to send again,
 * so the button goes back to being the send button.
 */
export const SEND_IT = "Send it";
export const GO_TO_GROUP = "Go to your group";

export function sendButtonLabel(state: SendState): string {
  return state === "sent" ? GO_TO_GROUP : SEND_IT;
}

/** What the group is looking at, when it is not what is on the screen. */
export const GROUP_HAS_OLDER =
  "Your group still has this flat as you sent it. Sending again replaces it.";

/**
 * The line under step 02's button, or an empty string when there is nothing
 * to say. It says something only once a flat has been sent AND changed since,
 * which is the one moment a resident can be wrong about what their neighbours
 * are looking at.
 */
export function staleNotice(state: SendState): string {
  return state === "edited" ? GROUP_HAS_OLDER : "";
}

/** Where an edit leaves it. A flat nobody has sent is still a flat nobody has
 *  sent, however much it changes. */
export function afterEdit(state: SendState): SendState {
  return state === "never" ? "never" : "edited";
}

/** Why step 02 is locked, and why the forward button is asleep. It names
 *  what the entrance is FOR rather than where it goes (run 0035): a
 *  resident who has not placed one needs the reason they should care, and
 *  the editor already refuses an entrance anywhere but an outside edge, so
 *  saying where to put it was answering a question nobody had. */
export const NO_WAY_IN = "Place an entrance to send the flat to the group.";

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
