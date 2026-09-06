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
 * checks that `changed` cleared. Every response is printed; the two flat bodies
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

// 1. The session exists the moment someone asks for it.
const empty = await call("GET", "");
check(empty.status === 200 && empty.json?.flats?.length === 0, "unknown session reads as empty");

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

console.log(`\n${failures === 0 ? "all checks passed" : `${failures} check(s) FAILED`} for session "${code}"`);
process.exit(failures === 0 ? 0 : 1);
