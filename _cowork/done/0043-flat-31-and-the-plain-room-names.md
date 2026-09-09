---
id: "0043"
title: Flat 31, the plain room names, and the test group says so
created: 2026-09-08
---

## Context

Three small things from runs 0041 and 0042's questions, answered by Shrey on
8 September.

A library entry named "Unit 31" was saved from the app at 12:47 on
8 September, during his walkthrough, and it breaks the naming rule from run
0035 that every library entry reads Flat NN. Three tests are red because of
it. The rule stands. The entry is renamed, and the save path that let "Unit"
through is closed.

The twenty room names, "Bedroom — Small" and the rest, travel inside every
flat file, so they cannot be rewritten without breaking files already in
groups. The file stays as it is. Each app shows a plain display name instead,
mapped from the stored one: "Small bedroom". This is the flat app's half; the
building app gets the same table in its own run.

A group filled by `scripts/fill-group.mjs` should say so, so a recording
cannot be mistaken for twenty real people: the script writes one message in
the store's own voice, "This group was filled for a test."

## Skills to use

Read the SKILL.md files from disk, under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`.
`interoperability` for the display-name table, which must map every stored
name and never change what the file carries. Report which you read, what
each contributed, and anything rejected.

## Assumptions

Check rather than trust, contradict rather than work around.

1. `public/units/index.json` holds a row named "Unit 31";
   `src/library/libraryNames.test.ts:80` requires Flat NN; run 0036 made
   the save dialog offer `flat-NN` only while a flat has never been sent.
   Something still lets a "Unit" name through: the "More" fold's library
   save, or a rename, or the dev endpoint.
2. `src/core/unitExport.ts:238` writes `def.name` into the unit file, and
   the same `def.name` is what the palette, the plan labels and the check
   lines show.
3. The fill script writes messages through `POST /messages` with a `who`;
   an empty `who` is the store's own voice (run 0036).

## Tasks

1. Flat 31, commit `library: Flat 31, and no way to name a Unit`. Rename
   the entry to "Flat 31" in the manifest, keeping its file and preview.
   Find the path that produced "Unit 31" by trying every way a library
   entry gets a name, and close it so that every path proposes and
   accepts Flat NN only. The three red tests go green without being
   changed.

2. The plain room names, commit `words: the rooms by their plain names`.
   One table in `src/core/words.ts` from every stored room name to a
   display name in the guide's voice ("Small bedroom", "Living room",
   "Bathroom", and so on for all twenty), and one function that reads it
   with the stored name as the fallback. Every place a person sees a room
   name uses it: the palette, the plan labels, the check-layout lines, the
   send panel, the library cards. The unit file, the project file and the
   three downloads do not change by a byte. Add the same table, byte for
   byte, to `_cowork/design/room-names.md` in the Context style so the
   building app copies it.

3. The test group says so, commit `script: a filled group says it was
   filled`. `fill-group.mjs` posts one message in the store's voice as its
   last write: "This group was filled for a test, with twenty people who
   are not real." The round-trip check reads it back.

4. Tests, commit `tests for 0043`. The naming paths; the display table
   covering every stored name; the downloads byte-identical; the fill
   message. Existing suites green, both fixture baselines still 12 and 7,
   the fingerprint test passing, `tsc` clean.

5. The finishing pass, as the last task before the report: open the app at
   1440 by 900, read every screen a room name appears on, and read the
   library. List each under "The finishing pass" with what was seen, fix
   what was found.

6. PROJECT_STATE.md and `_cowork/CONTEXT.md` updated. Report to
   `_cowork/outbox/0043-flat-31-and-the-plain-room-names.report.md`,
   prompt moved to done/, one LOG row.

All six tasks land. There is no short version of this run.

## Constraints

- A new branch `run/0043` from `main`. If `main` does not carry run 0042,
  stop and report.
- The `dwelling-unit` format, the project file and the three downloads
  stay byte-identical. The store is not changed.
- Every word on screen goes through `src/core/words.ts` and the guide.
- No new dependencies. Never stage with `git add -A`. Commit before
  opening a file a second time.

## What I need back

1. Every commit hash with one-line stats and the branch state found on
   `main`.
2. The path that produced "Unit 31" and what closed it.
3. The display-name table, all twenty rows.
4. Two pictures at 1440 by 900: step 01 with the palette and a plan label
   showing plain names; the library with Flat 31.
5. Test counts before and after, both fixture baselines, the three
   download checks, the fingerprint test, `tsc` clean.
6. Which skills you read from disk, what each contributed, anything
   rejected.
7. Contradictions with the Assumptions, then your own assumptions with
   their effects.

The report follows the writing rules: short sentences, plain words,
connected prose that carries its own logic, no em dashes as glue, no
contrast constructions, neutral voice, prose before any list or table,
every number exact, and every claim names its evidence. The reader has no
access to this repo, so cite paths and line numbers.
