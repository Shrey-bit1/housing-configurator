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
  if (open === null) {
    console.error(`\nno open round in "${code}". Open one first, then run this.`);
    return;
  }
  if (wantRound !== null && open.n !== wantRound) {
    console.error(`\nround ${wantRound} was asked for and round ${open.n} is the open one.`);
    return;
  }
  console.log(`  pairs: ${open.pairs.map((p) => `${p.id}/${p.dial}`).join(", ")}`);

  // 2. Every person's whole ballot, in casting order. The four who change
  //    their mind cast twice on the first pair, so the store supersedes the
  //    first and keeps it in `replaced`.
  let closedAt = null;
  for (const r of RESIDENTS) {
    for (const v of ballotFor(r, open.pairs)) {
      const res = await call(
        "POST",
        `/rounds/${open.n}/votes`,
        JSON.stringify({ who: r.name, pair: v.pair, pick: v.pick, reasons: v.reasons }),
        JSON_H
      );
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
  console.log(failures === 0 ? `\nvoted.` : `\n${failures} call(s) FAILED`);
  if (failures > 0) process.exitCode = 1;
}

if (process.exitCode !== 2) await main();
