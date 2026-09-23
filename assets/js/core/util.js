/* FPV OPS — kleine Hilfen, die überall gebraucht werden. */

export const $ = (s, r) => (r || document).querySelector(s);
export const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function h(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
}

export function deDate(iso) {
  if (!iso) return "—";
  const p = String(iso).slice(0, 10).split("-");
  return p.length === 3 ? p[2] + "." + p[1] + "." + p[0] : iso;
}

export function daysSince(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso + "T12:00:00").getTime();
  return Math.floor(ms / 864e5);
}

export function fmtMin(m) {
  m = Math.round(m || 0);
  if (m < 60) return m + " min";
  return Math.floor(m / 60) + " h " + String(m % 60).padStart(2, "0") + " min";
}
