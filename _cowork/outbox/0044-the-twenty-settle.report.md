---
id: "0044"
title: The twenty settle, and the line endings stay put
source: 0044-the-twenty-settle.md
status: complete
branch: run/0044
commit: 8d34b3b
completed: 2026-09-09
---

## Summary

Two fixes and no feature, both landed, plus one thing found on the way that
neither the prompt nor the two runs before it had right. `scripts/vote-group.mjs`
now lets a group settle: round 1 splits 8 to 12 as before, round 2 leaves the
disagreement behind, and round 3 reaches three quarters or more on every pair. A
`.gitattributes` writes down the line-ending convention the repository already
follows, and moves no file. The line-ending damage runs 0042 and 0043 reported
was not what they said it was, and the real cause is written down.

## What I did

Six commits on `run/0044`, cut from `main` at `67ccd6d`, which is the merge of
run 0043 and does carry it. Nothing was staged with `git add -A`.

| Commit | Title | Stats |
|---|---|---|
| `2948818` | script: the twenty settle in two or three rounds | `fillGroupTable.mjs` +70 −4, `vote-group.mjs` +10 −1 |
| `0c4a178` | docs: the NUL byte out of PROJECT_STATE.md | +1 −1 |
| `18cc7d8` | repo: line endings stay as they are | `.gitattributes` +40, new |
| `266fcb4` | script: the draw is one number per person per dial, held for the vote | `fillGroupTable.mjs` +16 −9 |
| `e3ed408` | tests for 0044 | `fillGroupTable.test.ts` +115 |
| `8d34b3b` | docs: PROJECT_STATE for run 0044 | +66 |

The whole run against `main` touches 5 files, none of them under `src/`.

## Findings

**The pick rule by round, in one paragraph.** `firstPreference` at
`scripts/fillGroupTable.mjs:128` is what a person wants before anybody has seen
a count: if the pair's dial is one of the two reasons they care about most they
want the challenger, otherwise they keep the building the group has. Round 1 is
that and nothing else, so the first tally is a real disagreement and still
splits 8 to 12 on every pair. From round 2 a person who wanted the challenger
has watched it lose and comes across, with a chance that rises by round:
six in ten in round 2 and nine in ten in round 3 and after, which is
`followChance` at `:152`. Nobody on the winning side ever moves and the chance
only rises, so the winning side only grows and a settled group stays settled.
The rule needs no history, because the table is fixed: round 1 is a property of
it and the loser is always the challenger, 8 of 20 on every dial. Somebody who
comes across keeps their own first care as the reason, because they are not
saying the dial moved them, they are saying the group has decided.

**The round-by-round output of a fresh group settling**, read back from
`GET /api/session/settled-0044/export` after three rounds of five pairs. The
figure is the count for the building the group has, out of 20.

```
round 1  privacy: 12/8   shared space: 12/8   cost: 12/8   light: 12/8   short walks: 12/8   replaced 4   closed 2026-09-09T11:03:12.032Z
round 2  privacy: 17/3   shared space: 18/2   cost: 17/3   light: 14/6   short walks: 18/2   replaced 4   closed 2026-09-09T11:03:45.584Z
round 3  privacy: 19/1   shared space: 20/0   cost: 18/2   light: 19/1   short walks: 20/0   replaced 4   closed 2026-09-09T11:04:16.913Z
```

Round 1 is 60 percent on every pair. Round 2 is 70 to 90 percent, and four of
the five pairs are at or past three quarters. Round 3 is 90 to 100 percent and
all five are past it. Four replaced votes in every round, which is the four who
change their mind still doing it. Every round closed on its twentieth vote.

**Round 2 does not always reach three quarters, and round 3 does.** Six in ten
of the eight who want the challenger is about five, so a pair lands between 14
and 18 of 20. On `settled-0044` the light pair sat at 14. Nine in ten in round 3
leaves about one, and five different group codes were checked in the test:
`one-group`, `another-group`, `hall-14`, `walk-08` and `settle-0044` all reach
15 of 20 or better on every pair by round 3. The prompt asked for round 2 or 3,
and round 3 is the one that carries the claim.

