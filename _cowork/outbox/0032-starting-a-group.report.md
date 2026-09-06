---
id: "0032"
title: Starting a group, and a code that does not exist says so
source: 0032-starting-a-group.md
status: complete
branch: run/0032
commit: 3c73ee3
completed: 2026-09-06
---

## Summary

A group is now started on purpose. `POST /api/session/{code}` starts one and is
the only call that does, and `GET /api/session/{code}` carries `exists` so the
two cases can be told apart. The landing gained a fourth door, Start a group,
which invents a code a person can read across a room, starts it, and shows it
back. Joining now means joining: a code nobody has started is refused with a
sentence naming the code the resident typed. The building app's poll is
untouched, which the report proves by reading it before and after.

## What I did

- `src/session/store.ts:129-145` — `startedAt` on `SessionIndex` and
  `groupExists`, the one rule.
- `src/session/store.ts:196-215` — the `POST` route.
- `src/session/store.ts:466` — `exists` in `sessionView`.
- `docs/store.md:26-45` — the sessions section rewritten; `:61-62` the table;
  `:296` the new `POST` section.
- `src/session/session.ts:40-89` — `CODE_WORDS` and `inventCode`.
- `src/session/session.ts:91-115` — `groupIsStarted`, `startGroup`,
  `noSuchGroupText`.
- `index.html:334`, `:365-383` — the fourth door and the Start a group screen.
- `src/style.css:2907-2932` — the code's type.
- `src/main.ts:1354-1400` — the door's handler and the join refusal.
- `scripts/store-roundtrip.mjs` — the group is started before it is used.
- `src/session/store.test.ts`, `src/session/session.test.ts` — fifteen cases.
- `PROJECT_STATE.md:3891`, `:3957`, `:4249`, `_cowork/CONTEXT.md:286`.

## Findings

**The bug was invisible by construction.** A group that was started and holds
nothing looked exactly like a group that was never started, so there was no
question the store could be asked that would separate them. That is why this run
had to add a field rather than only a route: without `exists` the landing could
not refuse anything.

**The two-part `exists` rule is what avoids a migration.** Every group live in
the store today was created by the old behaviour and carries no `startedAt`.
Making `exists` mean only "has `startedAt`" would have marked every one of them
as not existing, and joining them would have started failing. Adding "or holds a
flat or a resident" makes them all read as existing without touching a single
stored record. A migration of other people's data would have been a worse thing
to ship than a two-part rule.

**The taken-check has to run inside the mutate.** `updateIndex` re-reads and
re-runs its callback when it loses an ETag race. Checking `groupExists` before
calling it would let two people starting the same code at the same moment both
be told they won. Inside, the loser sees the winner's `startedAt` on the re-read.

## Evidence

**1. Commits and the branch state on `main`.** `main` was at `2eaa4d7`, "Merge
run/0031: the wishes, the group's messages, and a clean first visit", so
assumption 1 holds. `run/0032` branched from it. Eight commits:

| hash | message | stats |
|---|---|---|
| `155bc63` | store: a group is started on purpose | 1 file, +37 -1 |
| `44a028b` | store: exists, and what it means | 1 file, +4 |
| `300dade` | docs: starting a group | 1 file, +47 -4 |
| `43c116d` | session: a code worth reading aloud | 1 file, +43 |
| `38cab6f` | ui: start a group | 4 files, +111 |
| `b88c4cd` | ui: no such group | 2 files, +30 -1 |
| `ab9d3d8` | session: tests for 0032 | 2 files, +145 -1 |
| `3c73ee3` | store: the round trip starts a group | 1 file, +15 -1 |

**2. `POST` on a free code and on a taken one.** Against `netlify dev`, session
`rt-mtpqhwp2`:

```
201 {"code":"rt-mtpqhwp2","flats":[],"residents":[],"building":null,"exists":true,"messages":[]}
409 {"error":"group \"rt-mtpqhwp2\" has already been started"}
```

**3. `GET` on a code nobody has started, before and after this run.** The same
call, against the same running store, taken before any of this was written and
again after.

Before:

```json
{"code":"never-started-before","flats":[],"residents":[],"building":null,"messages":[]}
```

After:

```json
{"code":"rt-mtpqhwp2","flats":[],"residents":[],"building":null,"exists":false,"messages":[]}
```

Every field the first one carried is in the second and means the same thing.
`exists` is the only addition, and the call still answers `200` with an empty
group rather than failing, which is what the building app's poll needs. The test
`adds itself BESIDE everything the poll already returned` in
`src/session/store.test.ts` pins this by asserting the whole key set is exactly
`building, code, exists, flats, messages, residents`.

