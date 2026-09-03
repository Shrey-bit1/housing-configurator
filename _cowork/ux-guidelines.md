# UX guidelines for both apps

From Shrey, 3 September, after a reel on "UX laws". Every prompt that
touches a screen names this file under Skills to use, as reference.
The coding session reads it and says in the report which lines it
applied and which it rejected, with the reason.

- Reduce choices per screen.
- Make targets large.
- Follow familiar patterns.
- Group related information.
- Break content into chunks. Answer within about 400 ms, or show
  that something is happening.
- Highlight the primary action.
- Place key actions near each other.
- Put essentials first.
- End flows memorably.
- Show visible progress.
- Simplify complex interfaces.
- Use sensible defaults.
- Prevent inconsistency.
- Connect related elements visually.
- Reduce task completion time.
- Reveal complexity gradually.
- Make completion feel closer.

The laws behind them, for the record: Hick, Fitts, Jakob, proximity,
Miller, Doherty threshold, Von Restorff, serial position, peak-end,
Zeigarnik, Prägnanz, similarity, uniform connectedness, Tesler,
Postel, Parkinson, Occam, Pareto.

Where they bite first in this project:

- The building app's panel has many controls. Group them, hide the
  operator's controls behind an "advanced" fold for residents, and
  put Regenerate where the eye is.
- The flat app's save dialog: four boxes plus two fields plus a
  number. Sensible defaults, one primary button.
- The resident card (next packer run): essentials first, one
  screen, end with what the resident can do next.