**`git ls-files --eol` before**, over 370 tracked files:

```
   308  i/lf  w/crlf     every text file: LF in git, CRLF on disk
    45  i/-text          32 .jpg, 12 .png, and PROJECT_STATE.md
    15  i/none           empty files
     2  i/lf  w/lf       the two Context copies under _cowork/design/landing
     0  i/crlf           no blob in this repository holds CRLF
```

**The `.gitattributes` chosen** is `* text=auto eol=crlf`, with `eol=lf` for the
two Context copies and `binary` for pictures and fonts. That is what the census
already showed, so nothing moved: `git status` reports nothing modified with the
file in place, and `git add --renormalize .` stages no blob. `eol=lf` was
rejected because it would have rewritten 308 working-tree files, and the
measurement is what decided it.

**Runs 0042 and 0043 both misdiagnosed the line endings, and so did the prompt.**
Assumption 2 says files are CRLF on disk and the runs rewrote them as LF. Both
halves of that are wrong in an important way. `core.autocrlf=true` on this
machine, every blob is LF, and no blob has ever held CRLF. What the edit scripts
actually did was convert newlines in text that ALREADY carried CRLF, turning
each `\r\n` into `\r\r\n`. The normalisation on commit stripped only the last
pair, so the blob came out with a stray CR at the end of every line, which is
why `git diff` showed the whole file. Measured: the graphView blob at `8760338`
holds 677 stray CRs and the same file at `47150a1` holds none. Every blob at
`HEAD` is clean, which was checked over every tracked text file. A
`.gitattributes` does not prevent this, and it is worth having anyway; the cure
for the cause is to join lines with the ending a file already has, which is what
every edit in this run did.

**PROJECT_STATE.md held a NUL byte.** Run 0042 wrote a Windows path inside a
Python string as a backslash followed by two noughts, which Python reads as an
octal escape for NUL. One NUL landed at line 5046, and git read the whole file
as binary because of it. That is why it was the one markdown file
`git ls-files --eol` reported as `-text`, why it never normalised, and why it is
LF on disk while every other text file is CRLF. Removed in its own commit,
`0c4a178`, a one-line diff.

## Evidence

**Test counts.**

| suite | before (`67ccd6d`) | after |
|---|---|---|
| fast | 517 in 24 files | 530 in 24 files |
| slow | 59 passed, 1 expected fail, in 4 files | 59 passed, 1 expected fail, in 4 files |

The 13 new cases are all in `scripts/fillGroupTable.test.ts`.

**Two of the new tests failed on the way in, and both were the rule's fault.**
The first said the winning side never shrinks and it did: 2 for the challenger
on a pair in round 3 and 4 in round 4, because the draw was taken again each
round. That is what `266fcb4` fixes. The second asserted three quarters in round
2 for any seed, which is not true, so the test now says what actually happens
and round 3 carries the claim.

**Both fixture baselines are unchanged at 12 and 7**, asserted inside the slow
suite, which passes.

**The three downloads are byte-identical.** `git diff --stat 67ccd6d HEAD` over
`src/core/unitExport.ts`, `src/core/saveFiles.ts`, `src/core/projectIO.ts`,
`src/core/modules.ts`, `docs/bridge-format.md` and `testflats/` returns nothing.
This run touched no file under `src/`.

**The landing fingerprint test passes at 16.**

**`npx tsc --noEmit` exits 0. `npm run build` succeeds in 7.89 s.**

**Every file this run wrote is clean.** `scripts/fillGroupTable.mjs`,
`scripts/vote-group.mjs`, `scripts/fillGroupTable.test.ts`, `.gitattributes` and
`PROJECT_STATE.md` all hold zero stray CRs and zero NUL bytes, checked by
counting bytes rather than by reading a diff.

