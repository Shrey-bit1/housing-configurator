---
id: "0003"
title: Make the bridge survive a clone
source: 0003-make-the-bridge-survive-a-clone.md
status: complete
branch: elastic-rooms
commit: 6905a07
completed: 2026-07-28
---

## Summary

The absolute path was moved out of `_cowork/CONTEXT.md` into a new
`_cowork/CONTEXT.local.md`, and the ignore rule that used to hide the whole
orientation file now hides only the new one, so a clone arrives with all 112 lines of
method and one line to fill in by hand. Step 4 of `/next` gained a sub-step that
commits the run's own record and refuses anything else. Two commits were made and
pushed, and `origin/elastic-rooms` reads `6905a07456c653bee74881fa31a6514a41b76d3c`
from both the local tracking ref and the remote itself. The split left two sentences
elsewhere in `CONTEXT.md` describing the old arrangement, and a constraint in this
prompt forbade rewording them, so they are reported below rather than fixed.

## What I did

Every path was staged by name and no invocation of `git add` in this run carried
`-A` or `.`, including the two staging steps that were checked afterwards to confirm
what had been picked up.

The order was chosen so that the dangerous step came first while it was still cheap
to abandon. `_cowork/CONTEXT.local.md` was written before the ignore rule changed,
which meant it was briefly visible to git, so the rule was edited immediately and
`git status` was checked before anything was staged. Only once that file was
confirmed invisible did the run start committing. The record of run 0002 went in
first because it predates all of this and had been waiting since the previous run,
then the work of tasks 1 to 3 followed as a second commit, then the clone check ran
against the result, and the push came last.

- `_cowork/CONTEXT.local.md` was created with 8 lines, holding the absolute path and
  a short explanation of why it exists.
- `_cowork/CONTEXT.md:28` was replaced with a single line pointing at that file and
  saying a fresh clone has to write it by hand. No other line of the file was
  touched.
- `.gitignore:22-25` was rewritten in place, so the comment and its rule still form
  one block serving one purpose, and the target changed from `_cowork/CONTEXT.md` to
  `_cowork/CONTEXT.local.md`.
- `.claude/skills/next/SKILL.md` gained a new sub-step 5 in "Close the loop", and the
  reply sub-step was renumbered from 5 to 6. The file grew by 15 lines and lost 1.
- Three commits were made, described below, and the branch was pushed once.

## Findings

### What git now ignores

`git check-ignore -v` on `_cowork/CONTEXT.md` prints nothing and exits non-zero,
which is how the command reports that a path is not ignored. The same command on
`_cowork/CONTEXT.local.md` returns:

```
.gitignore:25:_cowork/CONTEXT.local.md	_cowork/CONTEXT.local.md
```

The rule sits at line 25 rather than line 24 because the comment above it grew from
two lines to three when it was rewritten to explain the split. That one-line shift
matters beyond bookkeeping, and its consequence is described further down.

`_cowork/CONTEXT.local.md` never appeared in `git status` at any point after the
ignore rule was edited, and a search of the staged file list before each commit
confirmed it was absent from the index both times. The constraint that would have
stopped this run before the push was therefore never triggered.

### The commits and the remote

Two commits were made before the push, and a third was made afterwards to carry this
run's own record.

| Hash | Message | Contents |
|---|---|---|
| `d73e3c8b6d8e3c67d04f0d05d259dcb231db04af` | `bridge: 0002 Verify and push the bridge commit` | 3 files, 297 insertions |
| `6905a07456c653bee74881fa31a6514a41b76d3c` | `Make the bridge survive a clone` | 3 files, 131 insertions, 4 deletions |

The second commit breaks down as 112 added lines for `_cowork/CONTEXT.md`, which git
counts as a new file because it was never tracked before, 15 added and 1 deleted for
`.claude/skills/next/SKILL.md`, and 4 added and 3 deleted for `.gitignore`.

The push moved the remote from `c7e1f6b` to `6905a07` in one step, reported as
`c7e1f6b..6905a07` rather than as a forced update. Read back afterwards:

```
git rev-parse origin/elastic-rooms
6905a07456c653bee74881fa31a6514a41b76d3c

git ls-remote origin refs/heads/elastic-rooms
6905a07456c653bee74881fa31a6514a41b76d3c	refs/heads/elastic-rooms
```

Both agree, which matters because the first reads a local ref that can be stale while
the second asks the server.