**4. `exists` on all four cases, each with the index behind it.** From
`src/session/store.test.ts`, run against the in-memory KV.

| case | index | `exists` |
|---|---|---|
| a code nobody has touched | no index written | `false` |
| after a `POST` | `startedAt` written | `true` |
| a group holding a flat | `startedAt` asserted `undefined`, one flat | `true` |
| a group holding a resident | `startedAt` asserted `undefined`, one resident | `true` |

The last two read `startedAt` straight out of the stored index and assert it is
absent before checking `exists`, so they are testing the pre-0032 shape rather
than a group that happens to pass for another reason.

**5. Twenty codes the generator invented**, so the wordlist can be judged:

```
pebble-29  olive-98  quartz-52  timber-91  birch-99
ember-19   zinc-05   lantern-03 birch-67   velvet-80
sage-06    pepper-49 delta-89   basil-80   copper-02
saffron-73 timber-81 thistle-74 apple-33   copper-65
```

The list holds 58 words, all lowercase `a-z`, so a code is inside the store's
own `CODE` rule by construction rather than by a check afterwards. All twenty
pass `/^[a-z0-9_-]{1,32}$/`. They were chosen to be said across a table without
spelling: one or two syllables, no pair that sounds alike, nothing that could be
heard as a letter, and nothing whose spelling anybody would have to ask about.
Note `birch` and `timber` and `copper` each appear twice above, which is the
digits doing their job: 58 words by 100 numbers is 5800 codes.

**6. The landing, measured live** against `netlify dev` at 800 by 450.

The doors read, in order: `Start a flat`, `Start a group`, `Join a group`,
`Open a file`.

Pressing Start a group swaps the doors for a screen carrying, top to bottom: the
label `Your group code` in the meta grey at 10px uppercase; the code itself,
`zinc-84` on that run, at `44px` in `rgb(214, 52, 28)` in the mono face, and
`user-select: all` so one click takes the whole thing; the sentence
`Pass this to the others so they can join. It is the only way in.`; a `Your name`
field, empty on a first visit; a `Start drawing` button; and a `back` link. It is
a plain screen in the app's own skin and not a dialog, for the reason the join
form is one.

**7. The refusal a resident sees**, quoted from the live run after typing
`zinc-99`, which nobody had started:

> No group called zinc-99. Check the code for a typo, or ask whoever started the group for it.

The landing stayed up and nothing was written. Joining `zinc-84`, started a
moment earlier from the new door, hid the landing and wrote
`{"resident":"Ana","code":"zinc-84"}` to storage, so a started code still joins
exactly as before.

**8. The round-trip script.** `node scripts/store-roundtrip.mjs
http://localhost:8888` ends `all checks passed for session "rt-mtpqhwp2"`. Its
new lines:

```
  before starting: {"code":"rt-mtpqhwp2","flats":[],"residents":[],"building":null,"exists":false,"messages":[]}
  ok    and says exists false, because nobody started it
  ok    POST starts the group, 201, exists true
  the POST that started it: 201 {"code":"rt-mtpqhwp2","flats":[],"residents":[],"building":null,"exists":true,"messages":[]}
  ok    starting it twice is refused with 409
  starting it twice: 409 {"error":"group \"rt-mtpqhwp2\" has already been started"}
  ok    exists is true after the start
  after starting: {"code":"rt-mtpqhwp2","flats":[],"residents":[],"building":null,"exists":true,"messages":[]}
```

**9. Test counts, fixtures, downloads and `tsc`.** The fast suite goes from 275
in eighteen files to **290 in eighteen**. `store.test.ts` goes from 36 to 45 and
`session.test.ts` from 34 to 40. The slow suite is unchanged at
`57 passed | 1 expected fail`.

Both fixture baselines are unchanged at **12 and 7**: `flat-1-two-storey.json`
reads 1 hard plus 11 soft and `flat-1-no-stair.json` 1 hard plus 6 soft.
`testflats/`, `src/core/rules.ts`, `src/core/saveFiles.ts`,
`src/core/savePlan.ts`, `src/core/modules.ts` and `docs/bridge-format.md` all
show zero changed lines against `main`, and `saveFiles.test.ts` passes its eight
cases, so **the three downloads stay byte-identical**. The editor, its tools and
its validation were not touched. `npx tsc --noEmit` exits 0 and `npm run build`
finishes with only the standing chunk-size warning.

