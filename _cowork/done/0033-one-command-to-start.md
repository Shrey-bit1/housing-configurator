---
id: "0033"
title: One command to start, and a clear word when the store is not there
created: 2026-09-06
---

## Context

The store is a Netlify function, so it only exists when the app is served by
Netlify's dev server. `npm run dev` runs plain Vite on port 5173, where every
call to `/api/session/...` hits nothing and the group panel shows the raw line
"Could not load /api/session/room1: Unexpected token '<'". That is a parser
error shown to a person, and it breaks the brief's own voice rule.

Shrey now works locally on purpose: the flat app served by Netlify at 8888, and
the building app pointed at the same address. He should not have to remember a
command, install a tool by hand, or know why 5173 is different from 8888.

This run makes starting it one command, and makes the wrong port say something a
person can act on instead of a parser error.

## Skills to use

Read the SKILL.md files from disk, under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`.
`design-automation` for "is the store reachable", which is one rule and is
currently a failure that leaks its exception to the screen. Report which you
read, what each contributed, and anything rejected with the reason.

## Assumptions

Check rather than trust, contradict rather than work around.

1. `package.json` has `dev: vite` and no Netlify anything. There is no
   `netlify.toml` in the repository.
2. The store handler is `src/session/store.ts` and its Netlify entry is
   `netlify/functions/session.mts`.
3. The flat app calls the store with a relative path, at `src/main.ts:1523` and
   in the three URL builders at `src/main.ts:1955` to `1957`.
4. The machine this runs on is Windows and may not have the Netlify CLI at all.
   Do not assume a global install exists.

## Tasks

1. The tool comes with the repository, commit `dev: netlify comes with the
   repo`. Add `netlify-cli` as a dev dependency at a pinned version, so
   `npm install` brings it and nothing has to be installed by hand. Say the
   version in the report and say how large the install is, because it is a big
   one and Shrey should know before he runs it.

2. One command, commit `dev: npm run dev starts the store too`. `npm run dev`
   serves the app with the store, at one address. Keep the old plain-Vite start
   available under a second name for anyone who wants it, and say in
   `README.md` what each does in two lines. If the port cannot be made stable,
   say what it is instead of 8888 and why.

3. A `netlify.toml`, commit `dev: the dev server is written down`. Pin the
   command, the port, the publish directory and the functions directory, so the
   address does not move between machines or versions.

4. A clear word, not an exception, commit `ui: the store is not running`. When a
   call to the store fails because the store is not there, the app says one
   short sentence a person can act on: that the group needs the store, that
   `npm run dev` starts it, and which address to open. It never prints a parser
   error, a status code or an exception to the screen. Tell the two cases apart
   where you can: the store is not running at all, and the store answered with
   an error of its own. A real store error keeps saying what it said.

5. The code stays in sight, commit `ui: the group code stays where you can
   see it`. Run 0032 shows the group's code once, on the screen that invents
   it, and after that a resident who has forgotten it has to dig it out of the
   send panel's group field. Put it in the top bar instead, beside the brand,
   small and quiet, wherever a resident is in the app once they are in a group.
   One click selects the whole code, as it does on the Start a group screen.
   When there is no group, the bar says nothing rather than saying it is empty.
   Read the code from wherever the app already holds it; do not add a second
   place it can live.

6. One sentence, not two, commit `copy: the code is passed on`. `index.html:374`
   reads "Pass this to the others so they can join. It is the only way in." The
   second sentence goes. The first is enough, and the second overstates it now
   that the code sits in the bar as well.

7. README, commit `docs: how to run it`. A short section at the top: one command
   to start the flat app, the address it opens on, and one line saying the
   building app's Store field has to point at the same address. Four or five
   lines, no more.

8. Tests, commit `session: tests for 0033`. The rule that tells a missing store
   from a store error, on the cases: HTML came back where JSON was expected,
   the connection was refused, the store answered `404`, the store answered
   `500` with its own message. Existing suites green, both fixture baselines
   still 12 and 7, the three downloads byte-identical.

9. PROJECT_STATE.md and `_cowork/CONTEXT.md` updated. Report to
   `_cowork/outbox/0033-one-command-to-start.report.md`, prompt moved to done/,
   one LOG row.

All nine tasks land. There is no short version of this run. If it is long, it
is long; keep going until every task is done and the report answers every point.

## Constraints

- A new branch `run/0033` from `main`, and never a commit on main.
- `netlify-cli` is a dev dependency only. Nothing it brings may reach the built
  app, and `npm run build` must produce the same output it produces today.
- The `dwelling-unit` format, the rules and both fixtures stay untouched. The
  three downloads stay byte-identical.
- The store contract does not change at all in this run.
- Never stage with `git add -A`. Commit before opening a file a second time.

## What I need back

Answer every point with its evidence. Raw output beats summary.

1. Every commit hash with one-line stats and the branch state found on `main`.
2. The exact command Shrey types, the address it opens on, and the first twenty
   lines it prints, pasted raw.
3. `npm install` from clean: how long it took and how much it added.
4. The old error and the new sentence, both quoted, from the same failure.
5. The four cases in task 8, each with what the app decided and what it said.
6. The top bar with a group and without one, as captures if the environment
   writes them, else described element by element, and the sentence at
   `index.html:374` quoted after the edit.
7. `npm run build` output before and after, so it is visible that nothing from
   the CLI reached the bundle.
8. Test counts before and after, both fixture baselines, the three download
   checks, `tsc` clean.
9. Which skills you read from disk, what each contributed, anything rejected.
10. Contradictions with the Assumptions, then your own assumptions with their
   effects.

The report follows the writing rules: short sentences, plain words, connected
prose that carries its own logic, no em dashes as glue, no contrast
constructions, neutral voice, prose before any list or table, every number
exact, and every claim names its evidence. The reader has no access to this
repo, so cite paths and line numbers.
