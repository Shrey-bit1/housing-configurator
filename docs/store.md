# The session store — one building, many residents, no files

Until run 0022 a flat left **Re_Configure** as a downloaded `dwelling-unit`
file (`docs/bridge-format.md`) and reached **bottom-up-design** when someone
uploaded it by hand. That works for one person at one desk. It does not work
for five residents in a room, which is the test the mid-review asked for. The
session store replaces the file with a small shared HTTP service that both
apps can reach: the flat configurator publishes to it, the building
configurator polls it and writes its runs back.

This document is the store's source of truth. The handler is
`src/session/store.ts`, its Netlify entry is `netlify/functions/session.mts`,
`src/session/store.test.ts` pins the contract without a live Netlify, and
`scripts/store-roundtrip.mjs` drives every call against a running one.

The `dwelling-unit` format is untouched. The store carries the published
file **byte for byte** and reads it only to compute a summary. Nothing in this
document changes anything in `docs/bridge-format.md`.

## Sessions and the no-login limit

One store serves many sessions. A session is a short code in the URL, chosen
by whoever starts it and told to the others: 1 to 32 characters from `a-z`,
`0-9`, `-` and `_`, compared case-insensitively (the store lowercases it), so
`Studio-3` and `studio-3` are the same room. Something like `room-42` or
`thesis-sep` is the intent.

**A group is started on purpose.** `POST /api/session/{code}` starts one and is
the only call that does. Before run 0032 a session existed the moment anybody
asked for it, which meant one typo in a code started an empty group of one while
the resident believed they had joined the twenty, and nothing could tell the two
apart afterwards.

`GET /api/session/{code}` therefore carries `exists`. **It is true when the
group carries `startedAt`, and also when it already holds at least one flat or
one resident.** The second half of that rule is there because every group live in
the store before run 0032 was created by the old behaviour and carries no
`startedAt`, and all of them should read as existing; without it they would all
have needed a migration, and a migration of other people's data is a worse thing
to ship than a two-part rule.

A `GET` on a code nobody has started still answers `200` with an empty group and
`exists` false, rather than `404`. That is deliberate: the building configurator
polls a code continuously, including before anybody has published anything, and
a `404` there would be a poll that fails for a group that is merely young.

**Who is in the group.** A person is in the group if they joined, which is a
resident row, or if they own a flat, which is a flat published under their
name. The store reads that off its own index, so nothing has to tell it who is
at the table and no membership list can go stale. Two names that match after
trimming and folding case are one person and count once. This is the rule the
vote uses to decide who may vote and how many votes a round is waiting for.

**A person's flats leave with them.** One person is one profile is one flat, so
`DELETE /api/session/{code}/residents/{name}` removes that person's row and
every flat they own in the same call, and nothing is left behind for the
building to keep packing.

**There is no login and no password: anyone who knows a session code can read
and overwrite everything in it, including flats published by others.** A
resident is a name typed in. That is accepted for a five-person test in one
room and it is the store's one recorded limit.

## Base URL and CORS

Every call lives under `/api/session/` on the site that hosts the
configurator, so on a Netlify deploy the base is
`https://<deploy>.netlify.app/api/session/`. The building configurator runs on
another origin, so every response carries
`Access-Control-Allow-Origin: *`, and `OPTIONS` on any path answers `204`
with methods `GET, POST, PUT, DELETE, OPTIONS` and the header `content-type`
allowed. Every method the store answers has to be named there or a browser
never sends the call: the preflight fails and `fetch` rejects with
`TypeError: Failed to fetch`, which says nothing about what was wrong.

A site-wide Netlify password gates these paths too: as of run 0022 the
`reconfigure-flat` site answers `401` to every request, preflights included,
until the password has been entered in a browser. The store cannot be
reached across origins while that is on.

## The calls

There are four things in a session: **flats**, **residents**, the last
**building** run, and the **session state** that summarises all three.