## Artifacts produced

- `_cowork/outbox/0044-the-twenty-settle.report.md` — this file.
- `.gitattributes` — the line-ending convention, 40 lines.
- `scripts/fillGroupTable.mjs` — `firstPreference`, `followChance`, `chanceFor`
  and the round-aware `voteFor`.

## Decisions and rationale

**The draw is one number per person per dial, not per round.** A number drawn
fresh each round is independent, so a person who came across in round 3 might
not in round 4 and a settled group comes apart. One number held for the whole
vote, compared against a chance that rises, makes coming across permanent by
construction and needs no state.

**It is keyed on the dial rather than the pair id.** A pair is built fresh every
round and carries a new id, so a pair id cannot follow a person across rounds.
What a person is deciding about is the dial.

**The chance stayed at six and nine in ten**, which the prompt offered as a
suggestion. Raising round 2 would have made it reach three quarters more often,
and round 3 already carries the claim for every code tested, so the numbers the
prompt named are the ones in the code.

**The NUL byte is a separate commit from the `.gitattributes`.** Task 2 said no
file's content changes in that commit, and removing a byte is a content change.

## Deviations from the prompt

**Assumption 2 is wrong in both halves**, set out under Findings. The repository
stores LF and checks out CRLF, no blob has ever held CRLF, and the damage was a
stray CR inside each line rather than a wholesale conversion. The
`.gitattributes` was still written, because it is worth having, and the report
says plainly that it would not have prevented what happened.

**Assumption 1 said the split is the same on every pair whatever the round**,
which was true and is the defect. It also said a person picks by whether their
BALLOT ranks the dial high. It is `cares`, a separate column added in run 0041
for this reason: a ballot ranks the five kinds of shared space and a dial is one
of the five reasons, and the two lists have nothing in common.

**Task 1 asked for one commit and it is two.** The second is the monotone draw,
which the tests in task 3 found. Folding it into the first would have hidden a
defect that the record should carry.

**A NUL byte was removed, which task 2 did not ask for.** It is the reason
PROJECT_STATE.md was the one text file git treated as binary, so the line-ending
task could not be honestly finished without it.

## Blocked / did not do

None.

## Open questions for you

1. **The group always settles on the building it already had, and nothing here
   can make it settle on a challenger.** The rule moves people toward the winner
   of round 1, and round 1's winner is always the incumbent because the table
   gives the challenger 8 of 20 on every dial. That is a settled vote, and it is
   also a vote in which the challenger never once wins a pair. Whether that is
   the right shape depends on what the building app does with a round: if it
   rebuilds the incumbent from the round's weights, then converging on "the
   building we have" is convergence on something that keeps moving, and the
   thesis argument holds. If it does not, the twenty are ratifying a building
   nobody chose. The building app's own run is where that is visible, not here.

2. **The four who change their mind now do it in every round, including the
   settled ones.** `replaced` held four entries in all three rounds of
   `settled-0044`. In round 3, when 19 of 20 agree, four people still cast a
   vote and change it. That reads as noise rather than as a room, and the fix
   is a judgement about what the record should show: a change of mind is most
   interesting in round 1 and least in the round where everybody agrees.

## Suggested next prompt

Give the twenty a reason to pick a challenger sometimes, so a vote can change
the building rather than only confirm it. Today `firstPreference` gives the
challenger 8 of 20 on every dial, because `cares` is spread evenly across the
five reasons, and the settling rule then moves everybody to the incumbent. A
round where the challenger wins needs the table to care about one dial more than
the others, or the pair's own numbers to enter the rule: the building app sends
`summary` with each candidate, and nothing in `scripts/vote-group.mjs` reads it.
The run should make the pick read one number from the pair, say the flats that
fit or the shared space, so a challenger that is plainly better wins its pair,
and report a walked vote in which at least one round changes the building. It
should keep round 1 a real disagreement, keep the group settling by round 3, and
keep the whole rule pure and seeded by the group code.
