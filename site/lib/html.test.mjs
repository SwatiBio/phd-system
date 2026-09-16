import test from "node:test";
import assert from "node:assert/strict";
import { esc, inline } from "./html.js";

/* Node test for the escaping helpers — no DOM needed. */

test("esc: escapes all five HTML-significant characters", () => {
  assert.equal(esc(`a & b < c > d " e ' f`), "a &amp; b &lt; c &gt; d &quot; e &#39; f");
});

test("esc: nullish input becomes empty string", () => {
  assert.equal(esc(null), "");
  assert.equal(esc(undefined), "");
  assert.equal(esc(0), "0");
});

test("inline: bold, code, italic, link — output is escaped", () => {
  assert.equal(inline("**b** `c` *i* [x](/y) <s>"), '<strong>b</strong> <code>c</code> <em>i</em> <a href="/y">x</a> &lt;s&gt;');
});

test("inline: markdown syntax cannot smuggle attributes through escaping", () => {
  const out = inline('[x](/y"onmouseover="alert(1))');
  // the injected quote must be entity-escaped — no raw quotes inside the href
  assert.match(out, /href="\/y&quot;/);
  assert.equal((out.match(/"/g) || []).length, 2, "raw quotes only delimit href, never inside it");
});
