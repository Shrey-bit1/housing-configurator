#!/usr/bin/env node
/**
 * Fill a group with twenty residents, so the whole journey can be walked.
 *
 *   node scripts/fill-group.mjs http://localhost:8888 hall-14
 *   node scripts/fill-group.mjs http://localhost:8888 hall-14 --replace
 *
 * Twenty people, twenty flats, twenty sets of answers and three messages, so
 * that Shrey can join the same code from the landing as the twenty-first, send
 * his own flat, and go through every step to the vote against a room that
 * looks like a room. Sending twenty flats by hand is not that.
 *
 * It writes ONLY through the store's public calls, the ones in docs/store.md
 * that `scripts/store-roundtrip.mjs` already drives: `POST` to start a group,
 * `PUT` a flat with `?resident=`, `PUT` its preview, `PUT` a resident's
 * answers, `POST` a message. It never touches the store's files or its index.
 * So what it writes is what twenty real residents would have written, and a
 * group it filled cannot be told from one twenty people filled.
 *
 * The twenty are a fixed table in `scripts/fillGroupTable.mjs`, checked by
 * `scripts/fillGroupTable.test.ts`.
 *
 * It refuses a group that already holds flats unless `--replace` is given, so
 * it cannot trample a live room by accident.
 *
 * Plain Node 18+, no dependencies: `fetch`, `fs` and `path` only.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RESIDENTS, MESSAGES, FILLED_BY, FILLED_FOR_A_TEST, flatIdFor } from "./fillGroupTable.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const unitsDir = resolve(here, "..", "public", "units");

const args = process.argv.slice(2);
const replace = args.includes("--replace");
const [base0, code] = args.filter((a) => !a.startsWith("--"));
const base = (base0 ?? "").replace(/\/$/, "");
if (!base || !code) {
  console.error("usage: node scripts/fill-group.mjs <store-url> <group-code> [--replace]");
  process.exitCode = 2;
}

/** The flat's own name and bytes, read from the library rather than assumed,
 *  so a rename in the library moves this script with it. */
function flatOf(entry) {
  const text = readFileSync(join(unitsDir, `${entry.file}.json`), "utf8");
  const name = JSON.parse(text).name;
  return { text, name, id: flatIdFor(name), preview: readFileSync(join(unitsDir, `${entry.file}.jpg`)) };
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
const wishesOf = (w) =>
  Object.entries(w)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join("+") || "none";

/**
 * `process.exitCode` rather than `process.exit`, and one function so the
 * refusal can return out of it. Exiting hard while `fetch` still has a
 * keep-alive socket closing aborts Node on Windows with
 * `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`, which is what the
 * refusal did on its first run: it printed the right words and then crashed
 * over the top of them.
 */
async function main() {
console.log(`filling "${code}" at ${base} with ${RESIDENTS.length} residents`);

// 1. Is there anything here already? A group with flats in it is a live room,
//    and twenty publishes would trample it.
const before = await call("GET", "");
const held = before.json?.flats?.length ?? 0;
console.log(`  before: ${held} flat(s), ${before.json?.residents?.length ?? 0} resident(s), exists ${before.json?.exists}`);
if (held > 0 && !replace) {
  console.error(
    `\nrefusing: "${code}" already holds ${held} flat(s) and ` +
      `${before.json?.residents?.length ?? 0} resident(s).\n` +
      `Pass --replace to fill it anyway, or choose a code nobody is using.`
  );
  process.exitCode = 1;
  return;
}

// 2. Start it, unless somebody already did. A 409 here is not a failure: it
//    means the group exists, which is what we wanted.
const started = await call("POST", "");
console.log(
  `  ${started.status === 201 ? "started" : started.status === 409 ? "already started" : "start FAILED"}` +
    `  ${started.status}  ${started.text.slice(0, 90)}`
);
if (started.status !== 201 && started.status !== 409) failures++;

// 3. Twenty flats, twenty pictures, twenty sets of answers.
for (const r of RESIDENTS) {
  const flat = flatOf(r);
  const q = `?resident=${encodeURIComponent(r.name)}&label=${encodeURIComponent(flat.name)}`;
  const put = await call("PUT", `/flats/${flat.id}${q}`, flat.text, JSON_H);
  line(`${r.name.padEnd(7)} sent ${flat.name.padEnd(8)} as ${flat.id.padEnd(8)}`, put.status, `v${put.json?.version ?? "?"}  ${flat.text.length} B`);

  const pic = await fetch(`${base}/api/session/${code}/flats/${flat.id}/preview`, {
    method: "PUT",
    body: flat.preview,
    headers: { "content-type": "image/jpeg" },
  });
  line(`${" ".repeat(7)} its picture${" ".repeat(21)}`, pic.status, `${flat.preview.length} B`);

  const answers = await call(
    "PUT",
    `/residents/${encodeURIComponent(r.name)}`,
    JSON.stringify({ shareM2: r.shareM2, extraM2: r.extraM2, ballot: r.ballot, wishes: r.wishes }),
    JSON_H
  );
  line(
    `${" ".repeat(7)} its answers${" ".repeat(21)}`,
    answers.status,
    `${r.shareM2}+${r.extraM2} m², ${r.ballot[0]} first, wishes ${wishesOf(r.wishes)}`
  );
}

// 4. A few things said, so the room is not silent.
for (const m of MESSAGES) {
  const res = await call("POST", "/messages", JSON.stringify(m), JSON_H);
  line(`${m.who.padEnd(7)} said`, res.status, JSON.stringify(m.text));
}

// 5. The group says what it is, as the last write, so a recording cannot be
//    mistaken for twenty real people. Said by a name, because the store
//    refuses an empty `who` on this call.
const saidSo = await call("POST", "/messages", JSON.stringify({ who: FILLED_BY, text: FILLED_FOR_A_TEST }), JSON_H);
line(`${FILLED_BY.padEnd(7)} said what this group is`, saidSo.status, JSON.stringify(FILLED_FOR_A_TEST));

// 6. What the room looks like now, from the call the building app polls.
const after = await call("GET", "");
const flats = after.json?.flats ?? [];
const residents = after.json?.residents ?? [];
console.log(
  `\n${code}: ${residents.length} residents, ${flats.length} flats, ` +
    `${(after.json?.messages ?? []).length} messages, exists ${after.json?.exists}`
);
console.log(`  every flat has a picture: ${flats.every((f) => f.preview)}`);
console.log(`  square metres asked for: ${residents.map((r) => r.shareM2).join(", ")}`);
console.log(
  failures === 0
    ? `\nfilled. Join "${code}" from the landing as the twenty-first.`
    : `\n${failures} call(s) FAILED`
);
if (failures > 0) process.exitCode = 1;
}

if (process.exitCode !== 2) await main();