A third commit follows this report, carrying `_cowork/outbox/` for this file,
`_cowork/done/` for the prompt, and `_cowork/LOG.md`. It was made by hand rather than
by the new sub-step, because this run was invoked with the version of
`.claude/skills/next/SKILL.md` that existed before the edit, and a skill loaded at the
start of a run does not change underneath it. Its hash cannot appear here, since a
commit hash depends on the content of the file it commits. It is the tip of
`elastic-rooms` after this run and its message is `bridge: 0003 Make the bridge
survive a clone`.

### The clone

The repository was cloned with `git clone --branch elastic-rooms --single-branch`
into a temporary directory outside the project, and the result was read off disk
rather than inferred from the tree. The clone's `HEAD` resolved to `6905a07`.
`_cowork/CONTEXT.md` was present and `_cowork/CONTEXT.local.md` was absent, which is
what the split was for. Line 28 of the clone's copy reads:

```
**Absolute path:** recorded in `_cowork/CONTEXT.local.md`, which git ignores, so a fresh clone has to write that file by hand.
```

A literal search for the string `_T3\Module Configurator` across every file under
`_cowork/` in the clone returned no occurrence, so the machine-specific path did not
survive anywhere else in the bridge by accident. The clone contained ten entries under
`_cowork/`, including the three working directories and the four prompt and report
files accumulated so far. It was deleted afterwards.

### Two sentences the split made wrong

`_cowork/CONTEXT.md` describes its own ignore situation in the section on non-obvious
things, and that description was written before the split. Two claims there are now
false, and the constraint forbidding any rewording of `CONTEXT.md` beyond line 28
means both were left in place.

The first is at `_cowork/CONTEXT.md:103`, which cites the negation rules as
`.gitignore:27-30`. Those rules now sit at lines 28 to 31, because the comment above
the `CONTEXT.local.md` rule grew by one line. The citation is off by one in both
bounds.

The second is at `_cowork/CONTEXT.md:106-107`, which reads that `_cowork/CONTEXT.md`
"(this file) is the other deliberate exception, for the same reason: it holds an
absolute path". After the split the file holds no absolute path and is tracked, so
the sentence now describes the arrangement it replaced. A planning session reading
the file top to bottom meets the correct pointer at line 28 and this contradiction
seventy-nine lines later.

### The skill can only commit under PowerShell

The `allowed-tools` line in the front matter of `.claude/skills/next/SKILL.md` grants
`Bash(mv:*)`, `Bash(git rev-parse:*)`, `Bash(git branch:*)`, `Bash(git status:*)` and
`PowerShell(git *)`. The Bash entries cover no command that can stage or commit, so
the new sub-step can only run through PowerShell. That is enough on this machine and
it will fail on a machine driving the same skill through Bash. The front matter sits
before step 4 and the constraints forbade changing anything there, so it was left
alone.

## Evidence

Every number and quoted string above came from a command run during this session.
Nothing is estimated.

- Ignore behaviour: `git check-ignore -v` run separately on each of the two paths,
  with output quoted verbatim.
- Absence from the index: `git diff --cached --name-only` filtered for `CONTEXT.local`
  before each of the two commits, returning nothing both times.
- Commit contents: `git show --numstat --format=""` on `6905a07` returned
  `15 1 .claude/skills/next/SKILL.md`, `4 3 .gitignore` and
  `112 0 _cowork/CONTEXT.md`. The 297-insertion figure for `d73e3c8` came from the
  commit output at the time it was made.
- File lengths: `[IO.File]::ReadAllLines(...).Length` returned 112 for
  `_cowork/CONTEXT.md` and 8 for `_cowork/CONTEXT.local.md`.
- Push and remote: `git push origin elastic-rooms` reported `c7e1f6b..6905a07`,
  followed by the two lookups quoted above.
- Clone contents: `Test-Path` on both context files, `Get-ChildItem -Recurse -Force`
  over `_cowork/`, `Select-String` for the pointer line, and a `-SimpleMatch` search
  for the machine path.
- Line numbers in `.gitignore`: the file printed with an explicit running counter
  starting at 22.

## Artifacts produced

- `_cowork/CONTEXT.local.md`, 8 lines, ignored and never committed.
- `_cowork/outbox/0003-make-the-bridge-survive-a-clone.report.md`, this file.
- `_cowork/done/0003-make-the-bridge-survive-a-clone.md`, the prompt after its move.
- `_cowork/LOG.md`, with one row appended.

## The commit step added to next/SKILL.md

Quoted exactly as written, as sub-step 5 of "Close the loop", between the
`CONTEXT.md` sub-step and the reply:

