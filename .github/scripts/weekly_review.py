#!/usr/bin/env python3
"""Weekly review prep — gather the week into one review-ready page.

Deterministic: it collects and counts, it does not summarise or judge. The
verdicts (Step 3 of the weekly-review skill) happen with pi in chat.

Writes daily/reviews/<ISO-week>.md and daily/reviews/latest.md.
Log files are one per ISO week (daily/logs/2026-W37.md).

The interface is "vault state -> review file": week stats plus two
suggestion piles grown from the reading residue (PHDOS-49, all counting,
never a verdict — approval is always human):

  - Concept promotion candidates: a tag that appeared on tagged highlights
    in >= threshold papers and does not name a concept yet. A tag becomes a
    concept when it earns a description; approving creates
    research/concepts/<slug>.md (Q5 workflow) — papers link via the shared
    slug, zero relinking.
  - Concept link suggestions: pairs of existing concepts sharing >=
    threshold papers, minus edges already declared in related-concepts.
    Two papers sharing a tag is evidence, not a verdict — nothing links
    automatically.

Run locally:  uv run --no-project .github/scripts/weekly_review.py
              uv run --no-project .github/scripts/weekly_review.py --date 2026-09-13
"""
import argparse
import datetime as dt
import os
import re

LOGS = "daily/logs"
TASKS = "daily/tasks"  # one file per task, YAML frontmatter
MEETINGS = "daily/meetings"
OUT = "daily/reviews"
PAPERS = "research/papers"        # paper notes, YAML frontmatter + Highlights
CONCEPTS = "research/concepts"    # one file per concept, slug = file name
ISO = "%Y-%m-%d"

PROMOTION_THRESHOLD = 3  # papers a tag must appear on to be flagged
LINK_THRESHOLD = 2       # shared papers two concepts need to be suggested


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


OPEN_STATUSES = ("backlog", "todo", "in-progress")


def tasks():
    """Every task file in daily/tasks/. Mirrors parseTask in site/lib/tasks.js:
    flat `key: value` frontmatter, status is the state field, done/cancelled
    are the closed states."""
    out = []
    if not os.path.isdir(TASKS):
        return out
    for name in sorted(os.listdir(TASKS)):
        if not name.endswith(".md"):
            continue
        text = read(f"{TASKS}/{name}")
        fm = re.match(r"^---\n(.*?)\n---", text, re.S)
        attrs = dict(re.findall(r"^([a-z-]+):\s*(.+)$", fm.group(1), re.M)) if fm else {}
        due = attrs.get("due", "")
        status = attrs.get("status", "todo")
        out.append({
            "title": attrs.get("title", name[:-3]),
            "status": status,
            "open": status in OPEN_STATUSES,
            "due": due if re.match(r"^\d{4}-\d{2}-\d{2}$", due) else None,
            "recurring": bool(attrs.get("recurring")),
        })
    return out


# --------------------------------------------------------------- vault state

def list_md(folder, skip_prefix="digest-"):
    """Sorted .md file names in a vault folder (digest-* is generated, not a paper)."""
    if not os.path.isdir(folder):
        return []
    return sorted(f for f in os.listdir(folder)
                  if f.endswith(".md") and not f.startswith(skip_prefix))


def slug_of(name):
    """paper.md / concept.md -> the shared slug (file name without .md)."""
    return name[:-3].lower()


def frontmatter(text):
    """Flat frontmatter attrs; empty values swallow a following block list
    (`concepts:\n  - a` -> {concepts: ["a"]})."""
    fm = re.match(r"^---\n(.*?)\n---", text, re.S)
    attrs = {}
    if not fm:
        return attrs
    lines = fm.group(1).splitlines()
    i = 0
    while i < len(lines):
        kv = re.match(r"^([a-z-]+):\s*(.*)$", lines[i])
        if not kv:
            i += 1
            continue
        if kv.group(2).strip():
            attrs[kv.group(1)] = kv.group(2).strip()
            i += 1
            continue
        items, j = [], i + 1
        while j < len(lines) and re.match(r"^\s+-\s*", lines[j]):
            items.append(re.sub(r"^\s+-\s*", "", lines[j]).strip().strip('"').strip("'"))
            j += 1
        attrs[kv.group(1)] = items if items else ""
        i = j
    return attrs


