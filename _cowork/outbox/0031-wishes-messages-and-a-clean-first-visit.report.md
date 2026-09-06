---
id: "0031"
title: The store carries the wishes and the group's messages, and a first visit starts empty
source: 0031-wishes-messages-and-a-clean-first-visit.md
status: complete
branch: run/0031
commit: 8d3b827
completed: 2026-09-06
---

## Summary

Three things that had nowhere to live now have somewhere. A resident's three
wishes about their own flat travel on the resident record, so the packer will be
able to reach them. The group gets a small append-only message list, capped at
200, so five people in a room can say something to each other while the building
changes. And this app's landing no longer fills its two fields from storage on a
browser that has never used it, so a first visit shows two empty fields and a
return visit says plainly that it is picking up where the resident left off.

## What I did

- `src/session/store.ts:88-107` — `Resident` gains `wishes`, and the `Wishes`
  interface beside it.
- `src/session/store.ts:427-443` — the `wishes` check in `parseResidentPatch`,
  and `WISH_KEYS` naming the three once.
- `src/session/store.ts:115-145` — the `Message` interface, `MESSAGE_CAP` at 200
  and `MESSAGE_MAX` at 500, and `messages?` on `SessionIndex`.
- `src/session/store.ts:296-330` — the `POST …/messages` route.
- `src/session/store.ts:123` — `POST` added to the CORS allow-methods.
- `src/session/store.ts:445-455` — `messages: index.messages ?? []` in
  `sessionView`.
- `docs/store.md:61-62` — the table row for `wishes` and the messages row;
  `:226` the `wishes` bullet; `:264` the new messages section; both worked
  examples.
- `scripts/store-roundtrip.mjs` — Ana's wishes, Ben's absence of them, two
  messages, and all of it read back from the poll and the export.
- `src/session/session.ts:101-124` — `landingRecall`.
- `src/main.ts:1290`, `:1301-1308` — the recall element and the wiring.
- `index.html:356` and `src/style.css:2907` — the sentence's element and style.
- `src/session/store.test.ts` and `src/session/session.test.ts` — fourteen new
  cases, six existing assertions updated.
- `PROJECT_STATE.md:3891`, `:3956`, `:4230`, `_cowork/CONTEXT.md:286`.

## Findings

**Assumption 2 needed its verification and the answer is not run 0030's.**
`sessionView` (`src/session/store.ts:445`) spreads a RESIDENT record whole, which
is why `shareM2` and `extraM2` needed no line there. It names its own top-level
keys one by one, so `messages` did need one. The rule to carry forward is that a
field added to a resident is free and a field added to the session is not.

**A wish that is absent and a wish that is false are the same thing.** That is
why a partial object is a 400 rather than a merge. Accepting `{corner: true}`
would leave `terrace` and `quiet` at whatever they were, or absent, and the
packer would then need an opinion about a third state that means nothing.

**`who` is trimmed and `text` is not.** A name with spaces round it is the same
name. A message with spaces round it is the message somebody chose to send, and
trimming it before the length check would silently reject a message of two
spaces that a person deliberately sent. The tests pin both directions.

**`text` is stored verbatim and never interpreted.** Nothing in the store
escapes, strips or parses it. Whoever renders it owns that, and the building app
is where that decision has to be made. This is under open questions.

## Evidence

**1. Commits and the branch state found on `main`.**

`main` was at `f231571`, "Merge run/0029: fifteen more flats, a bedroom rule, a
way to delete, and the two fields", so it carries runs 0029 and 0030 and the
constraint's stop condition did not fire. `run/0031` branched from it. Six
commits:

| hash | message | stats |
|---|---|---|
| `072ff60` | store: the resident carries three wishes | 1 file, +42 -1 |
| `cf5c336` | store: the group can say something | 1 file, +65 -1 |
| `83f19d7` | docs: wishes and messages | 1 file, +47 -4 |
| `0770f9e` | store: the round trip proves the new two | 1 file, +20 -1 |
| `5b01603` | ui: a first visit starts empty | 4 files, +45 -2 |
| `8d3b827` | store: tests for 0031 | 2 files, +161 -13 |

**2. A resident with `wishes`, read back three ways.** From the round trip
against `netlify dev` on `http://localhost:8888`, session `rt-mtppf1pa`.

The `PUT` echo:

```json
{"name":"Ana","counts":{"flat-2":1},"share":0.3,"ballot":["laundry","workshop","garden"],"shareM2":7,"extraM2":5,"wishes":{"corner":true,"terrace":false,"quiet":true}}
```

Inside `GET /api/session/rt-mtppf1pa`:

```json
{"name":"Ana","counts":{"flat-2":1},"share":0.3,"ballot":["laundry","workshop","garden"],"shareM2":7,"extraM2":5,"wishes":{"corner":true,"terrace":false,"quiet":true}}
```

Inside `GET /api/session/rt-mtppf1pa/export`:

```json
{"name":"Ana","counts":{"flat-2":1},"share":0.3,"ballot":["laundry","workshop","garden"],"shareM2":7,"extraM2":5,"wishes":{"corner":true,"terrace":false,"quiet":true}}
```

