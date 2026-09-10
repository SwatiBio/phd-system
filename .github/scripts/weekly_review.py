#!/usr/bin/env python3
"""Weekly review prep — gather the week into one review-ready page.

Deterministic: it collects and counts, it does not summarise or judge. The
verdicts (Step 3 of the weekly-review skill) happen with pi in chat.

Writes daily/reviews/<ISO-week>.md and daily/reviews/latest.md.
Log files are one per ISO week (daily/logs/2026-W37.md).

Run locally:  uv run --no-project .github/scripts/weekly_review.py
              uv run --no-project .github/scripts/weekly_review.py --date 2026-09-13
"""
import argparse
import datetime as dt
import os
import re

LOGS = "daily/logs"
TASKS = "daily/tasks/tasks.md"
MEETINGS = "daily/meetings"
OUT = "daily/reviews"
ISO = "%Y-%m-%d"


def read(path):
    return open(path, encoding="utf-8").read() if os.path.exists(path) else ""


WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def nice(d):
    """Locale- and platform-proof short date (no zero padding)."""
    return f"{WD[d.weekday()]} {d.day} {MO[d.month - 1]}"


def week_window(day):
    """Monday of the current ISO week through `day`."""
    return day - dt.timedelta(days=day.weekday()), day


def week_key(day):
    """The log file name for a week: daily/logs/2026-W37.md (ISO week)."""
    y, w, _ = day.isocalendar()
    return f"{y}-W{w:02d}"


def logged_days(day):
    """{date: [log lines]} from THIS week's file — one file per ISO week, so there is
    no window to filter and no month boundary to straddle. Newest day first."""
    days, current = {}, None
    for raw in read(f"{LOGS}/{week_key(day)}.md").split(chr(10)):
        head = re.match(r"^## (\d{4}-\d{2}-\d{2})\s*$", raw.strip())
        if head:
            current = head.group(1)
            days[current] = []
            continue
        if current and raw.startswith("- "):
            days[current].append(raw.rstrip())
    return dict(sorted(days.items(), reverse=True))


def tasks():
    out = []
    for line in read(TASKS).split("\n"):
        m = re.match(r"^- \[( |x)\] (.+)$", line)
        if not m:
            continue
        dates = re.findall(r"\d{4}-\d{2}-\d{2}", m[2])
        text = re.split(r"\s*\d{4}-\d{2}-\d{2}", m[2])[0]
        text = re.sub(r"[^\x00-\x7F]+\s*$", "", text).strip()
        out.append({
            "done": m[1] == "x",
            "text": text,
            "due": dates[-1] if dates else None,
            "recurring": "every" in m[2].lower(),
        })
    return out


def tagged(days, tag):
    hits = []
    for date, lines in days.items():
        for line in lines:
            if tag in line:
                hits.append((date, re.sub(r"^- \*\*\d{2}:\d{2}\*\*\s*", "", line).strip()))
    return hits


def rough_piles(day):
    """Open (unstruck) fragments in this month's meeting pile."""
    path = f"{MEETINGS}/rough-{day.strftime('%Y-%m')}.md"
    text = read(path)
    if not text:
        return path, 0
    frags = [f.strip() for f in re.split(r"^---\s*$", text, flags=re.M)]
    open_frags = [f for f in frags if f and not f.startswith("#") and not f.startswith("~~")]
    return path, len(open_frags)


def build(day):
    start, end = week_window(day)
    days = logged_days(day)
    all_tasks = tasks()
    entries = sum(len(v) for v in days.values())
    done = [t for t in all_tasks if t["done"] and t["due"] and start.strftime(ISO) <= t["due"] <= end.strftime(ISO)]
    overdue = [t for t in all_tasks if not t["done"] and t["due"] and t["due"] < day.strftime(ISO)]
    questions, ideas = tagged(days, "#question"), tagged(days, "#idea")
    pile_path, pile_open = rough_piles(day)

    L = []
    L.append(f"# Week {day.isocalendar()[1]} · {nice(start)} – {nice(end)} {end.year}")
    L.append("")
    L.append(f"*Prepared {dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d %H:%M')} UTC by the weekly-review job. "
             f"Verdicts are made with pi — nothing here is decided.*")
    L.append("")
    L.append("## The week in numbers")
    L.append("")
    L.append(f"- **{len(days)}** day{'s' if len(days) != 1 else ''} logged · **{entries}** entr{'ies' if entries != 1 else 'y'}"
             f" · **{len(done)}** task{'s' if len(done) != 1 else ''} done · **{len(overdue)}** overdue")
    L.append(f"- **{len(questions)}** open question{'s' if len(questions) != 1 else ''} · "
             f"**{len(ideas)}** idea{'s' if len(ideas) != 1 else ''} · "
             f"**{pile_open}** rough fragment{'s' if pile_open != 1 else ''} awaiting refinement")
    L.append("")
    L.append("## What you did")
    L.append("")
    if not days:
        L.append("*No entries this week. That is data, not a failure.*")
    for date, lines in days.items():
        L.append(f"### {nice(dt.datetime.strptime(date, ISO).date())}")
        L.append("")
        L.extend(lines or ["*(logged, nothing written)*"])
        L.append("")
    L.append("## What slipped")
    L.append("")
    if overdue:
        for t in sorted(overdue, key=lambda x: x["due"]):
            late = (day - dt.datetime.strptime(t["due"], ISO).date()).days
            L.append(f"- {t['text']} — due {t['due']} ({late} day{'s' if late != 1 else ''} late)")
    else:
        L.append("- Nothing overdue.")
    L.append("")
    L.append(f"## Open questions ({len(questions)})")
    L.append("")
    L.extend([f"- {txt}  ·  {date}" for date, txt in questions] or ["- None this week."])
    L.append("")
    L.append(f"## Ideas ({len(ideas)})")
    L.append("")
    L.extend([f"- {txt}  ·  {date}" for date, txt in ideas] or ["- None this week."])
    L.append("")
    rolled = [t for t in overdue if not t["recurring"]]
    L.append(f"## Rolled-over tasks ({len(rolled)})")
    L.append("")
    L.extend([f"- {t['text']} — due {t['due']}" for t in sorted(rolled, key=lambda x: x["due"])] or ["- None."])
    L.append("")
    L.append("## Rough pile")
    L.append("")
    L.append(f"- `{pile_path}` — {pile_open} open fragment{'s' if pile_open != 1 else ''} (refine with the refine-meeting skill, not here)")
    L.append("")
    L.append("---")
    L.append("")
    L.append("Verdicts to work with pi, one pile at a time: open questions -> ideas -> rolled-over tasks. "
             "Then the logbook for your guide, then next week's one thing.")
    L.append("")
    return "\n".join(L), f"{day.isocalendar()[0]}-W{day.isocalendar()[1]:02d}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", help="the day the review runs (default: today)")
    args = ap.parse_args()
    day = dt.datetime.strptime(args.date, ISO).date() if args.date else dt.date.today()

    body, label = build(day)
    os.makedirs(OUT, exist_ok=True)
    week_path = f"{OUT}/{label}.md"
    for path in (week_path, f"{OUT}/latest.md"):
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(body)
    print(f"wrote {week_path} and {OUT}/latest.md")


if __name__ == "__main__":
    main()