def parse_list(value):
    """`[]` / `[a, b]` / already-a-list -> python list of slugs."""
    if isinstance(value, list):
        return value
    s = (value or "").strip()
    if not s or s == "[]":
        return []
    return [x.strip().strip('"').strip("'") for x in s.strip("[]").split(",") if x.strip()]


def highlight_tags(text):
    """Tags on this paper's tagged highlights — the `#tag` tokens in each
    highlight's `_<small>...</small>` metadata line (zotero_import.py writes
    them). Untagged highlights carry no tags: excluded by design."""
    m = re.search(r"(?ms)^## Highlights\s*\n(.*?)(?=^## |\Z)", text)
    tags = set()
    if not m:
        return tags
    for meta in re.findall(r"_<small>(.*?)</small>", m.group(1)):
        tags.update(t.lower() for t in re.findall(r"#([a-z0-9_-]+)", meta, re.I))
    return tags


def load_papers():
    papers = []
    for name in list_md(PAPERS):
        text = read(f"{PAPERS}/{name}")
        attrs = frontmatter(text)
        title = attrs.get("title", slug_of(name))
        papers.append({
            "slug": slug_of(name),
            "title": title.strip('"').strip("'"),
            "tags": highlight_tags(text),
            "concepts": {c.lower() for c in parse_list(attrs.get("concepts", ""))},
        })
    return papers


def load_concepts():
    """(slugs, existing related-concepts edges) from research/concepts/."""
    slugs, edges = set(), set()
    for name in list_md(CONCEPTS):
        slug = slug_of(name)
        slugs.add(slug)
        attrs = frontmatter(read(f"{CONCEPTS}/{name}"))
        for other in parse_list(attrs.get("related-concepts", "")):
            edges.add(tuple(sorted((slug, other.lower()))))
    return slugs, edges


def promotion_candidates(papers, concept_slugs, threshold=PROMOTION_THRESHOLD):
    """[(tag, [paper slugs])] — tags on tagged highlights in >= threshold
    distinct papers that do not name a concept yet. Sorted by paper count
    desc, then tag. Pure counting: whether to promote is a human verdict."""
    tag_papers = {}
    for p in papers:
        for t in p["tags"]:
            tag_papers.setdefault(t, set()).add(p["slug"])
    out = [(tag, sorted(slugs)) for tag, slugs in tag_papers.items()
           if tag not in concept_slugs and len(slugs) >= threshold]
    out.sort(key=lambda x: (-len(x[1]), x[0]))
    return out


def concept_link_suggestions(papers, concept_slugs, existing_edges, threshold=LINK_THRESHOLD):
    """[((a, b), [paper slugs])] — concept pairs sharing >= threshold papers
    (papers' concepts field), minus edges already declared. Sorted by shared
    count desc, then pair. Pure counting: nothing links automatically."""
    existing_edges = {tuple(sorted(e)) for e in existing_edges}
    pair_papers = {}
    for p in papers:
        cs = sorted(c for c in p["concepts"] if c in concept_slugs)
        for i in range(len(cs)):
            for j in range(i + 1, len(cs)):
                pair_papers.setdefault((cs[i], cs[j]), set()).add(p["slug"])
    out = [(pair, sorted(slugs)) for pair, slugs in pair_papers.items()
           if pair not in existing_edges and len(slugs) >= threshold]
    out.sort(key=lambda x: (-len(x[1]), x[0]))
    return out

# ------------------------------------------------------------------ the week

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


