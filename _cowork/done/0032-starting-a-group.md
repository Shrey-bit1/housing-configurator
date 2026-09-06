---
id: "0032"
title: Starting a group, and a code that does not exist says so
created: 2026-09-04
---

## Context

There is no way to create a group, and there never was. `docs/store.md` says a
group exists the moment somebody asks for it: a `GET` on a code nobody has used
returns an empty group rather than an error. So typing a code into "Join a
group" creates it when it does not exist, silently, and the resident cannot tell
which of the two just happened. One typo in the code and a resident has started
an empty group of one while believing they joined the twenty.

Shrey's decision, 4 September: anybody may start a group, and they start it from
this app. The landing gains a third door, "Start a group", which invents a code
and shows it so the resident can pass it round the room. Joining then means
joining: a code that has never been started is refused with a sentence rather
than quietly conjured.

This needs the store to tell the two apart, which it cannot today, because a
group that was started and has nothing in it looks exactly like a group that was
never started.

## Skills to use

Read the SKILL.md files from disk, under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`.
`interoperability`, because this changes what the building app may assume when
it polls a code, and a change that breaks its poll is worse than the bug being
fixed. `design-automation` for "does this group exist", which is one rule read
by the landing, by the join and by the store. Report which you read, what each
contributed, and anything rejected with the reason.

## Assumptions

Check rather than trust, contradict rather than work around.

1. Run 0031 has landed and `main` carries it. If it has not, stop and report.
2. The session index is written through `updateIndex` in
   `src/session/store.ts`, and `sessionView` builds what a `GET` returns.
3. The landing's three doors are in `index.html` around line 330, and
   `showLanding` in `src/main.ts` around line 1291 drives them.
4. The building app polls `GET /api/session/{code}` continuously and today
   treats an empty answer as a group with nothing in it yet. Breaking that is
   out of the question; whatever this run adds is added beside what is there.

## Tasks

1. A group can be started, commit `store: a group is started on purpose`.
   `POST /api/session/{code}` starts one: `201` with the group's state when the
   code was free, `409` with a message naming the code when it was already
   taken. It writes `startedAt`, the store's own timestamp, into the index and
   nothing else. There is no body and no owner; anybody who knows the code can
   still do everything, which is the store's one recorded limit and this run
   does not change it.

2. A group knows whether it exists, commit `store: exists, and what it means`.
   `GET /api/session/{code}` gains `exists`, and keeps everything else exactly
   as it is, so the building app's poll is untouched. `exists` is true when the
   index carries `startedAt`, and also when it holds at least one flat or one
   resident, so that every group already live in the store today reads as
   existing without a migration. Say that rule in one sentence in
   `docs/store.md` and say why the second half of it is there.

3. The document, commit `docs: starting a group`. The call table gains the
   `POST` row. The sessions section is rewritten: it currently says a group
   exists the moment somebody asks for it, and that is no longer the whole
   truth. Say what `exists` means, what `startedAt` is, and that a `GET` on a
   code nobody has started still answers rather than failing, because the
   building app polls it.

4. A code you can say out loud, commit `session: a code worth reading aloud`.
   One pure function that invents a code: a short common word and two digits,
   from a small fixed list held in the code, inside the store's own character
   rules. It must be readable over a table without spelling it. It is checked
   against the store before it is offered, and tried again if taken, up to a
   small number of attempts.

5. The third door, commit `ui: start a group`. The landing's doors become Start
   a flat, Start a group, Join a group, Open a file. "Start a group" invents a
   code, starts it, and shows it large enough to read across a room, with the
   resident's name field beside it and one sentence saying to pass the code to
   the others. It is a plain screen in the app's own skin, not a dialog.

6. Joining means joining, commit `ui: no such group`. "Join a group" refuses a
   code that has not been started, with a sentence a person can act on, naming
   the code they typed and saying it may be a typo or the group may not have
   been started yet. The button stays where it is and nothing else moves.

7. Tests, commit `session: tests for 0032`. The `POST`: `201` on a free code,
   `409` on a taken one, the timestamp written once and never overwritten.
   `exists`: false on an untouched code, true after a `POST`, true on a group
   that has a flat but no `startedAt`, true on a group that has a resident but
   no `startedAt`. The code generator: inside the store's character rules, and
   a taken code is retried. The landing rule on the cases: code exists, code
   does not, code is malformed. Existing suites green, both fixture baselines
   still 12 and 7, the three downloads byte-identical.

8. The round trip, commit `store: the round trip starts a group`. The script
   starts a group, shows `exists` false before and true after, and shows the
   `409` on starting it twice. Print each raw.

9. PROJECT_STATE.md and `_cowork/CONTEXT.md` updated. Report to
   `_cowork/outbox/0032-starting-a-group.report.md`, prompt moved to done/, one
   LOG row.

All nine tasks land. There is no short version of this run. If it is long, it is
long; keep going until every task is done and the report answers every point.

## Constraints

- A new branch `run/0032` from `main`, and never a commit on main.
- `GET /api/session/{code}` keeps answering for a code nobody has started, and
  keeps every field it has today. Only `exists` is added. The building app's
  poll must not change behaviour, and the report proves that.
- The `dwelling-unit` format, `docs/bridge-format.md`, the rules and both
  fixtures stay untouched. The three downloads stay byte-identical.
- The editor, its tools and its validation are not touched.
- No new dependencies. Never stage with `git add -A`. Commit before opening a
  file a second time.

## What I need back

Answer every point with its evidence. Raw output beats summary.

1. Every commit hash with one-line stats and the branch state found on `main`.
2. `POST` on a free code and on a taken one, both pasted whole with status.
3. `GET` on a code nobody has started, pasted whole, beside the same call before
   this run, so it is visible that only `exists` was added.
4. `exists` on all four cases in task 7, each with the index behind it.
5. Twenty codes the generator invented, printed, so the wordlist can be judged.
6. The landing with four doors, and the Start a group screen, as captures if the
   environment writes them, else described element by element.
7. The refusal a resident sees on a code that does not exist, quoted.
8. The round-trip script's output, raw.
9. Test counts before and after, both fixture baselines, the three download
   checks, `tsc` clean.
10. Which skills you read from disk, what each contributed, anything rejected.
11. Contradictions with the Assumptions, then your own assumptions with their
    effects.

The report follows the writing rules: short sentences, plain words, connected
prose that carries its own logic, no em dashes as glue, no contrast
constructions, neutral voice, prose before any list or table, every number
exact, and every claim names its evidence. The reader has no access to this
repo, so cite paths and line numbers.
