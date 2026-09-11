/* The log file rule, in one place.
 *
 * A log file is ONE ISO WEEK: daily/logs/2026-W37.md, with a ## YYYY-MM-DD
 * section per day and `- **HH:MM** text #tags` entries under it.
 *
 * Why a module: static assets cannot list a directory, so every reader has to
 * compute the exact filename blind — the app writes it, the logbook opens it, and the weekly job reads it. Three call sites
 * inventing the same name is three chances to disagree. Cross this seam instead.
 *
 * ISO weeks (Monday start, week-year may differ from the calendar year) so the
 * name matches the print artefact `week-YYYY-Www.html` and Python's
 * datetime.isocalendar() in .github/scripts/weekly_review.py.
 */

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* git's autocrlf can hand us CRLF; every parser here is line-based. */
export const norm = (t) => String(t == null ? "" : t).replace(/\r\n?/g, "\n");

const pad = (n) => String(n).padStart(2, "0");
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/* Every entry point takes a Date OR an ISO date string. Callers hold both (the app
   has a Date, appendEntry has the day string), and one coercion here is cheaper
   than four chances to pass the wrong one. Noon avoids any timezone shift. */
const toDate = (x) => (x instanceof Date ? x : new Date(`${x}T12:00:00`));

/* Monday of the week containing `d`, as a local-midnight Date. */
export function weekStart(d) {
  const base = toDate(d);
  const x = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/* ISO 8601 week-year and week number (matches Python's isocalendar()). */
export function isoWeek(d) {
  const b = toDate(d);
  const date = new Date(Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()));
  const dayNum = date.getUTCDay() || 7;              // Mon=1 … Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);   // the Thursday of this week
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return { year: date.getUTCFullYear(), week: Math.ceil(((date - yearStart) / 86400000 + 1) / 7) };
}

export const weekKey = (d) => {
  const { year, week } = isoWeek(d);
  return `${year}-W${pad(week)}`;
};

export const weekPath = (d) => `daily/logs/${weekKey(d)}.md`;

/* The seven ISO dates of the week starting at `monday`. */
export function weekDays(monday) {
  const m = toDate(monday);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(m.getFullYear(), m.getMonth(), m.getDate());
    d.setDate(d.getDate() + i);
    out.push(iso(d));
  }
  return out;
}

/* "Week 37 · 7–13 Sep 2026" — the file's title and the logbook's label. */
export function weekLabel(d) {
  const mon = weekStart(d);
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  const span = mon.getMonth() === sun.getMonth()
    ? `${mon.getDate()}–${sun.getDate()} ${MON[mon.getMonth()]}`
    : `${mon.getDate()} ${MON[mon.getMonth()]} – ${sun.getDate()} ${MON[sun.getMonth()]}`;
  return `Week ${isoWeek(mon).week} · ${span} ${sun.getFullYear()}`;
}

/* File text -> { "YYYY-MM-DD": [{ time, text, tags }] } */
export function parseLog(text) {
  const days = {};
  let cur = null;
  for (const line of norm(text).split("\n")) {
    const h = line.match(/^## (\d{4}-\d{2}-\d{2})\s*$/);
    if (h) { cur = h[1]; days[cur] = days[cur] || []; continue; }
    if (!cur) continue;
    const e = line.match(/^- \*\*(\d{2}:\d{2})\*\* (.+)$/);
    if (!e) continue;
    days[cur].push({
      time: e[1],
      text: e[2].replace(/#\S+/g, "").trim(),
      tags: (e[2].match(/#\S+/g) || []).join(" "),
    });
  }
  return days;
}

/* The empty file for a week: frontmatter title (so the CMS list reads as weeks)
   and nothing else — day sections appear as they are written. */
export function newWeekText(d) {
  return `---\ntitle: "${weekLabel(d)}"\n---\n`;
}

/* One entry's raw text, from the textarea. The textarea is the source of truth,
   so the write path normalizes here: multi-line input collapses to a single line
   (newlines -> spaces, runs collapsed, trimmed) and the entry stays one
   `- **HH:MM** …` bullet — the shape every parser assumes. */
export function toEntryLineText(text) {
  return norm(text)
    .replace(/[ \t]*\n[ \t]*/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/* Append one already-formatted `- **HH:MM** …` line under `day`, creating the
   day section — or the whole file — if this is the first entry of the week. */
export function appendEntry(text, day, line) {
  const body = norm(text) || newWeekText(day);
  const heading = `## ${day}`;
  if (!body.includes(heading)) {
    return `${body.replace(/\s*$/, "\n")}\n${heading}\n\n${line}\n`;
  }
  const idx = body.indexOf(heading);
  const next = body.indexOf("\n## ", idx + 1);
  const at = next === -1 ? body.length : next;
  return body.slice(0, at).replace(/\s*$/, "\n") + line + "\n" + body.slice(at);
}
