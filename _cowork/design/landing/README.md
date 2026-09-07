# The landing, shared by both apps

Two files, `landing.html` and `landing.css`. Both apps render the landing from
them, byte for byte. They were split out on 7 September (flat app run 0037,
building app run 0062) because the two landings had drifted: the doors sat at
the far right edge in one and in the middle in the other, the columns were
different widths, and one carried a brand and a red rule the other lacked. Both
had been written from the same paragraph of the brief, and a paragraph leaves
room.

## The source is here

`D:\_Studies\_DFAB\DFAB\_T3\Context\01-design\landing\` is the source. A change
goes there first. Each app then carries a byte-for-byte copy of both files and
a test that fingerprints them against the hash recorded in the brief, under
"The screens". If a copy is edited by hand, that app's test fails and says the
landing has drifted.

Changing the landing is therefore three steps: edit here, copy into each app,
update the hash line in the brief. The hash covers both files together, so a
change to either one moves it.

## The switch

One attribute on the root element decides everything that differs between the
two apps:

```html
<div id="landing" data-app="flat">     <!-- or data-app="building" -->
```

Each app sets it at startup, before showing the landing. The root ships
`hidden`, so nothing appears until an app has both set the attribute and
decided to show it, and neither app ever shows the other's doors for a frame.

It reaches exactly two things.

**The doors.** Each door carries `data-for="flat"`, `data-for="building"` or
`data-for="both"`, and one CSS rule hides the ones this app does not have.
There are six door elements for seven door-appearances, because "Join a group"
is the same door in both apps.

| id | label | shown in |
| --- | --- | --- |
| `landing-start` | Start a flat | flat |
| `landing-new` | Start a group | flat |
| `landing-join` | Join a group | both |
| `landing-open` | Open a file | flat |
| `landing-open-building` | Open a building | building |
| `landing-example` | Look at the example | building |
| `landing-group` | the "Go to your group" link in the aside | flat |

**The six dots.** All six always show. Each step carries `data-owner`, which
never changes. The dots this app owns are ink, the other app's four are dim,
and the dot for where a resident is now is red, which on a landing is this
app's own first step: `journey-draw` for the flat app, `journey-wishes` for the
building app.

Nothing else may differ. A difference that is not one of those two is drift,
and drift is what these files exist to end.

## What each app does

1. Inlines both files. The markup goes where the landing belongs, the CSS goes
   into the app's stylesheet or beside it. Neither app may restyle anything in
   here from its own CSS: every selector in `landing.css` is scoped under
   `#landing` and every colour, font and size it needs is declared on `#landing`
   itself, so the file cannot be reached and cannot inherit a value that
   differs between the two apps.
2. Sets `data-app` before showing the landing.
3. Wires its own handlers to the door ids above. It never edits the markup.
4. Puts any markup of its own, such as its join form, inside `#landing-extra`.
   The shapes those forms take are styled here, so the two apps' forms look
   alike without either of them styling anything in this file.
5. Adds `no-arrive` to `#landing-doors` when re-showing the doors after a form,
   so the arrival stagger plays once per visit.

## The arrival

Eleven delays, settled 6 September and recorded in the brief. They live in
`landing.css` under "How the landing arrives", with the numbers written out in
a comment beside the rules. The doors take their delay by id rather than by
position, because the two apps show different doors and `nth-child` counts the
hidden ones too.

Every keyframe has a `from` and no `to`, so the resting state is the finished
state. An engine that ignores the animation, a reduced-motion setting, or a tab
that never came forward all leave the landing whole rather than blank.
