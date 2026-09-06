---
id: "0035"
title: Leaving takes the flat, renaming keeps it, and the library counts from one
created: 2026-09-06
---

## Context

The building app's run 0059 made one person one flat, and then ran into what
this store will not let it do. It cannot delete a resident row, so "leave"
only empties the answers. It cannot change who owns a flat, so a person who
renames themselves is at the table twice until they send again. Both are
this repository's to fix, and Shrey decided on 6 September: **leaving takes
the flat with it.** One person is one profile is one flat; when the person
goes, the flat goes.

Three smaller things ride along. The asleep sentence under step 01's forward
button should say what the entrance is for. Step 02 should tell a resident who
has edited after sending that the group is still looking at the older flat.
And the library's names are a mess of "Unit 23", "Flat 08 — one bedroom,
corner" and "flat-2-single-storey"; Shrey wants every one of them to read
Flat 1, Flat 2, and so on, and none removed.

## Skills to use

Read the SKILL.md files from disk, under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`.
`interoperability` for the two new store calls, because the building app is the
caller and what it may assume is the whole question. `design-automation` for
"who may withdraw this flat", which is one rule already answered by
`sameResident` and must not become a second one. Report which you read, what
each contributed, and anything rejected.

## Assumptions

Check rather than trust, contradict rather than work around.

1. The store has `PUT` for a flat and for a resident, and no `DELETE` on
   either. A `DELETE` from a browser today fails at the CORS preflight with
   `TypeError: Failed to fetch`, measured by the building app's run 0059.
2. Ownership is `sameResident` from run 0026, used by the flat's replace check.
3. The forward button's asleep sentence is `NO_WAY_IN` at
   `src/core/flatState.ts:82-83`, and the same constant is the bar's step 02
   `title`.
4. `hasSent` at `src/main.ts:1005` is cleared on any edit at `src/main.ts:1209`,
   and `publishUnit` returns a version number.
5. `public/units/index.json` holds 29 rows: `flat-2-single-storey`,
   `flat-3-terrace`, `unit-1` to `unit-7`, and `unit-8` to `unit-27`. `unit-5`
   is quarantined in `src/core/libraryClean.slow.test.ts` for four must-fix
   failures. `unit-23` has lost its name and reads "Unit 23". Group
   `review-0023` in the live store references `unit-6`, `unit-7` and `unit-8`
   by id.

## Tasks

1. A person can leave, and their flat goes with them, commit `store: leaving
   takes the flat`. `DELETE /api/session/{code}/residents/{name}` removes that
   resident's row and every flat they own in that group, with the flat's
   preview. Ownership is `sameResident`. It answers `200` with what it removed,
   `{ resident, flats: [ids] }`, and `404` for a name that has no row and no
   flat. `OPTIONS` allows `DELETE` so a browser can make the call. The store's
   index and `/export` no longer mention them afterwards.

2. A person can rename and keep their flat, commit `store: a new name keeps the
   flat`. `POST /api/session/{code}/residents/{name}/rename` with `{ to }`
   moves the row to the new name and retags every flat they own, so a rename
   is one call and nobody is at the table twice. `409` if the new name already
   has a row or a flat. The name as typed is what is stored; only the
   comparison folds case, as run 0026 decided.

3. The document, commit `docs: leave and rename`. Two new rows in the call
   table in `docs/store.md`, a short section for each with the request, the
   response and the refusals, and one sentence in the sessions section saying
   that a person's flats leave with them.

4. The round trip, commit `store: the round trip leaves and renames`. In
   `scripts/store-roundtrip.mjs`: Ana renames to "Ana B" and her flat follows;
   Ben leaves and his flat and its preview are gone from the state and the
   export; a rename onto a taken name is refused. Print each raw.

5. The sentence under the forward button, commit `copy: what the entrance is
   for`. `NO_WAY_IN` becomes "Place an entrance to send the flat to the group."
   Everywhere it is read.

6. The group has your older flat, commit `ui: the group still has the old
   one`. When a resident edits after a successful send, step 02 says, under
   the button, one sentence: that the group still has the flat as it was sent,
   and that sending again replaces it. It appears only after a send and an
   edit, never before either. `hasSent` clearing is what triggers it; keep one
   flag and derive the sentence, do not add a second flag.

7. The library counts from one, commit `library: Flat 1 to Flat 29`. Every
   entry in the library is renamed "Flat N", in the manifest and in each file's
   own name field, and nowhere else. File ids do not change, because the live
   store references them and "unit" is a filename word. The order: the twenty
   flats this project designed, `unit-8` to `unit-27`, become Flat 1 to Flat 20
   in id order, because they are the ones a resident should meet first; the
   nine older entries, `flat-2-single-storey`, `flat-3-terrace` and `unit-1` to
   `unit-7`, become Flat 21 to Flat 29 in that order. Nothing is removed,
   Shrey's decision. The descriptor each designed flat carries today, "one
   bedroom, corner" and so on, is kept where the library card can show it as a
   second line if the manifest has a place for one, and dropped if it does
   not; say which. `unit-5` keeps its quarantine in
   `src/core/libraryClean.slow.test.ts` under its new name. The library's
   own rename path in the dev build (`onRename` at `src/main.ts:2146`) exists;
   use it or edit the files directly, and say which. The contact sheet in
   `_cowork/outbox/0029-contact-sheet.jpg` is not regenerated; say so.

8. Tests, commit `session: tests for 0035`. `DELETE`: removes the row and the
   flats and the preview; refuses a name that owns nothing; the export no
   longer carries them; ownership through `sameResident` so "ana" removes
   Ana's. Rename: the row moves, the flats follow, a taken name is refused,
   case folds on the comparison only. The step 02 sentence: absent before a
   send, absent after a send with no edit, present after a send and an edit,
   absent again after a second send. The library: twenty-nine rows named Flat 1 to
   Flat 29 in the order above, ids unchanged, the twenty designed ones clean
   and `unit-5` still quarantined.
   Existing suites green; both fixture baselines still 12 and 7; the three
   downloads byte-identical.

9. PROJECT_STATE.md and `_cowork/CONTEXT.md` updated. Report to
   `_cowork/outbox/0035-leaving-takes-the-flat.report.md`, prompt moved to
   done/, one LOG row.

All nine tasks land. There is no short version of this run.

## Constraints

- A new branch `run/0035` from `main`, and never a commit on main. If `main`
  does not carry run 0034, stop and report.
- The `dwelling-unit` format and `docs/bridge-format.md` stay untouched. The
  three downloads stay byte-identical. Both fixtures stay untouched.
- The store contract changes only by the two new calls and the CORS line.
- The editor, its tools and its validation are not touched.
- No new dependencies. Never stage with `git add -A`. Commit before opening a
  file a second time.

## What I need back

1. Every commit hash with one-line stats and the branch state found on `main`.
2. A leave, pasted whole: the state before, the `DELETE` response, the state
   after, the export after.
3. A rename, pasted whole, and the `409` on a taken name.
4. The round-trip script's output, raw.
5. The step 02 sentence quoted, and the four states in task 8 described.
6. The library manifest after, all twenty-nine rows, and what happened to
   the descriptors.
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