| Method | Path | Body | Returns |
|---|---|---|---|
| `GET` | `/api/session/{code}` | none | the session state: `exists`, flat summaries, residents, messages, last run |
| `POST` | `/api/session/{code}` | none | starts the group; `201` with its state, `409` if already started |
| `GET` | `/api/session/{code}/flats/{id}` | none | one flat's `dwelling-unit` JSON, byte for byte |
| `PUT` | `/api/session/{code}/flats/{id}?resident=…&label=…` | the `dwelling-unit` JSON | the flat's summary; `201` created, `200` replaced, `409` refused |
| `GET` | `/api/session/{code}/flats/{id}/preview` | none | the flat's JPEG picture |
| `PUT` | `/api/session/{code}/flats/{id}/preview` | the JPEG bytes | `{ ok, bytes }` |
| `PUT` | `/api/session/{code}/residents/{name}` | any of `counts`, `share`, `ballot`, `shareM2`, `extraM2`, `wishes` | that resident's whole record after the merge |
| `DELETE` | `/api/session/{code}/residents/{name}` | none | `{ resident, flats }`, naming what was removed; `404` if that name has neither a row nor a flat |
| `POST` | `/api/session/{code}/residents/{name}/rename` | `to` | `{ from, to, flats }`; `409` if the new name is already at the table |
| `POST` | `/api/session/{code}/messages` | `who`, `text` | the stored message with the store's `at`; `201` |
| `PUT` | `/api/session/{code}/round` | `n`, `pairs`, `weights` | the round as stored; `409` if `n` is not the next one or a round is still open |
| `POST` | `/api/session/{code}/rounds/{n}/votes` | `who`, `pair`, `pick`, `reasons` | the vote with `closedTheRound`; `403` from outside the group, `409` on a round that is not open |
| `POST` | `/api/session/{code}/rounds/{n}/close` | none | the round, closed by hand; `409` if it is not the open one |
| `GET` | `/api/session/{code}/building` | none | the last run, or `null` |
| `PUT` | `/api/session/{code}/building` | `genome`, `summary`, `by` | the stored run with its `at` timestamp |
| `GET` | `/api/session/{code}/export` | none | the session state plus every flat body, as strings |
| `OPTIONS` | anything | none | `204` with the CORS headers |

Errors are JSON `{ "error": "…" }` with `400` for a body or name the store
will not accept, `404` for a flat or route that does not exist, `405` for a
method a path does not take, and `409` when four attempts to update the
session index all lost a race to another writer (send again).

### `GET /api/session/{code}` — the session state

This is the call the building configurator polls, so it is small on purpose:
it never contains a flat body, only what a building needs to decide whether
to fetch one. Two published fixtures make it 555 bytes; with a building run
written, 655.

```
GET /api/session/room-42
```

```json
{
  "code": "room-42",
  "exists": true,
  "flats": [
    {
      "id": "flat-2",
      "resident": "Ana",
      "label": "Flat 2",
      "version": 2,
      "changed": true,
      "bbox": [0, 0, 15, 14],
      "floors": 1,
      "areaCells": 194,
      "publishedAt": "2026-09-02T11:02:05.483Z"
    }
  ],
  "residents": [
    { "name": "Ana", "counts": { "flat-2": 1 }, "share": 0.3, "ballot": ["laundry", "workshop", "garden"] }
  ],
  "building": null
}
```

A flat summary's fields: `id` is the flat's id as published; `resident` and
`label` are what the publisher sent; `version` starts at 1 and goes up by one
on every replace; `changed` is true since the last publish and false once a
building run has been written; `bbox` is `[minX, minZ, maxX, maxZ]` in cells
over the union of every storey, in the file's own normalized space;
`floors` is the storey count; `areaCells` is the number of occupied cells
over all storeys (multiply by 0.36 for m²); `publishedAt` is when the store
received it.

`exists` is described above. `startedAt` is the store's own timestamp for when
somebody started the group, written once by the `POST` and never overwritten. It
is held in the index rather than returned by the poll, because what a client
needs is the answer and not the date.

### `POST /api/session/{code}` — start a group

No body. `201` with the same shape the `GET` returns when the code was free,
and `409` when it was already started, with a message naming the code.

```
POST /api/session/room-42
```

```json
409 Conflict
{ "error": "group \"room-42\" has already been started" }
```

