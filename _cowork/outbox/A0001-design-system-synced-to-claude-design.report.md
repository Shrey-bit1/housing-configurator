---
id: "A0001"
title: Design system synced to claude.ai/design as Re_Configure
source: ad-hoc
status: complete
branch: main
commit: 076a5a0 (working tree — see "Blocked / did not do")
completed: 2026-07-31
---

## Summary

The eight design cards authored in the planning session on 31 July 2026 and dropped
into `design/` have been synced to claude.ai/design as a new design-system project
named **Re_Configure** (project id `83e6cd06-7614-4347-9d75-00c7980cccfe`,
`https://claude.ai/design/p/83e6cd06-7614-4347-9d75-00c7980cccfe`). This was the
step `design/README-sync.md:24-31` handed over to Claude Code because it needs an
interactive terminal. All eight cards are uploaded and each was verified to render
in a real browser first. That verification caught a genuine bug: four of the eight
cards were rendering their buttons and chips in a **serif** typeface rather than the
tracked-wide sans the system specifies. Fixed at source in `design/`, not just in
the uploaded copy.

## What I did

- Fixed the font fallback bug in six CSS rules across four files —
  `design/controls-toggles.html:10` and `:15`, `design/panels-validation.html`
  (2 rules), `design/panels-toast.html:9`, `design/moments-interface-dissolve.html`.
  Each declared `font:600 10px/1 ui-sans-serif` with no fallback after it; all now
  terminate `,system-ui,sans-serif`.
- Created `ds-bundle/` (gitignored, generated) as the upload layout: each card
  copied to `components/<Group>/<Name>/<Name>.html` across four groups —
  Foundations (Tokens, MotionScale), Controls (Buttons, ViewToggles), Panels
  (RoomPalette, CheckLayout, Toasts), Moments (InterfaceDissolve).
- Wrote `ds-bundle/styles.css` (78 lines) — the token vocabulary extracted as the
  union of all eight cards' `:root` blocks, plus the shared heading/label idiom.
- Wrote `.design-sync/conventions.md` (~3.4k chars) — the usage contract read by the
  Claude Design agent when it builds screens with this system.
- Generated `ds-bundle/README.md` (4497 bytes) = conventions + an index of the eight
  cards, built from each file's line-1 `@dsCard` marker.
- Uploaded 10 files + a recompile sentinel to the project; reconciled the remote
  listing against the local build (0 orphans).
- Recorded `.design-sync/config.json` (pins the project id) and
  `.design-sync/NOTES.md` (7 findings, so the next sync does not rediscover them).
- Added `ds-bundle/` to `.gitignore:` (last 2 lines).

## Findings

- **Four of eight cards rendered wrong, and the cause was one pattern.**
  `ui-sans-serif` is not resolvable by Chrome on Windows. Where the stack ended
  there — 6 rules — the browser fell through to its default **serif**, so buttons
  and chips read as a serif face instead of the tracked-wide sans. Only
  `controls-buttons.html` escaped, and purely by accident: it happens to have
  `,system-ui` appended. This was invisible to the planning session, which cannot
  render the files.
- `--line` is genuinely two values, not a mistake: `#C9C5BB` on light ground,
  `#2A2830` on the dark palette panel (`design/panels-palette.html:3`). Encoded in
  `styles.css` as a `.panel` / `.on-panel` override rather than a second token.
- `#6d6a62` — the quiet grey for counts and hints — appears as a bare literal in all
  eight cards but was never named in any `:root`. Promoted to `--meta`.
- The token set across all eight cards is otherwise fully consistent: no colour is
  declared with two different values anywhere.
- The three motion durations (150 / 260 / 420) and both easing curves are declared
  identically in every card that uses them — the "three knobs" claim in
  `design/README-sync.md:5-8` holds exactly.

## Evidence

- Render verification: served `ds-bundle/` with `python -m http.server 8731` and
  loaded all eight cards in Chrome at 1546x784. Chrome refuses `file://` URLs, hence
  the local server. Screenshots were inspected for each; the four serif cards were
  re-checked at 2.2x zoom after the fix and now show the correct sans.
