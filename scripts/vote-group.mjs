#!/usr/bin/env node
/**
 * The twenty vote on the open round, so a walked vote has a real count.
 *
 *   node scripts/vote-group.mjs http://localhost:8888 walk-08
 *   node scripts/vote-group.mjs http://localhost:8888 walk-08 --round 2
 *
 * `scripts/fill-group.mjs` fills a group with twenty people so the whole
 * journey can be walked as the twenty-first. On 8 September that walk reached
 * the vote and the twenty never voted, because nothing made them. A round
 * waits for everyone, so the round could only be closed by hand and the count
 * read "1 of 1". This is the second half: the same twenty cast their votes.
 *
 * It writes ONLY through the store's public calls, `GET /api/session/{code}`
 * to read the open round and `POST /api/session/{code}/rounds/{n}/votes` to
 * cast one vote, both in docs/store.md. It never touches the store's files or
 * its index, so what it writes cannot be told from twenty real residents.
 *
 * The pick and the reasons come from each person's own row in
 * `scripts/fillGroupTable.mjs`, by the one rule in `voteFor` there, and four
 * named people change their mind once on the round's first pair. Two runs on
 * the same round give the same count.
 *
 * Without `--round` it votes on whatever round is open. `--round n` says which
 * round is expected and refuses if the open one is not it, which is what to
 * pass when a round has just been closed and its successor opened.
 *
 * Plain Node 18+, no dependencies: `fetch` only.
 */
import { RESIDENTS, ballotFor } from "./fillGroupTable.mjs";

const args = process.argv.slice(2);
const flagAt = args.indexOf("--round");
const wantRound = flagAt === -1 ? null : Number(args[flagAt + 1]);
// The round number is the one argument that is neither a flag nor positional.
// `-1` when there is no flag, so nothing is skipped; writing `flagAt + 1`
// unguarded would skip argument 0, which is the store's address.
const numberAt = flagAt === -1 ? -1 : flagAt + 1;
const positional = args.filter((a, i) => !a.startsWith("--") && i !== numberAt);
const [base0, code] = positional;
const base = (base0 ?? "").replace(/\/$/, "");
if (!base || !code) {
  console.error("usage: node scripts/vote-group.mjs <store-url> <group-code> [--round n]");
  process.exitCode = 2;
}

