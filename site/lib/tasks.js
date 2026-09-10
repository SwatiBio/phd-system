/* Task-file parsing, shared by index.html and tasks.html.
   Format (daily/tasks/tasks.md):
     - [ ] text 📅 2026-10-15          due date
     - [ ] text 🔁 every 6 months 📅 … recurring
   `text` is cleaned for display: due date, task glyphs and the "every …"
   phrase are removed (the recurring flag carries that instead). Em dashes and
   en dashes are kept — only emoji/symbol ranges are stripped. */

const TASK_GLYPHS = /[\u{1F000}-\u{1FAFF}\u2700-\u27BF\u2B00-\u2BFF\uFE0F]/gu;
const DUE = "\u{1F4C5}";

/* git's autocrlf can hand us CRLF; the parsers below are line-based and `.`
   never matches \r, so a CRLF file would silently parse as zero tasks. */
const norm = (t) => String(t).replace(/\r\n?/g, "\n");

const localIso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function parseTasks(text) {
  const out = [];
  let section = null;
  for (const line of norm(text).split("\n")) {
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

/* Move a date-only ISO string forward, clamping month ends (31 Jan + 1 month = 28 Feb). */
export function advanceDate(isoDate, n, unit) {
  const d = new Date(isoDate + "T12:00:00");
  if (unit === "day") d.setDate(d.getDate() + n);
  else if (unit === "week") d.setDate(d.getDate() + n * 7);
  else {
    const day = d.getDate();
    d.setDate(1);
    unit === "year" ? d.setFullYear(d.getFullYear() + n) : d.setMonth(d.getMonth() + n);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
  }
  return localIso(d);
}

const replaceLine = (text, raw, fn) =>
  norm(text).split("\n").map((l) => (l === raw ? fn(l) : l)).join("\n");

/* Ticking a task, then committing the whole file.
   Recurring tasks must NOT close: `🔁 every day` ticked once would silently end
   the series (that is how the attendance mandate vanished). Instead the due date
   rolls forward by its interval and the task stays open. If the roll lands in the
   past (an overdue daily), keep rolling until it is due today or later. */
export function withTaskDone(text, raw, done = true, todayIso = null) {
  if (!done) return replaceLine(text, raw, (l) => l.replace("- [x]", "- [ ]"));

  const rec = raw.match(/every\s+(\d+)?\s*(day|week|month|year)s?/i);
  const due = (raw.match(/\d{4}-\d{2}-\d{2}/g) || []).pop();
  if (!rec || !due) return replaceLine(text, raw, (l) => l.replace("- [ ]", "- [x]"));

  const n = rec[1] ? Number(rec[1]) : 1;
  const unit = rec[2].toLowerCase();
  const today = todayIso || localIso(new Date());
  let next = advanceDate(due, n, unit);
  let guard = 0;
  while (next < today && guard++ < 500) next = advanceDate(next, n, unit);
  return replaceLine(text, raw, (l) => l.replace(due, next).replace("- [x]", "- [ ]"));
}

/* Adding a task = a correctly-formed line at the end of the Active section,
   so nobody has to remember the Tasks syntax. */
export function withTaskAdded(text, taskText, due = null) {
  const line = `- [ ] ${taskText.trim()}${due ? ` ${DUE} ${due}` : ""}`;
  const lines = norm(text).split("\n");
  const head = lines.findIndex((l) => /^##\s+active\b/i.test(l));
  if (head === -1) {
    return `${text.replace(/\s*$/, "")}\n\n## Active\n\n${line}\n`;
  }
  let end = lines.findIndex((l, i) => i > head && /^##\s/.test(l));
  if (end === -1) end = lines.length;
  let at = end;
  while (at > head + 1 && lines[at - 1].trim() === "") at--;   // sit with the items, not after the blanks
  lines.splice(at, 0, line);
  return lines.join("\n");
}
