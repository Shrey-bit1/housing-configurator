/**
 * The whole journey a resident goes through, as data (run 0027).
 *
 * Six steps span TWO apps: this one authors a flat and sends it, the
 * building app (`bottom-up-design`, a separate repo that shares only
 * `docs/store.md`'s contract) does everything after that. The landing
 * screen renders this array so a resident can see what they are in for
 * before they start, and the building app is expected to render the SAME
 * array for the same reason, which is why the steps are exported data
 * rather than markup written into the landing.
 *
 * Keeping it as one ordered list, with the rendering downstream of the
 * model, is the shape `data-driven-design`'s own data-to-design pipeline
 * describes (its §1.3): the model is defined once and every view is a
 * later stage reading it, so two views can never disagree about the
 * order or the wording.
 *
 * Pure: no DOM, no imports. `journey.test.ts` pins the shape and the
 * marks.
 */

/** Which of the two apps owns a step. */
export type JourneyApp = "flat" | "building";

export interface JourneyStep {
  /** Stable key. Both apps render against this, never against the label. */
  id: string;
  /** What a resident reads. */
  label: string;
  app: JourneyApp;
}

/**
 * The six steps, in order. The first two are this app's own two steps
 * (`01 Draw your flat`, `02 Send it`, the top bar's tabs); the last four
 * are the building app's five screens minus its Join screen, which is a
 * door rather than a step.
 */
export const JOURNEY: readonly JourneyStep[] = [
  { id: "draw", label: "Draw your flat", app: "flat" },
  { id: "send", label: "Send it", app: "flat" },
  { id: "wishes", label: "Your wishes", app: "building" },
  { id: "group", label: "The group", app: "building" },
  { id: "your-flat", label: "Your flat in it", app: "building" },
  { id: "vote", label: "Vote", app: "building" },
];

/** How one step reads against the step a resident is on. */
export type JourneyMark = "done" | "now" | "ahead";

/** Position of `id` in {@link JOURNEY}, or -1 when nothing carries it. */
export function journeyIndex(id: string): number {
  return JOURNEY.findIndex((s) => s.id === id);
}

/**
 * One mark per step, in {@link JOURNEY}'s own order: everything before the
 * current step is `done`, the current step is `now`, everything after it is
 * `ahead`. An id no step carries leaves every step `ahead`, which is what
 * the landing wants before a resident has chosen a door at all.
 */
export function journeyMarks(currentId: string): JourneyMark[] {
  const at = journeyIndex(currentId);
  return JOURNEY.map((_, i) => (at < 0 || i > at ? "ahead" : i === at ? "now" : "done"));
}