```
5. **Commit this run's own record, and nothing else.** Stage exactly three paths by
   name: the report in `_cowork/outbox/`, the prompt now sitting in `_cowork/done/`,
   and `_cowork/LOG.md`. Commit them with the message `bridge: <id> <title>`.

   `git add -A` and `git add .` are forbidden in this step. A skill that commits on
   every run is the one place a stray flag does lasting damage: it would sweep up
   whatever else happened to be in the working tree and write it into history under a
   message describing something else.

   Nothing else goes into that commit, whatever else the run touched. If the work
   changed code, or updated `_cowork/CONTEXT.md` in the step above, those changes stay
   in the working tree so a person commits them deliberately after reading them.
   Committing is where this stops; pushing is a separate decision that belongs to
   whoever is watching the run.
```

## Decisions and rationale

The record of run 0002 was committed separately from the work of this run rather than
folded into one commit. Combining them would have produced a single commit whose
message described the clone fix while its contents also included a report about a
different prompt, and the history is the thing this whole exercise exists to protect.

`_cowork/CONTEXT.local.md` was given a short explanatory header rather than being made
a bare line holding the path. Someone arriving at a fresh clone finds `CONTEXT.md`
pointing at a file that does not exist, and the file they then create is more useful
if the version on the original machine shows what it is for. The cost is 8 lines
instead of 1.

This run's own three paths were committed by hand. Leaving them was permitted by the
prompt and would have been the smaller action, but it would have left the repository
in exactly the state that task 3 was written to end, and the next run would have
inherited the same untracked record the prompt describes as waiting for a person to
remember.

## Deviations from the prompt

The new sub-step ends with one sentence the prompt did not ask for: "Committing is
where this stops; pushing is a separate decision that belongs to whoever is watching
the run." It was added because the surrounding sub-step now performs a git write on
every run, and a reader who sees a commit instruction with no statement about pushing
has to guess. If the planning session would rather the skill say nothing about
pushing, that sentence can be deleted without touching anything else.

The prompt's context section describes `CONTEXT.md` as line 28 plus "the other 112
lines", which totals 113. The file measures 112 lines, and the edit replaced one line
with one line, so it measured 112 before the change as well. Nothing depends on the
difference, and it is recorded because every other number in this report is exact.

## Blocked / did not do

Nothing was blocked. The two false sentences at `_cowork/CONTEXT.md:103` and
`_cowork/CONTEXT.md:106-107` were left in place because a constraint forbade
rewording the file beyond line 28, and the front matter of
`.claude/skills/next/SKILL.md` was left unchanged for the same kind of reason.

## Open questions for you

1. **Should `CONTEXT.md` cite line numbers at all?** It currently names
   `.gitignore:27-30`, and this run moved those rules to lines 28 to 31 by adding one
   line of comment somewhere else in the file. That is the second time in three runs
   that an exact citation inside the orientation file has gone stale through a change
   that had nothing to do with it. Citing rules by their content instead, such as
   naming the negation block rather than its position, would survive edits above it,
   at the cost of being harder to check against the file. The trade is between a
   document that is precise when written and one that stays true, and it applies to
   every line number the bridge writes down.

2. **Should bridge commits share a branch with deliberate ones?** As of this run the
   history of `elastic-rooms` interleaves commits a person decided to make with
   commits a skill makes automatically at the end of every run, distinguished only by
   the `bridge:` prefix in the message. For a thesis that treats the record as source
   material this is arguably the point, because the record and the work then carry the
   same timestamps and the same ordering. The alternative is a separate branch or a
   separate repository for the bridge, which keeps the code history readable at the
   cost of breaking the tie between a change and the instruction that produced it.
   The decision determines what a reader of the log is looking at.

## Suggested next prompt

Audit `docs/bridge-format.md`, which is 221 lines, against what
`src/core/unitExport.ts` actually writes, read-only.

This is the third report to suggest it. Reports 0001 and 0002 both ended with the same
proposal and neither has been run, which is itself worth noticing: three runs have now
gone to bridge maintenance and none to the repository the bridge exists to drive. If
there is a reason the audit keeps being passed over, that reason is more useful to
know than the audit.

The substance has not changed. The `dwelling-unit` v1 format gained three additive
optional fields across separate sessions, `cellKinds`, `cellRooms` and `roomTypes`,
while the `version` value stayed at 1 deliberately. That file is the whole interface
with the second repository, and nothing fails when it drifts, so drift is found only
by looking. The prompt should ask for a field-by-field comparison of what the
specification documents against what the exporter emits, citing `unitExport.ts` line
numbers for each; any field written but undocumented, or documented but no longer
written; and whether the stated invariants, meaning that the cell count matches the
length of the kinds and rooms arrays and that the `roomTypes` legend covers every id
appearing in `cellRooms`, are enforced in code at export time or only described in
prose.
