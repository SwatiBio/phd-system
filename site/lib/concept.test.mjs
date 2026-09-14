/* Black-box test for the concept module (site/lib/concept.js) — no network:
   papers arrive as plain data, the way paper.js parseNote produces them.
   Locks the locked decisions of PHDOS-49: one vocabulary with two states
   (the dedupe rule lives here and nowhere else), tolerant concept parsing,
   round-trip serialization, and the shared-slug tag thread (no relinking). */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FOLDER,
  conceptHref,
  conceptSlugIndex,
  isConceptTag,
  parseConcept,
  serializeConcept,
  threadFromPapers,
} from "./concept.js";

const CONCEPT_MD = `---
title: "biofilm"
description: "Surface-attached microbial communities — the target phenotype for the usnic acid work."
related-concepts: []
---

Draft notes from the review pile.
`;

const CONCEPT_BLOCK_LIST = `---
title: "quorum sensing"
description: "Chemical cell-to-cell signalling"
related-concepts:
  - biofilm
  - usnic acid
---

`;

test("parseConcept: tolerant parse with defaults", () => {
  const c = parseConcept(`${FOLDER}/biofilm.md`, CONCEPT_MD);
  assert.equal(c.path, `${FOLDER}/biofilm.md`);
  assert.equal(c.slug, "biofilm");
  assert.equal(c.title, "biofilm");
  assert.equal(c.description, "Surface-attached microbial communities — the target phenotype for the usnic acid work.");
  assert.deepEqual(c.relatedConcepts, []);
  assert.equal(c.notes, "Draft notes from the review pile.");
});

test("parseConcept: missing file fields still yield a usable object (never null)", () => {
  const c = parseConcept(`${FOLDER}/fresh.md`, "");
  assert.equal(c.slug, "fresh");
  assert.equal(c.title, "fresh");
  assert.equal(c.description, "");
  assert.deepEqual(c.relatedConcepts, []);
  assert.equal(c.notes, "");
});

test("parseConcept: block-list related-concepts", () => {
  const c = parseConcept(`${FOLDER}/quorum sensing.md`, CONCEPT_BLOCK_LIST);
  assert.deepEqual(c.relatedConcepts, ["biofilm", "usnic acid"]);
  assert.equal(c.notes, "");
});

test("serializeConcept round-trips through parseConcept", () => {
  const c = parseConcept(`${FOLDER}/biofilm.md`, CONCEPT_MD);
  c.relatedConcepts = ["quorum sensing"];
  const text = serializeConcept(c);
  const back = parseConcept(`${FOLDER}/biofilm.md`, text);
  assert.equal(back.title, "biofilm");
  assert.equal(back.description, c.description);
  assert.deepEqual(back.relatedConcepts, ["quorum sensing"]);
  assert.equal(back.notes, "Draft notes from the review pile.");
});

test("serializeConcept: empty concept serializes without trailing junk", () => {
  const text = serializeConcept({
    title: "x",
    description: "",
    relatedConcepts: [],
    notes: "",
  });
  assert.match(text, /^---\ntitle: "x"\ndescription: ""\nrelated-concepts: \[\]\n---\n\n$/);
});

test("isConceptTag: the dedupe rule — a tag slug that names an existing concept links", () => {
  assert.equal(isConceptTag("biofilm", ["biofilm", "quorum"]), true);
  assert.equal(isConceptTag("biofilm", new Set(["BIOFILM"])), true); // case-insensitive
  assert.equal(isConceptTag("scratchpad", ["biofilm"]), false);
  assert.equal(isConceptTag("biofilm", []), false);
});

test("conceptHref: the only URL builder, slugs are encoded", () => {
  assert.equal(conceptHref("biofilm"), "/concept.html?c=biofilm");
  assert.equal(conceptHref("usnic acid"), "/concept.html?c=usnic%20acid");
});

const PAPER_A = {
  title: "Usnic acid against biofilms",
  path: "research/papers/usnic2026.md",
  highlights: [
    { text: "MIC dropped 4-fold", comment: "key result", page: "4", tags: ["biofilm"] },
    { text: "Untagged observation", comment: "", page: "5", tags: [] },
  ],
};

const PAPER_B = {
  title: "Quorum sensing review",
  path: "research/papers/quorum2025.md",
  highlights: [
    { text: "Signal blockade works", comment: "see also", page: "12", tags: ["biofilm", "quorum"] },
    { text: "Case mismatch", comment: "", page: "13", tags: ["BIOFILM"] },
  ],
};

test("threadFromPapers: every tagged highlight across papers, each carrying its paper", () => {
  const thread = threadFromPapers("biofilm", [PAPER_A, PAPER_B]);
  assert.equal(thread.length, 3);
  assert.deepEqual(
    thread.map((s) => [s.text, s.paperTitle, s.paperPath]),
    [
      ["MIC dropped 4-fold", "Usnic acid against biofilms", "research/papers/usnic2026.md"],
      ["Signal blockade works", "Quorum sensing review", "research/papers/quorum2025.md"],
      ["Case mismatch", "Quorum sensing review", "research/papers/quorum2025.md"],
    ],
  );
});

test("threadFromPapers: untagged highlights are excluded by design", () => {
  const thread = threadFromPapers("biofilm", [PAPER_A]);
  assert.ok(thread.every((s) => s.text !== "Untagged observation"));
});

test("threadFromPapers: a snippet carries every tag it has, but threads stay per-slug", () => {
  /* "quorum" thread gets only the highlight tagged #quorum, not #biofilm-only ones. */
  const thread = threadFromPapers("quorum", [PAPER_A, PAPER_B]);
  assert.deepEqual(thread.map((s) => s.text), ["Signal blockade works"]);
});

test("threadFromPapers: tags match case-insensitively (one shared vocabulary)", () => {
  const papers = [{ title: "P", path: "research/papers/p.md", highlights: [{ text: "t", comment: "", page: "1", tags: ["Biofilm"] }] }];
  assert.equal(threadFromPapers("biofilm", papers).length, 1);
});

test("conceptSlugIndex: lowercase tag -> canonical slug (links hit the real file)", () => {
  const idx = conceptSlugIndex([{ slug: "biofilm" }, { slug: "usnic acid" }]);
  assert.equal(idx.get("biofilm"), "biofilm");
  /* callers lowercase the tag before lookup (renderTags does) */
  assert.equal(idx.get("BIOFILM"), undefined);
  assert.equal(idx.get("usnic acid"), "usnic acid");
  assert.equal(idx.get("scratchpad"), undefined);
});

test("serializeConcept: quotes and backslashes in values stay valid frontmatter", () => {
  const c = parseConcept(`${FOLDER}/x.md`, "");
  c.description = 'Said "mIC 4\\x" — done';
  const text = serializeConcept(c);
  const back = parseConcept(`${FOLDER}/x.md`, text);
  assert.equal(back.description, c.description); // round-trips exactly
});