def build(day, promotion_threshold=PROMOTION_THRESHOLD, link_threshold=LINK_THRESHOLD):
    start, end = week_window(day)
    days = logged_days(day)
    all_tasks = tasks()
    entries = sum(len(v) for v in days.values())
    done = [t for t in all_tasks if not t["open"] and t["due"] and start.strftime(ISO) <= t["due"] <= end.strftime(ISO)]
    overdue = [t for t in all_tasks if t["open"] and t["due"] and t["due"] < day.strftime(ISO)]
    questions, ideas = tagged(days, "#question"), tagged(days, "#idea")
    pile_path, pile_open = rough_piles(day)

    # suggestion piles from the vault state (counting only, PHDOS-49)
    papers = load_papers()
    concept_slugs, existing_edges = load_concepts()
    promotions = promotion_candidates(papers, concept_slugs, promotion_threshold)
    link_suggestions = concept_link_suggestions(papers, concept_slugs, existing_edges, link_threshold)

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
            L.append(f"- {t['title']} — due {t['due']} ({late} day{'s' if late != 1 else ''} late)")
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
    L.extend([f"- {t['title']} — due {t['due']}" for t in sorted(rolled, key=lambda x: x["due"])] or ["- None."])
    L.append("")
    L.append("## Rough pile")
    L.append("")
    L.append(f"- `{pile_path}` — {pile_open} open fragment{'s' if pile_open != 1 else ''} (refine with the refine-meeting skill, not here)")
    L.append("")
    L.append(f"## Concept promotion candidates ({len(promotions)}, threshold: {promotion_threshold}+ papers)")
    L.append("")
    if promotions:
        for tag, slugs in promotions:
            L.append(f"- `#{tag}` — {len(slugs)} paper{'s' if len(slugs) != 1 else ''}: {', '.join(slugs)}")
        L.append("")
        L.append("  Approving promotes a tag to a concept: it earns a description and "
                 "`research/concepts/<slug>.md` is created (Q5 workflow, applied with pi in chat). "
                 "Papers link via the shared slug — zero relinking. Not every tag graduates.")
    else:
        L.append("- None crossed the threshold this week.")
    L.append("")
    L.append(f"## Concept link suggestions ({len(link_suggestions)}, threshold: {link_threshold}+ shared papers)")
    L.append("")
    if link_suggestions:
        for (a, b), slugs in link_suggestions:
            L.append(f"- `{a}` + `{b}` — share {len(slugs)} paper{'s' if len(slugs) != 1 else ''}: {', '.join(slugs)}")
        L.append("")
        L.append("  Approving adds `related-concepts` between the two concept files. Two papers sharing "
                 "a tag does not mean the concepts connect — decide per suggestion, nothing links automatically.")
    else:
        L.append("- None this week.")
    L.append("")
    L.append("---")
    L.append("")
    L.append("Verdicts to work with pi, one pile at a time: open questions -> ideas -> rolled-over tasks -> "
             "concept promotion -> concept links. "
             "Then the logbook for your guide, then next week's one thing.")
    L.append("")
    return "\n".join(L), f"{day.isocalendar()[0]}-W{day.isocalendar()[1]:02d}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", help="the day the review runs (default: today)")
    ap.add_argument("--promotion-threshold", type=int, default=PROMOTION_THRESHOLD,
                    help="papers a tag must appear on to be flagged for promotion (default 3)")
    ap.add_argument("--link-threshold", type=int, default=LINK_THRESHOLD,
                    help="shared papers two concepts need to be suggested for linking (default 2)")
    args = ap.parse_args()
    day = dt.datetime.strptime(args.date, ISO).date() if args.date else dt.date.today()

    body, label = build(day, args.promotion_threshold, args.link_threshold)
    os.makedirs(OUT, exist_ok=True)
    week_path = f"{OUT}/{label}.md"
    for path in (week_path, f"{OUT}/latest.md"):
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(body)
    print(f"wrote {week_path} and {OUT}/latest.md")


if __name__ == "__main__":
    main()