There is no owner and no password. Anybody who knows the code can still do
everything, which is the store's one recorded limit and this run does not change
it. Starting a group only makes the difference between a code that exists and a
code that does not visible, so joining can mean joining.

### `GET /api/session/{code}/flats/{id}` — one flat

Returns exactly the bytes that were published, with
`content-type: application/json`. Whitespace, key order and every field of
the `dwelling-unit` file are as the publisher sent them, so an importer that
validates the file sees what the exporter wrote.

```
GET /api/session/room-42/flats/flat-2
```

```json
{
  "format": "dwelling-unit",
  "version": 1,
  "name": "Flat 2 — single storey",
  …
}
```

`404` when the id has never been published in that session.

### `PUT /api/session/{code}/flats/{id}` — publish a flat

The body is the `dwelling-unit` JSON exactly as Export writes it. Who is
publishing and what to call it travel as query parameters, so the body stays
the file itself: `resident` is required, `label` is optional and falls back
to the file's own `name`. The id is chosen by the publisher, 1 to 64
characters from `a-z`, `0-9`, `-` and `_`. If the id exists in the session it
is replaced, its version goes up by one and `changed` becomes true; if it
does not, it is created at version 1.

The store checks only that the body is a JSON object with
`"format": "dwelling-unit"` and a `storeys` array whose `cells` are `[x, z]`
integer pairs, which is what the summary needs. Everything else in the file
passes through unread.

```
PUT /api/session/room-42/flats/flat-2?resident=Ana&label=Flat%202
content-type: application/json

{ "format": "dwelling-unit", "version": 1, "name": "Flat 2 — single storey", … }
```

```json
201 Created
{
  "id": "flat-2",
  "resident": "Ana",
  "label": "Flat 2",
  "version": 1,
  "changed": true,
  "preview": false,
  "bbox": [0, 0, 15, 14],
  "floors": 1,
  "areaCells": 194,
  "publishedAt": "2026-09-02T11:02:04.643Z"
}
```

`preview` is true once a picture has been stored for this id (see the preview
calls below), and stays true across a republish until a new picture overwrites
it.

**A flat belongs to whoever last published it under a resident name.** A `PUT`
whose `?resident=` differs from the flat's current owner is refused, unless
the request also carries `?replace=1`:

```
PUT /api/session/room-42/flats/flat-2?resident=Ben
content-type: application/json

{ "format": "dwelling-unit", "version": 1, … }
```

```json
409 Conflict
{ "error": "\"flat-2\" was published by Ana; add ?replace=1 to take it over", "resident": "Ana" }
```

`resident` in this error is the current owner's name, so a client can show
who to ask before offering to replace. `PUT …flats/flat-2?resident=Ben&replace=1`
with the same body succeeds, and Ben owns the flat from then on: a further
`PUT` from anyone but Ben is refused in turn, on the same terms. The SAME
resident republishing their own flat never needs `?replace=1`, exactly as
before this rule existed. A new id has no owner yet, so any resident may
create it.

### `PUT /api/session/{code}/residents/{name}` — a resident's wishes

The name is the URL segment, decoded, 1 to 64 printable characters (encode
spaces as `%20`). The body is a JSON object with any of five keys, and only
the keys present are changed, so a body of `{ "shareM2": 7 }` leaves that
resident's counts and ballot alone. Each key that is present is checked and
replaced whole:

- `counts` maps flat ids to whole numbers ≥ 0: how many of which flat this
  resident wants.
- `share` is a number between 0 and 1, or `null`. It is the pre-0056 reading of
  the shared-space question, a fraction of floor area, and nothing should read
  it again. It stays accepted because records already written carry it.
- `ballot` is an ordered list of shared-space type names, most wanted first.
- `shareM2` is how many square metres of shared space this resident thinks each
  person should pay for, or `null` when never answered. The store checks only
  that it is a whole number, zero or more. There is no upper bound here: how
  high the slider goes is the building app's business, and a bound written into
  the store would have to change in two repositories at once.
- `extraM2` is how many square metres this resident offered to pay for beyond
  that share, after the vote settled, or `null` when never answered. Same units
  and the same check: a whole number, zero or more.
