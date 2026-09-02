/**
 * Netlify entry for the session store. Everything is in
 * `src/session/store.ts`; this file only names the Blobs store and the URL.
 * `consistency: "strong"` so a poll issued right after a publish sees it.
 */
import { getStore } from "@netlify/blobs";
import { handleSession } from "../../src/session/store.ts";

export default (req: Request) => handleSession(req, getStore({ name: "sessions", consistency: "strong" }));

export const config = { path: "/api/session/*" };
