import { defineConfig } from "vite";

// Honour a PORT env var when present (e.g. preview tooling assigns one),
// otherwise use Vite's default 5173.
export default defineConfig({
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    strictPort: false,
  },
});
