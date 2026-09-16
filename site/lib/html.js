/* html.js — HTML escaping helpers shared by every page and lib module.
   One escaping rule everywhere: the five HTML-significant characters.
   Previously each page defined its own esc with different coverage
   (&< in some, all five in others) — that drift is why this is a module. */

const MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => MAP[c]);

/* inline markdown -> safe HTML: bold, code, italics, links.
   { external: true } renders links target=_blank rel=noopener (digest's rule). */
export const inline = (s, { external = false } = {}) => esc(s)
  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  .replace(/`([^`]+)`/g, "<code>$1</code>")
  .replace(/\*([^*]+)\*/g, "<em>$1</em>")
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, txt, url) =>
    `<a href="${url}"${external ? ' target="_blank" rel="noopener"' : ""}>${txt}</a>`);
