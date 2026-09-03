---
id: "0023"
title: Publish
created: 2026-09-02
---

## Context

Run 0022 built the shared store: one Netlify Function over Netlify
Blobs, four calls under `/api/session/*`, documented in
`docs/store.md`, proved from the shell with `scripts/store-roundtrip.mjs`.
Nothing in the app reaches it yet. A flat still leaves as a download.

This run connects the flat configurator to the store. A resident
types a name and a session code once, presses Save as today, and a
fourth output sends the flat to the session. The unit browser shows
the flats the neighbours have published, and any of them can be
opened as a copy. That is the "design exchange" from the 4 August
review and step 2 and 3 of the interaction brief. A session can also
leave as one file, so the state of the room at the end of the user
test can be committed as thesis material.

The password gate on `reconfigure-flat` blocked run 0022's deployed
proof. Shrey turned it off on 2 September and merged `run/0022` into
`main`; `GET https://reconfigure-flat.netlify.app/api/session/probe-2sep`
answered `{"code":"probe-2sep","flats":[],"residents":[],"building":null}`
the same day. If the gate is back on when the run reaches the
deployed proof, the run says so and finishes with the local proof
only.

## Skills to use

Read the SKILL.md files from disk rather than invoking the skill
tool. Run 0022 found them under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`
by filename search. `interoperability` for the exchange and its
failure modes, `design-automation` for where the session fields sit
in the save workflow. Report which you read, what each contributed,
and anything rejected with the reason. Reference, not instruction.

## Assumptions

These may be wrong. Check rather than trust, contradict rather than
work around. Where the prompt is silent, choose sensibly, keep going,
and record the choice.

1. `main` carries run 0022 merged, at `71362a0` or later. If it does
   not, stop and report, because merging is Shrey's call and this
   run needs the store code.
2. The save dialog is `#save-dialog` in `index.html`, wired by
   `runSave` in `src/main.ts`, with its decision rules in
   `src/core/savePlan.ts` and its serialization in
   `src/core/saveFiles.ts`. The three checkboxes write the project
   file, the unit file and the library entry, each with one result
   line, and a failed unit never cancels the project file.
3. The store's publish call is `PUT /api/session/{code}/flats/{id}`
   with the unit file as the body and `?resident=…&label=…` in the
   query, answering with `version` and `changed`. The poll is
   `GET /api/session/{code}` and one flat is
   `GET /api/session/{code}/flats/{id}`. `docs/store.md` is the
   contract.
4. A published unit file embeds `sourceProject`, the same way a
   library entry does, so opening a neighbour's flat can follow the
   unit browser's existing open path (`onOpen` in `src/library/`,
   then `importProjectText` in `main.ts`).
5. In dev the store is only reachable through `netlify dev`, which
   proxies Vite and serves the function on one origin. The Vite dev
   server alone has no function.

## Task

1. The session, commit `session: a name and a code`. Two fields at
   the top of the save dialog: resident name and session code. Both
   are remembered in `localStorage` under one key, and the code can
   also arrive in the URL as `?session=room-42`, which wins over the
   stored one and is then stored. Codes are lowercased on the way
   in, matching the store. While either field is empty the Publish
   checkbox from task 2 is disabled and says why. Show the session
   somewhere visible outside the dialog, so a person knows which
   room they are in; a small line in the top bar is enough.

2. The fourth output, commit `publish: the fourth output`. A
   checkbox "Publish to session" beside the three existing ones. It
   PUTs the exact bytes the unit download would contain, to
   `/api/session/{code}/flats/unit-{n}` on the same origin, with the
   resident name and `Unit {n}` as the label. The result line reports
   what came back: "Published as Unit 4 to room-42, version 2". The
   rules that hold for the other outputs hold here: the choice is
   remembered for the session, a hard gate failure or a declined
   confirm costs only the unit-derived outputs, and a failed publish
   (network, 4xx, 5xx) never cancels the files and reports the
   status and the body's reason. The three existing downloads stay
   byte-identical to today, proven with a diff.

3. The neighbours' flats, commit `library: the neighbours' flats`.
   The unit browser gains a second group, "In this session", listing
   the flats the poll returns: resident, label, version, storeys and
   area from the summary, and a "changed since the last building"
   mark. Each opens as a copy through the existing open path, using
   the full-flat call. The group refreshes when the browser opens
   and on a Refresh control; no background polling in this app. With
   no session set the group says so in one line. The library group
   is untouched.

4. A session leaves as one file, commit `store: a session leaves as
   one file`. One new call, `GET /api/session/{code}/export`, that
   returns the index and every flat body in one JSON document, with
   the flat bodies carried verbatim as strings so their bytes
   survive. Document it in `docs/store.md` with one worked example,
   add it to the round-trip script as a check that every body in the
   export equals what was sent, and add one vitest case beside the
   eight in `src/session/store.test.ts`.

5. Tests, commit `publish: tests`. `savePlan.test.ts` covers the
   fourth output in every combination, including that a failed
   publish never cancels a file and that publish is refused without
   a name or a code. The publish call is tested against a stubbed
   `fetch`, asserting the URL, the query, the method and that the
   body is the unit bytes. Existing suites stay green: `npm test`,
   `npm run test:slow` with its one expected fail, `tsc`, `npm run
   build`. Both fixture baselines still read 12 and 7.

6. PROJECT_STATE.md and `_cowork/CONTEXT.md` updated.

7. The record. Report to `_cowork/outbox/0023-publish.report.md`,
   prompt moved to done/, one LOG row, committed on `run/0023` and
   pushed, with the preview address.

If the run runs long: tasks 1, 2 and the deployed proof land whole;
3, 4, 5 and 6 follow named, in that order.

## Constraints

- A new branch `run/0023` from `main`. Never commit to main.
- The `dwelling-unit` format and `docs/bridge-format.md` stay
  untouched. The rules and both fixtures stay untouched.
- The three existing outputs stay byte-identical.
- No new dependencies. Never stage with `git add -A`.
- Nothing for the building configurator is built here. The packer's
  catalogue panel is its own run in the other repo.
- Commit before opening a file a second time.

## What I need back

Answer every point with its evidence. Raw output beats summary.

1. Every commit hash with one-line stats, the branch state found on
   `main`, and the preview address.
2. The dialog before and after as captures, and the top-bar line
   showing a session.
3. The `localStorage` key and its shape, and what `?session=` does
   when both exist.
4. One publish from the app observed in the deployed store:
   `GET /api/session/{code}` pasted whole, then the same after a
   republish showing version 2.
5. The unit browser with the session group showing two flats from
   two residents, as a capture, and one of them opened as a copy.
6. The export call's response for that session, with the byte check
   from the round-trip script.
7. The round-trip script's deployed output pasted whole, and the
   local one, both at the final commit. If the gate is back on, say
   so and paste what came back.
8. The byte-identity proof for the three existing downloads.
9. Test counts before and after, both fixture baselines.
10. Which skills you read from disk, what each contributed, anything
    rejected with the reason.
11. Contradictions with the Assumptions, then your own assumptions
    with their effects.

The report follows the writing rules: short sentences, plain words,
connected prose that carries its own logic, no em dashes as glue, no
contrast constructions, neutral voice, prose before any list or
table, every number exact, and every claim names its evidence. The
reader has no access to this repo, so cite paths and line numbers.
