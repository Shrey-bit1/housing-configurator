---
id: "0033"
title: One command to start, and a clear word when the store is not there
source: 0033-one-command-to-start.md
status: complete
branch: run/0033
commit: 2e1f2af
completed: 2026-09-06
---

## Summary

`npm run dev` now serves the app and the store together on one address,
`http://localhost:8888`, and `netlify-cli` comes with the repository so nothing
has to be installed by hand. When a call to the store fails because the store is
not running, the app says one sentence naming the command and the address
instead of printing the JSON parser's complaint. The group's code moved into the
top bar, so a resident who forgot it can read it wherever they are.

## What I did

- `package.json:20` — `netlify-cli` pinned at `27.5.0` in `devDependencies`.
- `package.json:7-8` — `dev` is `netlify dev`, `dev:vite` is the old `vite`.
- `netlify.toml` — new, 21 lines, pinning the command, the ports and both
  directories.
- `src/session/session.ts:91-134` — `StoreFailure`, `STORE_ADDRESS`,
  `STORE_COMMAND`, `classifyStoreFailure`, `storeAbsentText`.
- `src/session/session.ts:136-166` — `checkGroup`, replacing `groupIsStarted`.
- `src/library/unitBrowser.ts` — the `storeAbsentText` option and the `absent`
  test in `refreshSession`.
- `src/main.ts` — the wiring, and the join's two failure branches.
- `index.html:38-42` — the top bar's code; `:379` the trimmed sentence.
- `src/style.css:2035-2047` — `.tb-code`.
- `README.md:5-19` — the How to run it section.
- `src/session/session.test.ts` — eleven new cases.
- `PROJECT_STATE.md:4249`, `_cowork/CONTEXT.md:279`, `:294`.

## Findings

**The failure was invisible to the app.** Plain Vite answers `/api/session/...`
with `index.html` and a **200**, not a 404 and not a connection error. So every
ordinary check the app could make said the call succeeded, and the only thing
that went wrong was `res.json()` throwing. That is why the resident saw a parser
error: it was the first thing that noticed. The rule therefore has to look at
`ok` and the content type together, and a 404 has to be read two ways depending
on what it carries.

**Two functions were answering one question.** `groupIsStarted`, added in run
0032, returned a bare boolean and so read a missing store as a missing group.
That is right for a fail-closed join and wrong for what the resident is then
told. It was deleted rather than kept beside `checkGroup`.

**The CLI is large and the bundle did not notice.** 661 packages and 268 MB
arrived; the built JS grew 859 bytes and the CSS 211, all of it this run's own
source. A dev dependency nothing imports costs the build nothing, which is worth
stating because the size of the install invites the opposite worry.

## Evidence

**1. Commits and the branch state on `main`.** `main` was at `21da91c`, "Merge
run/0032: starting a group, and a code that does not exist says so". `run/0033`
branched from it. Eight commits:

| hash | message | stats |
|---|---|---|
| `dc3e857` | dev: netlify comes with the repo | 2 files, +16911 -1595 |
| `7690363` | dev: npm run dev starts the store too | 1 file, +2 -1 |
| `9883f01` | dev: the dev server is written down | 1 file, +21 |
| `e4a257b` | ui: the store is not running | 3 files, +103 -10 |
| `a37f68f` | ui: the group code stays where you can see it | 3 files, +23 |
| `0fd85c4` | copy: the code is passed on | 1 file, +1 -1 |
| `ffa9da8` | docs: how to run it | 1 file, +14 |
| `2e1f2af` | session: tests for 0033 | 1 file, +81 -11 |

The first commit's size is `package-lock.json`, not source.

**2. The command, the address, and what it prints.** Shrey types:

```
npm run dev
```

It opens **http://localhost:8888**. From a cold start on this machine the
address answered `200` about **20 seconds** later. The first twenty lines, with
the colour codes stripped:

```
npm notice run grid-module-configurator@0.1.0 dev
npm notice run netlify dev
⬥ Injecting environment variable values for all scopes
⬥ Setting up local dev server

⬥ Starting #custom dev server
⠋ Waiting for #custom dev server to be ready on port 5173
npm notice run grid-module-configurator@0.1.0 dev:vite
⠙ Waiting for #custom dev server to be ready on port 5173
npm notice run vite
⠹ Waiting for #custom dev server to be ready on port 5173
Re-optimizing dependencies because lockfile has changed
⠸ Waiting for #custom dev server to be ready on port 5173

  VITE v5.4.21  ready in 886 ms

⠼ Waiting for #custom dev server to be ready on port 5173
  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
⠴ Waiting for #custom dev server to be ready on port 5173
```

