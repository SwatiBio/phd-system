/* Concept module — the promoted-tag vocabulary, in one place (PHDOS-49).
 *
 * A concept is a promoted tag: concept slugs and free-form tag slugs share
 * the same string (`#biofilm` tag <-> `biofilm` concept). A tag becomes a
 * concept when it earns a description. The dedupe rule — "a tag slug that
 * names an existing concept links instead of recreating" — lives HERE and
 * nowhere else: atlas.js, the concept page, and any future tag surface all
 * cross this seam for it.
 *
 * Object model (site/admin/config.yml, concepts collection):
 *   Concept = title, description, related-concepts, body (Notes).
 *   One file per concept in research/concepts/, file name = slug.
 *
 * Interface (everything a caller must know):
 *   FOLDER                        "research/concepts"
 *   conceptHref(slug)             "/concept.html?c=slug"
 *   isConceptTag(tag, slugs)      bool — does this tag slug name an existing
 *                                 concept? (the dedupe rule)
 *   parseConcept(path, text)      Concept — tolerant: missing fields get
 *                                 defaults, never null
 *   serializeConcept(concept)     text — full markdown with frontmatter
 *   threadFromPapers(slug, papers)
 *                                 [{text, comment, page, paperTitle,
 *                                   paperPath}] — every tagged highlight
 *                                 snippet across papers whose highlights
 *                                 carry `slug`. The shared-slug link means
 *                                 papers never need relinking on promotion.
 *
 * `vault` is a dependency the caller supplies (site/lib/vault.js in the
 * browser; tests pass a fake — accept dependencies, don't create them).
 */

export const FOLDER = "research/concepts";

/* git's autocrlf can hand us CRLF. */
const norm = (t) => String(t).replace(/\r\n?/g, "\n");

/* Frontmatter lists arrive three ways — `[]`, `[a, b]`, and block YAML
   (`related-concepts:\n  - a`). Parse all three (paper.js rule). */
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

function unquote(v) {
  if (!v) return v;
  /* YAML double-quoted scalars: strip the outer quotes, then unescape what
     serializeConcept escaped (\" and \\). Single-quoted: outer quotes only. */
  if (/^".*"$/s.test(v))
    return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  if (/^'.*'$/.test(v)) return v.slice(1, -1);
  return v;
}

/**
 * The dedupe rule, in exactly one place: a tag slug that names an existing
 * concept links instead of recreating. Callers pass the concept slugs they
 * already loaded; nobody else may re-derive this.
 */
export function isConceptTag(tag, conceptSlugs) {
  const set = new Set((conceptSlugs instanceof Set ? [...conceptSlugs] : conceptSlugs || [])
    .map((s) => String(s).toLowerCase()));
  return set.has(String(tag).toLowerCase());
}

/** The only place that builds a concept-page URL. */
export function conceptHref(slug) {
  return `/concept.html?c=${encodeURIComponent(slug)}`;
}

/**
 * conceptSlugIndex(concepts) → Map<lowercase tag, canonical slug>
 *
 * The slug-namespace index behind isConceptTag: Zotero tags keep their case
 * (#Biofilm) while concept slugs are file names; a tag "names" a concept
 * case-insensitively, but every link and edge must use the canonical slug
 * (GitHub paths are case-sensitive). Callers pass the concept list they
 * loaded — the rule itself lives here, nowhere else.
 */
export function conceptSlugIndex(concepts) {
  return new Map((concepts || []).map((c) => [String(c.slug ?? c).toLowerCase(), c.slug ?? c]));
}

/**
 * parseConcept(path, text) → Concept
 *
 * Tolerant parser: missing frontmatter fields get defaults, the notes body
 * may be empty. The caller never gets null — always a usable object.
 */
export function parseConcept(path, text) {
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
  const notes = fm ? t.slice(fm[0].length).trim() : t.trim();

  return {
    path,
    slug: path.slice(FOLDER.length + 1).replace(/\.md$/, ""),
    title: unquote(attrs.title) || path.slice(FOLDER.length + 1).replace(/\.md$/, ""),
    description: unquote(attrs.description) || "",
    relatedConcepts: parseList(attrs["related-concepts"], blocks["related-concepts"]),
    notes,
  };
}

/**
 * serializeConcept(concept) → text
 *
 * Serialize a Concept back to full markdown with frontmatter — used for
 * saving inline edits on the concept page.
 */
export function serializeConcept(concept) {
  const rel = concept.relatedConcepts.length
    ? `[${concept.relatedConcepts.map((c) => `"${c}"`).join(", ")}]`
    : "[]";
  /* YAML double-quoted scalars: escape backslash and quote first. */
  const q = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
  const fm = [
    "---",
    `title: "${q(concept.title)}"`,
    `description: "${q(concept.description)}"`,
    `related-concepts: ${rel}`,
    "---",
  ].join("\n");
  const notes = concept.notes || "";
  return `${fm}\n\n${notes}${notes ? "\n" : ""}`;
}

/**
 * threadFromPapers(slug, papers) → [{text, comment, page, paperTitle, paperPath}]
 *
 * The tag thread for a promoted concept: every tagged highlight snippet
 * across the papers whose Highlights carry `slug` (case-insensitive — the
 * vocabulary is one shared string). Papers arrive already parsed by
 * paper.js's parseNote; each needs { title, path, highlights }.
 * Untagged highlights are excluded by design (PHDOS-48): a snippet enters
 * the thread only through its tag.
 */
export function threadFromPapers(slug, papers) {
  const needle = String(slug).toLowerCase();
  const out = [];
  for (const p of papers || []) {
    for (const h of p.highlights || []) {
      const tags = (h.tags || []).map((t) => String(t).toLowerCase());
      if (!tags.includes(needle)) continue;
      out.push({
        text: h.text,
        comment: h.comment,
        page: h.page,
        paperTitle: p.title || "(untitled)",
        paperPath: p.path,
      });
    }
  }
  return out;
}
