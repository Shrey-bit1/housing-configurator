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
`thesis-sep` is the intent. A session exists the moment someone asks for it:
`GET` on a code nobody has used returns an empty session rather than an
error, so the first resident can arrive before anyone else.

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
with methods `GET, PUT, OPTIONS` and the header `content-type` allowed.

A site-wide Netlify password gates these paths too: as of run 0022 the
`reconfigure-flat` site answers `401` to every request, preflights included,
until the password has been entered in a browser. The store cannot be
reached across origins while that is on.

## The calls

There are four things in a session: **flats**, **residents**, the last
**building** run, and the **session state** that summarises all three.

| Method | Path | Body | Returns |
|---|---|---|---|
| `GET` | `/api/session/{code}` | none | the session state: flat summaries, residents, last run |
| `GET` | `/api/session/{code}/flats/{id}` | none | one flat's `dwelling-unit` JSON, byte for byte |
| `PUT` | `/api/session/{code}/flats/{id}?resident=…&label=…` | the `dwelling-unit` JSON | the flat's summary; `201` created, `200` replaced, `409` refused |
| `GET` | `/api/session/{code}/flats/{id}/preview` | none | the flat's JPEG picture |
| `PUT` | `/api/session/{code}/flats/{id}/preview` | the JPEG bytes | `{ ok, bytes }` |
| `PUT` | `/api/session/{code}/residents/{name}` | any of `counts`, `share`, `ballot`, `shareM2`, `extraM2`, `wishes` | that resident's whole record after the merge |
| `POST` | `/api/session/{code}/messages` | `who`, `text` | the stored message with the store's `at`; `201` |
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