The port is stable at 8888 because `netlify.toml` pins it. Netlify runs
`npm run dev:vite` as its own child on 5173 and proxies it, so the two scripts
compose and 5173 stays exactly what it was. The store answers there:

```
$ curl http://localhost:8888/api/session/probe-0033
{"code":"probe-0033","flats":[],"residents":[],"building":null,"exists":false,"messages":[]}
```

One caveat worth knowing: the first attempt printed
`⬥ Could not acquire required 'port': '8888'` and served nothing, because
another Netlify dev server was already holding the port. That is the CLI
refusing to move rather than silently choosing another, which is the behaviour
this run wants.

**3. `npm install`.** The install of `netlify-cli@27.5.0` took **120 seconds**
on this machine over an already-warm npm cache. `node_modules` went from **158
MB to 426 MB**, so it added **268 MB**, and the package count went from **77 to
738**, so it brought **661 packages**. It also declares six postinstall scripts,
including a `node-gyp` rebuild for `unix-dgram` and a `sharp` download, which
npm listed and did not run without approval. A first install on a cold cache
would be slower; 120 seconds is the measured number here and not an estimate of
the general case.

**4. The old error and the new sentence**, both from the same failure: the app on
plain Vite with the group `room1` set, opening the group panel.

Before:

> Could not load /api/session/room1: Unexpected token '<', "<!DOCTYPE "... is not valid JSON

After:

> The group needs the store, which is not running. Start it with npm run dev and open http://localhost:8888.

The underlying call is unchanged. `fetch("/api/session/room1")` on 5173 returns
`200` with a body beginning `<!DOCTYPE html>`, which is Vite's SPA fallback.

**5. The four cases**, from `src/session/session.test.ts` and from
`classifyStoreFailure` in `src/session/session.ts`.

| case | what it saw | decided | said |
|---|---|---|---|
| HTML where JSON was expected | `200`, `text/html`, body will not parse | `absent` | the sentence above |
| the connection was refused | `fetch` threw, no response | `absent` | the sentence above |
| the store answered `404` | `404`, `application/json`, parsed | `error` | the store's own message |
| the store answered `500` | `500`, `application/json`, parsed | `error` | the store's own message |

A fifth case is tested because it is the one that could go wrong quietly: a
`404` carrying `text/html` is `absent`, since a static server's 404 is a page
about a path it never heard of rather than the store saying no.

**6. The top bar and the sentence.** Measured live at 5173.

With a group, the bar's left side reads, in order: the mark, `(Re)Configure`,
`0.6 m grid`, and then the code, `room1`, at 11px in `"JetBrains Mono"` with a
hairline border, the meta grey, and `user-select: all` so one click takes the
whole thing.

Without a group, that element is `hidden`, its text is `""` and its
`offsetParent` is `null`, so it occupies nothing. The `No group` chip on the
right of the bar already says there is no group, and saying it twice in one bar
is worse than saying it once.

`index.html:379` after the edit reads, in full:

> Pass this to the others so they can join.

**7. `npm run build`, before and after.**

Before, on `main`:

```
dist/assets/index-Cox0blbP.css     38903 bytes
dist/assets/index-xyFZf-FY.js    3428946 bytes
```

After, on this branch with `netlify-cli` installed:

```
dist/assets/index-b2EQSvMT.css     39114 bytes
dist/assets/index-CiTr2NhO.js    3429805 bytes
```

The JS grew **859 bytes** and the CSS **211**. That is the store-failure rule,
`checkGroup`, the top bar's code and `.tb-code`, which is all of this run's own
source. Nothing from a 268 MB CLI is in there; if any of it had been bundled the
numbers would differ by megabytes. Both builds carry only the standing
chunk-size warning.

**8. Test counts, fixtures, downloads and `tsc`.** The fast suite goes from 290
in eighteen files to **298 in eighteen**. `session.test.ts` goes from 40 to 48,
which is eleven new cases less the three that retired with `groupIsStarted`. The
slow suite is unchanged at `57 passed | 1 expected fail`.

Both fixture baselines are unchanged at **12 and 7**: `flat-1-two-storey.json`
reads 1 hard plus 11 soft and `flat-1-no-stair.json` 1 hard plus 6 soft.
`testflats/`, `src/core/rules.ts`, `src/core/saveFiles.ts`,
`src/core/savePlan.ts`, `src/core/modules.ts`, `docs/bridge-format.md` and
`src/session/store.ts` all show zero changed lines against `main`, so **the
three downloads stay byte-identical and the store contract did not change at
all**. `npx tsc --noEmit` exits 0.

