import { defineConfig } from "vitest/config";

/**
 * The SLOW suite, run by `npm run test:slow`.
 *
 * It exists because `*.slow.test.ts` files import the three.js render layer, and
 * measuring that in run 0013 put the whole suite from 1.6 s to 11.94 s. The fast
 * suite is the one people run on every change, so it must stay under two
 * seconds; the slow one runs before a commit that touches the export.
 *
 * A second config file rather than an env var, because npm scripts cannot set
 * one portably on Windows without adding a dependency, and rather than a CLI
 * `--include`, because the fast config's `exclude` would still hide these files
 * from it. The split lives in exactly two places: the `exclude` line in
 * `vite.config.ts` and the `include` line here.
 */
export default defineConfig({
  test: {
    include: ["**/*.slow.test.ts"],
  },
});
