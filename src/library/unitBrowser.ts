import {
  parseUnitLibraryIndex,
  ManifestParseError,
  type UnitManifestEntry,
} from "./manifest";

/**
 * The unit browser — a panel of cards over the saved-unit library
 * (docs/library-format.md).
 *
 * SELF-CONTAINED ON PURPOSE: plain TS and DOM, no imports from the app
 * outside `src/library/`, styles injected once under a `ulb-` prefix. The
 * bottom-up building repo is expected to lift this module (or build against
 * the same manifest) for its own unit list, so it takes a manifest URL and an
 * `onOpen(file, entry)` callback and knows nothing about what the host does
 * with an opened unit. This app wires `onOpen` to the project-import path in
 * main.ts; the building app would hand the file to its packer.
 *
 * The look leans on the host's design tokens (`--bg`, `--ink`, …) with
 * hardcoded fallbacks matching this app's Paper studio values, so the panel
 * follows a host theme without requiring one.
 */

/** One flat as the session store summarises it: the `flats[]` entry of
 *  `GET /api/session/{code}` (docs/store.md). Declared here rather than
 *  imported so the module stays liftable on its own. */
export interface SessionFlat {
  id: string;
  resident: string;
  label: string;
  version: number;
  /** True since the last publish, false once a building run has read it. */
  changed: boolean;
  bbox: [number, number, number, number];
  floors: number;
  areaCells: number;
  publishedAt: string;
  /** True once a preview has been published for this flat (run 0024). */
  preview: boolean;
}

/** Where the "Your group" group reads from (run 0023, `previewUrl` run
 *  0024, `residentName` run 0025). The host owns the session code and the
 *  resident's own name, so both are asked for fresh on each refresh. */
export interface SessionSource {
  /** `GET /api/session/{code}` for the current session, or null when none is set. */
  stateUrl(): string | null;
  /** `GET /api/session/{code}/flats/{id}`: one flat's file, byte for byte. */
  flatUrl(id: string): string;
  /** `GET /api/session/{code}/flats/{id}/preview`: the flat's JPEG. Only
   *  fetched when the flat's summary says `preview: true`. */
  previewUrl(id: string): string;
  /** The name typed into the save dialog, trimmed, or "" if none is set.
   *  A card whose `resident` matches this is "mine" and sorts first. */
  residentName(): string;
}

export interface UnitBrowserOptions {
  /** URL of `units/index.json`. Entry `file`/`preview` names resolve against it. */
  manifestUrl: string;
  /** Called with the fetched `dwelling-unit` file (named `<id>.json`) when a
   *  card's "Open a copy" is pressed, from the library or from the session.
   *  The browser itself never parses the unit file — what to do with it is
   *  the host's business. */
  onOpen: (file: File, source: UnitManifestEntry | SessionFlat) => void;
  /** OPTIONAL. When given, the panel grows a second group, "Your group"
   *  (run 0026; "In this session" before it — the word a resident reads is
   *  group, never session, per `_cowork/design/DESIGN-BRIEF-3sep.md`),
   *  listing the flats the store's poll returns, each openable as a copy the
   *  same way. Refreshed when the panel opens and on its own Refresh control;
   *  the browser never polls in the background. */
  session?: SessionSource;
  /** OPTIONAL. When given, each card grows a Rename control that collects a
   *  new display name and hands it over. The module knows nothing about how a
   *  rename is persisted — the host owns that endpoint — so this stays as
   *  portable as `onOpen`. Resolve to apply, reject to leave the card alone;
   *  the browser refreshes itself either way. Cards are read-only without it. */
  onRename?: (entry: UnitManifestEntry, newName: string) => Promise<void>;
  /** Where to attach the panel. Default `document.body`. The panel positions
   *  absolutely, so the mount should be a positioning context. */
  mount?: HTMLElement;
}

/** Whether `resident` is the current save dialog's own name (run 0025). Pure,
 *  no DOM, so it is what `sessionCard`'s "Yours" mark and `refreshSession`'s
 *  ordering both test against, and what a plain vitest case pins directly —
 *  the module otherwise needs a live DOM to exercise at all. An empty `me`
 *  (no resident name typed yet) never matches anything.
 *
 *  The comparison is trimmed and case-insensitive (run 0026: "ana" is Ana),
 *  matching `sameResident` in `src/session/store.ts` — restated here rather
 *  than imported, since this module stays self-contained on purpose (see the
 *  file header above); the two must be kept in step by hand. */
