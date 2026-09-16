import test from "node:test";
import assert from "node:assert/strict";
import { render } from "./md.js";

/* md.js runs against a DOM. The other lib tests avoid DOM entirely; here we
   stub a minimal document.createElement so render() can build nodes. */
const nodes = [];
const stubDocument = {
  createElement(tag) {
    const n = { tag, className: "", children: [], _html: "", classList: { add(c) { n.className += ` ${c}`; } } };
    Object.defineProperty(n, "innerHTML", {
      get: () => n._html,
      set: (v) => { n._html = v; },
    });
    Object.defineProperty(n, "firstChild", { get: () => n.children[0] || null });
    n.appendChild = (c) => n.children.push(c);
    return n;
  },
};
globalThis.document = stubDocument;

test("md: headings, h1 skipped, paragraphs and emphasis", () => {
  const out = render("# Title\n## Section\nplain line\n*emphasised line*");
  assert.equal(out.length, 3);
  assert.equal(out[0].tag, "h2");
  assert.equal(out[0]._html, "Section");
  assert.equal(out[1].tag, "p");
  assert.equal(out[1]._html, "plain line");
  assert.match(out[2]._html, /<span class="em">/);
});

test("md: checklist items map to a checklist ul", () => {
  const out = render("- [ ] todo\n- [x] done");
  assert.equal(out.length, 1);
  assert.equal(out[0].tag, "ul");
  assert.match(out[0].className, /checklist/);
  assert.match(out[0].children[1].className, /done/);
});

test("md: table builds th row first then td", () => {
  const out = render("| a | b |\n|---|---|\n| 1 | 2 |");
  assert.equal(out.length, 1);
  const t = out[0];
  assert.equal(t.children[0].tag, "tr");
  assert.equal(t.children[0].children[0].tag, "th");
  assert.equal(t.children[1].children[0].tag, "td");
});

test("md: plain list followed by checklist does not crash", () => {
  const out = render("- plain item\n- [ ] todo");
  assert.equal(out.length, 2);
  assert.equal(out[0].tag, "ul");
  assert.equal(out[1].tag, "ul");
  assert.match(out[1].className, /checklist/);
});

test("md: inline bold, code, link, escaping", () => {
  const out = render("**b** and `c` and [x](/y) and <script>");
  assert.match(out[0]._html, /<strong>b<\/strong>/);
  assert.match(out[0]._html, /<code>c<\/code>/);
  assert.match(out[0]._html, /<a href="\/y">x<\/a>/);
  assert.match(out[0]._html, /&lt;script&gt;/);
});