let failures = 0;
function line(what, status, detail = "") {
  const ok = status >= 200 && status < 300;
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${String(status).padEnd(3)} ${what}${detail ? "  " + detail : ""}`);
}

/** A refusal line that is the store working, not the script failing. */
function refused(what, status, detail) {
  console.log(`  --    ${String(status).padEnd(3)} ${what}  ${detail}`);
}

/**
 * Whether this answer means "you are not in this group".
 *
 * The store answers `403` (src/session/store.ts:768). Through `netlify dev`
 * that arrives as `404`: the dev server retries a non-2xx from a function as
 * `<path>.html`, `.htm`, `/index.html` and `/index.htm`, and the client is
 * handed the last of those 404s. Run 0039 found the same masking and its
 * report records it. Nothing else on this route answers either status, so both
 * mean the same thing, and the script prints which one it actually saw rather
 * than deciding for the reader.
 */
const notInTheGroup = (status) => status === 403 || status === 404;
const howItArrived = (status) =>
  status === 403
    ? "not in the group (the store's own 403)"
    : "not in the group (404, which is how `netlify dev` delivers the store's 403)";

async function call(method, path, body, headers) {
  const res = await fetch(`${base}/api/session/${code}${path}`, { method, body, headers });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: res.status, text, json };
}
const JSON_H = { "content-type": "application/json" };

/**
 * `process.exitCode` rather than `process.exit`, and one function so a refusal
 * can return out of it. Exiting hard while `fetch` still has a keep-alive
 * socket closing aborts Node on Windows with
 * `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`, which is what
 * `scripts/fill-group.mjs` did on its first run: it printed the right words
 * and then crashed over the top of them.
 */
async function main() {
  console.log(`voting in "${code}" at ${base} as ${RESIDENTS.length} residents`);

  // 1. What is open. The round comes from the polled state rather than from a
  //    number on the command line, so the script votes on the round the room
  //    is actually looking at.
  const state = await call("GET", "");
  const open = state.json?.round ?? null;
  console.log(
    `  before: round ${open?.n ?? "none"}, ` +
      `${open?.votes?.length ?? 0} vote(s), ${open?.replaced?.length ?? 0} replaced, ` +
      `${open?.pairs?.length ?? 0} pair(s), ${open?.expected ?? 0} expected`
  );
  // Two refusals, both exit 2, the same code the usage line uses: nothing was
  // written and nothing is half done, so a caller can tell "I asked wrongly"
  // from "some of the votes did not land", which is exit 1 below.
  if (open === null) {
    const last = state.json?.lastRound ?? null;
    console.error(
      `\nno open round in "${code}".` +
        (last === null
          ? " No round has ever been opened here."
          : ` Round ${last.n} closed at ${last.closedAt}. Open the next one, then run this again.`)
    );
    process.exitCode = 2;
    return;
  }
  if (wantRound !== null && open.n !== wantRound) {
    console.error(
      Number.isInteger(wantRound) && wantRound >= 1
        ? `\nround ${wantRound} was asked for and round ${open.n} is the open one.`
        : `\n--round wants a whole number 1 or more, and round ${open.n} is the open one.`
    );
    process.exitCode = 2;
    return;
  }
  console.log(`  pairs: ${open.pairs.map((p) => `${p.id}/${p.dial}`).join(", ")}`);

  // 2. Every person's whole ballot, in casting order. The four who change
  //    their mind cast twice on the first pair, so the store supersedes the
  //    first and keeps it in `replaced`.
  let closedAt = null;
  const strangers = [];
  for (const r of RESIDENTS) {
    for (const v of ballotFor(r, open.pairs)) {
      const res = await call(
        "POST",
        `/rounds/${open.n}/votes`,
        JSON.stringify({ who: r.name, pair: v.pair, pick: v.pick, reasons: v.reasons }),
        JSON_H
      );
      // Somebody the store does not know is not a failure of this script. It
      // is the store's membership rule working on a group this table does not
      // match. Report it, drop the rest of that person's ballot, which would
      // be refused the same way five more times, and go on to the next.
      if (notInTheGroup(res.status)) {
        strangers.push(r.name);
        refused(`${r.name.padEnd(7)} ${v.pair.padEnd(4)} ${v.pick}`, res.status, howItArrived(res.status));
        break;
      }
      const closed = res.json?.closedTheRound === true;
      if (closed) closedAt = res.json?.at ?? "";
      line(
        `${r.name.padEnd(7)} ${v.pair.padEnd(4)} ${v.pick}  ${v.reasons.join(", ").padEnd(13)}`,
        res.status,
        `${v.replaced ? "then changes their mind" : ""}${closed ? "  CLOSED THE ROUND" : ""}`
      );
    }
  }

  // 3. What the round looks like now, read back from the same polled call.
  const after = await call("GET", "");
  const round = after.json?.round ?? after.json?.lastRound ?? null;
  console.log(
    `\nround ${round?.n}: ${round?.votes?.length ?? 0} vote(s), ` +
      `${round?.replaced?.length ?? 0} replaced, ${round?.expected ?? 0} expected`
  );
  for (const p of round?.pairs ?? []) {
    const b = (round.votes ?? []).filter((v) => v.pair === p.id && v.pick === "b").length;
    console.log(`  ${p.id.padEnd(4)} ${p.dial.padEnd(13)} ${p.voted} of ${p.expected} voted, ${b} for the challenger`);
  }
  console.log(`  closedAt: ${round?.closedAt ?? "still open"}`);
  if (closedAt !== null) console.log(`  the last vote closed it, at ${closedAt}`);
  if (strangers.length > 0) {
    console.log(`  not in "${code}": ${strangers.join(", ")}`);
  }
  // Exit 1 when anybody's votes did not land, whether the store refused them
  // or a call failed. A refusal is the store being right and the run still
  // being short of what was asked for, and a caller in a script should hear
  // about both the same way.
  console.log(
    failures === 0 && strangers.length === 0
      ? `\nvoted.`
      : `\n${failures} call(s) FAILED, ${strangers.length} resident(s) refused`
  );
  if (failures > 0 || strangers.length > 0) process.exitCode = 1;
}

if (process.exitCode !== 2) await main();
