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
| `PUT` | `/api/session/{code}/flats/{id}?resident=…&label=…` | the `dwelling-unit` JSON | the flat's summary; `201` created, `200` replaced |
| `PUT` | `/api/session/{code}/residents/{name}` | any of `counts`, `share`, `ballot` | that resident's whole record after the merge |
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
  "bbox": [0, 0, 15, 14],
  "floors": 1,
  "areaCells": 194,
  "publishedAt": "2026-09-02T11:02:04.643Z"
}
```

### `PUT /api/session/{code}/residents/{name}` — a resident's wishes

The name is the URL segment, decoded, 1 to 64 printable characters (encode
spaces as `%20`). The body is a JSON object with any of three keys, and only
the keys present are changed, so a body of `{ "share": 0.5 }` leaves that
resident's counts and ballot alone. Each key that is present is checked and
replaced whole:

- `counts` maps flat ids to whole numbers ≥ 0: how many of which flat this
  resident wants.
- `share` is a number between 0 and 1, the wished share of shared space, or
  `null`.
- `ballot` is an ordered list of shared-space type names, most wanted first.

A resident who has never been written reads as
`{ "counts": {}, "share": null, "ballot": [] }` underneath the merge.

```
PUT /api/session/room-42/residents/Ben
content-type: application/json

{ "share": 0.5, "ballot": ["garden"] }
```

```json
200 OK
{ "name": "Ben", "counts": { "flat-3": 2 }, "share": 0.5, "ballot": ["garden"] }
```

Here Ben's `counts` came from an earlier body that sent only `counts`.

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
and the last run as one JSON document, and one blob per published flat at
`{code}/flats/{id}`, holding the file's bytes.

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