- Bug scope measured, not estimated: `grep -c "ui-sans-serif[;}]" design/*.html`
  returned 2 / 1 / 1 / 2 for `controls-toggles`, `moments-interface-dissolve`,
  `panels-toast`, `panels-validation` — 6 total, 0 for the other four files. After
  the fix the same grep returns 0 across all eight.
- Conventions validated against the built artifacts: every `--token` named in
  `.design-sync/conventions.md` was grepped against `ds-bundle/styles.css`, every
  class (`.label`, `.meta`, `.panel`, `.on-panel`) confirmed present, and all eight
  component names confirmed to have a directory. Zero misses.
- Upload confirmed by `list_files` on the project: 10 files + sentinel, matching the
  local build exactly, 0 files to delete.

## Artifacts produced

- `https://claude.ai/design/p/83e6cd06-7614-4347-9d75-00c7980cccfe` — the live project.
- `.design-sync/conventions.md` — the design agent's usage contract.
- `.design-sync/config.json` — pins the project id so a re-sync targets this project.
- `.design-sync/NOTES.md` — 7 findings carried forward to the next sync.
- `ds-bundle/` — generated upload layout (gitignored; rebuild by copying `design/*.html`).
- `design/*.html` — 4 files modified by the font fix.

## Decisions and rationale

- **Did not run the standard converter.** `design/` is hand-authored self-contained
  HTML, not a React package with a `dist/`, so there is nothing to compile into a
  component bundle and no per-component API to document. The cards are the
  deliverable and were uploaded as-is.
- **Cards keep their inlined CSS; `styles.css` is a separate artifact.** These serve
  two different consumers. The cards must render standalone as preview cards. The
  stylesheet exists because designs the Claude Design agent generates receive only
  `styles.css` — so the tokens must also live there, duplicated on purpose.
- **No `_ds_sync.json` uploaded.** That sidecar's hash recipe is defined for the
  package and storybook shapes; neither fits here, and a sidecar claiming a recipe
  it did not follow is worse than none. The cost is that every future re-sync
  re-verifies all eight cards — a few minutes, and it fails safe.
- **Fixed the font bug in `design/`, not just in the uploaded copy.** Patching only
  the upload would have left the source broken and reintroduced the bug on the next
  sync.

## Deviations from the prompt

- `design/README-sync.md:26` says to upload "every `*.html` here". All eight were
  uploaded, but organised into `components/<Group>/<Name>/` directories rather than
  a flat list, which is the layout the Design System pane expects. Grouping was
  taken from each card's own `@dsCard group=` marker, so nothing was invented.
- Two files were added that the handover did not ask for — `styles.css` and the
  conventions/README. Without them the cards are viewable but the design agent has
  no token vocabulary to build new screens with, which is the point of syncing.

## Blocked / did not do

- **Nothing is committed.** `design/` (including the font fix), `.design-sync/`, the
  `.gitignore` change, and this report are all sitting in the working tree on `main`
  at `076a5a0`. Committing was not requested, and `design/` was untracked before
  this session, so the whole folder is still new to git.
- The cards were verified to render; their *animations* were not frame-verified.
  Each card's motion was allowed to play and the resulting state screenshotted, but
  no timing was measured against the 150/260/420 contract.

## Open questions for you

1. The cards were authored deliberately loud (`design/README-sync.md:5-8`). Seen
   rendering at full width in a browser rather than as thumbnails, the 420ms hero on
   `moments-interface-dissolve.html` reads as the strongest moment by a wide margin
   — which is the intent, but it also means everything else looks tame next to it.
   Is that contrast the argument, or does the rest of the system need to come up to
   meet it?
2. `styles.css` now duplicates tokens that each card also inlines. That is correct
   for the upload, but if the app later adopts these tokens there will be a third
   copy. Should the app import a single generated token file, making `design/` the
   source of truth for the running configurator too?

## Suggested next prompt

Open `https://claude.ai/design/p/83e6cd06-7614-4347-9d75-00c7980cccfe`, review the
eight cards, and decide the tone-down question: whether `--dur-tap` / `--dur-panel`
/ `--dur-hero` stay at 150/260/420 or drop. Then write a bridge prompt that applies
the approved motion tokens to the running app additively — starting with
`src/ui/palette.ts` (the room palette stagger) and the Check Layout button in
`src/main.ts` — and returns which existing transitions it replaced versus added.
