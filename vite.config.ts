import { defineConfig, type Plugin } from "vite";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { assignUnitId } from "./src/library/ids.ts";

/**
 * DEV-ONLY capture sink. The app renders to a WebGL canvas, so the only way to
 * get a picture of a view out of the browser and into the repo is to read the
 * canvas back and hand the bytes to something that can write a file. This adds
 * the one endpoint that does that: POST a data URL to `/__capture?name=...` and
 * it lands under `captures/`.
 *
 * It exists because the review material is a set of rendered plans, and a check
 * that can only look at a view cannot leave it behind. `apply: "serve"` keeps it
 * out of every production build, and the target path is resolved and then tested
 * against the capture directory, so a name cannot escape it.
 */
function captureSink(root: string): Plugin {
  const outDir = resolve(root, "captures");
  return {
    name: "capture-sink",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__capture", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          return res.end("POST only");
        }
        const url = new URL(req.url ?? "", "http://localhost");
        const raw = url.searchParams.get("name") ?? "capture.png";
        const target = resolve(outDir, normalize(raw));
        if (!target.startsWith(outDir)) {
          res.statusCode = 400;
          return res.end("name escapes the capture directory");
        }
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          const comma = body.indexOf(",");
          if (!body.startsWith("data:") || comma < 0) {
            res.statusCode = 400;
            return res.end("expected a data URL body");
          }
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, Buffer.from(body.slice(comma + 1), "base64"));
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ ok: true, path: join("captures", raw) }));
        });
      });
    },
  };
}

/**
 * DEV-ONLY library sink (docs/library-format.md). "Save to library" in the
 * unit-export dialog POSTs the unit JSON plus a JPEG preview here; the sink
 * assigns an id (name slug, numeric suffix on collision — src/library/ids.ts),
 * writes `<id>.json` + `<id>.jpg` into `public/units/`, and appends a manifest
 * entry to `public/units/index.json`. Storeys and area are derived from the
 * posted unit file itself, so the manifest cannot drift from the file it
 * points at. `apply: "serve"` keeps it out of every production build; a
 * production save falls back to downloading the same pair (main.ts).
 */
function librarySink(root: string): Plugin {
  const unitsDir = resolve(root, "public", "units");
  const manifestPath = join(unitsDir, "index.json");
  return {
    name: "library-sink",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__library/save", (req, res) => {
        const reply = (status: number, payload: unknown) => {
          res.statusCode = status;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(payload));
        };
        if (req.method !== "POST") return reply(405, { ok: false, error: "POST only" });
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          try {
            const { name, color, unit, preview } = JSON.parse(body) as {
              name?: string;
              color?: string;
              unit?: { format?: string; cellSize?: number; storeys?: { cells: unknown[] }[] };
              preview?: string;
            };
            if (!name || typeof name !== "string")
              return reply(400, { ok: false, error: "missing name" });
            if (!unit || unit.format !== "dwelling-unit" || !Array.isArray(unit.storeys))
              return reply(400, { ok: false, error: "body.unit is not a dwelling-unit file" });
            // The preview rides in as a data URL. Byte-check it here as well as
            // client-side: a hidden canvas reads back empty, and an empty JPEG
            // in the library is worse than a refused save.
            const comma = preview?.indexOf(",") ?? -1;
            if (!preview?.startsWith("data:image/jpeg") || comma < 0)
              return reply(400, { ok: false, error: "body.preview is not a JPEG data URL" });
            const jpeg = Buffer.from(preview.slice(comma + 1), "base64");
            if (jpeg.length < 1000)
              return reply(400, {
                ok: false,
                error: `preview is ${jpeg.length} bytes — the canvas read back empty (is the view visible?)`,
              });

            // Taken ids: the manifest's, plus any stray file already named that
            // way, so a save never overwrites a pair the manifest forgot.
            const manifest = existsSync(manifestPath)
              ? (JSON.parse(readFileSync(manifestPath, "utf8")) as {
                  format: string;
                  version: number;
                  units: { id: string }[];
                })
              : { format: "unit-library" as const, version: 1, units: [] };
            const taken = new Set(manifest.units.map((u) => u.id));
            for (const f of existsSync(unitsDir) ? readdirSync(unitsDir) : [])
              taken.add(f.replace(/\.(json|jpg)$/, ""));
            taken.delete("index");
            const id = assignUnitId(name, taken);

            const cellSize = typeof unit.cellSize === "number" ? unit.cellSize : 0.6;
            const cellCount = unit.storeys.reduce((n, s) => n + s.cells.length, 0);
            const entry = {
              id,
              name,
              color: typeof color === "string" ? color : "#4dabf7",
              file: `${id}.json`,
              preview: `${id}.jpg`,
              storeys: unit.storeys.length,
              areaM2: Math.round(cellCount * cellSize * cellSize * 100) / 100,
              savedAt: new Date().toISOString(),
            };
            mkdirSync(unitsDir, { recursive: true });
            writeFileSync(join(unitsDir, entry.file), JSON.stringify(unit, null, 2) + "\n");
            writeFileSync(join(unitsDir, entry.preview), jpeg);
            manifest.units.push(entry);
            writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
            reply(200, { ok: true, entry });
          } catch (err) {
            reply(500, { ok: false, error: err instanceof Error ? err.message : String(err) });
          }
        });
      });
    },
  };
}

// Honour a PORT env var when present (e.g. preview tooling assigns one),
// otherwise use Vite's default 5173.
export default defineConfig(({ command }) => ({
  plugins: command === "serve" ? [captureSink(process.cwd()), librarySink(process.cwd())] : [],
  // `npm test` is the suite people run on every change, so it stays under two
  // seconds. Anything named `*.slow.test.ts` imports the three.js render layer
  // and belongs to `npm run test:slow` (vitest.slow.config.ts), which is the
  // only other place this split is written down.
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.slow.test.ts"],
  },
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    strictPort: false,
  },
}));
