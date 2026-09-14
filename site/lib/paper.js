/* Paper reader module — parsing, rendering, and inline editing of paper notes.
 *
 * Deep module: pages ask for a parsed paper and rendered sections; the
 * frontmatter parsing, highlight rendering, and note serialization live here.
 * The CMS stays the backup editing surface; the reader page is the primary
 * reading/editing place (PHDOS-48).
 *
 * Object model (docs/business-logic.md):
 *   Paper = title, category, status, tags, citekey, zotero-key, authors,
 *           concepts, related, citations + 6 body sections (Highlights
 *           is sync-owned; 5 human sections are user-editable).
 *
 * Interface (everything a caller must know):
 *   parseNote(path, text)         Paper — tolerant: missing fields get defaults
 *   serializeNote(paper)          text — full markdown with frontmatter
 *   renderHighlights(paper)       HTML string — the sync-owned Highlights section
 *   renderSection(name, content)  HTML string — a single section for display
 *   preview(paper)                string — "Key result" body text, "" when unfilled
 *
 * `vault` is a dependency the caller supplies (site/lib/vault.js in the
 * browser; tests pass a fake — accept dependencies, don't create them).
 */

export const FOLDER = "research/papers";

/* Human-editable sections — these are never clobbered by sync. */
export const HUMAN_SECTIONS = [
  "What it did",
  "How",
  "Key result",
  "What it means for me",
  "Sparked",
];

/* git's autocrlf can hand us CRLF. */
const norm = (t) => String(t).replace(/\r\n?/g, "\n");

/* Frontmatter lists arrive three ways — `[]`, `[a, b]`, and block YAML
   (`tags:\n  - a`). Parse all three. */
