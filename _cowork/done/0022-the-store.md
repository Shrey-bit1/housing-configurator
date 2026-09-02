---
id: "0022"
title: The store
created: 2026-09-02
---

## Context

Today a flat leaves the configurator as a file download, and the
building configurator reads it after somebody uploads it by hand.
That is fine for one person at one desk. It does not work for five
residents in a room, which is the test three of the four mid-review
jurors asked for on 24 August.

This run builds the thing that replaces the file: a small shared
store that both apps can reach over HTTP. The flat configurator will
publish to it (run 0023), and the building configurator will read
from it (bottom-up 0042). This run builds only the store and proves
it from the shell. Nothing in the app's UI changes.

The store lives in this repo because this repo is Shrey's own and it
already deploys to Netlify. A Netlify function is the handler and
Netlify Blobs is the storage. The building repo will call the same
function across origins, so CORS is open.

One store serves many sessions. A session is a short code in the
URL. Everyone who knows the code is in the same building. There is no
login and no password. A resident is a name typed in. That is
accepted for a five-person test and it is written down as a limit.

What the store holds, per session:

- FLATS. Each published flat: who published it, a short label, the
  `dwelling-unit` JSON exactly as Export writes it today, a version
  number, and whether it changed since the last building run.
- RESIDENTS. Each resident's counts (how many of which flat they
  want), their shared-share wish as a number between 0 and 1, and
  their ordered ballot of shared-space types.
- BUILDING. The last run: the genome, a summary, who pressed it, and
  when. Written by the building configurator, read by everyone.

## Skills to use

Read the SKILL.md files from disk rather than invoking the skill
tool, which has been returning `Unknown skill`. `interoperability`
for the shape of the exchanged data and its compatibility rules.
Report which you read, what each contributed, and anything rejected
with the reason. If none is reachable on disk, say where you looked.
Reference, not instruction.

## Assumptions

These may be wrong. Check rather than trust, contradict rather than
work around. Where the prompt is silent, choose sensibly, keep going,
and record the choice.

1. `main` carries run 0021 or later. Branch from `main` and say what
   you found.
2. The site deploys on Netlify from this repo, with a `netlify.toml`
   or equivalent, and Netlify Functions are available. Netlify Blobs
   is available on the plan. If Blobs is not available, stop after
   proving that, report it, and do not substitute another backend,
   because every alternative needs Shrey's account.
3. The `dwelling-unit` v1 export, with `openCeilings` since run
   0021, is the bridge contract. The store carries it verbatim and
   never inspects it beyond what a summary needs.
4. The largest library unit's export is under 200 KB. Measure it and
   say the number, because it sets the blob size and the polling
   cost.

## Task

1. The handler, commit `store: four calls`. One Netlify function,
   routed by path and method, under a stable prefix such as
   `/api/session/`. The calls:
   - `GET  /api/session/{code}` returns the whole session state:
     flat summaries (id, resident, label, version, changed, outline
     bounding box, floor count, area in cells), every resident's
     counts, share and ballot, and the last building run. This is
     the call the building configurator will poll, so it must be
     small. No full flat JSON in it.
   - `GET  /api/session/{code}/flats/{id}` returns one flat's full
     `dwelling-unit` JSON.
   - `PUT  /api/session/{code}/flats/{id}` publishes a flat. Body:
     resident name, label, and the `dwelling-unit` JSON. If the id
     exists, replace it, increment the version, and set `changed`
     true. If it does not, create it at version 1.
   - `PUT  /api/session/{code}/residents/{name}` sets that
     resident's counts, share and ballot. Partial bodies merge.
   - `PUT  /api/session/{code}/building` writes the last run and
     clears `changed` on every flat. `GET` of the same path returns
     it.
   - `OPTIONS` on anything answers CORS. Allow any origin, methods
     GET, PUT and OPTIONS, header content-type.
   Storage is one Netlify Blobs store keyed by session code. Choose
   between one blob per session and one blob per object, and justify
   the choice in three sentences against the polling call. Unknown
   session codes on GET return an empty session rather than an
   error, so the first resident can arrive before anyone else.

2. Proven from the shell, commit `store: the round trip`. A script
   under `scripts/` that, against a base URL passed in:
   - creates nothing, since sessions are implicit
   - publishes both fixture flats under two different resident names
   - sets counts, a share and a ballot for each resident
   - reads the session state and checks the summaries
   - reads each flat back and checks byte equality with what was
     sent
   - writes a building run and checks that `changed` cleared
   - prints every response
   Run it twice and paste both outputs whole: once against
   `netlify dev` locally, once against the deployed preview.

3. Documented, commit `docs: the store`. Wherever the
   `dwelling-unit` format is documented, a sibling file describes
   the store: every call with its method, path, request body and
   response body, one worked example each, the session code
   convention (short, URL-safe, chosen by whoever starts the
   session), and the no-auth limit in one plain sentence.

4. Tests. If the existing test runner can exercise the handler
   without a live Netlify, add cases for routing, for replace versus
   create, for the partial merge on residents, and for `changed`
   clearing on a building write. If it cannot, say so, and the
   script from task 2 is the test.

5. PROJECT_STATE.md updated.

6. The record. Report to `_cowork/outbox/0022-the-store.report.md`,
   prompt moved to done/, one LOG row, committed on `run/0022` and
   pushed, with the preview address and the function's base URL.

If the run runs long: tasks 1 and 2 land whole; 3, 4 and 5 follow
named, in that order.

## Constraints

- A new branch `run/0022` from `main`. Never commit to main.
- Nothing visible in the app changes. No button, no panel, no
  field. That is run 0023.
- `@netlify/blobs`, and `@netlify/functions` if it is not already
  present, are the only new dependencies.
- The bridge contract is untouched. The store carries the
  `dwelling-unit` JSON verbatim and changes nothing in it.
- Commit before opening a file a second time.
- Never stage with `git add -A`.

## What I need back

Answer every point with its evidence. Raw output beats summary.

1. Every commit hash with one-line stats, the branch state found on
   `main`, the preview address, and the function's base URL.
2. The storage layout chosen and the three-sentence justification.
3. Both full outputs of the round-trip script, local and deployed,
   pasted whole.
4. The size of the largest library unit's export in bytes, and what
   the polling call returns in bytes for a session holding both
   fixtures.
5. The path of the store documentation and one worked example from
   it.
6. Test counts before and after, or the statement that the script
   is the test and why.
7. Which skills you read from disk, what each contributed, anything
   rejected with the reason, and where you looked if none was
   reachable.
8. Contradictions with the Assumptions, then your own assumptions
   with their effects.

The report follows the writing rules: short sentences, plain words,
connected prose that carries its own logic, no em dashes as glue, no
contrast constructions, neutral voice, prose before any list or
table, every number exact, and every claim names its evidence. The
reader has no access to this repo, so cite paths and line numbers.
