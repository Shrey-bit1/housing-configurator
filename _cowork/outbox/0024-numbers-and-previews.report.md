---
id: "0024"
title: Numbers in a room, and one view for every flat
source: 0024-numbers-and-previews.md
status: complete
branch: run/0024
commit: db086eb
completed: 2026-09-03
---

## Summary

The prompt asked for two fixes to run 0023's session store: the design number
must count the room, not just the library, and a publish over somebody
else's flat must be a deliberate act; and one standard picture for every
flat, taken the same way whether it is saved to the library or published to
a session. All eight tasks are done, on `run/0024` in eight commits ending
at `db086eb`, pushed and verified against both `netlify dev` on this machine
and the branch deploy at `https://run-0024--reconfigure-flat.netlify.app`.
Two residents opening the same session and accepting the proposed number
now get `Unit 6` and `Unit 7`, never both `Unit 6`. A refusal names the
current owner and a Replace checkbox takes the flat over deliberately. Every
flat's picture is the same axonometric, framed to its own bounds, taken by
one function used by the library save, the session publish, and a one-time
re-render of all seven committed library entries. One real bug surfaced and
was fixed inside this run, not left for the next one: the preview's storage
key collided with the flat's own key in Netlify Blobs' local filesystem-backed
store, hanging every preview write under `netlify dev` until the key was
changed to a sibling of the flat's rather than a child of it. All suites are
green, the fixture baselines are unchanged, and the three existing downloads
are still byte-identical to `main`.

## What I need back — answers

### 1. Commits, the branch state on main, the preview address

`main` was at `d8a2343`, "Merge run/0023: publish," which carries run 0023
merged, as the assumption expected. `run/0024` was branched from it.

| Commit | Message | Stats |
|---|---|---|
| `70b8a1c` | save: the next number counts the room | 3 files changed, 73 insertions(+), 14 deletions(-) |
| `15f1a1b` | store: a flat belongs to who published it | 2 files changed, 205 insertions(+), 21 deletions(-) |
| `3a616bf` | docs: the flat-ownership refusal | 1 file changed, 29 insertions(+) |
| `8ba773f` | preview: one axonometric for every flat | 3 files changed, 238 insertions(+) |
| `67c67dc` | store: the preview key must not be the flat's own child | 1 file changed, 10 insertions(+), 2 deletions(-) |
| `fa892c9` | store: a flat has a picture | 7 files changed, 250 insertions(+), 16 deletions(-) |
| `4cbd711` | library: every preview through one function | 9 files changed, 54 insertions(+), 6 deletions(-) |
| `db086eb` | state: numbers count the room, a flat's owner, and its picture | 2 files changed, 124 insertions(+), 12 deletions(-) |

The bridge commit carrying this report follows and is pushed with it. The
preview is `https://run-0024--reconfigure-flat.netlify.app`; its function
answered 200 on `/api/session/probe0024` and its bundle
(`assets/index-lmVgx8w2.js`) was live within about two minutes of the push.
The working tree on `main` carried the same pre-existing uncommitted material
runs 0022 and 0023 found and left alone: `public/units/index.json` (a
`unit-7` manifest row) and `public/units/unit-7.json`/`.jpg`,
`docs/research-precedents.md`, `docs/research-swiss-regulations.md`,
`docs/review-storyline-2026-08-04.md` and `captures/`, all untracked. None of
it was staged into any commit of this run, with one exception recorded under
Blocked: the batch preview re-render (task 5) briefly touched `unit-7.jpg`
before its exclusion was added to the loop's filter, and that file's bytes
could not be restored since it was never tracked by git.

### 2. A deployed session, two residents, two different numbers

