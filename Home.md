# 🎓 PhD Dashboard

> Dates are **PROVISIONAL** (reg = 2026-09-15) until the registration letter lands.

## ⏰ Next deadlines

```dataviewjs
const today = dv.date("today");
let rows = [];
for (const p of dv.pages('"daily/tasks"')) {
  for (const t of p.file.lists) {
    if (t.completed || !t.due) continue;
    const days = Math.round((t.due.ts - today.ts) / 86400000);
    const label = t.text.replace(/📅.*|🔁.*/g, "").trim();
    rows.push([days, t.due.toFormat("yyyy-MM-dd"), label]);
  }
}
rows.sort((a, b) => a[0] - b[0]);
dv.table(["", "date", "in", "milestone / task"],
  rows.slice(0, 6).map(([d, m, t]) => [
    d <= 7 ? "🔴" : (d <= 21 ? "🟡" : "⚪"),
    m,
    d === 1 ? "1 day" : `${d} days`,
    t
  ]));
```

## ✅ Today (top 5 — overdue formalities first)

```dataview
TASK
FROM "daily/tasks"
WHERE !completed
SORT due ASC
LIMIT 5
```

## 🔥 Streak

```dataviewjs
const counts = {};
for (const f of dv.pages('"daily/logs"').file) {
  const text = await dv.io.load(f.path);
  const days = text.match(/^## (\d{4}-\d{2}-\d{2})/gm) || [];
  for (const d of days) {
    const date = d.replace("## ", "");
    counts[date] = (counts[date] || 0) + 1;
  }
}
const dayList = Object.keys(counts).sort();
let streak = 0, lastTs = null;
const todayStr = dv.date("today").toFormat("yyyy-MM-dd");
for (const d of dayList) {
  const ts = dv.date(d).ts;
  if (lastTs !== null && (ts - lastTs) / 86400000 <= 2) streak++;
  else streak = 1;
  lastTs = ts;
}
if (!counts[todayStr] && lastTs !== null) {
  const gap = (dv.date(todayStr).ts - lastTs) / 86400000;
  if (gap > 1) streak = 0;
}
dv.paragraph(`**Current streak: ${streak} day${streak === 1 ? "" : "s"}** · ${dayList.length} days logged total`);
dv.paragraph(dayList.slice(-21).map(d => counts[d] ? "🟩" : "⬜").join(""));
```

## 📥 Rough pile awaiting refinement

```dataviewjs
const month = "rough-" + dv.date("today").toFormat("yyyy-MM");
const piles = dv.pages('"daily/meetings"').where(p => p.file.name.includes(month));
if (piles.length) {
  const text = await dv.io.load(piles.first().file.path);
  const frags = text.split(/^---$/m).map(s => s.trim()).filter(s => s && !s.startsWith("#"));
  const open = frags.filter(s => !s.startsWith("~~"));
  dv.paragraph(`Open fragments in this month's pile: **${open.length}**`);
} else dv.paragraph("No pile for this month yet.");
```

## 🔗 Quick links

- [[system/milestones/milestones|Milestones (full MAHE requirements)]] · [[daily/tasks/tasks|All tasks]] · [[SETUP|Setup checklist]] · [[later/publications/Publications|📚 Publications tracker]]
- Capture: `phd log "..."` in a terminal · or just tell the agent

## 🗂️ Where things live

- **daily/** — your touchpoints: logs · tasks · meeting rough piles
- **research/** — fills as PhD starts: materials · work-units · targets · papers · data
- **system/** — machinery I maintain: scripts · skills · templates · wayfinder · milestones
- **later/** — parked on purpose: writing · publications · money (designed just-in-time)