function parseList(raw, blockLines) {
  const s = (raw || "").trim();
  if (s && s !== "[]") {
    return s
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map((x) => x.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  return (blockLines || [])
    .map((l) => l.trim().replace(/^-\s*/, "").replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

/* Strip surrounding quotes from a frontmatter value. */
function unquote(v) {
  if (!v) return v;
  return v.replace(/^["']|["']$/g, "");
}

/* Extract a ## section's body text from the markdown body.
   Avoids \s*$ in multiline mode (it matches trailing whitespace to string
   end, which breaks the non-greedy quantifier). Instead, finds the next
   ## header position and slices. */
function sectionBody(body, name) {
  const startRe = new RegExp(`^## ${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n`, "m");
  const startMatch = body.match(startRe);
  if (!startMatch) return "";
  const start = startMatch.index + startMatch[0].length;
  const rest = body.slice(start);
  const nextHeader = rest.match(/^## /m);
  const end = nextHeader ? start + nextHeader.index : body.length;
  return body.slice(start, end).replace(/<!--.*?-->/gs, "").trim();
}

/**
 * parseNote(path, text) → Paper
 *
 * Tolerant parser: missing frontmatter fields get defaults, missing sections
 * get empty strings. The caller never gets null — always a usable object.
 */
export function parseNote(path, text) {
  const t = norm(text);
  const fm = t.match(/^---\n([\s\S]*?)\n---\n?/);
  const attrs = {};
  const blocks = {};
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

  /* Parse the Highlights section into structured data. */
  const hlRaw = sectionBody(body, "Highlights");
  const highlights = parseHighlights(hlRaw);

  /* Parse human sections. */
  const sections = {};
  for (const name of HUMAN_SECTIONS) {
    sections[name] = sectionBody(body, name);
  }

  return {
    path,
    slug: path.slice(FOLDER.length + 1).replace(/\.md$/, ""),
    title: unquote(attrs.title) || "(untitled)",
    category: attrs.category === "personal" ? "personal" : "phd",
    status: attrs.status || "to-read",
    tags: parseList(attrs.tags, blocks.tags),
    authors: parseList(attrs.authors, blocks.authors),
    concepts: parseList(attrs.concepts, blocks.concepts),
    citekey: unquote(attrs.citekey) || "",
    zoteroKey: unquote(attrs["zotero-key"]) || "",
    citations: parseInt(attrs.citations, 10) || 0,
    related: parseList(attrs.related, blocks.related),
    zoteroUri: (body.match(/\[Zotero\]\(([^)]+)\)/) || [])[1] || "",
    highlights,
    sections,
  };
}

/**
 * parseHighlights(md) → [{text, comment, page, tags}]
 *
 * Parse the Highlights markdown back into structured data.
 * Processes lines sequentially so metadata (page, tags) is associated with
 * the preceding blockquote even when separated by blank lines.
 * Handles both wrapped ("_<small>...</small>_") and plain metadata formats.
 */
function parseHighlights(md) {
  if (!md || md.trim() === "_No highlights yet._") return [];
  const lines = md.split("\n");
  const results = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith("> ")) {
      /* New highlight block — push previous if exists. */
      if (current) results.push(current);
      current = { text: line.slice(2), comment: "", page: "", tags: [] };
    } else if (
      current &&
      (line.startsWith("_<small>") || /^p\.\s|\S+#\S/.test(line.trim()))
    ) {
      /* Metadata line: either wrapped or plain format. The closing emphasis
         is optional — the importer once emitted "_<small>…</small>" (PHDOS-49
         bug hunt); tolerate both. */
      const meta = line.replace(/_<small>/, "").replace(/<\/small>_?/, "").trim();
      const parts = meta.split(" \u00b7 ");
      for (const part of parts) {
        const pm = part.trim().match(/^p\.\s*(.+)$/);
        if (pm) current.page = pm[1];
        else
          current.tags.push(
            ...part
              .trim()
              .split(/\s+/)
              .map((t) => t.replace(/^#/, ""))
              .filter(Boolean),
          );
      }
    } else if (current && line.trim() && !line.startsWith(">")) {
      current.comment = line.trim();
    }
  }
  if (current) results.push(current);
  return results;
}

/**
 * renderHighlights(paper) → HTML string
 *
 * Render the sync-owned Highlights section as HTML for display.
 * Each highlight becomes a styled blockquote with metadata.
 */
export function renderHighlights(paper) {
  if (!paper.highlights || paper.highlights.length === 0) {
    return '<p class="text-muted-foreground italic">No highlights yet.</p>';
  }
  return paper.highlights
    .map((h) => {
      const meta = [];
      if (h.page) meta.push(`p. ${h.page}`);
      if (h.tags.length) meta.push(h.tags.map((t) => `#${t}`).join(" "));
      return `<blockquote class="border-l-2 border-muted-foreground/30 pl-3 py-1 my-2">
        <p>${esc(h.text)}</p>
        ${h.comment ? `<p class="text-sm text-muted-foreground mt-1">${esc(h.comment)}</p>` : ""}
        ${meta.length ? `<p class="text-xs text-muted-foreground mt-1"><em>${esc(meta.join(" \u00b7 "))}</em></p>` : ""}
      </blockquote>`;
    })
    .join("\n");
}

/**
 * renderSection(name, content) → HTML string
 *
 * Render a single human-editable section. Empty sections show a placeholder.
 */
export function renderSection(name, content) {
  if (!content || !content.trim()) {
    return `<p class="text-muted-foreground italic" data-placeholder="${esc(name)}">Click to add ${esc(name.toLowerCase())}…</p>`;
  }
  /* Basic markdown: bold, italic, links, line breaks. */
  let html = esc(content)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="underline">$1</a>')
    .replace(/\n/g, "<br>");
  return html;
}

/**
 * serializeNote(paper) → text
 *
 * Serialize a Paper object back to full markdown with frontmatter.
 * Used for saving inline edits.
 */
export function serializeNote(paper) {
  const tagStr = paper.tags.length ? `[${paper.tags.map((t) => `"${t}"`).join(", ")}]` : "[]";
  const authorStr = paper.authors.length
    ? `[${paper.authors.map((a) => `"${a}"`).join(", ")}]`
    : "[]";
  const conceptStr = paper.concepts.length ? `[${paper.concepts.map((c) => `"${c}"`).join(", ")}]` : "[]";
  const relatedStr = paper.related.length ? `[${paper.related.map((r) => `"${r}"`).join(", ")}]` : "[]";

  const fm = [
    "---",
    `title: "${paper.title}"`,
    `category: ${paper.category}`,
    `status: ${paper.status}`,
    `tags: ${tagStr}`,
    `citekey: "${paper.citekey}"`,
    `zotero-key: ${paper.zoteroKey}`,
    `authors: ${authorStr}`,
    `concepts: ${conceptStr}`,
    `citations: ${paper.citations}`,
    `related: ${relatedStr}`,
    "---",
  ].join("\n");

  /* Highlights section — serialized from structured data. */
  const hlMd = serializeHighlights(paper.highlights);

  /* Body: title + zotero link + highlights + human sections. */
  const body = [
    `# ${paper.title}`,
    "",
    paper.zoteroUri ? `[Zotero](${paper.zoteroUri})` : "",
    "",
    "## Highlights",
    "",
    hlMd,
    "",
    ...HUMAN_SECTIONS.map((name) => {
      const content = paper.sections[name] || "";
      return `## ${name}\n\n${content}`;
    }),
    "",
    "<!-- 1-3 lines, rough words: what idea did this paper give you? Optional. -->",
    "",
  ].join("\n");

  return fm + "\n" + body;
}

function serializeHighlights(highlights) {
  if (!highlights || highlights.length === 0) return "_No highlights yet._";
  return highlights
    .map((h) => {
      const parts = [];
      if (h.text) parts.push(`> ${h.text}`);
      if (h.comment) parts.push(h.comment);
      const meta = [];
      if (h.page) meta.push(`p. ${h.page}`);
      if (h.tags && h.tags.length) meta.push(h.tags.map((t) => `#${t}`).join(" "));
      if (meta.length) parts.push(`_<small>${meta.join(" \u00b7 ")}</small>_`);
      return parts.join("\n");
    })
    .join("\n\n");
}

/**
 * preview(paper) → string
 * The "Key result" section body, or "" when unfilled.
 */
export function preview(paper) {
  return paper.sections["Key result"] || "";
}

/* HTML-escape for safe interpolation. */
function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
