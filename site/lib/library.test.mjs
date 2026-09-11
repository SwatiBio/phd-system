/* Black-box test for the library module (site/lib/library.js) — no network:
   the vault is a fake (in-memory map), the module's own dependency seam.
   Locks the locked decisions of PHDOS-43: status chips with counts, tag
   grouping with an (untagged) bucket, search over title/authors/tags,
   and the PhD/Personal split surviving the parse. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { FOLDER, STATUSES, parsePaper, load, preview, statusCounts, filterStatus, search, groupByTag, sortPapers } from "./library.js";

const PAPER_A = `---
title: Usnic acid against biofilms
category: phd
status: read
tags: [usnic acid, biofilms]
authors: ["A. Author", "B. Builder"]
concepts: [biofilm-inhibition]
---

[Zotero](zotero://select/library/items/ABC)

## What it did

Tested usnic acid.

## How

Docking + MIC assays.

## Key result

MIC dropped 4-fold at 32 ug/mL.

## What it means for me

## Sparked
`;

const PAPER_B = `---
title: Personal reading — journal
category: personal
status: to-read
tags:
  - scratchpad
---

## What it did

## How

## Key result

## What it means for me

## Sparked
`;

const PAPER_C = `---
title: CRLF paper
status: reading
---

## Key result
Grew on CRLF line endings.
`;

function fakeVault(files) {
  return {
    async list(folder) {
      return [...files.keys()]
        .filter((p) => p.startsWith(folder + "/"))
        .map((p) => ({ name: p.slice(folder.length + 1), path: p, type: "file" }));
    },
    async get(path) { return files.has(path) ? { text: files.get(path) } : null; },
  };
}

test("parsePaper reads inline lists, block lists, and defaults", () => {
  const p = parsePaper(`${FOLDER}/usnic-acid.md`, PAPER_A);
  assert.equal(p.title, "Usnic acid against biofilms");
  assert.equal(p.category, "phd");
  assert.equal(p.status, "read");
  assert.deepEqual(p.tags, ["usnic acid", "biofilms"]);
  assert.deepEqual(p.authors, ["A. Author", "B. Builder"]);
  assert.deepEqual(p.concepts, ["biofilm-inhibition"]);
  assert.equal(preview(p), "MIC dropped 4-fold at 32 ug/mL.");
});

test("parsePaper: block-style lists and CRLF files parse, not silently empty", () => {
  const b = parsePaper(`${FOLDER}/x.md`, PAPER_B);
  assert.deepEqual(b.tags, ["scratchpad"]);
  assert.equal(b.category, "personal");
  const c = parsePaper(`${FOLDER}/crlf.md`, PAPER_C.replace(/\n/g, "\r\n"));
  assert.equal(c.status, "reading");
  assert.equal(preview(c), "Grew on CRLF line endings.");
});

test("load reads every paper and sorts by title", async () => {
  const v = fakeVault(new Map([
    [`${FOLDER}/b.md`, PAPER_B],
    [`${FOLDER}/a.md`, PAPER_A],
  ]));
  const papers = await load(v);
  assert.deepEqual(papers.map((p) => p.slug), ["b", "a"]); // "Personal..." < "Usnic..." (codepoint)
});

test("statusCounts covers the whole vocabulary; filterStatus honours all", () => {
  const papers = [
    parsePaper(`${FOLDER}/a.md`, PAPER_A),
    parsePaper(`${FOLDER}/b.md`, PAPER_B),
    parsePaper(`${FOLDER}/c.md`, PAPER_C),
  ];
  const counts = statusCounts(papers);
  assert.deepEqual(STATUSES.map((s) => counts[s]), [1, 1, 1, 0]);
  assert.equal(filterStatus(papers, "all").length, 3);
  assert.equal(filterStatus(papers, "read").length, 1);
});

test("search matches title, authors, and tags, case-insensitive", () => {
  const papers = [parsePaper(`${FOLDER}/a.md`, PAPER_A)];
  assert.equal(search(papers, "usnic").length, 1);
  assert.equal(search(papers, "BUILDER").length, 1);
  assert.equal(search(papers, "biofilms").length, 1);
  assert.equal(search(papers, "nothing-matches").length, 0);
});

test("groupByTag groups by tag and parks untagged papers in (untagged)", () => {
  const papers = [
    parsePaper(`${FOLDER}/a.md`, PAPER_A),
    parsePaper(`${FOLDER}/b.md`, PAPER_B),
  ];
  const groups = groupByTag(papers);
  const byTag = Object.fromEntries(groups.map((g) => [g.tag, g.papers.length]));
  assert.equal(byTag["usnic acid"], 1);
  assert.equal(byTag["biofilms"], 1);
  assert.equal(byTag["scratchpad"], 1);
  assert.equal(byTag["(untagged)"], undefined);
  assert.equal(groupByTag([parsePaper(`${FOLDER}/c.md`, PAPER_C)])[0].tag, "(untagged)");
});

test("sortPapers: title is alphabetical, status follows the vocabulary order", () => {
  const papers = [
    parsePaper(`${FOLDER}/b.md`, PAPER_B),   // to-read
    parsePaper(`${FOLDER}/a.md`, PAPER_A),   // read
    parsePaper(`${FOLDER}/c.md`, PAPER_C),   // reading
  ];
  assert.deepEqual(sortPapers(papers, "title").map((p) => p.slug), ["c", "b", "a"]); // CRLF < Personal < Usnic
  assert.deepEqual(sortPapers(papers, "status").map((p) => p.slug), ["b", "c", "a"]);
});
