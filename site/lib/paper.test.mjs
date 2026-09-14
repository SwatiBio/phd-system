/* Black-box test for the paper reader module (site/lib/paper.js) — no network.
   Focus: the Highlights parsing seam that Atlas tag threads and the concept
   page both depend on. Locks the metadata format tolerance (PHDOS-49 bug
   hunt): the importer once emitted an unclosed emphasis "_<small>…</small>"
   — both wrapped and plain formats must parse to clean tags. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNote, serializeNote } from "./paper.js";

const HL = (metaLine) => `---
title: "T"
category: phd
status: read
tags: []
citekey: "c"
zotero-key: K
authors: []
concepts: []
citations: 0
related: []
---
# T

## Highlights

> A quoted finding.

${metaLine}
`;

const parse = (metaLine) => parseNote("research/papers/t.md", HL(metaLine)).highlights[0];

test("highlight metadata: closed emphasis format parses to clean tags", () => {
  const h = parse("_<small>p. 4 · #biofilm #usnic</small>_");
  assert.equal(h.page, "4");
  assert.deepEqual(h.tags, ["biofilm", "usnic"]);
});

test("highlight metadata: unclosed emphasis (importer drift) still parses to clean tags", () => {
  const h = parse("_<small>p. 4 · #Biofilm</small>");
  assert.equal(h.page, "4");
  assert.deepEqual(h.tags, ["Biofilm"]);
});

test("highlight metadata: plain (unwrapped) format parses", () => {
  const h = parse("p. 7 · #biofilm");
  assert.equal(h.page, "7");
  assert.deepEqual(h.tags, ["biofilm"]);
});

test("highlight tags survive serialize/parse round-trip", () => {
  const p = parseNote("research/papers/t.md", HL("_<small>p. 4 · #biofilm</small>_"));
  const again = parseNote("research/papers/t.md", serializeNote(p));
  assert.deepEqual(again.highlights, p.highlights);
});
