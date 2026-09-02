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

// 3. Each resident's counts, share and ballot; Ben's arrive in two partial bodies.
const ana = await call("PUT", "/residents/Ana", JSON.stringify({ counts: { "flat-2": 1 }, share: 0.3, ballot: ["laundry", "workshop", "garden"] }));
check(ana.json?.share === 0.3 && ana.json?.ballot?.length === 3, "Ana's wishes stored");
await call("PUT", "/residents/Ben", JSON.stringify({ counts: { "flat-3": 2 } }));
const ben = await call("PUT", "/residents/Ben", JSON.stringify({ share: 0.5, ballot: ["garden"] }));
check(ben.json?.counts?.["flat-3"] === 2 && ben.json?.share === 0.5, "Ben's second, partial body merged with the first");

// 4. The polling call: summaries, residents, no building yet, no flat bodies.
const state = await call("GET", "");
const flats = Object.fromEntries((state.json?.flats ?? []).map((f) => [f.id, f]));
check(state.json?.flats?.length === 2, "session lists two flats");
check(flats["flat-2"]?.version === 2 && flats["flat-2"]?.resident === "Ana" && flats["flat-2"]?.label === "Flat 2 again", "flat-2 summary: version 2, Ana, relabelled");
check(flats["flat-3"]?.version === 1 && flats["flat-3"]?.resident === "Ben", "flat-3 summary: version 1, Ben");
check(flats["flat-2"]?.floors === 1 && flats["flat-2"]?.areaCells === 194 && String(flats["flat-2"]?.bbox) === "0,0,15,14", "flat-2 measures 1 storey, 194 cells, bbox 0,0,15,14");
check(flats["flat-3"]?.floors === 1 && flats["flat-3"]?.areaCells === 168 && String(flats["flat-3"]?.bbox) === "0,0,14,12", "flat-3 measures 1 storey, 168 cells, bbox 0,0,14,12");
check(Object.values(flats).every((f) => f.changed === true), "both flats are marked changed");
check(state.json?.residents?.length === 2, "session lists two residents");
check(state.json?.building === null, "no building run yet");
check(!state.text.includes('"storeys"'), "no flat body in the polling call");
console.log(`  polling call for two fixtures: ${state.bytes} bytes`);

// 5. Each flat back, byte for byte.
for (const f of fixtures) {
  const r = await call("GET", `/flats/${f.id}`, undefined, { quiet: true });
  const same = r.status === 200 && Buffer.compare(Buffer.from(r.text), sent[f.id]) === 0;
  check(same, `${f.id} came back byte-identical (${r.bytes} bytes)`);
}

// 6. A building run clears changed on every flat and is readable on its own.
const run = await call("PUT", "/building", JSON.stringify({ genome: [3, 1, 4, 1, 5], summary: { flats: 2, fitness: 0.71 }, by: "Ben" }));
check(run.status === 200 && typeof run.json?.at === "string" && run.json?.by === "Ben", "building run stored with a timestamp");
const after = await call("GET", "");
check((after.json?.flats ?? []).every((f) => f.changed === false), "changed cleared on both flats");
check(after.json?.building?.genome?.length === 5, "building run appears in the session state");
const building = await call("GET", "/building");
check(building.text === JSON.stringify(after.json?.building), "GET building matches the session's copy");

// 7. Preflight, as a browser on another origin would send it.
const opt = await fetch(`${base}/api/session/${code}/flats/flat-2`, { method: "OPTIONS" });
console.log(`\nOPTIONS ${base}/api/session/${code}/flats/flat-2\n${opt.status} ${opt.statusText}  allow-methods=${opt.headers.get("access-control-allow-methods")}  allow-headers=${opt.headers.get("access-control-allow-headers")}`);
check(opt.status === 204 && opt.headers.get("access-control-allow-origin") === "*", "preflight answers 204 with an open origin");

console.log(`\n${failures === 0 ? "all checks passed" : `${failures} check(s) FAILED`} for session "${code}"`);
process.exit(failures === 0 ? 0 : 1);
