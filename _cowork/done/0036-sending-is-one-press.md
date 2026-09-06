---
id: "0036"
title: Sending is one press, and the store says who left
created: 2026-09-06
---

## Context

Pressing "Send it" today does five things. It downloads a project file, it
downloads a unit file, it writes a library entry, it sends the flat to the
group, and before any of that it may pop a browser dialog asking whether to
continue despite the advisory rules. Under "More" sit a design number, a
colour picker, five checkboxes and a Replace tick. A resident has to
understand all of that to send one flat.

Shrey's rule, 6 September: remove or automate anything that does not
specifically need the resident, and leave just enough choice that it does not
feel restricting. A resident says who they are and which group, once, on the
landing, and then presses Send. Everything else happens on its own or lives
folded under More.

One store change rides along: when a person leaves a group, the store itself
writes one line into the group's chat, so the record of a session can tell
"four took part" from "five took part and one left".

## Skills to use

Read the SKILL.md files from disk, under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`.
`design-automation`, because the button's label and the sentence under it are
one rule over three facts (is it ready, has it been sent, has it been edited
since) and must not become a tangle of ifs. `explain-code` on `runSave` before
touching it, because five things happen in one function and the order they
happen in matters. Report which you read, what each contributed, and anything
rejected.

## Assumptions

Check rather than trust, contradict rather than work around.

1. `runSave` in `src/main.ts` does the five things above in order: the
   advisory confirm, the project download, the unit download, the library
   entry, the publish. The checkboxes are `#save-what-*` in `index.html` under
   `#more-card`, with `#save-number`, `#save-color` and `#save-replace`.
2. The group code and the resident's name are stored in `localStorage` from
   the landing since run 0027, and shown again as two open fields on step 02
   (`#save-session`, `#save-resident`).
3. `sendState` from run 0035 is `never | sent | edited`, and
   `sendButtonLabel` and `staleNotice` in `src/core/flatState.ts` read it.
4. The store refuses to overwrite a flat published under another name unless
   `?replace=1` is sent, and accepts a republish by the same person
   (`sameResident`) without it.
5. The library write and the library's delete and rename are `import.meta.env.DEV`
   only, at `src/main.ts` around 2146 to 2163.
6. Whether the drawing survives a page reload is not known. Find out.
7. The store's leave is `DELETE /api/session/{code}/residents/{name}` from run
   0035 and the messages list is append-only with `{ who, text, at }`.

## Tasks

1. The drawing survives a reload, commit `editor: the flat is kept as you
   draw`. If the drawing is not already saved in the browser as it changes,
   save it, and restore it on load with one quiet line saying so. If it already
   is, say so in the report and move on. A resident should never lose a flat
   to a refresh.

2. Who and where, once, commit `ui: as you, to your group`. Step 02 no longer
   shows the two open fields. It shows one quiet line, "As Ana, to hall-14."
   with a small "change" that unfolds the two fields for the rare case. The
   values come from what the landing recorded. When there is no group yet, the
   line says so and the button leads to the landing's join.

3. One button, no dialog, commit `ui: send is one press`. The red button reads
   "Send it". When the checks have complaints it reads "Send anyway · N things
   to look at" and there is no browser dialog; the check line in the bar
   already says what they are. After a send it reads "Go to your group". After
   an edit that follows a send, the stale sentence from run 0035 shows. All of
   that is one rule in `src/core/flatState.ts` over the three facts, and the
   report shows it as a table.

4. Sending sends, commit `ui: sending writes nothing to your computer`.
   Pressing the button publishes the flat and does nothing else. No project
   download, no unit download, no library write. A resident's own earlier flat
   in the group is replaced without asking, through `sameResident`. Replacing
   somebody else's flat is no longer a resident option; the checkbox goes.

5. What is left under More, commit `ui: more holds three things, four for
   Shrey`. The folded More holds: the colour, chosen automatically from the
   app's own palette and changeable here; "Save a copy to my computer", which
   downloads the project file; and, only in the dev build, "Add to the
   library" and "Save the unit file". The design number is gone from the
   screen and chosen automatically. The five checkboxes and the Replace tick
   are gone. Nothing under More is needed to send.

6. The store says who left, commit `store: the store says who left`. When
   `DELETE .../residents/{name}` removes a person, the store appends one
   message to the group's chat, `{ who: "", text: "<name> left the group.", at }`,
   with `who` empty so a reader can tell the store's voice from a person's.
   Documented in `docs/store.md` beside the leave call, exercised in
   `scripts/store-roundtrip.mjs`, and the messages cap still holds.

7. Tests, commit `ui: tests for 0036`. The button rule over all combinations
   of the three facts. That the two fields are hidden when the landing has
   recorded a group and shown when it has not. That a send calls publish and
   nothing else, with the downloads and the library write asserted absent. The
   store's leave line: present after a leave, `who` empty, counted against the
   cap. Existing suites green, both fixture baselines still 12 and 7, the
   three downloads byte-identical when a resident chooses them under More.

8. PROJECT_STATE.md and `_cowork/CONTEXT.md` updated. Report to
   `_cowork/outbox/0036-sending-is-one-press.report.md`, prompt moved to
   done/, one LOG row.

All eight tasks land. There is no short version of this run.

## Constraints

- A new branch `run/0036` from `main`, and never a commit on main. If `main`
  does not carry run 0035, stop and report.
- The `dwelling-unit` format and `docs/bridge-format.md` stay untouched. The
  project file and the unit file a resident chooses to save under More stay
  byte-identical to what they are today.
- The store contract changes only by the leave line.
- The editor, its tools and its validation are not touched. Only the chrome.
- No new dependencies. Never stage with `git add -A`. Commit before opening a
  file a second time.
- Every sentence on a screen follows "How the app talks" in
  `_cowork/design/DESIGN-BRIEF-3sep.md`.

## What I need back

1. Every commit hash with one-line stats and the branch state found on `main`.
2. Whether the drawing already survived a reload, and what task 1 did.
3. Step 02 before and after, element by element, every sentence quoted.
4. The button rule as a table over the three facts.
5. Proof that a send writes nothing to disk: what a send used to trigger and
   what it triggers now.
6. The leave line, pasted raw from the chat after a leave in the round trip.
7. Test counts before and after, both fixture baselines, the three download
   checks, `tsc` clean.
8. Which skills you read from disk, what each contributed, anything rejected.
9. Contradictions with the Assumptions, then your own assumptions with their
   effects.

The report follows the writing rules: short sentences, plain words, connected
prose that carries its own logic, no em dashes as glue, no contrast
constructions, neutral voice, prose before any list or table, every number
exact, and every claim names its evidence. The reader has no access to this
repo, so cite paths and line numbers.