**10. The skills.** Two were read from disk under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`.

`interoperability` contributed the shape of the constraint. Its section 1.4 data
loss taxonomy has no row for "a field appeared", which is the point: adding
beside is the only change to a polled contract that costs the other side
nothing, and every alternative considered here, a `404` on an unstarted code or
a separate `exists` route, would have been a change the building app had to
notice. Its section 1.2 on federated models is why the store answers the
question and the landing reads the answer rather than deciding for itself: each
side owns its own screen and they agree on one field.

`design-automation` contributed its section 1.4 hard and soft rule distinction to
`groupExists`. "Does this group exist" is one rule read by the store's `POST`,
the store's `GET` and the landing's join, and its key principle 4, "design for
maintenance", is why the three read one function rather than three copies of a
condition that would drift. Its section 2.1 production-rule shape, IF-THEN over
stated facts, is the two-clause form the rule ended up in.

Nothing else was read: no geometry, no packing, no drawing.

**11. Contradictions with the Assumptions, then my own.**

All four assumptions hold. Assumption 4 was the one that shaped the work: the
building app polls the code continuously and treats an empty answer as a young
group, so `exists` was added beside everything and a `404` was never considered
seriously. Point 3 above is that assumption held to.

My own assumptions. **"Taken" means `groupExists`**, so a group that holds a flat
but was never formally started also refuses a `POST`. Starting a group that is
already live would be a lie whether or not it carries `startedAt`. **No `GET` on
the `POST` route**, and a `PUT` there answers 405 saying `GET or POST only`.
**The code shape is one word and two digits**, which the prompt asked for; the
wordlist is 58 words and lives in `session.ts` rather than a data file, because
it is small and never loaded separately. **Five attempts in the landing** when
the store refuses an invented code, and a distinct message when the store cannot
be reached at all, so a resident is never shown a code that was not started.
**`groupIsStarted` fails closed**: anything other than a clean 200 carrying
`exists: true` reads as not started, so a store that is down refuses a join
rather than letting one through into a group that may not be there.

## Artifacts produced

- `src/session/store.ts`, `src/session/store.test.ts`, `src/session/session.ts`,
  `src/session/session.test.ts`, `scripts/store-roundtrip.mjs`, `docs/store.md`,
  `src/main.ts`, `index.html`, `src/style.css`.
- No new files.

## Decisions and rationale

**`exists` rather than a `404`.** A `404` on an unstarted code would have been
the tidier REST answer and would have broken the building app's poll, which is
the one thing the constraints forbade. A field costs the other side nothing until
it chooses to read it.

**The two-part rule instead of a migration.** Explained under Findings.

**The taken-check inside the mutate.** Explained under Findings.

**The wordlist lives in the code.** 58 words is small enough that a separate file
would be one more thing to load and keep in step, and the words are part of what
the feature is rather than data it happens to use.

**Five attempts, then a different message.** A collision is not the resident's
problem and should be retried silently; a store that cannot be reached is their
problem and should be said.

## Deviations from the prompt

**Tasks 5 and 6 were first committed together and then split.** The join refusal
and the Start a group screen both touch `src/main.ts`, and the first commit
carried both. It was reset and redone as `38cab6f` and `b88c4cd` so the history
matches the prompt's structure, which is why the two commits are adjacent and
the second is small.

## Blocked / did not do

None.

## Open questions for you

**1. What happens to a group nobody ever uses?** Every press of Start a group
writes a `startedAt` into the store, and a resident who presses it twice and
walks away has left two. Nothing cleans them up and nothing counts them. For a
five-person test that is nothing; for a term of teaching it is a slow leak, and
the fix is either an expiry or a count, both of which are decisions rather than
code.

**2. Should the code be shown again after the landing?** It is shown once, on
the screen that invents it, and after that a resident who forgot it has to read
it out of the send panel's group field. That is probably fine, and the person to
ask is whoever runs the fifteenth.

**3. Does the building app need to refuse an unstarted code too?** This side now
does. Somebody who types a typo into the building app's own join, if it has one,
would still land in a group of one. The field is there to read; whether that app
reads it is its own run.

## Suggested next prompt

**0034, the building app joins properly.** Read `exists` from
`GET /api/session/{code}` on the building app's own way in, and refuse a code
that has not been started with the same sentence this side uses, so a resident
who mistypes gets the same answer from either app. `docs/store.md` already
carries the field and the rule, so that run is a screen and a call rather than a
contract change. Decide open question 1 there as well, because the building app
is where a group's whole life is visible and this app only ever sees one flat.
