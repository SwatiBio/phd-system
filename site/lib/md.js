/* md.js — markdown renderer for the site.
   Deep module: pages hand it raw markdown, it returns DOM nodes.
   Supports: h1/h2/h3 (h1 skipped — the page shows the title in its own
   header), tables, ul, checklists (- [ ] / - [x]), rules, emphasis lines,
   inline bold/code/links. Used by review.html and report.html. */

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const inline = (s) => esc(s)
  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  .replace(/`([^`]+)`/g, "<code>$1</code>")
  .replace(/\*([^*]+)\*/g, "<em>$1</em>")
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

function el(tag, html) {
  const n = document.createElement(tag);
  n.innerHTML = html;
  return n;
}

/* render(md) -> Node[] — one node per block (heading, list, table, rule, paragraph) */
export function render(md) {
  const out = [];
  let list = null, table = null; // list: "ul" | "checklist"
  const close = () => { list = null; table = null; };
  for (const line of md.split("\n")) {
    if (line.startsWith("### ")) { close(); out.push(el("h3", esc(line.slice(4)))); }
    else if (line.startsWith("## ")) { close(); out.push(el("h2", esc(line.slice(3)))); }
    else if (line.startsWith("# ")) { close(); }              // file title duplicates the page h1
    else if (line.trim() === "---") { close(); out.push(el("hr", "")); }
    else if (line.startsWith("|")) {
      if (/^\|[\s:|-]+$/.test(line)) continue;               // separator row
      if (!table) { table = document.createElement("table"); table.className = "grid"; out.push(table); }
      const tr = document.createElement("tr");
      const tag = table.firstChild ? "td" : "th";
      for (const cell of line.split("|").slice(1, -1)) tr.appendChild(el(tag, inline(cell.trim())));
      table.appendChild(tr);
    }
    else if (/^- \[[ x]\] /.test(line)) {
      table = null;
      if (!list) { list = document.createElement("ul"); list.className = "checklist"; out.push(list); }
      const done = line.startsWith("- [x] ");
      const li = document.createElement("li");
      if (done) li.classList.add("done");
      li.innerHTML = inline(line.replace(/^- \[[ x]\] /, ""));
      list.appendChild(li);
    }
    else if (line.startsWith("- ")) {
      table = null;
      if (list !== "ul") { close(); list = document.createElement("ul"); out.push(list); }
      const li = document.createElement("li"); li.innerHTML = inline(line.slice(2)); list.appendChild(li);
      list = "ul";
    }
    else if (/^\*.+\*$/.test(line.trim()) && line.trim().length > 2) {
      close(); out.push(el("p", `<span class="em">${inline(line.trim().replace(/^\*|\*$/g, ""))}</span>`));
    }
    else if (line.trim()) { close(); out.push(el("p", inline(line))); }
  }
  return out;
}
