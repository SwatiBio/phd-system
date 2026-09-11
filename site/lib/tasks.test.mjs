/* Black-box test for the task module (site/lib/tasks.js) — no network: the
   vault is a fake (in-memory map), which is the module's own dependency seam.
   Locks the recurring rule: a tick NEVER closes a recurring task (the run-1
   attendance mandate vanished that way); the due date rolls forward instead. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { FOLDER, STATUSES, isOpen, load, create, setStatus, advanceDate, parseTask } from "./tasks.js";

function fakeVault() {
  const files = new Map();     // path -> text
  const commits = [];          // audit of put() calls
  return {
    commits,
    async list(folder) {
      return [...files.keys()]
        .filter((p) => p.startsWith(folder + "/"))
        .map((p) => ({ name: p.slice(folder.length + 1), path: p, type: "file" }));
    },
    async get(path) { return files.has(path) ? { text: files.get(path) } : null; },
    async put(path, text, message) { files.set(path, text); commits.push({ path, text, message }); },
  };
}

test("create writes a frontmatter file with a slug derived from the title", async () => {
  const v = fakeVault();
  const t = await create(v, { title: "Draft DAC report", due: "2027-08-25", recurring: "every 6 months" });
  assert.equal(t.path, `${FOLDER}/draft-dac-report.md`);
  assert.equal(t.status, "todo");
  assert.equal(t.recurring, "6 months");
  assert.match(v.commits[0].text, /^---\ntitle: Draft DAC report\nstatus: todo\ndue: 2027-08-25\nrecurring: 6 months\n---/);
});

test("create de-duplicates slugs instead of overwriting", async () => {
  const v = fakeVault();
  await create(v, { title: "Present at DAC" });
  const t2 = await create(v, { title: "Present at DAC" });
  assert.equal(t2.slug, "present-at-dac-2");
  assert.equal((await load(v)).length, 2);
});

test("load parses tasks and sorts by due date, undated last", async () => {
  const v = fakeVault();
  await create(v, { title: "B task", due: "2026-09-20" });
  await create(v, { title: "A task", due: "2026-09-19" });
  await create(v, { title: "C task" });
  const titles = (await load(v)).map((t) => t.title);
  assert.deepEqual(titles, ["A task", "B task", "C task"]);
});

test("setStatus done closes a plain task; reopen keeps its due date", async () => {
  const v = fakeVault();
  const t = await create(v, { title: "Set real registration date", due: "2026-10-15" });
  assert.ok(isOpen(t));
  const done = await setStatus(v, t, "done", "2026-09-16");
  assert.equal(done.status, "done");
  assert.equal(done.due, "2026-10-15");
  const reopened = await setStatus(v, done, "todo", "2026-09-16");
  assert.equal(reopened.status, "todo");
  assert.equal(reopened.due, "2026-10-15");
});

test("a tick on a recurring task rolls the due date and never closes it", async () => {
  const v = fakeVault();
  const t = await create(v, { title: "Check conference tracker", due: "2026-10-01", recurring: "every month" });
  const ticked = await setStatus(v, t, "done", "2026-09-16");
  assert.equal(ticked.status, "todo");
  assert.equal(ticked.due, "2026-11-01");
});

test("an overdue recurring tick rolls until the task is due today or later", async () => {
  const v = fakeVault();
  const t = await create(v, { title: "Record attendance", due: "2026-09-01", recurring: "day" });
  const ticked = await setStatus(v, t, "done", "2026-09-16");
  assert.equal(ticked.due, "2026-09-16");
});

test("month-end clamp: 31 Jan + 1 month = 28 Feb", () => {
  assert.equal(advanceDate("2027-01-31", 1, "month"), "2027-02-28");
});

test("parseTask survives CRLF and falls back to todo for a bad status", () => {
  const t = parseTask(`${FOLDER}/x.md`, "---\r\ntitle: X\r\nstatus: wip\r\n---\r\n\r\nnotes here\r\n");
  assert.equal(t.status, "todo");
  assert.equal(t.notes, "notes here");
  assert.equal(t.due, null);
});

test("status vocabulary is the one object model: 5 states, open/closed split", () => {
  assert.deepEqual(STATUSES, ["backlog", "todo", "in-progress", "done", "cancelled"]);
  assert.deepEqual(STATUSES.filter((s) => isOpen({ status: s })), ["backlog", "todo", "in-progress"]);
});