- `wishes` is the three wishes this resident makes about their own flat, or
  `null` when never answered. `corner` is a wish for a flat on a corner of the
  building, with two outside faces rather than one. `terrace` is a wish to be
  near a shared terrace. `quiet` is a wish to be away from the noise, meaning
  the shared rooms and the circulation. All three keys must be present and all
  three must be booleans; a partial object is a `400` rather than a merge,
  because a wish that is absent and a wish that is false are the same thing to
  whoever reads them and letting them differ would invent a third state.

A resident who has never been written reads as
`{ "counts": {}, "share": null, "ballot": [], "shareM2": null, "extraM2": null,
"wishes": null }`
underneath the merge.

```
PUT /api/session/room-42/residents/Ben
content-type: application/json

{ "shareM2": 7, "extraM2": 5, "ballot": ["garden"],
  "wishes": { "corner": true, "terrace": false, "quiet": true } }
```

```json
200 OK
{
  "name": "Ben",
  "counts": { "flat-3": 2 },
  "share": null,
  "ballot": ["garden"],
  "shareM2": 7,
  "extraM2": 5,
  "wishes": { "corner": true, "terrace": false, "quiet": true }
}
```

Here Ben's `counts` came from an earlier body that sent only `counts`, and his
`share` is `null` because he has never sent one.

### `DELETE /api/session/{code}/residents/{name}` — leaving

Removes that person from the group and takes their flats with them. The row
goes, every flat they own goes, and each flat's picture goes with its flat.
Afterwards nothing in the session state, and nothing in `/export`, mentions
them.

Who owns a flat is the same rule the publish check uses: two names are one
person when they match after trimming and folding case. So `DELETE
.../residents/ana` removes the row filed under `Ana` and the flats published as
`Ana`. The name in the answer is the name as it was stored, not as it was
typed in the URL.

The call answers `404` when that name has neither a row nor a flat, so a person
who is not at the table cannot be removed twice. It answers `200` when either
one is there, which means a person who published a flat and never sent any
wishes can still leave, and so can a person who sent wishes and never published.

```
DELETE /api/session/room-42/residents/ben
```

```json
200 OK
{ "resident": "Ben", "flats": ["flat-3"] }
```

`flats` is sorted, and it is empty when that person had a row but no flat.

**The store says so afterwards.** Removing somebody appends one message to the
group's chat, `{ "who": "", "text": "Ben left the group.", "at": … }`. `who` is
empty on that one message and on no other, because every message a person
sends is refused unless `who` is 1 to 64 printable characters, so a reader can
tell the store's own voice from a person's without a second field. It is
subject to the same 200-message cap as anything a person says. It exists so
the record of a session can tell "four took part" from "five took part and one
left": without it, an export after a departure is indistinguishable from one
where that person never joined.

### `POST /api/session/{code}/residents/{name}/rename` — a new name

Moves a person's row to a new name and retags every flat they own, in one
write. It is one call rather than a `PUT` under the new name followed by a
`DELETE` of the old one, because between those two calls the person is at the
table twice and the building configurator is polling.

The body is `{ "to": "the new name" }`, checked by the same rule as the name in
the URL: 1 to 64 printable characters after trimming. Both names are stored as
typed; only the comparison folds case.

It answers `409` when the new name is already at the table, whether that is a
row or a published flat. Renaming to another spelling of one's own name is not
a clash with oneself, and it is the case this call mostly exists for: it is how
somebody who typed `ana` once and `Ana` the next time stops being two people.
It answers `404` when the name being renamed has neither a row nor a flat.

```
POST /api/session/room-42/residents/ana/rename
content-type: application/json

{ "to": "Ana B" }
```

```json
200 OK
{ "from": "Ana", "to": "Ana B", "flats": ["flat-2"] }
```

`from` is the name as it was stored. A flat's `id` never changes here, only the
`resident` recorded against it, so a link to a flat survives a rename.

### `POST /api/session/{code}/messages` — what the group said

A small append-only list, so five people in a room can say something to each
other while the building changes under them. `who` is 1 to 64 printable
characters, trimmed, and is deliberately not checked against the resident list,
since somebody may want to say something before they have published a flat.
`text` is 1 to 500 characters, is not trimmed, and is stored exactly as sent and
never interpreted. `at` is the store's own timestamp rather than the sender's.

