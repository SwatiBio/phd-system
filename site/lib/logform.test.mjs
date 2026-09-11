/* Node's test runner — black-box at the logs.js / tags.js seams.
 * Every case calls the same pure functions the page script calls.
 * Run: node --test site/lib/logform.test.mjs */

import { test } from "node:test";
import assert from "node:assert/strict";
import { iso, toEntryLineText, parseLog } from "./logs.js";
import {
  CURATED, TAG_DESCRIPTIONS, tagsIn, hasTag, insertTag, removeTag,
  suggest, newAdHocs, parseRegistry, registryText, tagAtCaret,
} from "./tags.js";

test("iso() is the LOCAL date — logging after midnight must not fall into yesterday (UTC-shift regressions)", () => {
  // 00:30 local on Jan 1; on any UTC+ timezone toISOString() would return Dec 31
  assert.equal(iso(new Date(2026, 0, 1, 0, 30)), "2026-01-01");
  assert.equal(iso(new Date(2026, 8, 11, 12, 0)), "2026-09-11");
});

test("CURATED has exactly the 9 decided tags, each with a description", () => {
  assert.deepEqual(CURATED, [
    "experiment", "reading", "idea", "meeting",
    "university", "writing", "data", "analysis", "question",
  ]);
  for (const t of CURATED) assert.ok(TAG_DESCRIPTIONS[t], `missing description for #${t}`);
});

/* ---------- logs.js seam ---------- */

test("toEntryLineText collapses multi-line input to one line", () => {
  assert.equal(toEntryLineText("Ran the assay\n\nThen wrote it up"), "Ran the assay Then wrote it up");
  assert.equal(toEntryLineText("  a\t\tb  "), "a b");
  assert.equal(toEntryLineText("line1\r\nline2"), "line1 line2");
  assert.equal(toEntryLineText("   \n  "), "");
});

test("normalized entry round-trips through the file format", () => {
  const line = toEntryLineText("Docking prep #analysis");
  const text = `## 2026-09-13\n${line}`.replace(line, `- **09:14** ${line}`); // shape as appendEntry would
  const parsed = parseLog(text)["2026-09-13"];
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].text, "Docking prep");
  assert.equal(parsed[0].tags, "#analysis"); // parseLog joins tags: "#analysis"
});

/* ---------- tags.js seam ---------- */

test("tagsIn extracts, lowercases and dedupes", () => {
  assert.deepEqual([...tagsIn("a #Reading and #reading and #DATA")], ["reading", "data"]);
  assert.deepEqual([...tagsIn("none")], []);
});

test("hasTag matches whole words only", () => {
  assert.equal(hasTag("read #reading", "reading"), true);
  assert.equal(hasTag("readings review", "reading"), false);
  assert.equal(hasTag("#Reading", "reading"), true);
});

test("insertTag dedupes and manages spacing at the caret", () => {
  assert.deepEqual(insertTag("alpha", "idea"), { text: "alpha #idea ", caret: 12 });
  assert.deepEqual(insertTag("alpha ", "idea"), { text: "alpha #idea ", caret: 12 });
  assert.deepEqual(insertTag("alpha", "idea", 3), { text: "alp #idea ha", caret: 10 });
  assert.equal(insertTag("already #idea", "idea", 0).text, "already #idea");
});

test("removeTag removes the word and tidies whitespace", () => {
  assert.equal(removeTag("read #reading today", "reading"), "read today");
  assert.equal(removeTag("read #reading  today", "reading"), "read today");
  assert.equal(removeTag("#reading\ntoday", "reading"), "today");
  assert.equal(removeTag("no tag here", "reading"), "no tag here");
});

test("tagAtCaret finds the partial #tag being typed at the caret", () => {
  // bare # with caret after it -> empty prefix (dropdown should open)
  assert.deepEqual(tagAtCaret("wrote #", 7), { prefix: "", cutLength: 1 });
  // partial tag at the caret
  assert.deepEqual(tagAtCaret("drafted #th", 11), { prefix: "th", cutLength: 3 });
  // only the text BEFORE the caret counts
  assert.deepEqual(tagAtCaret("#meeting later", 0), null);
  assert.deepEqual(tagAtCaret("#meeting later", 8), { prefix: "meeting", cutLength: 8 });
  // opens at word start only: not after a letter
  assert.equal(tagAtCaret("mail#th", 7), null);
  // caret mid-tag still sees the whole partial
  assert.deepEqual(tagAtCaret("#thesis", 3), { prefix: "th", cutLength: 3 });
  // no tag at all
  assert.equal(tagAtCaret("plain text", 10), null);
});

test("suggest: curated first in chip order, then custom, prefix-filtered", () => {
  assert.deepEqual(suggest("r", ["thesis", "rainbow"]).curated, ["reading"]);
  assert.deepEqual(suggest("r", ["thesis", "rainbow"]).custom, ["rainbow"]);
  assert.deepEqual(suggest("re", ["thesis"]).curated, ["reading"]);
  assert.deepEqual(suggest("zz", ["thesis"]), { curated: [], custom: [] });
  assert.deepEqual(suggest("u"), { curated: ["university"], custom: [] });
});

test("newAdHocs finds only unregistered tags", () => {
  assert.deepEqual(newAdHocs("wrote #thesis with #reading", CURATED), ["thesis"]);
  assert.deepEqual(newAdHocs("bench #experiment", CURATED), []);
});

test("registry parses and serializes symmetrically", () => {
  const md = registryText(new Map([["thesis", "2026-09-13"], ["mahe", "2026-09-14"]]));
  const back = parseRegistry(md);
  assert.equal(back.get("thesis"), "2026-09-13");
  assert.equal(back.get("mahe"), "2026-09-14");
  // hand-pruned line without a date survives
  assert.equal(parseRegistry(back === null ? "" : "- mahe — 2026-09-14\n- zotero").get("zotero"), "");
  // CRLF tolerated
  assert.equal(parseRegistry("- thesis — 2026-09-13\r\n").get("thesis"), "2026-09-13");
});