And Ben, who never answered them, after three partial bodies:

```json
{"name":"Ben","counts":{"flat-3":2},"share":0.5,"ballot":["garden"],"shareM2":9,"extraM2":null,"wishes":null}
```

**3. The refusals for `wishes`, live.** Each a `PUT` to
`/api/session/probe-0031/residents/Ana`. Every one answers `400` with the same
message, which names all three keys:

```
{"wishes":{"corner":true}}                                          400  {"error":"wishes must be null or an object with corner, terrace, quiet all boolean"}
{"wishes":{"corner":"yes","terrace":false,"quiet":true}}            400  {"error":"wishes must be null or an object with corner, terrace, quiet all boolean"}
{"wishes":{"corner":true,"terrace":false,"quiet":true,"loud":true}} 400  {"error":"wishes must be null or an object with corner, terrace, quiet all boolean"}
{"wishes":"corner"}                                                 400  {"error":"wishes must be null or an object with corner, terrace, quiet all boolean"}
{"wishes":[]}                                                       400  {"error":"wishes must be null or an object with corner, terrace, quiet all boolean"}
```

The accepted one, for contrast:

```json
{"name":"Ana","counts":{},"share":null,"ballot":[],"shareM2":null,"extraM2":null,"wishes":{"corner":true,"terrace":false,"quiet":true}}
```

**4. Two messages, and the cap.** Posted by two different people, the second
carrying leading and trailing spaces:

```json
{"who":"Ana","text":"shall we put the terrace on the south side?","at":"2026-09-06T11:04:07.878Z"}
{"who":"Ben","text":"  yes, and keep the workshop  ","at":"2026-09-06T11:04:08.189Z"}
```

Read back from `GET /api/session/rt-mtppf1pa`, oldest first, and byte for byte
the same from `/export`:

```json
[{"who":"Ana","text":"shall we put the terrace on the south side?","at":"2026-09-06T11:04:07.878Z"},{"who":"Ben","text":"  yes, and keep the workshop  ","at":"2026-09-06T11:04:08.189Z"}]
```

Ben's spaces survived in both directions, which is the "stored exactly as sent"
claim tested rather than stated.

The cap, proved against the live store by posting 203 messages to
`/api/session/probe-cap/messages` and reading the poll:

```
posted 203, stored 200
first three stored: m4, m5, m6
last two stored  : m202, m203
m1 still there?   false
```

So `m1`, `m2` and `m3` fell off the front and `m203` is at the back. The same
thing is pinned in `store.test.ts` against the in-memory KV.

**5. The round-trip script, raw.** `node scripts/store-roundtrip.mjs
http://localhost:8888` ends `all checks passed for session "rt-mtppf1pa"`. Its
new lines:

```
  ok    Ana's three wishes came back from the PUT
  ok    Ben never answered the wishes, so they read null
  ok    first message stored with the store's timestamp
  ok    second message stored verbatim, spaces and all
  message 1: {"who":"Ana","text":"shall we put the terrace on the south side?","at":"2026-09-06T11:04:07.878Z"}
  message 2: {"who":"Ben","text":"  yes, and keep the workshop  ","at":"2026-09-06T11:04:08.189Z"}
  ok    Ana's wishes survive into the polled state
  ok    both messages are in the polled state, oldest first
  ok    Ana's wishes survive into the export
  ok    the export carries the same two messages
```

Both flat bodies still came back byte-identical at 37484 and 33388 bytes.

**6. The landing, field by field.** Measured live at 800 by 450 by setting
`localStorage` and reloading.

On a browser that has never used it, with the key absent: the group field is
`""`, the name field is `""`, and the sentence element is hidden with empty text.
Nothing is filled and nothing is claimed.

On a return visit, with `{"resident":"Ana","code":"room-42"}` stored: the group
field reads `room-42`, the name field reads `Ana`, and the sentence is shown,
reading in full:

> Picking up where you left off, as Ana in room-42. Change either if that is not you.

Its computed colour is `rgb(107, 102, 92)`, the meta grey, rather than the
accent red the error line below it uses.

On a browser that knows a code but no name, with `{"resident":"","code":"room-42"}`:
the group field reads `room-42`, the name field is `""`, and the sentence reads:

> Picking up where you left off, in room-42. Change it if that is not you.

It says "it" rather than "either" because there is one thing to change.

**7. Test counts, fixtures, downloads and `tsc`.** The fast suite goes from 261
in eighteen files to **275 in eighteen**. `store.test.ts` goes from 26 to 36 and
`session.test.ts` from 30 to 34. The slow suite is unchanged at
`57 passed | 1 expected fail`.

Both fixture baselines are unchanged at **12 and 7**, measured after this work:
`flat-1-two-storey.json` reads 1 hard plus 11 soft, `flat-1-no-stair.json` 1 hard
plus 6 soft. `testflats/`, `src/core/rules.ts`, `src/core/saveFiles.ts`,
`src/core/savePlan.ts`, `src/core/modules.ts` and `docs/bridge-format.md` all
show zero changed lines against `main`, and `saveFiles.test.ts` passes its eight
cases, so **the three downloads stay byte-identical**. `npx tsc --noEmit` is
clean and `npm run build` finishes with only the standing chunk-size warning.

