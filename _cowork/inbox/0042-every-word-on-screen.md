---
id: "0042"
title: Every word on screen, rewritten against the guide
created: 2026-09-08
---

## Context

Shrey read both apps' words on 8 September and rejected them. "Three
questions. The building follows." in the building app is the kind of line
he means: a slogan where a sentence should be. This app has its own. The headlines, the
captions, the buttons, the feed, the empty states and the error lines were
written run by run over three months by different sessions, and they do
not sound like one app or like the brief.

This run is one pass over every string a person can read in this app, and
nothing else. The measure is two documents. The brief's section "How the
app talks" (`_cowork/design/DESIGN-BRIEF-3sep.md`) says what the app
sounds like. Shrey's writing guide is in this repo at
`_cowork/design/WRITING-GUIDE.md`, the actual file, copied from the
Context folder on 8 September; it says how he writes and what he strikes
out. Read it from disk, every line, before anything else in this run. Read
both whole before touching a string. The rules that matter most, from the
guide: short sentences, plain words, no slogans, no punchlines, no
metaphors, no selling, no contrast constructions ("x, not y"), no em
dashes as glue, no filler words, hedges inside the sentence, every number
in something a person can picture. From the brief: short natural sentences
that explain rather than announce, as if explaining to a clever person who
has never seen this, kindly and unhurried.

## Skills to use

Read the SKILL.md files from disk, under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`.
`engineering:documentation` for how to inventory every user-facing string
and keep the inventory true afterwards. Report which you read, what each
contributed, and anything rejected.

## Assumptions

Check rather than trust, contradict rather than work around.

1. Strings a resident reads are spread across `index.html` (the landing's
   own forms, the send panel, the palette, the check-layout lines),
   `src/main.ts` (captions, the send sentence, the confirms), `src/core/`
   (the 35 rules' advisory lines, the journey labels, `draft.ts`'s
   START_AGAIN and FORGET_CONFIRM), `src/session/session.ts`
   (`landingRecall`'s line, the takeover text), and the store's own
   refusal messages in `src/session/store.ts`. There is no single place.
2. The store's refusals are read by a person only through the other app,
   but they are its words too; they stay exact and become plain.
3. Run 0041 has landed. The shared landing's words are the Context copy's
   and are not touched here.

## Tasks

0. The guide and the brief come across, commit `design: the writing guide
   and the brief as of 8 September`. Copy `WRITING-GUIDE.md` from
   `D:\_Studies\_DFAB\DFAB\_T3\Context\00-start\` to
   `_cowork/design/WRITING-GUIDE.md`, and `DESIGN-BRIEF-3sep.md` from
   `D:\_Studies\_DFAB\DFAB\_T3\Context\01-design\` over
   `_cowork/design/DESIGN-BRIEF-3sep.md`, both byte for byte.

1. The inventory, commit `words: every string a person reads`. One file,
   `docs/words.md`, listing every user-facing string in the app with
   where it lives: headline, caption, button, empty state, refusal,
   tooltip, the rule engine's advisory lines, the check-layout lines, the
   send sentence, the confirms, the store's refusals. Group by screen.
   Mark the ones written for the operator only. This is the before.

2. The rewrite, commit `words: rewritten against the guide`. Every string
   in the inventory rewritten to the brief's voice and the guide's rules,
   or left as it is with the reason. Headlines are sentences or plain
   nouns, never slogans: "Three questions. The building follows." becomes
   what the screen is, "Your wishes", with the explaining sentence under
   it. Buttons say what they do in the words a person would use: "See the
   group", "Send your answers", "This is the one". Feed lines name a
   person and a thing that happened. Every number in something a person
   can picture. Refusals say what to do differently. Nothing announces,
   nothing sells, nothing winks. Where a string is built from parts, the
   parts are rewritten so every combination reads as a sentence, and the
   report shows the combinations. Where a template needs a table (the
   vote's difference sentence, the card), the table is rewritten and
   tested.

3. One voice, one place, commit `words: the strings live together`.
   Strings a resident reads move into one module, `src/core/words.ts`, as
   named constants and small pure functions, imported wherever they are
   shown, so the next rewrite is one file. Strings the operator alone
   reads may stay where they are but are listed in `docs/words.md`.
   The journey labels keep their rule from the brief (copied from the
   brief, never imported across the two repos).

4. The after, commit `words: the inventory after`. `docs/words.md` gains
   the after column beside the before, and a short note per group on
   what changed and why, in the guide's own terms.

5. Tests, commit `tests for 0042`. A test that reads every string in
   `src/core/words.ts` and the templates' outputs over their tables and fails
   on the guide's tells: an em dash, "not only", "rather than" used as a
   contrast, a sentence ending in a full stop after a fragment of three
   words or fewer used as a headline, the words genuinely / honestly /
   straightforward / seamless / leverage / robust, an exclamation mark, a
   number with no unit where a unit exists. Existing suites green, both
   fixture baselines still 12 and 7, the three downloads byte-identical,
   the landing fingerprint test passing, `tsc` clean, the build
   succeeding.

6. Pictures, commit `words: what it reads like`. At 1440 by 900, after
   the rewrite: the landing remembered, the join form, step 01 with the
   palette and a check-layout fault showing, step 02 send before and
   after the press. Five pictures, `0042-<name>.png`.

7. PROJECT_STATE.md updated. Report to
   `_cowork/outbox/0042-every-word-on-screen.report.md`, prompt moved to
   done/, one LOG row.

All eight tasks land, task 0 included. There is no short version of this
run. It is long by nature; every string is looked at.

## Constraints

- A new branch `run/0042` from `main`. If `main` does not carry run 0041,
  stop and report.
- Words only. No layout, no logic, no rules' thresholds, no numbers
  change. The `dwelling-unit` format and the three downloads stay
  byte-identical. If a
  string cannot be fixed without changing what the screen does, leave it,
  list it, and say so.
- The journey's six labels change only if the brief's copy changes; they
  do not in this run.
- No new dependencies. Never stage with `git add -A`. Commit before
  opening a file a second time.

## What I need back

1. Every commit hash with one-line stats and the branch state found on
   `main`.
2. `docs/words.md` whole, before and after, pasted into the report.
3. The templates' tables with every combination's output.
4. The strings left unchanged and why, as a list.
5. The five pictures.
6. Test counts before and after, both fixture baselines, the three
   download checks, the fingerprint test, `tsc` clean.
7. Which skills you read from disk, what each contributed, anything
   rejected.
8. Contradictions with the Assumptions, then your own assumptions with
   their effects.

The report follows the writing rules: short sentences, plain words,
connected prose that carries its own logic, no em dashes as glue, no
contrast constructions, neutral voice, prose before any list or table,
every number exact, and every claim names its evidence. The reader has no
access to this repo, so cite paths and line numbers.