```
POST /api/session/room-42/messages
content-type: application/json

{ "who": "Ana", "text": "shall we put the terrace on the south side?" }
```

```json
201 Created
{
  "who": "Ana",
  "text": "shall we put the terrace on the south side?",
  "at": "2026-09-04T18:22:10.417Z"
}
```

The list is capped at the **last 200** messages, oldest dropped, so a long
session cannot grow the index without bound. It comes back under `messages` in
`GET /api/session/{code}` and in `/export`, oldest first, and a group that has
said nothing reads as `[]` rather than as a missing key. There is no edit and no
delete: the point is a record of what a group said while it decided something.

### `PUT /api/session/{code}/round` — open a round of pairs

The vote runs as rounds of pairs. A round offers several pairs at once, each a
current building beside a challenger built by pushing one dial, and a resident
votes on each pair. The design is in the brief under "The vote chooses the
building"; the store holds the rounds and the votes and counts nothing beyond
"has everybody voted".

The body is the whole round:

- `n` is the round number, a whole number 1 or more. It must be exactly one
  more than the last round's number, or 1 when there has been none.
- `pairs` is a list, at least one, each `{ id, a, b, dial, sentence }`. `id` is
  yours and must be unique within the round. `a` and `b` are the two buildings,
  each `{ genome, summary }` and optionally `plot`; all three are opaque and
  stored exactly as sent. `dial` is the one reason the challenger was pushed
  on, one of the five below. `sentence` is the line the screen shows, naming
  what is different: "This one has more light and longer walks to the stair."
- `weights` is five numbers, one per reason, in the order the five are listed
  below. These are the weights the round was built with, kept so a round read
  back later is the round that ran.

The store adds `openedAt` and an empty `votes` list. A body carrying either is
ignored rather than refused, because they are not a caller's to send.

```
PUT /api/session/room-42/round
content-type: application/json

{ "n": 1,
  "weights": [1, 1, 1, 1, 1],
  "pairs": [
    { "id": "p1",
      "a": { "genome": [3, 1, 4], "summary": { "flats": 20 }, "plot": { "modulesX": 11 } },
      "b": { "genome": [3, 2, 4], "summary": { "flats": 20 }, "plot": { "modulesX": 11 } },
      "dial": "light",
      "sentence": "This one has more light and longer walks to the stair." }
  ] }
```

```json
201 Created
{ "n": 1, "pairs": [ … ], "weights": [1, 1, 1, 1, 1],
  "openedAt": "2026-09-07T09:00:00.000Z", "votes": [], "expected": 20 }
```

**Two refusals, both `409`.** A round while another is open is refused, naming
the open one, because the polled state's `round` can only mean one of them. An
`n` that is not the next one is refused, naming the number that was expected.
Both checks run inside the same write that would store the round, so two
clients racing to open the same round cannot both win: the loser reads the
winner's round and is refused.

### The five reasons

The reasons a resident may tick, and the dials a challenger is built on, are
five and are copied word for word from the brief:

```
privacy, shared space, cost, light, short walks
```

Both apps read them from that paragraph. Anything else, in a `dial` or in a
vote's `reasons`, is a `400` naming all five.

### `POST /api/session/{code}/rounds/{n}/votes` — one vote

The body is `{ who, pair, pick, reasons }`. `pick` is `"a"` or `"b"`.
`reasons` is a list of any of the five, in any order, and may be empty:
somebody may prefer a building without being able to say why.

One vote per person per pair. A second vote on the same pair replaces the
first while the round is open, so a resident who changes their mind is not
told they cannot. Who cast a vote is matched the way ownership is matched
everywhere in this store, after trimming and folding case, so a name typed two
ways is one voter.

`who` must be in the group by the rule above. Anybody else gets `403`. A vote
on a round that is not the open one gets `409`, and the message says whether
that round is closed or never existed.

```
POST /api/session/room-42/rounds/1/votes
content-type: application/json

{ "who": "Ana", "pair": "p1", "pick": "b", "reasons": ["light", "privacy"] }
```