export function isMine(resident: string, me: string): boolean {
  return me.length > 0 && resident.trim().toLowerCase() === me.trim().toLowerCase();
}

/** Stable "mine first" ordering over any list carrying a `resident` field —
 *  everything else keeps the order it arrived in, since `Array.prototype.sort`
 *  is spec-stable. Pure, no DOM. */
export function sortMineFirst<T extends { resident: string }>(items: readonly T[], me: string): T[] {
  return [...items].sort((a, b) => Number(isMine(b.resident, me)) - Number(isMine(a.resident, me)));
}

export interface UnitBrowser {
  /** The panel root, attached to the mount and hidden until `open()`. */
  el: HTMLElement;
  open(): void;
  close(): void;
  toggle(): void;
  /** Re-fetch the manifest and re-render the cards (no-op when closed —
   *  `open()` always refreshes). */
  refresh(): Promise<void>;
  readonly isOpen: boolean;
}

/** Injected once per document, keyed by id, so two browsers share one sheet. */
const STYLE_ID = "ulb-style";
const CSS = `
.ulb-panel {
  position: absolute;
  inset: 18px;
  z-index: 45;
  display: none;
  flex-direction: column;
  background: var(--bg, #ece6d8);
  border: 2px solid var(--ink, #161616);
  color: var(--ink, #161616);
  font-family: inherit;
}
.ulb-panel.ulb-open { display: flex; }
.ulb-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 2px solid var(--ink, #161616);
}
.ulb-title {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.ulb-count { font-size: 11px; color: var(--meta, #6b665c); }
.ulb-close {
  margin-left: auto;
  background: none;
  border: 0;
  color: var(--meta, #6b665c);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 4px;
}
.ulb-close:hover { color: var(--ink, #161616); }
.ulb-status { padding: 24px 16px; font-size: 12px; color: var(--meta, #6b665c); }
.ulb-body { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
.ulb-group + .ulb-group { border-top: 2px solid var(--ink, #161616); }
.ulb-group-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 12px 16px 0;
}
.ulb-group-title {
  margin: 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--meta, #6b665c);
}
.ulb-refresh {
  margin-left: auto;
  background: none;
  border: 1px solid var(--line-paper, #c9c5bb);
  color: var(--meta, #6b665c);
  font-family: inherit;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 4px 8px;
  cursor: pointer;
}
.ulb-refresh:hover { color: var(--ink, #161616); border-color: var(--ink, #161616); }
.ulb-refresh:disabled { opacity: 0.5; cursor: default; }
.ulb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
  padding: 16px;
  align-content: start;
}
/* No preview image (run 0024): the name row takes the padding an image's
   border would otherwise give it. A card WITH a preview needs none of this —
   it already looks exactly like a library card. */
.ulb-session-card.ulb-no-preview .ulb-name { padding-top: 11px; }
.ulb-session-card .ulb-name { flex-wrap: wrap; }
.ulb-session-card .ulb-meta { padding-left: 10px; }
.ulb-tag {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--meta, #6b665c);
  border: 1px solid var(--line-paper, #c9c5bb);
  border-radius: 999px;
  padding: 1px 6px;
}
.ulb-tag.ulb-changed { color: var(--accent, #d6341c); border-color: var(--accent, #d6341c); }
/* The owner, one line under the label, at the card's normal (not meta) size —
   "put essentials first": whose flat this is matters as much as what it is
   named. ".ulb-yours" is a filled badge (Von Restorff) rather than another
   outline tag, and the card itself gets a heavier border so a resident's own
   flats are findable at a glance in a crowded room (run 0025). */
.ulb-owner {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px 4px;
  font-size: 12px;
  font-weight: 600;
}
/* Red, not ink: the brief's colour for "the resident's own" (their flat in
   the building, their shape in the radar) — the same rule applied to the
   card's own border below. */
.ulb-tag.ulb-yours {
  background: var(--accent, #d6341c);
  color: var(--panel-ink, #edece8);
  border-color: var(--accent, #d6341c);
}
.ulb-session-card.ulb-mine { border-width: 2px; border-color: var(--accent, #d6341c); }
.ulb-card {
  display: flex;
  flex-direction: column;
  background: var(--card, #f4f0e6);
  border: 0;
  border-top: 3px solid var(--ink, #161616);
  box-shadow: 0 1px 0 var(--line-paper, #c9c5bb);
  /* Rise in, one after another (the brief's motion language): a plain CSS
     stagger over the first few cards, then a flat cap — a grid can hold
     far more than the wireframe's short lists ever did. */
  animation: ulb-rise 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
@keyframes ulb-rise {
  from { opacity: 0; transform: translateY(14px); }
}
.ulb-grid > *:nth-child(1) { animation-delay: 0ms; }
.ulb-grid > *:nth-child(2) { animation-delay: 60ms; }
.ulb-grid > *:nth-child(3) { animation-delay: 120ms; }
.ulb-grid > *:nth-child(4) { animation-delay: 180ms; }
.ulb-grid > *:nth-child(5) { animation-delay: 240ms; }
.ulb-grid > *:nth-child(6) { animation-delay: 300ms; }
.ulb-grid > *:nth-child(7) { animation-delay: 360ms; }
.ulb-grid > *:nth-child(8) { animation-delay: 420ms; }
.ulb-grid > *:nth-child(n + 9) { animation-delay: 480ms; }
.ulb-preview {
  width: 100%;
  aspect-ratio: 3 / 2;
  object-fit: cover;
  display: block;
  background: var(--plate2, #c9c5bb);
  border-bottom: 1px solid var(--line-paper, #c9c5bb);
}
.ulb-name {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 10px 2px;
  font-size: 12px;
  font-weight: 600;
}
.ulb-chip {
  width: 11px;
  height: 11px;
  flex: 0 0 11px;
  border: 1px solid var(--ink, #161616);
}
.ulb-meta { padding: 0 10px 9px 28px; font-size: 10px; color: var(--meta, #6b665c); }
.ulb-actions { display: flex; gap: 6px; margin: 0 10px 10px; }
.ulb-openbtn, .ulb-renamebtn {
  padding: 7px 10px;
  background: transparent;
  border: 1px solid var(--ink, #161616);
  color: var(--ink, #161616);
  font-family: inherit;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
}
.ulb-openbtn { flex: 1; }
.ulb-renamebtn { color: var(--meta, #6b665c); border-color: var(--line-paper, #c9c5bb); }
.ulb-openbtn:hover, .ulb-renamebtn:hover { background: var(--ink, #161616); color: var(--panel-ink, #edece8); }
.ulb-openbtn:disabled, .ulb-renamebtn:disabled { opacity: 0.5; cursor: default; }
`;

