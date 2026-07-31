# Re_Configure design system — first drop

Eight motion-first cards for the flat configurator's look-development pass.
Authored in the Cowork planning session on 31 July 2026. Motion is set
NOTICEABLE on purpose; toning down later means lowering three variables
(`--dur-tap`, `--dur-panel`, `--dur-hero`) that every card and, later, the
app share.

## Cards

- Foundations: `foundations-tokens.html`, `foundations-motion.html`
- Controls: `controls-buttons.html`, `controls-toggles.html`
- Panels: `panels-palette.html`, `panels-validation.html`, `panels-toast.html`
- Moments: `moments-interface-dissolve.html`

Each file is self-contained (inline CSS, Web Animations API, no libraries)
and carries a `@dsCard` marker on line 1, so the Design System pane can
index it without manual registration.

## How to sync to claude.ai/design (run in Claude Code, not the bridge)

1. In Claude Code: `/design-login` (needs the interactive terminal, which is
   why the cloud session cannot do this part).
2. Then ask it to sync this folder to a NEW design-system project named
   `Re_Configure` using `/design-sync`, uploading every `*.html` here.
3. Open claude.ai/design, find the project, browse the cards.

## Rules the system encodes

- Three durations only: 150 tap, 260 panel, 420 hero. One hero motion on
  screen at a time; nothing loops after arrival.
- The red is earned: it marks the active and the failing, never decoration.
- Focus rings are door-arc violet.
- The app applies these with the same Web Animations API (or anime.js if a
  timeline needs it), through a bridge prompt, additively, after Shrey
  approves the cards.
