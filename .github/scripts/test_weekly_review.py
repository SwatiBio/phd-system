#!/usr/bin/env python3
"""Tests for the weekly-review counting rules (PHDOS-49).

The suggestion piles are deterministic: they count, they never judge. These
tests lock the counting rules — thresholds, already-promoted exclusions,
existing-edge exclusions, sort order — at the module's seam (pure functions,
no filesystem).

Run:  py .github/scripts/test_weekly_review.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import weekly_review as wr  # noqa: E402

FAILURES = []


def check(name, got, want):
    if got != want:
        FAILURES.append(f"{name}\n  got:  {got!r}\n  want: {want!r}")


# ------------------------------------------------- highlight tag extraction
HIGHLIGHTS = """# Some paper

[Zotero](zotero://select/library/items/ABC)

## Highlights

> First finding

Margin note here
_<small>p. 4 · #biofilm #Usnic-acid</small>

> Second finding
_<small>p. 7</small>

> Untagged finding

## What it did

nothing
"""

check("highlight_tags: tagged highlights only, lowercased",
      wr.highlight_tags(HIGHLIGHTS), {"biofilm", "usnic-acid"})
check("highlight_tags: no Highlights section -> empty set",
      wr.highlight_tags("## What it did\n\nnothing\n"), set())
check("highlight_tags: placeholder body -> empty set",
      wr.highlight_tags("## Highlights\n\n_No highlights yet._\n"), set())

# ------------------------------------------------- promotion candidates
PAPERS = [
    {"slug": "paper-a", "tags": {"biofilm", "quorum"}, "concepts": set()},
    {"slug": "paper-b", "tags": {"biofilm", "quorum"}, "concepts": set()},
    {"slug": "paper-c", "tags": {"biofilm"}, "concepts": set()},
    {"slug": "paper-d", "tags": {"scratchpad"}, "concepts": set()},
]

check("promotion: 3+ papers cross the default threshold, sorted count desc then tag",
      wr.promotion_candidates(PAPERS, set()), [("biofilm", ["paper-a", "paper-b", "paper-c"])])
check("promotion: tag already a concept is excluded",
      wr.promotion_candidates(PAPERS, {"biofilm"}), [])
check("promotion: lower threshold admits 2-paper tags",
      wr.promotion_candidates(PAPERS, set(), threshold=2),
      [("biofilm", ["paper-a", "paper-b", "paper-c"]), ("quorum", ["paper-a", "paper-b"])])
check("promotion: one-paper tags never cross threshold 3",
      wr.promotion_candidates(PAPERS, {"biofilm", "quorum"}), [])

# ------------------------------------------------- concept link suggestions
LINK_PAPERS = [
    {"slug": "p1", "concepts": {"biofilm", "quorum-sensing"}},
    {"slug": "p2", "concepts": {"biofilm", "quorum-sensing"}},
    {"slug": "p3", "concepts": {"biofilm", "usnic-acid"}},
]

check("links: pairs sharing 2+ papers, sorted count desc then pair",
      wr.concept_link_suggestions(LINK_PAPERS, {"biofilm", "quorum-sensing", "usnic-acid"}, set()),
      [(("biofilm", "quorum-sensing"), ["p1", "p2"])])
check("links: single-paper overlaps stay below threshold 2",
      wr.concept_link_suggestions(LINK_PAPERS, {"biofilm", "quorum-sensing", "usnic-acid"},
                                  {("biofilm", "quorum-sensing")}), [])
check("links: already-declared edges are excluded",
      wr.concept_link_suggestions(LINK_PAPERS, {"biofilm", "quorum-sensing", "usnic-acid"},
                                  {("biofilm", "quorum-sensing"), ("biofilm", "usnic-acid")}), [])
check("links: slugs that are not concepts are ignored",
      wr.concept_link_suggestions([{"slug": "p1", "concepts": {"ghost-a", "ghost-b"}}],
                                  {"real"}, set()), [])
check("links: edge normalization (order of the pair does not matter)",
      wr.concept_link_suggestions(LINK_PAPERS, {"biofilm", "quorum-sensing", "usnic-acid"},
                                  {("quorum-sensing", "biofilm")}),
      [])  # (biofilm, usnic-acid) shares only 1 paper — below threshold

# ------------------------------------------------- frontmatter parsing
FM_DOC = """---
title: "Test paper"
category: phd
concepts: [biofilm, quorum-sensing]
tags: []
related:
  - alpha
  - "beta"
---

## What it did
"""
fm = wr.frontmatter(FM_DOC)
check("frontmatter: inline list", wr.parse_list(fm.get("concepts")), ["biofilm", "quorum-sensing"])
check("frontmatter: empty inline list", wr.parse_list(fm.get("tags")), [])
check("frontmatter: block list", wr.parse_list(fm.get("related")), ["alpha", "beta"])
check("frontmatter: missing key", wr.parse_list(fm.get("nothing")), [])

# ------------------------------------------------- vault-state loaders (files)
import tempfile  # noqa: E402

with tempfile.TemporaryDirectory() as tmp:
    old_cwd = os.getcwd()
    os.chdir(tmp)
    try:
        os.makedirs("research/papers")
        os.makedirs("research/concepts")
        with open("research/papers/digest-latest.md", "w", encoding="utf-8") as fh:
            fh.write("# digest — not a paper\n")
        with open("research/papers/paper-a.md", "w", encoding="utf-8") as fh:
            fh.write('---\ntitle: "Paper A"\nconcepts: []\n---\n\n## Highlights\n\n'
                     "> finding\n_<small>p. 1 · #biofilm</small>\n")
        with open("research/papers/paper-b.md", "w", encoding="utf-8") as fh:
            fh.write('---\ntitle: "Paper B"\nconcepts:\n  - biofilm\n---\n\n## Highlights\n\n'
                     "> finding\n_<small>p. 2 · #biofilm</small>\n")
        with open("research/concepts/biofilm.md", "w", encoding="utf-8") as fh:
            fh.write("---\ntitle: \"biofilm\"\ndescription: \"test\"\nrelated-concepts: []\n---\n")

        papers = wr.load_papers()
        check("load_papers: digest skipped, tags+concepts read",
              [(p["slug"], p["tags"], p["concepts"]) for p in papers],
              [("paper-a", {"biofilm"}, set()), ("paper-b", {"biofilm"}, {"biofilm"})])
        slugs, edges = wr.load_concepts()
        check("load_concepts: slugs and edges", (slugs, edges), ({"biofilm"}, set()))
        # biofilm is already a concept -> no promotion candidate despite 2 papers
        check("loaders end-to-end: promoted tag is not re-suggested",
              wr.promotion_candidates(papers, slugs), [])
    finally:
        os.chdir(old_cwd)

if FAILURES:
    print(f"FAIL — {len(FAILURES)} counting-rule failure(s):")
    for f in FAILURES:
        print(f"  - {f}")
    sys.exit(1)
print("OK — weekly_review counting rules pass")
