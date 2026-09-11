/* The tag vocabulary rule, in one place.
 *
 * A tag is a `#word` in the entry text — the text is the source of truth.
 * Eight curated tags get chips, descriptions and suggestions; any other
 * `#word` is a free-form tag, remembered in daily/tags.md (the registry) so
 * the autosuggest can offer it next time. Chips are shortcuts that insert or
 * remove `#tag` in the text — nothing is stored separately.
 *
 * Why a module: chip state, suggestions and the registry are three views of
 * one fact (which #words are in the text). The page script used to keep a
 * separate Set of "active tags" that drifted out of sync with what parseLog()
 * extracted from the saved line — and the "is a #partial at the caret?"
 * rule was re-derived twice in the page. Cross this seam instead.
 *
 * Pure functions: no DOM, no fetch. Callers read the registry and pass its
 * contents in; tests cross the same interface.
 */

import { norm } from "./logs.js";

export const CURATED = [
  "experiment",
  "reading",
  "idea",
  "meeting",
  "university",
  "writing",
  "data",
  "analysis",
  "question",
];

/* One-line descriptions shown in chip tooltips and suggestion subtitles. */
export const TAG_DESCRIPTIONS = {
  experiment: "Bench or work-unit work: runs, assays, samples",
  reading: "Reading & working with papers: lit review, digests, Zotero exports",
  idea: "Flashes and hypotheses, not yet work",
  meeting: "Guide meetings, committee, supervisor time",
  university: "MAHE obligations: coursework, classes, forms, registrations",
  writing: "Drafting anything: intro, methods, notes becoming prose",
  data: "Recording datasets, MANIFEST updates, freezing data",
  analysis: "Interpreting results: docking, stats, in silico work",
  question: "Open research questions — pending, deferred, or blockers",
};

const TAG_WORD = "[a-z0-9_-]+";
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* All tags in `text` as a Set of lowercased names, deduped. */
export function tagsIn(text) {
  const out = new Set();
  for (const m of String(text).matchAll(new RegExp(`#(${TAG_WORD})`, "gi"))) out.add(m[1].toLowerCase());
  return out;
}

/* Is `#tag` present as a whole word? (So "readings" does not light #reading.) */
export function hasTag(text, tag) {
  return new RegExp(`#${esc(tag)}(?![${TAG_WORD}])`, "i").test(String(text));
}

/* Insert "#tag " at `caret` (default: end). No-op if already present —
   one #word is enough, and duplicates would pollute the registry. */
export function insertTag(text, tag, caret = text.length) {
  if (hasTag(text, tag)) return { text, caret };
  const at = Math.max(0, Math.min(caret, text.length));
  const before = text.slice(0, at);
  const after = text.slice(at);
  const lead = !before || /\s$/.test(before) ? "" : " ";
  const trail = after && /\s/.test(after[0]) ? "" : " ";
  const piece = `${lead}#${tag}${trail}`;
  return { text: before + piece + after, caret: at + piece.length };
}

/* Remove "#tag" and tidy the whitespace it leaves behind. */
export function removeTag(text, tag) {
  return String(text)
    .replace(new RegExp(`\\s*#${esc(tag)}(?![${TAG_WORD}])`, "gi"), " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/* The partial #tag being typed at `caret`, or null. A tag starts at word
   start (start of text or after whitespace) and may have an EMPTY prefix —
   a bare "#" with the caret right after it. cutLength is how many characters
   before the caret belong to the partial ("#th" -> 3), so acceptors can
   replace it with the completed tag. This is the single rule deciding when
   the autosuggest opens — the page must not re-derive it. */
export function tagAtCaret(text, caret) {
  const s = String(text);
  const at = Math.max(0, Math.min(caret ?? s.length, s.length));
  const m = s.slice(0, at).match(/(?:^|\s)#([a-z0-9_-]*)$/i);
  // NB: cutLength counts only "#prefix", not the whitespace the match needed —
  // insertTag() owns spacing, the acceptor must not eat it.
  return m ? { prefix: m[1], cutLength: m[1].length + 1 } : null;
}

/* Autosuggest contents: curated matches first (in chip order), then the
   caller's custom-tag keys, prefix-filtered, case-insensitive. */
export function suggest(prefix, customKeys = []) {
  const p = String(prefix).toLowerCase();
  const curated = CURATED.filter((t) => t.startsWith(p));
  const custom = customKeys
    .map((t) => String(t).toLowerCase())
    .filter((t) => t.startsWith(p) && !curated.includes(t))
    .slice(0, 8);
  return { curated, custom };
}

/* Free-form tags in `text` that are not among the known set (curated + registry).
   These are the registry additions a save must record. */
export function newAdHocs(text, known) {
  const knownSet = new Set(known.map((t) => String(t).toLowerCase()));
  return [...tagsIn(text)].filter((t) => !knownSet.has(t));
}

/* daily/tags.md -> Map<tag, "YYYY-MM-DD" | "">, oldest first.
   Tolerates a plain "- tag" line (hand-edited before the date was added). */
export function parseRegistry(text) {
  const out = new Map();
  for (const line of norm(text).split("\n")) {
    const m = line.match(/^-\s+([a-z0-9_-]+)(?:\s*[—-]\s*(\d{4}-\d{2}-\d{2}))?\s*$/i);
    if (m) out.set(m[1].toLowerCase(), m[2] || "");
  }
  return out;
}

/* Map<tag, date> -> the daily/tags.md file text. */
export function registryText(entries) {
  const lines = [...entries.entries()].map(([tag, date]) => `- ${tag}${date ? ` — ${date}` : ""}`);
  return `---\ntitle: "Ad-hoc tags"\n---\n\n${lines.join("\n")}\n`;
}