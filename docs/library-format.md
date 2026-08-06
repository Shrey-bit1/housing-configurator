# The unit library — storage, manifest, and browser module

A visual library of saved dwelling units, added in run 0018. It serves two
apps: **Re_Configure** (this repo) saves units into it and reopens copies for
editing; **bottom-up-design** (the building packer) reads the same folder as
its unit catalog. The library stores the existing `dwelling-unit` export file
unchanged — one file serves both apps because it already embeds a full project
save in `sourceProject` (see `docs/bridge-format.md`, which stays the format's
source of truth; nothing here modifies it).

This document is the library's source of truth: the folder layout, the
manifest schema, the save endpoint, and the browser module's interface.

## Folder layout

```
public/units/
├── index.json    the manifest (schema below)
├── <id>.json     one dwelling-unit file per unit
└── <id>.jpg      one JPEG preview per unit, captured from the canvas at save time
```

The folder lives under Vite's `public/` root, so it is served statically at
`/units/…` in dev and copied verbatim into `dist/units/` by a production
build — no build-system change involved. Files are **named by id**, and every
entry's `file`/`preview` are those bare names, resolved against the manifest's
own URL — so a consumer can host the folder anywhere.

## Ids

An id is the **lowercase slug of the display name** — `[a-z0-9-]` runs only,
e.g. `"Flat 2 — single storey"` → `flat-2-single-storey` — with a numeric
suffix on collision: a second save under an already-used name gets `<slug>-2`,
then `<slug>-3`, and so on. Two saves under one display name therefore
coexist as two entries and two file pairs; nothing is ever overwritten. The
implementation is `slugifyUnitName` / `assignUnitId` in `src/library/ids.ts`,
shared by the dev save endpoint and the production download fallback, and
pinned by `src/library/ids.test.ts`.

## The manifest — `units/index.json`

```jsonc
{
  "format": "unit-library",   // fixed discriminator
  "version": 1,
  "units": [
    {
      "id": "flat-2-single-storey",     // unique, lowercase [a-z0-9-]
      "name": "Flat 2 — single storey", // display name as typed; NOT unique
      "color": "#f783ac",               // the unit colour, same value as in the unit file
      "file": "flat-2-single-storey.json",   // always "<id>.json"
      "preview": "flat-2-single-storey.jpg", // always "<id>.jpg"
      "storeys": 1,                     // unit file's storeys.length
      "areaM2": 69.84,                  // gross area, all storeys: cell count × cellSize²
      "savedAt": "2026-08-06T20:44:56.100Z"  // ISO 8601, assigned at save time
    }
  ]
}
```

`storeys` and `areaM2` are **derived from the posted unit file at save time**
(never trusted from a client), so the manifest cannot drift from the files it
points at. `areaM2` counts every cell of every storey — rooms, circulation,
stairs, and outdoor cells alike — times `cellSize²` (0.36 m²), rounded to two
decimals. It is a gross figure for card display, not a net habitable area.

The parser/validator is `parseUnitLibraryIndex` in `src/library/manifest.ts`:
it checks the discriminator, every field's type and pattern, the `<id>.json` /
`<id>.jpg` naming rule, and id uniqueness, and throws naming the first
offending entry. The committed manifest is validated by
`src/library/manifest.test.ts` through the same parser.

## Saving — dev endpoint and production fallback

**Dev.** The unit-export dialog's "Save to library" action POSTs
`{ name, color, unit, preview }` to `/__library/save` — `unit` is the
`dwelling-unit` JSON built by the untouched export path
(`src/core/unitExport.ts`), `preview` a `data:image/jpeg` URL read from the
canvas in the same frame it was rendered. The `library-sink` middleware in
`vite.config.ts` (dev-only, `apply: "serve"`) assigns the id, writes
`<id>.json` and `<id>.jpg` into `public/units/`, and appends the manifest
entry. It responds `{ ok: true, entry }` or `{ ok: false, error }`.

The preview is **byte-checked on both sides** (≥ 1000 bytes): a hidden canvas
"succeeds" with an empty image, and an empty preview in the library is worse
than a refused save. The saver in `src/main.ts` also runs the same hard gates
and advisory hard-rule confirm as the plain export.

**Production.** A built app has no dev server, so the same action downloads
the identical pair — `<slug>.json` and `<slug>.jpg`, slug without collision
suffix, since only the dev server owns the manifest — and toasts that they
belong in `units/` beside a hand-added manifest entry.

## The browser module — `src/library/`

`src/library/` is a **self-contained boundary**: plain TypeScript and DOM, no
imports from the rest of the app, styles injected under a `ulb-` prefix with
hardcoded fallbacks behind the host's design tokens. The bottom-up repo can
lift the module wholesale or build its own list against the manifest schema
above.

```ts
// src/library/unitBrowser.ts
createUnitBrowser(opts: UnitBrowserOptions): UnitBrowser

interface UnitBrowserOptions {
  manifestUrl: string;                                  // URL of units/index.json
  onOpen: (file: File, entry: UnitManifestEntry) => void;
  mount?: HTMLElement;                                  // default document.body
}
interface UnitBrowser {
  el: HTMLElement;
  open(): void;      // opens and (re-)fetches the manifest
  close(): void;
  toggle(): void;
  refresh(): Promise<void>;  // re-fetch + re-render; no-op while closed
  readonly isOpen: boolean;
}

// src/library/manifest.ts
parseUnitLibraryIndex(text: string): UnitLibraryIndex  // throws ManifestParseError
interface UnitManifestEntry { id; name; color; file; preview; storeys; areaM2; savedAt }

// src/library/ids.ts
slugifyUnitName(name: string): string
assignUnitId(name: string, taken: Iterable<string>): string
```

The browser renders one card per manifest entry — preview, name, colour chip,
storey count, area — with a single action, **Open a copy**, which fetches the
entry's `dwelling-unit` file and hands it to `onOpen` unparsed. What happens
next is the host's business:

- **This app** (`src/main.ts`) extracts `sourceProject` and feeds it through
  the normal project-import path, confirm dialog included. The opened design
  then belongs to the user; saving it back always creates a **new** entry.
- **The building app** would hand the file straight to its packer — it is a
  complete `dwelling-unit` file, `sourceProject` and all.

The panel has no keyboard bindings of its own; the host decides how it is
opened (here: the "Units" top-bar button toggles it) and closed (its ✕, the
toggle, or `close()` after a successful open).

## Non-goals

There is no delete, rename, or re-order endpoint — the manifest is edited by
hand for curation, and `units/` is committed like any other content. The
library never mutates a stored unit: opening is always a copy, and the
`dwelling-unit` format itself stays at version 1, governed by
`docs/bridge-format.md`.
