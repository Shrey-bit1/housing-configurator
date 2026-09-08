#!/usr/bin/env node
/**
 * The session store's round trip, from the shell, against a live store.
 *
 *   node scripts/store-roundtrip.mjs http://localhost:8888          (netlify dev)
 *   node scripts/store-roundtrip.mjs https://<deploy>.netlify.app    (a deploy)
 *
 * It uses a fresh session code every run, publishes both library fixtures under
 * two resident names, sets each resident's counts, share and ballot, reads the
 * session state back and checks the summaries, reads each flat back and checks
 * it byte for byte against the file that was sent, writes a building run and
 * checks that `changed` cleared, then runs a whole round of the vote to its
 * close, then renames one resident and removes the other
and checks that a person's flats follow them out. Every response is printed; the two flat bodies
 * are printed as their size and SHA-256 rather than 70 KB of JSON, and the
 * byte comparison is the check. Exit code 1 if any check fails.
 *
 * Plain Node 18+, no dependencies: `fetch`, `fs` and `crypto` only.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const base = (process.argv[2] ?? "").replace(/\/$/, "");
if (!base) {
  console.error("usage: node scripts/store-roundtrip.mjs <base-url>");
  process.exit(2);
}

const code = "rt-" + Date.now().toString(36);
const fixtures = [
  { id: "flat-2", resident: "Ana", label: "Flat 2", file: "public/units/flat-2-single-storey.json" },
  { id: "flat-3", resident: "Ben", label: "Flat 3", file: "public/units/flat-3-terrace.json" },
];
const sha = (s) => createHash("sha256").update(s).digest("hex");
let failures = 0;
const check = (ok, what) => {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${what}`);
  if (!ok) failures++;
};

async function call(method, path, body, { quiet = false } = {}) {
  const url = `${base}/api/session/${code}${path}`;
  const res = await fetch(url, {
    method,
    body,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
  });
  const text = await res.text();
  const bytes = Buffer.byteLength(text);
  console.log(`\n${method} ${url}`);
  console.log(`${res.status} ${res.statusText}  ${bytes} bytes  cors=${res.headers.get("access-control-allow-origin")}`);
  console.log(quiet ? `(body not printed) sha256 ${sha(text)}  starts ${JSON.stringify(text.slice(0, 60))}` : text);
  return { status: res.status, text, bytes, json: safeJson(text) };
}
const safeJson = (t) => {
  try {
    return JSON.parse(t);
  } catch {
    return undefined;
  }
};

console.log(`session store round trip against ${base}, session "${code}"`);

// 1. A code nobody has started still ANSWERS, because the building app polls it
//    before anybody has published anything, but it says it does not exist yet.
const empty = await call("GET", "");
check(empty.status === 200 && empty.json?.flats?.length === 0, "unknown session reads as empty");
check(empty.json?.exists === false, "and says exists false, because nobody started it");
console.log(`  before starting: ${JSON.stringify(empty.json)}`);

// 1b. Start it on purpose (run 0032), then start it again and be refused.
const started = await call("POST", "");
check(started.status === 201 && started.json?.exists === true, "POST starts the group, 201, exists true");
console.log(`  the POST that started it: ${started.status} ${JSON.stringify(started.json)}`);
const twice = await call("POST", "");
check(twice.status === 409, "starting it twice is refused with 409");
console.log(`  starting it twice: ${twice.status} ${JSON.stringify(twice.json)}`);
const afterStart = await call("GET", "", undefined, { quiet: true });
check(afterStart.json?.exists === true, "exists is true after the start");
console.log(`  after starting: ${JSON.stringify(afterStart.json)}`);

// 2. Publish both fixtures, one per resident, then republish the first to see the version move.
const sent = {};
for (const f of fixtures) {
  sent[f.id] = readFileSync(f.file);
  const q = `?resident=${encodeURIComponent(f.resident)}&label=${encodeURIComponent(f.label)}`;
  const r = await call("PUT", `/flats/${f.id}${q}`, sent[f.id]);
  check(r.status === 201 && r.json?.version === 1 && r.json?.changed === true, `${f.id} created at version 1, changed`);
  console.log(`  sent ${sent[f.id].length} bytes, sha256 ${sha(sent[f.id])}`);
}
const again = await call("PUT", `/flats/flat-2?resident=Ana&label=Flat%202%20again`, sent["flat-2"]);
check(again.status === 200 && again.json?.version === 2, "republishing flat-2 replaces it at version 2");

// 3. Each resident's wishes; Ben's arrive in two partial bodies. Ana sends both
//    square-metre answers with everything else, Ben's second body sends ONLY
//    shareM2, so the merge is exercised on the new keys as well as the old.
const ana = await call("PUT", "/residents/Ana", JSON.stringify({ counts: { "flat-2": 1 }, share: 0.3, ballot: ["laundry", "workshop", "garden"], shareM2: 7, extraM2: 5, wishes: { corner: true, terrace: false, quiet: true } }));
check(ana.json?.share === 0.3 && ana.json?.ballot?.length === 3, "Ana's wishes stored");
check(ana.json?.shareM2 === 7 && ana.json?.extraM2 === 5, "Ana's square metres came back from the PUT");
check(ana.json?.wishes?.corner === true && ana.json?.wishes?.terrace === false && ana.json?.wishes?.quiet === true, "Ana's three wishes came back from the PUT");
console.log(`  Ana, echoed by the PUT: ${JSON.stringify(ana.json)}`);
await call("PUT", "/residents/Ben", JSON.stringify({ counts: { "flat-3": 2 } }));
const ben = await call("PUT", "/residents/Ben", JSON.stringify({ share: 0.5, ballot: ["garden"] }));
check(ben.json?.counts?.["flat-3"] === 2 && ben.json?.share === 0.5, "Ben's second, partial body merged with the first");
const ben3 = await call("PUT", "/residents/Ben", JSON.stringify({ shareM2: 9 }));
check(
  ben3.json?.shareM2 === 9 && ben3.json?.counts?.["flat-3"] === 2 && ben3.json?.ballot?.length === 1 && ben3.json?.extraM2 === null,
  "Ben's third body sent only shareM2 and left counts, ballot and extraM2 alone"
);
check(ben3.json?.wishes === null, "Ben never answered the wishes, so they read null");
console.log(`  Ben, echoed by the PUT: ${JSON.stringify(ben3.json)}`);

// 3b. The group says two things, from two different people (run 0031).
const m1 = await call("POST", "/messages", JSON.stringify({ who: "Ana", text: "shall we put the terrace on the south side?" }));
check(m1.status === 201 && typeof m1.json?.at === "string" && m1.json?.who === "Ana", "first message stored with the store's timestamp");
const m2 = await call("POST", "/messages", JSON.stringify({ who: "Ben", text: "  yes, and keep the workshop  " }));
check(m2.status === 201 && m2.json?.text === "  yes, and keep the workshop  ", "second message stored verbatim, spaces and all");
console.log(`  message 1: ${JSON.stringify(m1.json)}`);
console.log(`  message 2: ${JSON.stringify(m2.json)}`);

// 4. The polling call: summaries, residents, no building yet, no flat bodies.
const state = await call("GET", "");
const flats = Object.fromEntries((state.json?.flats ?? []).map((f) => [f.id, f]));
check(state.json?.flats?.length === 2, "session lists two flats");
check(flats["flat-2"]?.version === 2 && flats["flat-2"]?.resident === "Ana" && flats["flat-2"]?.label === "Flat 2 again", "flat-2 summary: version 2, Ana, relabelled");
check(flats["flat-3"]?.version === 1 && flats["flat-3"]?.resident === "Ben", "flat-3 summary: version 1, Ben");
check(flats["flat-2"]?.floors === 1 && flats["flat-2"]?.areaCells === 194 && String(flats["flat-2"]?.bbox) === "0,0,15,14", "flat-2 measures 1 storey, 194 cells, bbox 0,0,15,14");
check(flats["flat-3"]?.floors === 1 && flats["flat-3"]?.areaCells === 168 && String(flats["flat-3"]?.bbox) === "0,0,14,12", "flat-3 measures 1 storey, 168 cells, bbox 0,0,14,12");
check(Object.keys(flats).length === 2 && Object.values(flats).every((f) => f.changed === true), "both flats are marked changed");
check(state.json?.residents?.length === 2, "session lists two residents");
const anaPolled = (state.json?.residents ?? []).find((r) => r.name === "Ana");
check(anaPolled?.shareM2 === 7 && anaPolled?.extraM2 === 5, "Ana's square metres survive into the polled state");
check(anaPolled?.wishes?.corner === true && anaPolled?.wishes?.quiet === true, "Ana's wishes survive into the polled state");
console.log(`  Ana, inside GET /api/session/${code}: ${JSON.stringify(anaPolled)}`);
check(
  state.json?.messages?.length === 2 && state.json.messages[0].who === "Ana" && state.json.messages[1].who === "Ben",
  "both messages are in the polled state, oldest first"
);
console.log(`  messages, inside GET /api/session/${code}: ${JSON.stringify(state.json?.messages)}`);
check(state.json?.building === null, "no building run yet");
check(state.status === 200 && !state.text.includes('"storeys"'), "no flat body in the polling call");
console.log(`  polling call for two fixtures: ${state.bytes} bytes`);

// 5. Each flat back, byte for byte.
for (const f of fixtures) {
  const r = await call("GET", `/flats/${f.id}`, undefined, { quiet: true });
  const same = r.status === 200 && Buffer.compare(Buffer.from(r.text), sent[f.id]) === 0;
  check(same, `${f.id} came back byte-identical (${r.bytes} bytes)`);
}

// 6. A building run clears changed on every flat and is readable on its own.
// Run 0026: the run also carries a plot, opaque to the store, which must come
// back byte-for-byte on every one of the three calls that carry a building run.
const plot = { modulesX: 11, modulesY: 11, floors: 7 };
const run = await call("PUT", "/building", JSON.stringify({ genome: [3, 1, 4, 1, 5], summary: { flats: 2, fitness: 0.71 }, by: "Ben", plot }));
check(run.status === 200 && typeof run.json?.at === "string" && run.json?.by === "Ben", "building run stored with a timestamp");
check(JSON.stringify(run.json?.plot) === JSON.stringify(plot), "building run carries the plot back at once");
const after = await call("GET", "");
check(after.json?.flats?.length === 2 && after.json.flats.every((f) => f.changed === false), "changed cleared on both flats");
check(after.json?.building?.genome?.length === 5, "building run appears in the session state");
check(JSON.stringify(after.json?.building?.plot) === JSON.stringify(plot), "the session state's building run carries the plot too");
const building = await call("GET", "/building");
check(building.text === JSON.stringify(after.json?.building), "GET building matches the session's copy");

// 7. The whole session as one file: the state plus every body, verbatim (run 0023).
const exp = await call("GET", "/export", undefined, { quiet: true });
const expJson = exp.json ?? {};
check(exp.status === 200 && expJson.code === code, "export answers with the session");
for (const f of fixtures) {
  const body = expJson.bodies?.[f.id];
  const same = typeof body === "string" && Buffer.compare(Buffer.from(body), sent[f.id]) === 0;
  check(same, `export carries ${f.id} byte-identical (${typeof body === "string" ? Buffer.byteLength(body) : 0} bytes)`);
}
check(
  JSON.stringify(expJson.flats) === JSON.stringify(after.json?.flats) &&
    JSON.stringify(expJson.residents) === JSON.stringify(after.json?.residents) &&
    JSON.stringify(expJson.building) === JSON.stringify(after.json?.building),
  "export's flats, residents and building match the session state"
);
const anaExported = (expJson.residents ?? []).find((r) => r.name === "Ana");
check(anaExported?.shareM2 === 7 && anaExported?.extraM2 === 5, "Ana's square metres survive into the export");
check(JSON.stringify(anaExported?.wishes) === JSON.stringify(anaPolled?.wishes), "Ana's wishes survive into the export");
console.log(`  Ana, inside GET /export: ${JSON.stringify(anaExported)}`);
check(JSON.stringify(expJson.messages) === JSON.stringify(state.json?.messages), "the export carries the same two messages");
console.log(`  messages, inside GET /export: ${JSON.stringify(expJson.messages)}`);
const abbreviated = {
  ...expJson,
  bodies: Object.fromEntries(Object.entries(expJson.bodies ?? {}).map(([k, v]) => [k, `<${Buffer.byteLength(String(v))} bytes>`])),
};
console.log(`  export with bodies abbreviated: ${JSON.stringify(abbreviated)}`);

// 8. Preflight, as a browser on another origin would send it.
const opt = await fetch(`${base}/api/session/${code}/flats/flat-2`, { method: "OPTIONS" });
console.log(`\nOPTIONS ${base}/api/session/${code}/flats/flat-2\n${opt.status} ${opt.statusText}  allow-methods=${opt.headers.get("access-control-allow-methods")}  allow-headers=${opt.headers.get("access-control-allow-headers")}`);
check(opt.status === 204 && opt.headers.get("access-control-allow-origin") === "*", "preflight answers 204 with an open origin");
// Run 0035: a method missing from this line is a call a browser never sends,
// which is how the building app's run 0059 met `TypeError: Failed to fetch`.
check((opt.headers.get("access-control-allow-methods") ?? "").includes("DELETE"), "preflight offers DELETE, so a browser can send the leave call");

// 9. A whole round of the vote (run 0039), from opening to closing, with the
// group as it now stands: Ana and Ben, two people, two pairs.
const candidate = (g) => ({ genome: [g, g + 1], summary: { flats: 2, fitness: 0.5 + g / 10 }, plot });
const roundBody = (n) => ({
  n,
  weights: [1, 1, 1, 1, 1],
  pairs: [
    { id: "p1", a: candidate(1), b: candidate(2), dial: "light",
      sentence: "This one has more light and longer walks to the stair." },
    { id: "p2", a: candidate(3), b: candidate(4), dial: "cost",
      sentence: "This one has a tighter facade and is cheaper to heat." },
  ],
});

const wrongN = await call("PUT", "/round", JSON.stringify(roundBody(4)));
check(wrongN.status === 409, `opening round 4 first is refused (${wrongN.status})`);
console.log(`  the refusal: ${wrongN.status} ${JSON.stringify(wrongN.json)}`);

const opened = await call("PUT", "/round", JSON.stringify(roundBody(1)), { quiet: true });
check(opened.status === 201 && opened.json?.n === 1, "round 1 opens");
check(opened.json?.expected === 2, `it expects both people (${opened.json?.expected})`);
check(
  Array.isArray(opened.json?.pairs) && opened.json.pairs.length === 2 && opened.json.votes.length === 0,
  "with two pairs and no votes yet"
);
console.log(`  round 1 opened at ${opened.json?.openedAt}, pairs ${opened.json?.pairs.map((p) => p.id).join(", ")}`);

const openedTwice = await call("PUT", "/round", JSON.stringify(roundBody(2)));
check(openedTwice.status === 409, `a second round while one is open is refused (${openedTwice.status})`);

const stranger = await call("POST", "/rounds/1/votes", JSON.stringify({ who: "Zoe", pair: "p1", pick: "a", reasons: [] }));
check(stranger.status === 403, `somebody who is not in the group cannot vote (${stranger.status})`);

const badReason = await call("POST", "/rounds/1/votes", JSON.stringify({ who: "Ana", pair: "p1", pick: "a", reasons: ["a nice view"] }));
check(badReason.status === 400, `a reason outside the five is refused (${badReason.status})`);

// Every person in the group votes on every pair. The name is spelled in the
// wrong case on the last one, to show that the store counts one voter.
const votes = [
  { who: "Ana", pair: "p1", pick: "a", reasons: ["light"] },
  { who: "Ana", pair: "p1", pick: "b", reasons: ["light", "privacy"] }, // she changes her mind
  { who: "Ben", pair: "p1", pick: "a", reasons: ["cost"] },
  { who: "Ana", pair: "p2", pick: "b", reasons: [] },
  { who: "ben", pair: "p2", pick: "b", reasons: ["shared space", "short walks"] },
];
let closedOn = null;
for (const v of votes) {
  const r = await call("POST", "/rounds/1/votes", JSON.stringify(v));
  check(r.status === 201, `${v.who} votes ${v.pick} on ${v.pair} (${r.status})`);
  if (r.json?.closedTheRound) closedOn = v;
}
check(closedOn !== null, "the last vote closed the round");
console.log(`  the vote that closed it: ${JSON.stringify(closedOn)}`);

const afterVote = await call("GET", "", undefined, { quiet: true });
check(afterVote.json?.round === null, "no round is open any more");
check(afterVote.json?.lastRound?.n === 1, "and round 1 is the last closed one");
check(typeof afterVote.json?.lastRound?.closedAt === "string", "with the time it closed");
check(
  afterVote.json?.lastRound?.votes?.length === 4,
  `four votes, because the second one replaced the first rather than joining it (${afterVote.json?.lastRound?.votes?.length})`
);
check(
  afterVote.json?.lastRound?.pairs?.every((p) => p.voted === 2 && p.expected === 2),
  "and both pairs read two of two"
);
console.log(`  the round that closed: ${JSON.stringify(afterVote.json?.lastRound)}`);

const tooLate = await call("POST", "/rounds/1/votes", JSON.stringify({ who: "Ana", pair: "p1", pick: "a", reasons: [] }));
check(tooLate.status === 409, `a vote after the close is refused (${tooLate.status})`);

const wrongNext = await call("PUT", "/round", JSON.stringify(roundBody(4)));
check(wrongNext.status === 409, `opening round 4 after round 1 is refused (${wrongNext.status})`);
console.log(`  the refusal: ${wrongNext.status} ${JSON.stringify(wrongNext.json)}`);

const two = await call("PUT", "/round", JSON.stringify(roundBody(2)), { quiet: true });
check(two.status === 201 && two.json?.n === 2, "round 2 opens once round 1 has closed");
const byHand = await call("POST", "/rounds/2/close", undefined, { quiet: true });
check(byHand.status === 200 && typeof byHand.json?.closedAt === "string", "and can be closed by hand");

const expRounds = await call("GET", "/export", undefined, { quiet: true });
check(
  (expRounds.json?.rounds ?? []).map((r) => r.n).join(",") === "1,2",
  `the export carries both rounds (${(expRounds.json?.rounds ?? []).map((r) => r.n).join(",")})`
);
check(
  !("rounds" in (afterVote.json ?? {})),
  "and the polling call does not, because a round holds two whole buildings per pair"
);

// 10. A new name keeps the flat, and leaving takes it (run 0035). Ben's flat
// gets a picture first, so the removal has a preview to take with it.
const shot = Buffer.from("ffd8ffe000104a46494600010100000100010000ffd9", "hex");
const shotRes = await fetch(`${base}/api/session/${code}/flats/flat-3/preview`, { method: "PUT", body: shot, headers: { "content-type": "image/jpeg" } });
console.log(`\nPUT ${base}/api/session/${code}/flats/flat-3/preview\n${shotRes.status} ${shotRes.statusText}  ${await shotRes.text()}`);
check(shotRes.status === 200, "Ben's flat has a picture before he leaves");

// The name in the URL is the wrong case on purpose: ownership folds case.
const renamed = await call("POST", "/residents/ana/rename", JSON.stringify({ to: "Ana B" }));
check(renamed.status === 200 && renamed.json?.from === "Ana" && renamed.json?.to === "Ana B", "ana renames to Ana B, and the stored spelling comes back as `from`");
check(JSON.stringify(renamed.json?.flats) === JSON.stringify(["flat-2"]), "the rename reports flat-2 as hers");
const afterRename = await call("GET", "", undefined, { quiet: true });
const renamedFlat = (afterRename.json?.flats ?? []).find((f) => f.id === "flat-2");
check(renamedFlat?.resident === "Ana B", "flat-2 is now recorded against Ana B");
check((afterRename.json?.residents ?? []).some((r) => r.name === "Ana B"), "the row moved to Ana B");
check(!(afterRename.json?.residents ?? []).some((r) => r.name === "Ana"), "and nobody is called Ana any more, so she is not at the table twice");
const anaMoved = (afterRename.json?.residents ?? []).find((r) => r.name === "Ana B");
check(anaMoved?.shareM2 === 7 && anaMoved?.wishes?.corner === true, "her answers came with her");
console.log(`  Ana B, after the rename: ${JSON.stringify(anaMoved)}`);

const taken = await call("POST", "/residents/Ana B/rename", JSON.stringify({ to: "ben" }));
check(taken.status === 409, "renaming onto a name already at the table is refused with 409");
console.log(`  the refusal: ${taken.status} ${JSON.stringify(taken.json)}`);

const left = await call("DELETE", "/residents/BEN");
check(left.status === 200 && left.json?.resident === "Ben", "BEN leaves, and the stored spelling comes back");
// Run 0036: the store says so, in the group's own chat, with `who` empty so a
// reader can tell its voice from a person's.
check(JSON.stringify(left.json?.flats) === JSON.stringify(["flat-3"]), "his flat leaves with him");
const twiceGone = await call("DELETE", "/residents/BEN");
check(twiceGone.status === 404, `leaving twice is a 404, because he is not at the table any more (${twiceGone.status})`);

const afterLeave = await call("GET", "", undefined, { quiet: true });
check((afterLeave.json?.flats ?? []).length === 1 && afterLeave.json.flats[0].id === "flat-2", "one flat is left, and it is Ana B's");
check((afterLeave.json?.residents ?? []).length === 1 && afterLeave.json.residents[0].name === "Ana B", "one resident is left, and it is Ana B");
check(
  !JSON.stringify(afterLeave.json?.residents).includes("Ben") && !JSON.stringify(afterLeave.json?.flats).includes("Ben") && !JSON.stringify(afterLeave.json?.flats).includes("flat-3"),
  "no resident row and no flat summary mentions Ben or his flat"
);
// What he SAID stays. The messages are an append-only record of a
// conversation and the building run records who asked for it; neither is
// his profile or his flat, and run 0035 does not rewrite either.
check(
  (afterLeave.json?.messages ?? []).some((m) => m.who === "Ben") && afterLeave.json?.building?.by === "Ben",
  "what he said and the run he asked for are still there, because leaving takes the profile and the flat and nothing else"
);

// The store says who left (run 0036), in the group's own chat.
const said = afterLeave.json?.messages ?? [];
const line = said[said.length - 1];
console.log(`  the line the store wrote: ${JSON.stringify(line)}`);
check(line?.text === "Ben left the group.", "the store wrote one line saying he left");
check(line?.who === "", "with `who` empty, so a reader can tell the store's voice from a person's");
check(typeof line?.at === "string" && !Number.isNaN(Date.parse(line.at)), "and the store's own timestamp on it");
check(said.length === 3, `the two people said two things and the store said one, so the chat holds three (${said.length})`);
check(
  said.filter((m) => m.who === "").length === 1,
  "and it is the only message with an empty `who`, because a person's message is refused without one"
);
console.log(`  the state after he left: ${JSON.stringify(afterLeave.json)}`);

const goneFlat = await call("GET", "/flats/flat-3", undefined, { quiet: true });
// Checked as "not 200" rather than "404" on purpose. Under `netlify dev` a
// 404 from the function is not the last word: the dev server retries the
// same path with `.html` appended, and the client sees THAT response, which
// is a 400 because a dot is not allowed in a flat id. Measured in this run,
// in the dev server's own log: `GET /flats/nope` answered 404 and was
// followed at once by `GET /flats/nope.html` answering 400. What matters is
// that the body does not come back, and that is what is checked.
check(goneFlat.status !== 200 && !goneFlat.text.includes("dwelling-unit"), `his flat is gone from the store, not merely unlisted (${goneFlat.status})`);
const gonePreview = await fetch(`${base}/api/session/${code}/flats/flat-3/preview`);
console.log(`\nGET ${base}/api/session/${code}/flats/flat-3/preview\n${gonePreview.status} ${gonePreview.statusText}`);
check(gonePreview.status !== 200, `and so is its picture (${gonePreview.status})`);

const expAfter = await call("GET", "/export", undefined, { quiet: true });
check(Object.keys(expAfter.json?.bodies ?? {}).length === 1 && "flat-2" in (expAfter.json?.bodies ?? {}), "the export carries one body, Ana B's");
check(
  !JSON.stringify(expAfter.json?.residents).includes("Ben") && !JSON.stringify(expAfter.json?.flats).includes("Ben"),
  "and the export carries no resident row and no flat summary for him"
);
console.log(`  the export after he left, bodies abbreviated: ${JSON.stringify({ ...expAfter.json, bodies: Object.fromEntries(Object.entries(expAfter.json?.bodies ?? {}).map(([k, v]) => [k, `<${Buffer.byteLength(String(v))} bytes>`])) })}`);

console.log(`\n${failures === 0 ? "all checks passed" : `${failures} check(s) FAILED`} for session "${code}"`);
process.exit(failures === 0 ? 0 : 1);