**8. The skills.** Two were read from disk under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`.

`interoperability` contributed section 1.4's data-loss taxonomy again, and this
time the row that applies is **semantic loss**, "a wall becomes a generic
extrusion in the target tool". A partial `wishes` object accepted here would
reach the packer as three booleans that no longer mean what the resident chose,
because absent and false would have become distinguishable without meaning
anything different. Refusing the partial is what keeps the meaning intact across
the seam. Its section 1.2 on federated models is why `who` is not checked
against the resident list: each side owns its own constraints, and requiring a
published flat before a person may speak would be this side inventing a rule
about the other's screen.

`design-automation` contributed its section 1.4 hard and soft rule distinction to
the landing. "Has this person been here before" is one rule read in three places,
the code field, the name field and the sentence, and its key principle 4,
"design for maintenance", is the argument for `landingRecall` returning all three
answers from one call rather than each caller asking the question again.

`architectural-drawing`, `algorithmic-patterns`, `computational-geometry`,
`parametric-modeling` and the rest were **not read**: nothing here is geometry or
a parametric family.

**9. Contradictions with the Assumptions, then my own.**

Assumption 2 **held for residents and did not hold for the session**, which is
what it asked to be checked. `sessionView` spreads a resident record whole, so
`wishes` needed no line there, and it names its own top-level keys one by one, so
`messages` did. This is under Findings.

Assumptions 1, 3 and 4 hold as written. The landing was where assumption 3 said,
and the two lines it named are the two that changed.

My own assumptions. **The messages route has no `GET`.** Reading the list is the
poll's job and a client that wants the chat is already polling, so a second way
to read the same data would be a second thing to keep in step; a `GET` on the
route answers 405 and the test pins that. **`who` is not matched against the
resident list**, because somebody may want to say something before they have
published a flat. **`text` is not trimmed** before its length check, unlike
`who`. **An extra key in `wishes` is refused**, which the prompt did not ask for
but follows from "checks it whole": `{corner, terrace, quiet, loud}` is not the
object the field describes. **`MESSAGE_CAP` and `MESSAGE_MAX` are exported
constants** so the check, the error message, the document and the test cannot
drift. **The recall sentence gets its own element** rather than sharing the
error line, since one is information and the other is a warning and they can
both be true at once.

## Artifacts produced

- `src/session/store.ts`, `src/session/store.test.ts`, `src/session/session.ts`,
  `src/session/session.test.ts`, `scripts/store-roundtrip.mjs`, `docs/store.md`,
  `src/main.ts`, `index.html`, `src/style.css`.
- No new files.

## Decisions and rationale

**A partial `wishes` object is refused rather than merged.** Explained under
Findings. The alternative invents a third state that the packer would have to
decide about, and the packer is in another repository.

**Messages are POST and append-only.** POST because it appends rather than
replaces, which no other call in the store does. Append-only because the point is
a record of what a group said while a building changed under them, and a record
that can be quietly rewritten is not one. Moderation is a decision, not an
omission, and this run does not make it.

**The cap drops the oldest rather than refusing the newest.** A group in a room
for a user test would rather lose the beginning of the conversation than be told
they may not speak.

**`landingRecall` returns the fields as well as the sentence.** It could have
returned only a boolean and let the caller decide what to fill. Returning all
three means there is exactly one place where "has this person been here before"
is answered, which is what the prompt asked for.

## Deviations from the prompt

**The messages route answers 405 on GET.** The prompt did not say there should be
no GET; it said `GET /api/session/{code}` returns them under `messages`, which it
does. A second read path was not added, for the reason under point 9.

## Blocked / did not do

None.

## Open questions for you

**1. Who escapes the message text?** The store keeps it verbatim and never
interprets it, which is the right choice for a record. It also means the first
thing that renders a message into HTML owns the escaping, and that is the
building app's group screen. If that screen sets `innerHTML`, a message
containing a tag becomes markup. Worth deciding on purpose in the run that builds
the screen, and worth one sentence in `docs/store.md` once decided.

**2. Should a message name a resident rather than a free string?** `who` is
whatever the sender typed, and two people who type their name differently on two
days will appear as two speakers. Tying it to the resident record would fix that
and would stop somebody speaking before they have published a flat, which is the
reason it is loose today. The user test on the fifteenth will show which matters
more.

**3. Do the three wishes need weights?** They are booleans, so a resident who
wants a corner flat above all else and one who mildly prefers it are the same
input to the packer. That may be right for five people in a room, and it is a
decision the scoring run will have to make either way.

## Suggested next prompt

**0033, the group screen says something.** In the building app, put a working
message line on the group screen: post to `POST /api/session/{code}/messages`,
render the list from the poll oldest first, and show `who` and a short time
rather than the raw timestamp. Decide open question 1 there and write the
decision into `docs/store.md` on this side, so both repositories carry the same
sentence about who escapes the text. The store end is done and proved, so that
run is a screen and a decision rather than a contract change.