```json
201 Created
{ "who": "Ana", "pair": "p1", "pick": "b", "reasons": ["light", "privacy"],
  "at": "2026-09-07T09:04:00.000Z", "closedTheRound": false }
```

`closedTheRound` is true on the vote that was the last one expected. The
client that cast it therefore knows at once, without polling.

### `POST /api/session/{code}/rounds/{n}/close` — close one by hand

**You should not normally need this.** The store closes a round itself, in the
same write that records its last expected vote, so a round is never open for a
moment after everybody has voted.

This exists for the day a rule for an absent person arrives. The brief says one
is coming and that "for now an absent person can hold a round open", and when
that rule is written this is where it will land. Until then it is a way to
close a round a group has given up waiting on.

It answers the closed round. `409` if that round is not the open one, saying
whether it was already closed or never existed.

### The vote in the polled state

`GET /api/session/{code}` carries two fields for the vote, both `null` when
there is nothing to carry, so a client can tell "no round" from "a store that
does not have this".

`round` is the open round, with two things added for counting. Each pair
carries `voted`, how many people have voted on it, and `expected`, how many are
at the table; the round itself carries `expected` as well. Every vote so far
rides along whole under `votes`, so a client that wants to count its own way
can. `lastRound` is the round that closed most recently, in the same shape.

```json
{ "code": "room-42",
  "round": { "n": 2, "expected": 20, "openedAt": "…",
             "weights": [1.2, 0.9, 1, 1.1, 0.8],
             "pairs": [ { "id": "p1", "a": {…}, "b": {…}, "dial": "light",
                          "sentence": "…", "voted": 8, "expected": 20 } ],
             "votes": [ { "who": "Ana", "pair": "p1", "pick": "b",
                          "reasons": ["light"], "at": "…" } ] },
  "lastRound": { "n": 1, "closedAt": "…", … } }
```

Only `/export` carries every round, under `rounds`, oldest first. A poll runs
every few seconds and every round holds two whole buildings per pair, so the
history stays out of it.

### `PUT` and `GET /api/session/{code}/building` — the last run

Written by the building configurator after a run, read by everyone. The body
is a JSON object; `genome` and `summary` are stored as sent and never
inspected, `by` is the name of whoever pressed run, and the store adds `at`.
Writing a run clears `changed` on every flat in the session, which is how the
building side knows, on its next poll, which flats it has already seen.

```
PUT /api/session/room-42/building
content-type: application/json

{ "genome": [3, 1, 4, 1, 5], "summary": { "flats": 2, "fitness": 0.71 }, "by": "Ben" }
```

```json
200 OK
{ "genome": [3, 1, 4, 1, 5], "summary": { "flats": 2, "fitness": 0.71 }, "by": "Ben", "at": "2026-09-02T11:02:08.466Z" }
```

`GET` on the same path returns the same object, or `null` when no run has
been written.

`plot` is OPTIONAL (run 0026) and opaque, exactly like `genome` and `summary`:
the building app's own record of the plot it built on — module grid size,
floor count, whatever it decides a plot is — stored exactly as sent and never
read inside. It travels back on `GET .../building`, on `GET /api/session/{code}`
(as `building.plot`) and on `GET .../export`, the same three places the rest of
a building run appears.

```
PUT /api/session/room-42/building
content-type: application/json

{ "genome": [3, 1, 4, 1, 5], "summary": { "flats": 2, "fitness": 0.71 }, "by": "Ben",
  "plot": { "modulesX": 11, "modulesY": 11, "floors": 7 } }
```

A `plot` present but not a JSON object is `400`; its absence means a building
app that predates the field, or a run with nothing yet to say about the plot.

### `GET`/`PUT /api/session/{code}/flats/{id}/preview` — a flat's picture

