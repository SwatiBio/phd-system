/* Task module — one file per task in daily/tasks/.
 *
 * Deep module: pages ask for tasks and state changes; the file layout, YAML
 * frontmatter, slug naming, and the recurring roll-forward rule live here,
 * not in any page.
 *
 * Object model (docs/business-logic.md):
 *   Task = title, status, due?, recurring?, notes
 *   status: backlog | todo | in-progress | done | cancelled
 *   Ticking a recurring task never closes it — the due date rolls forward
 *   by its interval instead.
 *
 * Interface (everything a caller must know):
 *   FOLDER                      where task files live ("daily/tasks")
 *   STATUSES                    the status vocabulary, in display order
 *   isOpen(task)                backlog/todo/in-progress (i.e. not done/cancelled)
 *   load(vault) → Task[]        every task file, sorted by due then title
 *   create(vault, {title, due?, recurring?, status?, notes?}) → Task
 *   setStatus(vault, task, status, todayIso?) → Task
 *                               `done` on a recurring task rolls the due date
 *                               and keeps the task open (status -> todo)
 *   advanceDate(isoDate, n, unit)
 *
 * `vault` is a dependency the caller supplies (the real one is site/lib/vault.js;
 * tests pass a fake — accept dependencies, don't create them):
 *   list(folder) → [{ path }]        files in the folder
 *   get(path)    → { text } | null
 *   put(path, text, message)
 *
 * Task shape: { path, slug, title, status, due, recurring, notes }
 *   recurring is a canonical interval string: "day" | "week" | "6 months" | …
 *   (no "every" prefix; parsed by ROLL below)
 */

export const FOLDER = "daily/tasks";
export const STATUSES = ["backlog", "todo", "in-progress", "done", "cancelled"];
const OPEN = new Set(["backlog", "todo", "in-progress"]);
export const isOpen = (t) => OPEN.has(t.status);

const TASK_GLYPHS = /[\u{1F000}-\u{1FAFF}\u2700-\u27BF\u2B00-\u2BFF\uFE0F]/gu;
const ROLL = /^(\d+ )?(day|week|month|year)(?:s)?$/i;

/* git's autocrlf can hand us CRLF; the parsers below are line-based and `.`
   never matches \r, so a CRLF file would silently parse as zero tasks. */
const norm = (t) => String(t).replace(/\r\n?/g, "\n");

const localIso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* "every 6 months" (old syntax, CMS hints) -> "6 months"; junk -> null. */
function normRecurring(s) {
  if (!s) return null;
  const m = String(s).replace(TASK_GLYPHS, "").trim().replace(/^every\s+/i, "").match(ROLL);
  return m ? `${m[1] || ""}${m[2].toLowerCase()}${m[1] ? "s" : ""}` : null;
}

/* Flat `key: value` frontmatter only — no nesting, so the parser stays trivial
   and testable. Notes are the body. */
export function parseTask(path, text) {
  const t = norm(text);
  const fm = t.match(/^---\n([\s\S]*?)\n---\n?/);
  const attrs = {};
  if (fm) {
    for (const line of fm[1].split("\n")) {
      const kv = line.match(/^([a-z-]+):\s*(.*)$/);
      if (kv && kv[2].trim() !== "") attrs[kv[1]] = kv[2].trim();
    }
  }
  return {
    path,
    slug: path.slice(FOLDER.length + 1).replace(/\.md$/, ""),
    title: attrs.title || "(untitled)",
    status: STATUSES.includes(attrs.status) ? attrs.status : "todo",
    due: /^\d{4}-\d{2}-\d{2}$/.test(attrs.due || "") ? attrs.due : null,
    recurring: normRecurring(attrs.recurring),
    notes: (fm ? t.slice(fm[0].length) : t).replace(/^\s*\n/, "").trim(),
  };
}

function serialize(task) {
  const lines = ["---"];
  for (const [k, v] of [["title", task.title], ["status", task.status], ["due", task.due], ["recurring", task.recurring]]) {
    if (v !== null && v !== undefined && v !== "") lines.push(`${k}: ${v}`);
  }
  lines.push("---", "");
  const notes = (task.notes || "").trim();
  return lines.join("\n") + (notes ? `${notes}\n` : "");
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

/* Recurring roll: advance by the interval; if the result lands in the past
   (an overdue daily), keep rolling until it is due today or later. */
function rollRecurring(due, recurring, todayIso) {
  const m = recurring.match(ROLL);
  const n = m[1] ? Number(m[1].trim()) : 1;
  const unit = m[2].toLowerCase();
  const today = todayIso || localIso(new Date());
  let next = advanceDate(due, n, unit);
  let guard = 0;
  while (next < today && guard++ < 500) next = advanceDate(next, n, unit);
  return next;
}

const slugify = (s) =>
  String(s).toLowerCase().match(/[\p{L}\p{N}]+/gu)?.join("-").slice(0, 60) || "task";

const byDue = (a, b) =>
  (a.due || "9999-12-31").localeCompare(b.due || "9999-12-31") || a.title.localeCompare(b.title);

export async function load(vault) {
  const files = await vault.list(FOLDER);
  const tasks = await Promise.all(
    files.map(async (f) => {
      const r = await vault.get(f.path);
      return r ? parseTask(f.path, r.text) : null;
    })
  );
  return tasks.filter(Boolean).sort(byDue);
}

/* Adding a task = a new slug-named file, so nobody has to remember any syntax. */
export async function create(vault, { title, due = null, recurring = null, status = "todo", notes = "" }) {
  const base = slugify(title);
  const existing = new Set((await vault.list(FOLDER)).map((f) => f.name.replace(/\.md$/, "")));
  let slug = base;
  for (let i = 2; existing.has(slug); i++) slug = `${base}-${i}`;
  const task = {
    path: `${FOLDER}/${slug}.md`,
    slug,
    title: String(title).trim(),
    status: STATUSES.includes(status) ? status : "todo",
    due: /^\d{4}-\d{2}-\d{2}$/.test(due || "") ? due : null,
    recurring: normRecurring(recurring),
    notes: String(notes || "").trim(),
  };
  await vault.put(task.path, serialize(task), `task created: ${task.title}`);
  return task;
}

/* State changes. The transition table lives here so pages can't drift from it:
   - `done` on a recurring task rolls the due date forward and stays open (todo)
     — that is how the attendance mandate once vanished from the file.
   - reopening (done/cancelled -> todo) keeps the due date untouched. */
export async function setStatus(vault, task, status, todayIso = null) {
  const next = { ...task, status };
  if (status === "done" && task.recurring) {
    next.status = "todo";
    next.due = rollRecurring(task.due || todayIso || localIso(new Date()), task.recurring, todayIso);
  }
  await vault.put(task.path, serialize(next), `task ${next.status}: ${task.title}`);
  return next;
}
