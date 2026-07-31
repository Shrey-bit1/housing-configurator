# design-sync notes

- **Shape is off-script.** `design/` is eight hand-authored, self-contained HTML
  cards with `@dsCard` markers on line 1 — not a React package and not a
  Storybook. The `package-build.mjs` converter does not apply: there is no
  `dist/` to bundle, so no `_ds_bundle.js`, no per-component `.d.ts`/`.jsx`/
  `.prompt.md`. The cards ARE the deliverable.

- **No `_ds_sync.json` is uploaded.** Neither the package nor the storybook
  hash recipe fits this shape, and a sidecar that claims a recipe it did not
  follow would be worse than none. Consequence, and it is the correct one:
  every re-sync re-verifies all eight cards from scratch. That costs a few
  minutes, not hours.

- **Cards stay self-contained; `styles.css` is for the design agent.** The
  cards inline their own CSS on purpose so they render standalone as preview
  cards. `ds-bundle/styles.css` exists for a different consumer — the designs
  the Claude Design agent generates receive only `styles.css`'s `@import`
  closure, so the token vocabulary must live there.

- **`ui-sans-serif` needs an explicit fallback** (fixed 31 Jul 2026 in
  `design/*.html`). Six rules across `controls-toggles.html`,
  `panels-validation.html`, `panels-toast.html`, and
  `moments-interface-dissolve.html` declared `font:600 10px/1 ui-sans-serif`
  with nothing after it. Chrome on Windows does not resolve `ui-sans-serif`,
  so those buttons and chips fell back to the default **serif** — visibly wrong
  against the tracked-wide sans the system specifies. Always terminate a stack
  with `,system-ui,sans-serif`.

- **`--line` is deliberately context-dependent:** `#C9C5BB` on light ground,
  `#2A2830` on a dark panel (`panels-palette.html`). `styles.css` encodes this
  as a `.panel` / `.on-panel` override rather than a second token.

- **`--meta` (`#6d6a62`) was promoted to a token** in `styles.css`. It appears
  as a bare literal in all eight cards but was never named in any `:root`.

- **Verification is a local static server**, since Chrome refuses `file://`:
  `cd ds-bundle && python -m http.server 8731`, then browse
  `http://localhost:8731/components/<Group>/<Name>/<Name>.html`.

- `ds-bundle/` is generated output — gitignored. Regenerate by copying
  `design/*.html` into `components/<Group>/<Name>/<Name>.html`.
