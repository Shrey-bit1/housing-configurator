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

export interface UnitBrowserOptions {
  /** URL of `units/index.json`. Entry `file`/`preview` names resolve against it. */
  manifestUrl: string;
  /** Called with the fetched `dwelling-unit` file (named `<id>.json`) when a
   *  card's "Open a copy" is pressed. The browser itself never parses the
   *  unit file — what to do with it is the host's business. */
  onOpen: (file: File, entry: UnitManifestEntry) => void;
  /** Where to attach the panel. Default `document.body`. The panel positions
   *  absolutely, so the mount should be a positioning context. */
  mount?: HTMLElement;
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
  background: var(--bg, #ece8e0);
  border: 2px solid var(--ink, #141317);
  color: var(--ink, #141317);
  font-family: inherit;
}
.ulb-panel.ulb-open { display: flex; }
.ulb-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 2px solid var(--ink, #141317);
}
.ulb-title {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.ulb-count { font-size: 11px; color: var(--meta, #6d6a62); }
.ulb-close {
  margin-left: auto;
  background: none;
  border: 0;
  color: var(--meta, #6d6a62);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 4px;
}
.ulb-close:hover { color: var(--ink, #141317); }
.ulb-status { padding: 24px 16px; font-size: 12px; color: var(--meta, #6d6a62); }
.ulb-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
  padding: 16px;
  align-content: start;
}
.ulb-card {
  display: flex;
  flex-direction: column;
  background: var(--plate, #d8d4cb);
  border: 1px solid var(--ink, #141317);
}
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
  border: 1px solid var(--ink, #141317);
}
.ulb-meta { padding: 0 10px 9px 28px; font-size: 10px; color: var(--meta, #6d6a62); }
.ulb-openbtn {
  margin: 0 10px 10px;
  padding: 7px 10px;
  background: transparent;
  border: 1px solid var(--ink, #141317);
  color: var(--ink, #141317);
  font-family: inherit;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
}
.ulb-openbtn:hover { background: var(--ink, #141317); color: var(--panel-ink, #edece8); }
.ulb-openbtn:disabled { opacity: 0.5; cursor: default; }
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

  const body = document.createElement("div");
  body.className = "ulb-grid";
  el.append(header, body);
  mount.appendChild(el);

  /** Entry names resolve against the manifest's own URL, so the library can
   *  live anywhere the host serves it from. */
  const fileUrl = (name: string): string =>
    new URL(name, new URL(opts.manifestUrl, location.href)).toString();

  function status(msg: string): void {
    body.replaceChildren();
    const p = document.createElement("p");
    p.className = "ulb-status";
    p.textContent = msg;
    body.appendChild(p);
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
        .catch((err: Error) => status(`Could not fetch ${entry.file}: ${err.message}`))
        .finally(() => (openBtn.disabled = false));
    });

    c.append(img, nameRow, meta, openBtn);
    return c;
  }

  async function refresh(): Promise<void> {
    if (!api.isOpen) return;
    count.textContent = "";
    status("Loading…");
    try {
      const res = await fetch(opts.manifestUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const index = parseUnitLibraryIndex(await res.text());
      count.textContent = `${index.units.length}`;
      if (index.units.length === 0) {
        status("No units yet. Save one from Save / Open → Export unit → Save to library.");
        return;
      }
      body.replaceChildren(...index.units.map(card));
    } catch (err) {
      status(
        err instanceof ManifestParseError
          ? `Manifest invalid: ${err.message}`
          : `Could not load ${opts.manifestUrl}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
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
