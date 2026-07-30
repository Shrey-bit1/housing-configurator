import { defineConfig, type Plugin } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";

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

// Honour a PORT env var when present (e.g. preview tooling assigns one),
// otherwise use Vite's default 5173.
export default defineConfig(({ command }) => ({
  plugins: command === "serve" ? [captureSink(process.cwd())] : [],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    strictPort: false,
  },
}));