On `https://run-0024--reconfigure-flat.netlify.app/?session=review-0024`,
Ana opened `Flat 2 — single storey` from the library, opened Save, and the
dialog proposed 6 ("Writes Flat 6 and Unit 6 — next free in the library and
review-0024") against an empty session. She published. Ben then opened
`Flat 3 — terrace`, typed his own name, and the SAME dialog, on the SAME
session, now proposed 7 ("Writes Unit 7 — next free in the library and
review-0024"), because Ana's `unit-6` was now counted. He published. Neither
typed a number by hand; both accepted what the dialog opened on.
`GET /api/session/review-0024` right after, pasted whole:

```json
{"code":"review-0024","flats":[{"id":"unit-6","resident":"Ana","label":"Unit 6","version":1,"changed":true,"preview":true,"bbox":[0,0,15,14],"floors":1,"areaCells":194,"publishedAt":"2026-09-03T10:38:43.522Z"},{"id":"unit-7","resident":"Ben","label":"Unit 7","version":1,"changed":true,"preview":true,"bbox":[0,0,14,12],"floors":1,"areaCells":168,"publishedAt":"2026-09-03T10:39:05.095Z"}],"residents":[],"building":null}
```

Both flats carry `"preview": true` already, from the publish itself (answer
4 of the store report and task 4 below).

### 3. The refusal, then Replace

With `unit-6` owned by Ana, Ben's dialog was reopened, the design number set
back to 6 by hand, and Save pressed. The dialog's Session line read:

```
not published — Ana already owns Unit 6 in review-0024; tick Replace to take it over
```

A screenshot of this state is in the artifacts below. The raw 409 the store
answered, fetched separately by `curl` against `unit-7` (owned by Ben) from a
third name, Cy, to isolate the exact body from any dialog-side formatting:

```
HTTP/1.1 409 Conflict
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8

{"error":"\"unit-7\" was published by Ben; add ?replace=1 to take it over","resident":"Ben"}
```

Ben then ticked Replace and pressed Save again. The line changed to
`Published as Unit 6 to review-0024, version 2`, and the Replace box was
unticked again on its own. `GET /api/session/review-0024` afterward:

```json
{"code":"review-0024","flats":[{"id":"unit-6","resident":"Ben","label":"Unit 6","version":2,"changed":true,"preview":true,"bbox":[0,0,14,12],"floors":1,"areaCells":168,"publishedAt":"2026-09-03T10:39:30.917Z"},{"id":"unit-7","resident":"Ben","label":"Unit 7","version":1,"changed":true,"preview":true,"bbox":[0,0,14,12],"floors":1,"areaCells":168,"publishedAt":"2026-09-03T10:39:05.095Z"}],"residents":[],"building":null}
```

`unit-6`'s `resident` moved from Ana to Ben, its `version` from 1 to 2, and
its `bbox`/`areaCells` now match the flat Ben actually published (Flat 3's
footprint), since Replace is a real overwrite, not a rename.

### 4. The axonometric's pose and size, and three previews

The pose is the app's own default isometric: elevation `atan(1/√2)` ≈
35.264°, azimuth 45°, which reduces to the closed-form direction
`(1/√3, 1/√3, 1/√3)` — the classic engineering-isometric direction, verified
in `previewFrame.test.ts` (`src/core/previewFrame.ts:70`, `axoFrame`). It is
the SAME pose `sceneSetup.ts`'s `frameBox` already uses for the app's own
Reset View, chosen so a preview reads as the same kind of picture as the
live view rather than introducing a second convention. The size is a fixed
800×600, `PREVIEW_W`/`PREVIEW_H` in `main.ts:771-772`, at pixel ratio 1 so
the JPEG is exactly that many pixels, never stretched or cropped to whatever
the live window's aspect happens to be at save time.

Three previews, all sent as files: a one-storey flat
(`flat-2-single-storey`, captured live with the on-screen camera first moved
to an arbitrary pose to prove the restore, 63216 bytes), a two-storey flat
(`flat-1-two-storey`, 74736 bytes after the dim-state fix in answer 5 below),
and a published flat read back from its session card
(`unit-20`/room-t4, an early local test session, 62454 bytes, fetched from
`GET /api/session/room-t4/flats/unit-20/preview` and re-encoded to a JPEG
file for delivery). All three are on the paper ground, every floor visible,
cutaway off, no view overlays.

### 5. The camera and view state, before and after

Captured via the DEV-only `window.__app.capturePreview()` hook. The camera
was first mutated to an arbitrary, deliberately un-round pose — position
`(12.3, 45.6, 78.9)`, up `(0,1,0)`, zoom 1.7, `viewSize` 9.42, target
`(2.5, 0.1, -3.2)`, pixel ratio 1, no inline canvas style — recorded as
`before`, then `capturePreview()` was called (returning a 63216-byte JPEG),
then the same six values were read again as `after`:

```json
before: {"pos":[12.299999999999999,45.600000000000016,78.89999999999999],"up":[0,1,0],"zoom":1.7,"viewSize":9.42,"target":[2.5,0.1,-3.2],"styleW":"","styleH":"","pixelRatio":1}
after:  {"pos":[12.299999999999999,45.600000000000016,78.89999999999999],"up":[0,1,0],"zoom":1.7,"viewSize":9.42,"target":[2.5,0.1,-3.2],"styleW":"","styleH":"","pixelRatio":1}
equal (JSON.stringify): true
```

The same check, repeated after the two-storey fix (answer 6), on a live
`?project=flat-1-two-storey.json` session with the app's own natural camera
state (not a synthetic pose this time): `before`/`after` again compared equal
by `JSON.stringify`, and the capture returned 71292 bytes.

### 6. The library re-render: count, one pair, the manifest

Re-rendered: 7 of 7 committed entries — `flat-2-single-storey`,
`flat-3-terrace`, `unit-1`, `unit-2`, `unit-3`, `unit-4`, `unit-5` — each
through `POST /__library/preview`, each answering `{"ok":true, "bytes": …}`.
Sizes written: 63211, 62023, 61428, 75531, 57937, 74523, 49635 bytes
respectively. `public/units/index.json`'s diff against `main` is unchanged
by this task: the only difference from before this run is the same
`unit-7` row that was already pending, untouched by anything in this run.

One before-and-after pair, `unit-2.jpg` (both sent as files): before, an
oblique angle with plain grey ground and no grid, the whole two-storey unit
shown with a mix of shading that reads as an ad-hoc capture from whatever
view its author was in that day; after, the same standard axonometric every
other unit now carries, dot-grid paper ground, both storeys solid.

### 7. Test counts, both fixture baselines

Before this run: `npm test` 153 passed in 12 files. After: `npm test` 177
passed in 13 files. `npm run test:slow` 26 passed and 1 expected fail
(the standing french-window case), unchanged. `npx tsc --noEmit` exits 0.
`npm run build` completes ("built in 18.12s").

The 24 new fast cases, by file: `src/library/naming.test.ts` from 14 to 18
(a second list with a gap in each, the pre-0024 single-list call unchanged,
an empty second list, a renamed entry in the second list —
`naming.test.ts:80-101`); `src/session/store.test.ts` from 9 to 18 (4 for the
ownership refusal and `?replace=1` — `store.test.ts:134-175` — 1 for a new
flat's `preview` defaulting false — `:128-131` — and 4 for the preview
GET/PUT round trip including the 404-before-publish and the
empty-body/wrong-method refusals — `:257-301`); `src/session/session.test.ts`
from 15 to 21 (`ownerResident` set
only on a 409 and never on a 400, `&replace=1` added only when asked, and
`publishPreview` against a stubbed fetch: the documented URL and content
type, the store's own reason on a refusal, never throwing on a network
failure — `session.test.ts:152-208`); `src/core/previewFrame.test.ts` new at
5 (direction, centre, the width-governed vs height-governed branch, the
0.5-half-extent floor for a degenerate point box — all pinned against a box
computed once and printed, not re-derived by hand in the test).

Both fixture baselines, read from `#validation-panel` after Check Layout:
`flat-1-two-storey.json` reads "1 must fix, 11 worth a look, 5 note", the
12; `flat-1-no-stair.json` reads "1 must fix, 6 worth a look, 4 note", the 7.
Neither `testflats/` nor `src/core/rules.ts` changed.

### 8. Skills read from disk

The skill tool was not invoked. Two files were read under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\f1d881be-0a13-45d3-acab-472cf2886dae\c2d4eab5-d7ca-4602-ba94-9758ddd63e18\skills\`:
`architectural-drawing\SKILL.md` (9.9 KB, read in full) and
`interoperability\SKILL.md` (re-read, sections 1.4 and 7.3, already read
in runs 0022/0023).

What each contributed, and what was rejected. `architectural-drawing`
describes an entirely different kind of drawing than this task needed: a 2D
SVG "Bartlett style" kernel (hairline context, watercolour-washed
intervention, figures) for producing SECTIONS and PLANS out of mesh data or
hand-drawn geometry, not a screenshot of a live 3D scene. Its central rule,
"line is inheritance, colour is agency," and its machinery — `Region`,
`Drawing.solid()`, mesh-slicing via `sliceMesh`/`featureEdges` — were
rejected outright: nothing here is being cut into a section or composed onto
a sheet, and the app already owns real 3D wall geometry, so introducing a
second, 2D drawing system to represent it would be exactly the kind of
reinvention the task did not ask for. The one thing that carried over is
its Method step 7, "generate and look at it before calling it done, every
problem in this style is a visual problem" — which is why every preview in
this report was actually opened and inspected rather than trusted from byte
counts alone, and it is how the two-storey dim-state bug (answer 6) was
caught in the first place: the byte count and the restored-camera proof both
looked fine, and only the picture itself showed the ghost.

`interoperability`'s section 7.3 (Autodesk Platform Services) names "Model
Derivative: translate RVT/DWG/IFC to SVF2 for viewing" as a service
CATEGORY: a derived, viewable artefact kept separate from the authoritative
model, generated once, used by a lightweight viewer. That is exactly the
preview's role here, and it is the reasoning behind the constraint already
in the prompt: the picture is a second object, PUT and GET on its own path,
never folded into the `dwelling-unit` JSON. Section 1.4's data-loss taxonomy
(Appearance Loss: "materials, textures, colors not transferred") is the
reason the preview travels as the exact JPEG bytes `canvas.toDataURL`
produced, never re-encoded or regenerated by the store, which only measures
the flat's own text and never touches the picture's bytes.

### 9. Contradictions with the Assumptions, then my own

Assumption 1 held: `main` at `d8a2343` carries run 0023 merged.

Assumption 2 held, with one addition: `nextFreeNumber` does live in
`src/library/naming.ts` and read the library manifest only, and
`openSaveDialog` did already fetch the manifest. It now also fetches
`GET /api/session/{code}` when a session is set (`readSessionFlatNames`,
`main.ts`), which is the "one more GET" the assumption anticipated.

Assumption 3 held for the LIBRARY side (`saveLibraryEntry` did render one
frame and byte-check it) but the specific mechanism — reading
`canvas.toDataURL` off whatever the live camera happened to show — is
exactly what the prompt asked this run to replace, and it now does: task 3
introduces `captureFlatPreview`, and task 5 makes `saveLibraryEntry` call it
instead of rendering the live camera directly.

Assumption 4 held on every point named: the store has one blob per flat and
one index per session, and had no preview and no notion of ownership before
this run. It contradicted itself in one place this run's testing found: the
NATURAL key extension of the existing scheme, `{code}/flats/{id}/preview`,
is wrong on a filesystem-backed local Blobs store for the reason in answer
1's summary and documented in `docs/store.md`'s Storage section — a
contradiction inside the store's OWN assumed shape, not of anything the
prompt said, and it is fixed rather than merely noted, since leaving a
known-hanging endpoint uncommitted-fixed would have been worse than the
extra commit it cost.

Assumption 5 held: `window.__app` in DEV exposes camera, scene, renderer and
floor manager, and an off-screen render at a fixed pose and size was driven
from it exactly as assumed. One qualification: `window.__app` is DEV-only by
design (dropped from a production build by `import.meta.env.DEV`
tree-shaking), so the direct camera-state proof in answer 5 was necessarily
run against `netlify dev`, not the deployed branch; the deployed branch was
instead verified by observing that publishing WORKS and returns a correct
preview (answers 2-4), which exercises the identical, non-DEV-gated
`captureFlatPreview` function through the UI.

My own assumptions, and their effects. The Replace checkbox is ALWAYS
visible in the dialog rather than appearing only after a refusal (the prompt
reads "the dialog shows that refusal... and offers a Replace box," which
could mean either); always-visible is simpler, matches "off by default,"
and reads consistently with the other rows in the same fieldset, at the cost
of one always-present, muted-styled row that means nothing until a refusal
happens. The library's re-render batch script is ephemeral (a Browser-pane
JS loop, not committed), while the two REUSABLE pieces it drove
(`window.__app.loadAndCapturePreview`, `POST /__library/preview`) are
committed and permanent, mirroring how run 0021's own `buildUnit`/`capture`
dev tools were used for a similar one-off job and kept afterward. The
preview's failure to send never fails the publish itself; the Session
result line just grows a parenthetical ("preview not sent — …"), since the
flat is the thing residents and the building actually need, and the picture
is a convenience layered on top of it.

## What I did

- `src/library/naming.ts:62-73` — `nextFreeNumber` takes any number of
  lists via a rest parameter; single-list callers are unchanged.
- `src/main.ts` — `readSessionFlatNames` and the `numberCountsSession` flag
  feeding `openSaveDialog` and `syncSaveDialog`'s names-line clause; the
  `#save-replace` wiring (`:988`, publish step `:1227-1240`); `captureFlatPreview`
  (`:774-853`); `saveLibraryEntry` now calls it (`:1291`); the `window.__app`
  additions `capturePreview` and `loadAndCapturePreview` (`:1560-1573`).
- `src/session/store.ts` — segment-based routing replacing the old regex
  (`route`, `:131-256`); the ownership check and `?replace=1` (`:180-189`);
  `FlatSummary.preview`; `routePreview` (`:265-292`) and its base64 helpers
  (`:297-306`); the preview key fixed to `{code}/flats/{id}.preview`
  (`:266-273`).
- `src/session/session.ts` — `FetchLike.body` widened to `BodyInit`;
  `publishUnit` gained `replace` and `ownerResident` (`:90-156`);
  `publishPreview` (`:158-194`).
- `src/library/unitBrowser.ts` — `SessionFlat.preview` (`:27-40`),
  `SessionSource.previewUrl` (`:45-53`), the session card's conditional
  `<img>` and `ulb-no-preview` class (`:388-403`).
- `src/core/previewFrame.ts` (new, 98 lines) — `axoFrame`, pure.
- `vite.config.ts:231-256` — the `/__library/preview` dev endpoint.
- `index.html:196-201` — the Replace checkbox.
- `src/style.css` — the Replace row's muted styling; `.ulb-no-preview`'s
  padding compensation moved off the bare `.ulb-session-card` selector.
- `docs/store.md` — the 409/`?replace=1` behaviour on the flat PUT
  (`:161-183`), the two preview calls with a worked example (`:257-283`),
  the sibling-key Storage note (`:326-338`).
- `public/units/*.jpg` — seven committed previews re-rendered.
- `PROJECT_STATE.md` — §2 row for `previewFrame.ts`, §10's preview
  paragraphs, §11's number-and-replace paragraphs, §12's table row and
  Storage-layout note.
- `_cowork/CONTEXT.md` — the run 0024 paragraph and the suite counts.

## Findings

- The design number and the flat's session id are the same value
  (`unit-<n>`), so two residents accepting the SAME proposed number is a
  silent overwrite, not a visible error, unless the count is shared — which
  is exactly what happened in the very first test of this feature: Ben's
  dialog, opened before Ana had published anything in the room, proposed 6
  too, matching her already-published flat, and only failed loudly once the
  ownership check existed to catch it.
- A key of `{parent}/{child}` in a store backed by a real filesystem is only
  safe when `{parent}` is never ALSO used as a leaf key on its own. This
  repo's session store violated that the moment it needed a second object
  per flat, and the fix is one string literal, not a schema migration.
- The translucent "inactive floor" rendering is driven purely by
  `FloorManager`'s `activeIndex`, entirely independent of a floor's
  `.visible` flag; a function that wants "every floor visible AND normal"
  has to touch both, and there is no public getter for the dim state, only
  the formula that derives it (`i !== activeIndex`).
- Netlify Dev retries a GET that gets a 404 from a function by appending
  `.html` to the last path segment (observed in its own request log: a GET
  for `/flats/unit-9` that legitimately 404's was immediately retried as
  `/flats/unit-9.html`, which then fails the id's own character-set check).
  This never affects a real 200 response and did not need a code change, but
  it is worth knowing before reading a confusing local-only error twice.

## Evidence

- Commit stats: `git show --shortstat` on each of the eight commits, answer 1.
- Deployed numbers and refusal: the app's own result lines and
  `fetch('/api/session/review-0024')` from the console, answers 2-3; the raw
  409 from `curl -i -X PUT ...&resident=Cy`, answer 3.
- Pose derivation: `previewFrame.test.ts`, computed once via a Node one-liner
  using the same formula and pinned with `toBeCloseTo`, answer 4.
- Camera/view restoration: `window.__app.capturePreview()` before/after JSON,
  answer 5, both the synthetic-pose run and the two-storey-fix rerun.
- Library re-render: the JSON array of `{id, capBytes, ok, writtenBytes}`
  from the batch loop, answer 6; `git diff public/units/index.json` shows
  nothing from this task.
- Suites: `npm test`, `npm run test:slow`, `npx tsc --noEmit`, `npm run
  build`, and `#validation-panel` text after `#check-layout`, answer 7.
- The preview-key bug: reproduced with `curl` on a fully clean process tree
  (verified via `tasklist`/`wmic` that no orphaned `netlify dev` processes
  remained), root-caused by listing `.netlify/blobs-serve/entries/` and
  seeing the flat's own key as a FILE at the exact path the preview's old
  key needed to be a DIRECTORY, and confirmed fixed by the same `curl`
  sequence returning promptly after the key changed.
- Nothing in this report is estimated.

## Artifacts produced

- `src/core/previewFrame.ts`, `previewFrame.test.ts`.
- `docs/store.md`, updated.
- Three preview images sent as files: `preview-onestorey.png` (one storey),
  `preview-twostorey-v2.png` (two storeys, post-fix), and
  `preview-published-session-card.jpg` (a published flat's stored picture).
- `library-unit-2-before.jpg` and the re-rendered `public/units/unit-2.jpg`,
  sent as the before/after pair.
- Seven re-rendered committed library JPEGs, in `public/units/`.
- The deployed session `review-0024` at
  `https://run-0024--reconfigure-flat.netlify.app/api/session/review-0024`
  (and, after a merge, under `reconfigure-flat.netlify.app`): two flats, a
  refusal and a replace, both showing pictures.

## Decisions and rationale

- The preview key became `{code}/flats/{id}.preview`, a sibling, rather than
  moving the flat's OWN key to make room for a subdirectory
  (`{code}/flats/{id}/body`, say). Changing the flat's established key would
  have broken every session already published under the old scheme (runs
  0022 and 0023's own test sessions, and anyone who had already used the
  deployed store); changing only the NEW key's shape costs nothing already
  in use.
- `captureFlatPreview` restores the dim state by recomputing it
  (`i !== floors.activeIndexValue`) rather than by adding a getter to
  `FloorManager`/`Floor` to read and restore an exact prior value. The
  formula is already the single source of truth `applyDim` itself uses; a
  getter would be a second copy of the same fact, which is what "derive,
  don't store" already rules out for less consequential state than this.
- The batch library re-render is a hand-typed loop run once from the
  Browser pane, not a committed script, because it is a one-time
  maintenance action over a fixed, small, already-enumerated list (seven
  ids), not a repeatable pipeline step; the two pieces it depends on
  (`loadAndCapturePreview`, `/__library/preview`) ARE committed, since
  those are the reusable part and the next such job needs them again.
- `readSessionFlatNames` treats a failed or absent session fetch as an empty
  list rather than blocking the dialog, mirroring `readManifestEntries`'s
  existing fallback: a resident who has not yet set a session, or whose
  network hiccups for one request, still gets a working dialog that
  proposes 1 or whatever the library alone supports.

## Deviations from the prompt

- Eight commits rather than six: `docs: the flat-ownership refusal` and
  `store: the preview key must not be the flat's own child` are fix-up
  commits the prompt did not name, made because the ownership documentation
  was written a commit late and the key bug was found live-testing task 4,
  after task 2's commit had already landed. Both are recorded honestly as
  their own commits rather than folded silently into a later one.
- Task 6 ("commit `numbers: tests`") produced no separate commit: every
  test named in that task was written and committed ALONGSIDE the feature
  it tests, in tasks 1 through 4's own commits, so by the time task 6 was
  reached there was nothing left to add. This is recorded here rather than
  invented as a padding commit.
- `unit-7.jpg`, an untracked, pre-existing file outside this run's scope,
  was inadvertently overwritten by the library batch loop before its
  exclusion was added (the loop's first filter excluded only `unit-999`, a
  throwaway test entry, not `unit-7`). Its bytes cannot be restored, since
  git never tracked the original. It is not staged in any commit, and the
  new content — the same standard axonometric every other unit now
  carries — is neutral to positive rather than corrupting, but it was not
  asked for and is recorded here rather than passed over quietly.

## Blocked / did not do

None of the eight tasks was blocked. The one incomplete item is the
`unit-7.jpg` side effect above, which is not fixable rather than not done.

## Open questions for you

1. The Replace checkbox is a per-save opt-in with no memory of who owns
   what; a resident only learns they need it when a save is refused. Should
   the "In this session" panel show OWNERSHIP up front — whose flats are
   whose — so a resident sees before they save that Unit 6 is Ana's, rather
   than discovering it from a refusal? That is a small addition to
   `sessionCard` (the resident name is already in the summary) and would
   turn the refusal from the first signal into a confirmation of something
   already visible.

2. `?replace=1` has no cost beyond the tick: Ben can take Ana's flat with no
   confirmation dialog, no record of the takeover beyond the store's own
   `resident` field silently changing, and no notice to Ana. Is a silent
   takeover acceptable for a five-person test in one room (everyone present,
   everyone will notice), or does the review want a `window.confirm`-style
   "This flat belongs to Ana. Take it over?" step before the tick takes
   effect, matching the pattern the library's own replace-or-new prompt
   already uses?

## Suggested next prompt

Run 0025, "Whose flat is this," on `run/0025` from `main` after `run/0024` is
merged, taking open question 1 as its premise: show each session card's
owner more prominently (already present as `flat.resident` in the summary,
currently a small meta-line word) and, when the CURRENT dialog's resident
name matches a card's owner, mark that card "Yours" so a resident can find
their own flat in a crowded room without reading every label. If open
question 2's answer is yes, add the confirm to the Replace path in
`runSave`, worded with the owner's name (`ownerResident` is already
returned). Tests: a `sessionCard` case asserting the "Yours" mark appears
only for a matching resident name; a `runSave` case (or a small pure helper
extracted from it) asserting the confirm text names the actual owner. Return:
the commits, a deployed session with two residents where each sees the
other's card unmarked and their own marked "Yours," and — if built — the
confirm dialog's exact wording as a capture.