**9. The skills.** One was read from disk under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`.

`design-automation` contributed section 8.3 on error handling in automated
workflows, whose distinction between a transient failure and a misconfiguration
is exactly the one this run had to draw: the store answering `500` is the first,
the store not being there at all is the second, and only the second can be fixed
by a sentence telling somebody what to type. Its key principle 5, "transparency
over black boxes", is the argument against the old behaviour: the parser's
message was transparent about the wrong layer. And its section 1.4 hard and soft
rule distinction is why `classifyStoreFailure` is one function read by both
screens rather than a condition written twice.

`interoperability` was **not read** this time. Nothing here changes the seam
between the two apps: the store contract is untouched, and the only thing that
crosses is the address, which the README now states.

The geometry skills were not read. Nothing here is geometry.

**10. Contradictions with the Assumptions, then my own.**

All four assumptions hold. Assumption 4 in particular: the Netlify CLI was not
installed globally on this machine, which is why task 1 exists and why the
`npx netlify dev` used in earlier runs was fetching it fresh every time.

My own assumptions. **`netlify dev` runs Vite as its child** through
`[dev] command = "npm run dev:vite"` and `targetPort = 5173`, rather than
Netlify's own framework detection, which would have run Vite with flags this
repo does not choose. **`autoLaunch = false`**, so the command does not steal a
browser window from whoever ran it. **The absent-store sentence names the
command and the address as literals** in `session.ts` rather than reading them
from `netlify.toml`, which the browser cannot see; they are two constants,
`STORE_COMMAND` and `STORE_ADDRESS`, so there is one place to change them.
**`groupIsStarted` was deleted** rather than deprecated, and its three tests went
with it. **The unit browser gets the sentence as an option** rather than
importing it, keeping that module free of imports outside `src/library/`, which
is the rule it has followed since run 0018. **The top bar shows the code and not
the resident's name**, because the name is already on the right of the bar in
the session chip.

## Artifacts produced

- `netlify.toml`, new.
- `package.json`, `package-lock.json`, `README.md`,
  `src/session/session.ts`, `src/session/session.test.ts`,
  `src/library/unitBrowser.ts`, `src/main.ts`, `index.html`, `src/style.css`.

## Decisions and rationale

**One rule, read by both screens.** The group panel and the join both talk to
the store and both used to decide for themselves what a failure meant.
`classifyStoreFailure` is the only place that decides now, which is what makes
the two screens say the same thing about the same failure.

**A 404 is read two ways.** By status alone it is ambiguous: the store's 404
means no such flat, and a static server's 404 means no such path. The content
type separates them and nothing else does.

**The sentence names a command.** "The store is not running" would have been
true and useless. Naming `npm run dev` and the address is the difference between
an error and an instruction.

**`netlify-cli` pinned exactly.** A caret range would let a CLI minor move the
dev address, which is the thing this run exists to stop.

**The old start kept under a second name.** Someone working on the editor alone
does not need a 268 MB dev server in the loop, and `dev:vite` is also what
`netlify.toml` calls, so keeping it is not a courtesy but a requirement.

## Deviations from the prompt

**The README covers tasks 2 and 7 in one commit.** Task 2 asks for two lines in
`README.md` saying what each script does, and task 7 asks for a short section at
the top. The same section answers both, so it landed once, in `ffa9da8`, and
task 2's commit says so.

**Tasks 5 and 6 were first committed together and then split.** Both touch
`index.html`. The first commit was amended to hold only the top bar and the
sentence was committed separately as `0fd85c4`, so the history matches the
prompt's structure.

## Blocked / did not do

None.

## Open questions for you

**1. Should the building app be started by this repository too?** Shrey now runs
two apps that must agree on one address, and this run fixed the half of that
which lives here. The other half is still "remember to set the Store field".
A second script, or a note in the building app's own README, would close it, and
which of the two is right depends on whether the repositories are ever cloned
apart.

**2. Is 8888 the right port to pin?** It is Netlify's default and it is what the
building app has been pointed at all along, so it was the conservative choice.
It is also a common port and this run has already seen it collide, with the CLI
refusing to start rather than moving. If that happens to Shrey mid-test, the
message is Netlify's own and does not say what to do about it.

**3. Should the app check the store once at startup rather than on first use?**
Today a resident learns the store is missing when they open the group panel,
which may be some minutes in. A check on load could put the same sentence on the
landing before anything else happens. That is a design decision about how loud
to be on a screen whose whole point is being quiet.

## Suggested next prompt

**0035, one command for both apps.** Take open question 1. In the building app,
default its Store field to `http://localhost:8888` rather than empty, so the two
agree without anybody remembering, and say in both READMEs that the flat app is
started first because it is the one that serves the store. Then decide question
3 there as well, since the building app is the one that cannot do anything at
all without the store and is therefore the right place to find out early.
