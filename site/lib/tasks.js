/* Task-file parsing, shared by index.html and tasks.html.
   Format (daily/tasks/tasks.md):
     - [ ] text 📅 2026-10-15          due date
     - [ ] text 🔁 every 6 months 📅 … recurring
   `text` is cleaned for display: due date, task glyphs and the "every …"
   phrase are removed (the recurring flag carries that instead). Em dashes and
   en dashes are kept — only emoji/symbol ranges are stripped. */

const TASK_GLYPHS = /[\u{1F000}-\u{1FAFF}\u2700-\u27BF\u2B00-\u2BFF\uFE0F]/gu;

export function parseTasks(text) {
  const out = [];
  let section = null;
  for (const line of text.split("\n")) {
    const h = line.match(/^## (.+)$/);
    if (h) { section = h[1].trim(); continue; }
    const m = line.match(/^- \[( |x)\] (.+)$/);
    if (!m) continue;
    const dates = m[2].match(/\d{4}-\d{2}-\d{2}/g) || [];
    out.push({
      done: m[1] === "x",
      text: m[2]
        .replace(/\s*\d{4}-\d{2}-\d{2}/g, "")     // due date
        .replace(TASK_GLYPHS, "")                  // 📅 🔁 ✅ … but not em/en dashes
        .replace(/\s*every\b.*$/i, "")             // the recurring badge says this
        .replace(/\s{2,}/g, " ")
        .trim(),
      due: dates.length ? dates[dates.length - 1] : null,
      recurring: /every/i.test(m[2]),
      section,
      raw: line,
    });
  }
  return out;
}

/* Ticking a task = flipping its own line, then committing the whole file. */
export function withTaskDone(text, raw, done = true) {
  return text
    .split("\n")
    .map((l) => (l === raw ? l.replace(done ? "- [ ]" : "- [x]", done ? "- [x]" : "- [ ]") : l))
    .join("\n");
}
