/* reg + offset timeline maths, shared by index.html, timeline.html and review.html.
   The grammar lives in system/milestones/milestones.md:
     **Target:** reg + 3 days          (one date)
     **Targets:** reg + 6 months · reg + 12 months   (a series)
     **Done:** 2026-09-23              (complete: shown at its real date, skipped by "next")
   Keep the bold-label shape exact — `**Target: reg...**` silently matches nothing.
   Day identity/diff math belongs to day.js — don't re-derive it here. */
import { dayIso } from "./day.js";

/* CRLF-proof: git's autocrlf can hand us CRLF, and the frontmatter fence
   /^---\n/ would then never match, blanking the whole timeline. */
const norm = (t) => String(t).replace(/\r\n?/g, "\n");

export function addOffset(regIso, n, unit) {
  const d = new Date(regIso + "T12:00:00");
  if (unit === "day") d.setDate(d.getDate() + n);
  else if (unit === "week") d.setDate(d.getDate() + n * 7);
  else {
    const day = d.getDate();
    d.setDate(1);
    unit === "year" ? d.setFullYear(d.getFullYear() + n) : d.setMonth(d.getMonth() + n);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
  }
  return dayIso(d);
}

export function parseMilestones(text) {
  text = norm(text);
  const fm = text.match(/^---\n([\s\S]*?)\n---/);
  const reg = fm && (fm[1].match(/^reg:\s*(\d{4}-\d{2}-\d{2})/m) || [])[1];
  const note = fm && (fm[1].match(/^reg-note:\s*"?([^"\n]*)"?/m) || [])[1];
  const items = [];
  if (!reg) return { reg: null, note, items };
  for (const s of text.split(/^## /m).slice(1)) {
    const title = s.split("\n")[0].split("—")[0].replace(/^\d+ · /, "").trim();
    /* `**Done:** YYYY-MM-DD` marks the milestone complete: report the real
       completion date and flag it, so "next/upcoming" views skip it. A done
       section wins over its own Target line (the deadline no longer applies). */
    const done = (s.match(/^\*\*Done:\*\* (\d{4}-\d{2}-\d{2})/m) || [])[1];
    if (done) { items.push({ title, date: done, done: true }); continue; }
    const line = s.match(/^\*\*Targets?:\*\* (.+)$/m);
    if (!line) continue;
    for (const t of line[1].matchAll(/reg\s*\+\s*(\d+)\s*(day|week|month|year)/gi))
      items.push({ title, date: addOffset(reg, Number(t[1]), t[2].toLowerCase()) });
  }
  items.sort((a, b) => a.date.localeCompare(b.date));
  return { reg, note, items };
}
