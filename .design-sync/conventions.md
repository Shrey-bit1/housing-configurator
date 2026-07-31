# Re_Configure — how to build with this system

**This is a specification system, not a component library.** There is no bundle
and nothing to import. What ships here is a token vocabulary (`styles.css`), a
motion contract, and eight reference cards under `components/` that show the
intended behaviour. Build screens as plain semantic HTML styled with
`var(--*)` tokens, and animate with the Web Animations API (`el.animate(...)`).

## Setup

Link `styles.css`. No provider, no root wrapper, no theme switch — tokens are
declared on `:root` and inherit everywhere. It also sets the base `body`,
`h1`, and `h2` idiom, so headings look right with no extra work.

For a dark panel, put `class="panel"` on the container: it flips background and
text, and rebinds `--line` to `#2A2830` so hairlines lift off the fill instead
of sitting on paper. Do not hand-pick a darker border colour.

## The styling idiom

No utility classes and no CSS framework — style with tokens directly. The only
shared classes are `.label` (tracked-wide uppercase, used for buttons, chips,
axis labels), `.meta` (quiet grey caption text), and `.panel` / `.on-panel`.
Everything else is component-local CSS written against the tokens.

| Family | Tokens |
|---|---|
| Ground & text | `--bg` `--ink` `--panel` `--panel-ink` `--line` `--meta` |
| Surfaces | `--plate` `--plate2` `--tint` |
| Signal | `--accent` `--entry` `--violet` `--soft` `--note` |
| Rooms | `--living` `--kitchen` `--bedS` `--bedL` `--bath` `--rec` `--out` `--circ` |
| Motion | `--dur-tap` `--dur-panel` `--dur-hero` `--ease-out` `--ease-spring` |
| Spacing | `--s1`…`--s6` (4 · 8 · 12 · 16 · 24 · 32) |

## Rules the system enforces

- **Three durations, no fourth.** 150ms tap (press, hover, checks), 260ms panel
  (lists, drawers, toasts), 420ms hero (view changes, reveals). Many at 150, a
  few at 260, **exactly one 420 on screen at a time**.
- **Nothing loops after arrival.** Motion resolves and stops. No idle pulsing,
  no ambient animation, no spinner that outlives its work.
- **The red is earned.** `--accent` marks the *active* and the *failing* only.
  Never a decorative border, never a brand flourish, never a resting state.
- **Focus rings are `--violet`,** the door-arc colour — never the accent red.
- Easing: `--ease-out` for anything obedient; `--ease-spring` only on hero
  motion and toast entrances.

## Where the truth lives

Read `styles.css` before styling anything. For behaviour, read the card that
covers it — each is self-contained and its inline `<script>` is the reference
implementation: `Foundations/Tokens`, `Foundations/MotionScale`,
`Controls/Buttons`, `Controls/ViewToggles`, `Panels/RoomPalette`,
`Panels/CheckLayout`, `Panels/Toasts`, `Moments/InterfaceDissolve`.

## An idiomatic control

```html
<button class="btn label">Check layout</button>
<style>
.btn {
  padding: var(--s3) var(--s4);
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--accent);
  cursor: pointer;
  transition: transform var(--dur-tap) var(--ease-out),
              box-shadow var(--dur-tap) var(--ease-out);
}
.btn:hover  { transform: translateY(-1px); box-shadow: 0 2px 0 var(--accent); }
.btn:active { transform: translateY(1px) scale(.97); box-shadow: none; }
</style>
<script>
// One pulse on completion, then still — never a loop.
document.querySelector('.btn').addEventListener('click', e =>
  e.currentTarget.animate(
    [{ boxShadow: '0 0 0 0 rgba(210,35,46,.55)' },
     { boxShadow: '0 0 0 12px rgba(210,35,46,0)' }],
    { duration: 600, easing: 'ease-out' }));
</script>
```
