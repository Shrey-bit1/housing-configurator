---
id: "0024"
title: Numbers in a room, and one view for every flat
created: 2026-09-03
---

## Context

Run 0023 connected the flat configurator to the session store. Two
things came out of it, one from the report and one from Shrey
looking at the Units panel.

THE NUMBER. The save dialog proposes the next free design number
from the library manifest, and that number is the flat's id in the
session. Every resident on the deployed site reads the same manifest,
so everyone is offered the same number, and five people accepting it
would publish over one flat five times. The room's flats have to
count too, and a publish over somebody else's flat has to be a
deliberate act.

THE PREVIEW. Flats published to a session show no picture in the
Units panel, and the library pictures were each taken from whatever
view the author happened to be in, so no two look alike. Every flat
gets one view: an axonometric, framed to the flat's own bounds, on
the paper ground, at one size. It is taken when a flat is saved to
the library and when it is published, and the existing library is
re-rendered through the same function so all of them match.

## Skills to use

Read the SKILL.md files from disk, under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`
as runs 0022 and 0023 did. `architectural-drawing` for framing an
axonometric to a bounding box, `interoperability` for the preview as
a second object beside the flat in the store. Report which you read,
what each contributed, and anything rejected with the reason.
Reference, not instruction.

## Assumptions

These may be wrong. Check rather than trust, contradict rather than
work around. Where the prompt is silent, choose sensibly, keep going,
and record the choice.

1. `main` carries run 0023 merged. Branch from `main` and say what
   you found.
2. `nextFreeNumber` lives in `src/library/naming.ts` and reads the
   library manifest only. `openSaveDialog` in `src/main.ts` already
   fetches the manifest; the session state is one more `GET`.
3. The library preview is taken in `saveLibraryEntry` (`src/main.ts`)
   by rendering one frame and reading `canvas.toDataURL("image/jpeg",
   0.9)` from the live camera, with the 1000-byte check against a
   hidden canvas. The unit browser (`src/library/unitBrowser.ts`)
   shows the library card's `preview` and the session card has no
   image.
4. The store (`src/session/store.ts`, `docs/store.md`) holds one blob
   per flat and one index per session. It has no preview and no
   notion of who may overwrite a flat.
5. The app exposes `window.__app` in DEV with the camera, scene,
   renderer and floor manager, so an off-screen render at a fixed
   pose and size can be driven from the app itself.

## Task

1. Numbers, commit `save: the next number counts the room`. With a
   session set, the dialog proposes the lowest number free in BOTH
   the library manifest and the session's flats, and the names line
   says which list the number came from. Without a session, today's
   behaviour.

2. Refusal, commit `store: a flat belongs to who published it`. A
   `PUT` on a flat id that another resident published answers 409
   with the other name in the body, unless the request carries
   `?replace=1`. The dialog shows that refusal as the Session result
   line, with the name, and offers a "Replace" box that is off by
   default and sends `replace=1` when ticked. Same resident, same id,
   is a republish as today. Document it in `docs/store.md`.

3. One view, commit `preview: one axonometric for every flat`. A
   function that renders the current flat as an axonometric at a
   fixed pose (front-left, from above, the pose you judge reads
   best and state it), framed to the flat's bounding box with a
   small margin, on the paper ground, at one fixed size such as
   800 by 600, without touching the user's camera or view state,
   and returns a JPEG. Every floor visible, the cutaway off, no
   overlays. Prove it leaves the camera and the view where they
   were, by reading them before and after.

4. The preview travels, commit `store: a flat has a picture`. Two
   calls: `PUT /api/session/{code}/flats/{id}/preview` with the JPEG
   as the body, and `GET` of the same path. The flat summary in the
   poll gains `preview: true` when one exists. Publish sends the
   preview right after the flat. The session card in the Units
   panel shows it, sized like the library card's. Document both
   calls in `docs/store.md`.

5. The library, commit `library: every preview through one function`.
   `saveLibraryEntry` uses the function from task 3. Then every
   existing library entry is re-rendered through it: open each
   entry's `sourceProject`, render, write the JPEG in place, keep the
   id and the manifest row. A dev-only control or script is fine.
   Commit the new JPEGs. Report the count and one before-and-after
   pair.

6. Tests, commit `numbers: tests`. `nextFreeNumber` over both lists
   with a gap in each; the refusal and the replace path in
   `store.test.ts`; the preview call against a stubbed `fetch`; the
   framing function's pose and size pinned on a known bounding box.
   Existing suites green, both fixture baselines still 12 and 7.

7. PROJECT_STATE.md and `_cowork/CONTEXT.md` updated.

8. The record. Report to
   `_cowork/outbox/0024-numbers-and-previews.report.md`, prompt
   moved to done/, one LOG row, committed on `run/0024` and pushed,
   with the preview address.

If the run runs long: tasks 1, 2 and 3 land whole; 4, 5, 6 and 7
follow named, in that order.

## Constraints

- A new branch `run/0024` from `main`. Never commit to main.
- The `dwelling-unit` format and `docs/bridge-format.md` stay
  untouched. The preview is a separate object, never inside the
  flat file.
- The rules and both fixtures stay untouched.
- The three file downloads stay byte-identical.
- No new dependencies. Never stage with `git add -A`. Commit before
  opening a file a second time.

## What I need back

Answer every point with its evidence. Raw output beats summary.

1. Every commit hash with one-line stats, the branch state found on
   `main`, and the preview address.
2. A deployed session in which two residents each accepted the
   proposed number and got different numbers, `GET /api/session/{code}`
   pasted whole.
3. The refusal: the 409 body, and the dialog's result line with the
   other resident's name, then the same publish with Replace ticked.
4. The axonometric pose and size chosen, and three previews side by
   side: a one-storey flat, a two-storey flat, and a published one
   from the session card.
5. The camera and view state before and after a preview render,
   quoted.
6. The library re-render: count, one before-and-after pair, and the
   manifest unchanged apart from `savedAt` if you touch it.
7. Test counts before and after, both fixture baselines.
8. Which skills you read from disk, what each contributed, anything
   rejected with the reason.
9. Contradictions with the Assumptions, then your own assumptions
   with their effects.

The report follows the writing rules: short sentences, plain words,
connected prose that carries its own logic, no em dashes as glue, no
contrast constructions, neutral voice, prose before any list or
table, every number exact, and every claim names its evidence. The
reader has no access to this repo, so cite paths and line numbers.
