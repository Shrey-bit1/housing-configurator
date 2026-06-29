/**
 * Minimal non-blocking message surface. Used to announce version events and
 * import errors. `info` auto-dismisses; `warn`/`error` stay until dismissed so a
 * prominent message (e.g. a newer-version file) isn't missed.
 */
export type ToastKind = "info" | "warn" | "error";

const AUTO_DISMISS_MS = 6000;

export function showToast(kind: ToastKind, message: string): void {
  const host = document.getElementById("toast");
  if (!host) return;

  const item = document.createElement("div");
  item.className = `toast-item ${kind}`;

  const text = document.createElement("span");
  text.className = "toast-text";
  text.textContent = message;
  item.appendChild(text);

  const close = document.createElement("button");
  close.type = "button";
  close.className = "toast-close";
  close.textContent = "✕";
  close.addEventListener("click", () => item.remove());
  item.appendChild(close);

  host.appendChild(item);

  if (kind === "info") window.setTimeout(() => item.remove(), AUTO_DISMISS_MS);
}
