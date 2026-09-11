/* Library module — the browsing view of the paper vault.
 *
 * Deep module: pages ask for papers and views of them; the frontmatter
 * parsing, tag grouping, search, and status vocabulary live here, not in
 * any page. The CMS stays the editing place; the Library is the
 * browsing/deciding place (PHDOS-43).
 *
 * Object model (docs/business-logic.md):
 *   Paper = title, category (phd|personal), status, tags, authors,
 *           concepts, related, citekey, zotero-key + 5 body sections.
 *
 * Interface (everything a caller must know):
 *   FOLDER                        where paper notes live ("research/papers")
 *   STATUSES                      the status vocabulary, in display order
 *   parsePaper(path, text)        Paper — tolerant: missing fields get defaults
 *   load(vault) → Paper[]         every paper note, sorted by title
 *   preview(paper) → string       "Key result" body text, "" when unfilled
 *   statusCounts(papers) → {status: n}  includes every status key (0 allowed)
 *   filterStatus(papers, s)       s = "all" or a status
 *   search(papers, q)             matches title, authors, tags (case-insensitive)
 *   groupByTag(papers) → [{tag, papers}]  sorted by group size then tag;
 *                                 untagged papers land in tag "(untagged)"
 *   sortPapers(papers, by)        by = "title" | "status"
 *
 * `vault` is a dependency the caller supplies (site/lib/vault.js in the
 * browser; tests pass a fake — accept dependencies, don't create them):
 *   list(folder) → [{ path }]
 *   get(path)    → { text } | null
 */

export const FOLDER = "research/papers";
export const STATUSES = ["to-read", "reading", "read", "parked"];
export const UNTAGGED = "(untagged)";

/* git's autocrlf can hand us CRLF; the parser is line-based and `.`
   never matches \r, so a CRLF file would silently parse as empty. */
const norm = (t) => String(t).replace(/\r\n?/g, "\n");

/* Frontmatter lists arrive three ways — `[]`, `[a, b]`, and block YAML
   (`tags:\n  - a`). Parse all three; junk stays a single string. */
function parseList(raw, blockLines) {
  const s = (raw || "").trim();
  if (s && s !== "[]") {
    return s
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map((x) => x.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  return (blockLines || []).map((l) => l.trim().replace(/^-\s*/, "").replace(/^["']|["']$/g, "")).filter(Boolean);
}

export function parsePaper(path, text) {
  const t = norm(text);
  const fm = t.match(/^---\n([\s\S]*?)\n---\n?/);
  const attrs = {};
  const blocks = {}; // key -> following "- item" lines
  if (fm) {
    let currentBlock = null;
    for (const line of fm[1].split("\n")) {
      const kv = line.match(/^([a-z-]+):\s*(.*)$/);
      if (kv && !/^\s/.test(line)) {
        attrs[kv[1]] = kv[2].trim();
        currentBlock = kv[2].trim() === "" ? kv[1] : null;
      } else if (currentBlock && /^\s*-\s*/.test(line)) {
        (blocks[currentBlock] = blocks[currentBlock] || []).push(line);
      }
    }
  }
  const body = fm ? t.slice(fm[0].length) : t;
  const kr = body.match(/^## Key result\s*\n([\s\S]*?)(?=^## |\s*$)/m);
  return {
    path,
    slug: path.slice(FOLDER.length + 1).replace(/\.md$/, ""),
    title: attrs.title || "(untitled)",
    category: attrs.category === "personal" ? "personal" : "phd",
    status: STATUSES.includes(attrs.status) ? attrs.status : "to-read",
    tags: parseList(attrs.tags, blocks.tags),
    authors: parseList(attrs.authors, blocks.authors),
    concepts: parseList(attrs.concepts, blocks.concepts),
    keyResult: kr ? kr[1].trim() : "",
  };
}

/* The faded preview line: the Key result section when filled, else nothing. */
export const preview = (p) => p.keyResult;

export async function load(vault) {
  const files = await vault.list(FOLDER);
  const papers = await Promise.all(
    files.map(async (f) => {
      const r = await vault.get(f.path);
      return r ? parsePaper(f.path, r.text) : null;
    })
  );
  return papers.filter(Boolean).sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
}

export function statusCounts(papers) {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const p of papers) counts[p.status]++;
  return counts;
}

export function filterStatus(papers, status) {
  return status === "all" ? papers : papers.filter((p) => p.status === status);
}

export function search(papers, q) {
  const needle = String(q || "").trim().toLowerCase();
  if (!needle) return papers;
  return papers.filter((p) =>
    [p.title, p.tags.join(" "), p.authors.join(" ")].join(" ").toLowerCase().includes(needle)
  );
}

const byTagThenSize = (a, b) =>
  b.papers.length - a.papers.length || (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0);

export function groupByTag(papers) {
  const groups = new Map();
  for (const p of papers) {
    const tags = p.tags.length ? p.tags : [UNTAGGED];
    for (const tag of tags) {
      if (!groups.has(tag)) groups.set(tag, []);
      groups.get(tag).push(p);
    }
  }
  return [...groups.entries()].map(([tag, list]) => ({ tag, papers: list })).sort(byTagThenSize);
}

const STATUS_ORDER = Object.fromEntries(STATUSES.map((s, i) => [s, i]));
const byCode = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export function sortPapers(papers, by) {
  const sorted = [...papers];
  if (by === "status") sorted.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || byCode(a.title, b.title));
  else sorted.sort((a, b) => byCode(a.title, b.title));
  return sorted;
}