function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}

export function createUnitBrowser(opts: UnitBrowserOptions): UnitBrowser {
  const mount = opts.mount ?? document.body;
  ensureStyles(mount.ownerDocument);

  const el = document.createElement("section");
  el.className = "ulb-panel";
  el.setAttribute("aria-label", "Unit library");

  const header = document.createElement("div");
  header.className = "ulb-header";
  const title = document.createElement("p");
  title.className = "ulb-title";
  title.textContent = "Units";
  const count = document.createElement("span");
  count.className = "ulb-count";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "ulb-close";
  close.textContent = "✕";
  close.setAttribute("aria-label", "Close");
  close.addEventListener("click", () => api.close());
  header.append(title, count, close);

  // Two groups in one scrolling column: (when the host gives a session source)
  // the flats published in this session, then the library. The session comes
  // first because the library already holds eight cards, which would push the
  // neighbours' flats below the fold every time. Each group has its own grid
  // so one failing to load leaves the other readable.
  const body = document.createElement("div");
  body.className = "ulb-body";
  let sessionGrid: HTMLElement | null = null;
  let sessionCode: HTMLElement | null = null;
  let refreshBtn: HTMLButtonElement | null = null;
  if (opts.session) {
    sessionCode = document.createElement("span");
    sessionCode.className = "ulb-count";
    refreshBtn = document.createElement("button");
    refreshBtn.type = "button";
    refreshBtn.className = "ulb-refresh";
    refreshBtn.textContent = "Refresh";
    refreshBtn.addEventListener("click", () => void refreshSession());
    sessionGrid = group(body, "Your group", sessionCode, refreshBtn);
  }
  const libGrid = group(body, "Library");
  el.append(header, body);
  mount.appendChild(el);

  function group(parent: HTMLElement, name: string, ...extra: HTMLElement[]): HTMLElement {
    const section = document.createElement("section");
    section.className = "ulb-group";
    const head = document.createElement("div");
    head.className = "ulb-group-head";
    const h = document.createElement("h3");
    h.className = "ulb-group-title";
    h.textContent = name;
    head.append(h, ...extra);
    const grid = document.createElement("div");
    grid.className = "ulb-grid";
    section.append(head, grid);
    parent.appendChild(section);
    return grid;
  }

  /** Entry names resolve against the manifest's own URL, so the library can
   *  live anywhere the host serves it from. */
  const fileUrl = (name: string): string =>
    new URL(name, new URL(opts.manifestUrl, location.href)).toString();

  function status(grid: HTMLElement, msg: string): void {
    grid.replaceChildren();
    const p = document.createElement("p");
    p.className = "ulb-status";
    p.textContent = msg;
    grid.appendChild(p);
  }

  function card(entry: UnitManifestEntry): HTMLElement {
    const c = document.createElement("article");
    c.className = "ulb-card";

    const img = document.createElement("img");
    img.className = "ulb-preview";
    img.src = fileUrl(entry.preview);
    img.alt = entry.name;
    img.loading = "lazy";

    const nameRow = document.createElement("div");
    nameRow.className = "ulb-name";
    const chip = document.createElement("span");
    chip.className = "ulb-chip";
    chip.style.background = entry.color;
    const name = document.createElement("span");
    name.textContent = entry.name;
    nameRow.append(chip, name);

    const meta = document.createElement("div");
    meta.className = "ulb-meta";
    meta.textContent = `${entry.storeys} ${entry.storeys === 1 ? "storey" : "storeys"} · ${entry.areaM2} m²`;

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "ulb-openbtn";
    openBtn.textContent = "Open a copy";
    openBtn.addEventListener("click", () => {
      openBtn.disabled = true;
      fetch(fileUrl(entry.file), { cache: "no-store" })
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
          return r.text();
        })
        .then((text) => {
          opts.onOpen(new File([text], entry.file, { type: "application/json" }), entry);
        })
        .catch((err: Error) => status(libGrid, `Could not fetch ${entry.file}: ${err.message}`))
        .finally(() => (openBtn.disabled = false));
    });

    c.append(img, nameRow, meta);

    // Two actions at most, so the card stays one obvious thing to press.
    const actions = document.createElement("div");
    actions.className = "ulb-actions";
    actions.appendChild(openBtn);
    if (opts.onRename) {
      const renameBtn = document.createElement("button");
      renameBtn.type = "button";
      renameBtn.className = "ulb-renamebtn";
      renameBtn.textContent = "Rename";
      renameBtn.addEventListener("click", () => {
        const next = window.prompt(`Rename "${entry.name}" to:`, entry.name);
        if (next === null) return; // cancelled
        const trimmed = next.trim();
        if (!trimmed || trimmed === entry.name) return;
        renameBtn.disabled = true;
        opts
          .onRename!(entry, trimmed)
          .then(() => refreshLibrary())
          .catch((err: Error) => status(libGrid, `Could not rename ${entry.id}: ${err.message}`))
          .finally(() => (renameBtn.disabled = false));
      });
      actions.appendChild(renameBtn);
    }
    c.appendChild(actions);
    return c;
  }

  /** A neighbour's flat: no preview (the store keeps none), the summary's
   *  numbers instead, and the same "Open a copy" through the full-flat call.
   *  The owner is its own line, and "mine" — the resident name typed into
   *  the save dialog, if any, matches this flat's — gets a "Yours" badge and
   *  a heavier border (run 0025; sorting itself happens in `refreshSession`,
   *  over the same `isMine` test, so the mark and the order never disagree). */
  function sessionCard(flat: SessionFlat): HTMLElement {
    const mine = isMine(flat.resident, opts.session!.residentName());
    const c = document.createElement("article");
    c.className = "ulb-card ulb-session-card" + (mine ? " ulb-mine" : "");

    // The flat's own axonometric (run 0024), sized like a library card's —
    // same `.ulb-preview` class — only when the summary says one exists;
    // no picture at all for an older flat that predates the preview call.
    if (flat.preview) {
      const img = document.createElement("img");
      img.className = "ulb-preview";
      img.src = opts.session!.previewUrl(flat.id);
      img.alt = flat.label;
      img.loading = "lazy";
      c.appendChild(img);
    } else {
      c.classList.add("ulb-no-preview");
    }

    const nameRow = document.createElement("div");
    nameRow.className = "ulb-name";
    const name = document.createElement("span");
    name.textContent = flat.label;
    const version = document.createElement("span");
    version.className = "ulb-tag";
    version.textContent = `v${flat.version}`;
    nameRow.append(name, version);
    if (flat.changed) {
      const changed = document.createElement("span");
      changed.className = "ulb-tag ulb-changed";
      changed.textContent = "changed since last building";
      nameRow.appendChild(changed);
    }

    // The owner: the first line after the label, at the card's normal size
    // (run 0025) — not folded into the smaller meta line, since whose flat
    // this is matters as much as what it is called.
    const ownerRow = document.createElement("div");
    ownerRow.className = "ulb-owner";
    const ownerName = document.createElement("span");
    ownerName.textContent = flat.resident;
    ownerRow.appendChild(ownerName);
    if (mine) {
      const yours = document.createElement("span");
      yours.className = "ulb-tag ulb-yours";
      yours.textContent = "Yours";
      ownerRow.appendChild(yours);
    }

    const meta = document.createElement("div");
    meta.className = "ulb-meta";
    const areaM2 = Math.round(flat.areaCells * 36) / 100; // 0.6 m cells
    meta.textContent = `${flat.floors} ${flat.floors === 1 ? "storey" : "storeys"} · ${areaM2} m²`;

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "ulb-openbtn";
    openBtn.textContent = "Open a copy";
    openBtn.addEventListener("click", () => {
      openBtn.disabled = true;
      fetch(opts.session!.flatUrl(flat.id), { cache: "no-store" })
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
          return r.text();
        })
        .then((text) => {
          opts.onOpen(new File([text], `${flat.id}.json`, { type: "application/json" }), flat);
        })
        .catch((err: Error) => status(sessionGrid!, `Could not fetch ${flat.id}: ${err.message}`))
        .finally(() => (openBtn.disabled = false));
    });

    const actions = document.createElement("div");
    actions.className = "ulb-actions";
    actions.appendChild(openBtn);
    c.append(nameRow, ownerRow, meta, actions);
    return c;
  }

  async function refreshLibrary(): Promise<void> {
    count.textContent = "";
    status(libGrid, "Loading…");
    try {
      const res = await fetch(opts.manifestUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const index = parseUnitLibraryIndex(await res.text());
      count.textContent = `${index.units.length}`;
      if (index.units.length === 0) {
        status(libGrid, "No units yet. Save one from Save / Open → Export unit → Save to library.");
        return;
      }
      libGrid.replaceChildren(...index.units.map(card));
    } catch (err) {
      status(
        libGrid,
        err instanceof ManifestParseError
          ? `Manifest invalid: ${err.message}`
          : `Could not load ${opts.manifestUrl}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /** The session group: one line when no session is set, the poll's flats
   *  otherwise. The poll is the same small call the building configurator
   *  makes (docs/store.md), so this never fetches a flat body until asked. */
  async function refreshSession(): Promise<void> {
    if (!opts.session || !sessionGrid) return;
    const url = opts.session.stateUrl();
    sessionCode!.textContent = "";
    if (url === null) {
      status(sessionGrid, "No group set. Enter a group code under Save… to see the flats published in your group.");
      return;
    }
    refreshBtn!.disabled = true;
    status(sessionGrid, "Loading…");
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const state = (await res.json()) as { code?: string; flats?: SessionFlat[] };
      const flats = Array.isArray(state.flats) ? state.flats : [];
      sessionCode!.textContent = `${state.code ?? ""} · ${flats.length}`;
      if (flats.length === 0) {
        status(sessionGrid, `Nobody has published to ${state.code ?? "this group"} yet.`);
        return;
      }
      // Mine first — a stable sort, so flats that are neither the resident's
      // own keep the order the poll gave them (run 0025).
      const ordered = sortMineFirst(flats, opts.session!.residentName());
      sessionGrid.replaceChildren(...ordered.map(sessionCard));
    } catch (err) {
      status(sessionGrid, `Could not load ${url}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      refreshBtn!.disabled = false;
    }
  }

  async function refresh(): Promise<void> {
    if (!api.isOpen) return;
    await Promise.all([refreshLibrary(), refreshSession()]);
  }

  const api: UnitBrowser = {
    el,
    get isOpen() {
      return el.classList.contains("ulb-open");
    },
    open() {
      el.classList.add("ulb-open");
      void refresh();
    },
    close() {
      el.classList.remove("ulb-open");
    },
    toggle() {
      if (api.isOpen) api.close();
      else api.open();
    },
    refresh,
  };
  return api;
}
