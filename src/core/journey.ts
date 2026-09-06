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

/**
 * How one dot reads (run 0034, the brief's landing section as settled on
 * 6 September). Three tones, not four: the dot a resident is on now, the
 * dots that belong to the app they are in, and the dots that belong to the
 * other app.
 *
 * This replaces run 0027's done/now/ahead. Done and ahead told a resident
 * how far along they were, which the strip cannot know across two apps that
 * share nothing but a store: the flat app has no way to find out whether a
 * resident has voted. Which app owns a step is knowable from
 * {@link JOURNEY} alone, and it answers the question the strip is actually
 * for, which is "how much of this happens here".
 */
export type JourneyTone = "now" | "here" | "elsewhere";

/** Position of `id` in {@link JOURNEY}, or -1 when nothing carries it. */
export function journeyIndex(id: string): number {
  return JOURNEY.findIndex((s) => s.id === id);
}

/**
 * One tone per step, in {@link JOURNEY}'s own order. The step a resident is
 * on is `now`; every other step is `here` when this app owns it and
 * `elsewhere` when the other app does. An id no step carries leaves no `now`
 * at all, which is what a landing wants before a resident has chosen a door.
 *
 * The two apps call this with different `thisApp`, so the flat app gets the
 * first two `here` and the last four `elsewhere`, and the building app gets
 * the mirror image, from one function neither app has to reimplement.
 */
export function journeyTones(currentId: string, thisApp: JourneyApp): JourneyTone[] {
  const at = journeyIndex(currentId);
  return JOURNEY.map((s, i) => (i === at ? "now" : s.app === thisApp ? "here" : "elsewhere"));
}