Added in run 0024, alongside the axonometric every flat gets when it is
published (`src/core/previewFrame.ts`, `src/main.ts`'s `captureFlatPreview`).
The picture is a **separate object from the flat**, never inside the
`dwelling-unit` JSON: `PUT` takes the JPEG as the raw request body (`content-
type: image/jpeg`, no envelope), and `GET` returns the same bytes back with
that content type. `PUT` requires the flat to already exist — a preview
belongs to a published flat, so `404` is the answer for an id nobody has
published yet.

```
PUT /api/session/room-42/flats/flat-2/preview
content-type: image/jpeg

<JPEG bytes>
```

```json
200 OK
{ "ok": true, "bytes": 24705 }
```

A flat's summary in the session state gains `preview: true` once one has
been stored, and it stays true across a republish of the same flat until a
new preview overwrites it — the summary never says which version the
picture is of, only that one exists. The store keeps the JPEG base64-encoded
under a key that is a **sibling** of the flat's own key, never a child of
it: an earlier shape nested the preview one path segment under the flat
(`{code}/flats/{id}/preview`), which collided with the flat's own key
(`{code}/flats/{id}`) in Netlify Blobs' local sandbox, since that store maps
keys onto a real filesystem path and the flat's key was already a file where
the preview's key needed a directory. See "Storage" below.

### `GET /api/session/{code}/export` — a session as one file

Added in run 0023 so the state of a room at the end of a user test can be
kept as one document and committed as thesis material. It returns exactly
what the session-state call returns, plus `bodies`, a map from flat id to
that flat's published file **as a string**, so the bytes survive the JSON
around them, and `exportedAt`. Reading a body back is `JSON.parse` of the
document and then the string itself; nothing needs re-encoding. It is the
one call that reads every flat blob, so it is for the end of a session
rather than for polling.

```
GET /api/session/room-42/export
```

```json
{
  "code": "room-42",
  "flats": [ { "id": "flat-2", "resident": "Ana", "label": "Flat 2", "version": 2, "changed": false, … } ],
  "residents": [ { "name": "Ana", "counts": { "flat-2": 1 }, "share": 0.3, "ballot": ["laundry"] } ],
  "building": { "genome": [3, 1, 4, 1, 5], "summary": { "flats": 2 }, "by": "Ben", "at": "2026-09-02T11:02:08.466Z" },
  "bodies": {
    "flat-2": "{\r\n  \"format\": \"dwelling-unit\",\r\n  \"version\": 1,\r\n  …"
  },
  "exportedAt": "2026-09-02T12:40:11.208Z"
}
```

A flat whose body blob is missing, which the store never produces itself,
appears in `bodies` as `null` rather than being dropped, so the export always
names every flat the state names.

## Storage

One Netlify Blobs store named `sessions`, read with strong consistency so a
poll issued right after a publish sees it. Per session code there is one
**index** blob at `{code}/index`, holding the flat summaries, the residents
and the last run as one JSON document, one blob per published flat at
`{code}/flats/{id}`, holding the file's bytes, and (run 0024) one blob per
preview at `{code}/flats/{id}.preview`, base64-encoded, holding the JPEG.

The preview's key is a **sibling** of the flat's key, in the same
`{code}/flats/` "directory," never a path segment under it. Netlify Blobs'
local development store maps a key onto a real filesystem path, one path
component per `/`, so a key of `{code}/flats/{id}/preview` needs `{id}` to
be a directory — but `{id}` is already the flat's OWN key, a file. Every
write to that shape hung indefinitely under `netlify dev` until the key
changed to `{code}/flats/{id}.preview`, a plain filename next to the
flat's, which cannot collide with anything. Whether the production Blobs
backend shares this exact failure mode was not tested, and does not matter:
the key was wrong on its own terms, since one object should never need
another object's own name to double as its folder.

The layout was chosen against the polling call. One blob for the whole
session would have put every flat body on the path of every poll and every
write, so a session of ten flats would read and rewrite some 600 KB on each
resident's smallest change. With the index separate, a poll reads one
document of a few hundred bytes, a publish writes the flat once and touches
the index only to update a summary, and a flat body is read only by the
one-flat call that asked for it.

Every change to the index is a read-modify-write under the blob's ETag,
retried up to four times, so two residents publishing at the same moment
cannot overwrite each other's summary; an unknown session is created with a
create-only write for the same reason.

The store is global to the site rather than per deploy, so a branch deploy
and production share the same sessions.
