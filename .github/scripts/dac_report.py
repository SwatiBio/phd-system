#!/usr/bin/env python3
"""Annexure 28 progress report assembler.

Reads from the vault (daily logs, work-units, publications, DAC files,
milestones) and produces a draft Annexure 28 in markdown + HTML.

Output:
    daily/reviews/dac-report-YYYY-MM.md   (editable source)
    daily/reviews/dac-report-YYYY-MM.html (print-ready)

Run locally:
    uv run .github/scripts/dac_report.py [--months 6] [--output-dir daily/reviews]
On Actions:
    workflow_dispatch or cron (7 days before each DAC)
"""
import argparse
import os
import re
import string
import sys
from datetime import datetime, timedelta

# sibling import
sys.path.insert(0, os.path.dirname(__file__))
from dac_reader import load_latest_dac, load_all_dacs, _parse_frontmatter

PAPERS_DIR = "research/papers"
WORKUNITS_DIR = "research/work-units"
LOGS_DIR = "daily/logs"
MILESTONES_FILE = "system/milestones/milestones.md"
PUBLICATIONS_DIR = "later/publications"
MEETINGS_DIR = "daily/meetings"


# ── helpers ────────────────────────────────────────────────────────────

def parse_fm(text):
    """Shared frontmatter parser — delegates to dac_reader's (handles
    multi-line list values). One parser at the frontmatter seam, not two."""
    fm, _ = _parse_frontmatter(text)
    return fm


def read_file(path):
    try:
        return open(path, encoding="utf-8").read()
    except FileNotFoundError:
        return ""


def list_dir(directory, ext=".md"):
    if not os.path.isdir(directory):
        return []
    return [f for f in os.listdir(directory) if f.endswith(ext)]


def iso_week_range(start_date, end_date):
    """Return list of ISO week filenames (YYYY-Www.md) covering the date range."""
    weeks = []
    d = start_date
    while d <= end_date:
        iso = d.isocalendar()
        wk = f"{iso[0]}-W{iso[1]:02d}"
        if wk not in weeks:
            weeks.append(wk)
        d += timedelta(days=7)
    return weeks


# ── data loaders ───────────────────────────────────────────────────────

def load_logs(months=6):
    """Load daily log entries from the past N months. Returns [{date, time, text, tags}]."""
    end = datetime.now()
    start = end - timedelta(days=months * 30)
    weeks = iso_week_range(start, end)
    entries = []
    for wk in weeks:
        path = os.path.join(LOGS_DIR, f"{wk}.md")
        text = read_file(path)
        if not text:
            continue
        current_date = ""
        for line in text.split("\n"):
            line = line.strip()
            if line.startswith("## "):
                current_date = line[3:].strip()
                continue
            # match log entry: - **HH:MM** text #tags
            m = re.match(r"^-\s+\*\*(\d{2}:\d{2})\*\*\s+(.+)$", line)
            if m:
                time_str = m.group(1)
                content = m.group(2)
                tags = re.findall(r"#(\w+)", content)
                entries.append({
                    "date": current_date,
                    "time": time_str,
                    "text": re.sub(r"#\w+", "", content).strip(),
                    "tags": tags,
                })
    return entries


def load_work_units():
    """Load all work-units. Returns [{id, question, type, status, body}]."""
    units = []
    for fn in list_dir(WORKUNITS_DIR):
        text = read_file(os.path.join(WORKUNITS_DIR, fn))
        if not text:
            continue
        fm = parse_fm(text)
        body = text.split("---", 2)[2] if text.count("---") >= 2 else ""
        units.append({**fm, "_body": body, "_slug": fn.replace(".md", "")})
    return units


def load_publications():
    """Load all publications (journal + conference). Returns [{title, status, type}]."""
    pubs = []
    for fn in list_dir(PUBLICATIONS_DIR):
        text = read_file(os.path.join(PUBLICATIONS_DIR, fn))
        if not text:
            continue
        fm = parse_fm(text)
        pubs.append({**fm, "_slug": fn.replace(".md", "")})
    return pubs


def load_milestones():
    """Parse milestones file for registration date. Returns {reg: YYYY-MM-DD}."""
    text = read_file(MILESTONES_FILE)
    if not text:
        return {}
    fm = parse_fm(text)
    return fm


def load_meetings_with_guide(start_date, end_date):
    """Count meetings in date range from meetings folder. Returns [{date, file}]."""
    meetings = []
    for fn in list_dir(MEETINGS_DIR):
        # meetings are named rough-YYYY-MM.md
        m = re.match(r"rough-(\d{4})-(\d{2})\.md", fn)
        if not m:
            continue
        ym = f"{m.group(1)}-{m.group(2)}"
        # check if in range
        if start_date.strftime("%Y-%m") <= ym <= end_date.strftime("%Y-%m"):
            meetings.append({"date": ym, "file": fn})
    return meetings


# ── section generators ─────────────────────────────────────────────────

def working_days_before(date_str, n):
    """MAHE deadline chain: the report must be with DAC members n working
    days (Mon-Fri, no holiday calendar) before the DAC meeting.
    Returns an ISO date string, or the input untouched if unparseable."""
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d")
    except (ValueError, TypeError):
        return date_str
    left = n
    while left > 0:
        d -= timedelta(days=1)
        if d.weekday() < 5:
            left -= 1
    return d.strftime("%Y-%m-%d")


def period_start(dac, months):
    """Annexure 28 covers work since the last DAC. Use the latest DAC date
    when one is known; fall back to the calendar window."""
    if dac and dac.get("date"):
        try:
            return datetime.strptime(dac["date"], "%Y-%m-%d")
        except ValueError:
            pass
    return datetime.now() - timedelta(days=months * 30)


def is_pre_phd(milestones):
    """Pre-PhD mode: the registration date is provisional or in the future.
    Until the real joining date lands in milestones.md, the monthly draft is
    a plain work report, not an Annexure 28 (no DAC exists yet)."""
    if "PROVISIONAL" in milestones.get("reg-note", "").upper():
        return True
    try:
        return datetime.strptime(milestones.get("reg", ""), "%Y-%m-%d") > datetime.now()
    except ValueError:
        return True


def write_outputs(md_content, output_dir, end):
    """Write markdown + print-ready HTML, return (md_path, html_path, words)."""
    word_count = len(md_content.split())
    os.makedirs(output_dir, exist_ok=True)
    md_path = os.path.join(output_dir, f"dac-report-{end.strftime('%Y-%m')}.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    print(f"  markdown: {md_path} ({word_count} words)")

    html_body = markdown_to_html(md_content)
    html_content = HTML_TEMPLATE.substitute(body=html_body)
    html_path = os.path.join(output_dir, f"dac-report-{end.strftime('%Y-%m')}.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"  html:     {html_path}")
    return md_path, html_path, word_count


def gen_title_page(milestones, dac, period=None):
    """Section 1: Title page."""
    scholar = os.environ.get("PHD_SCHOLAR_NAME", "[Scholar Name]")
    guide = os.environ.get("PHD_GUIDE_NAME", "[Guide Name]")
    dept = os.environ.get("PHD_DEPARTMENT", "[Department]")
    inst = os.environ.get("PHD_INSTITUTION", "[Institution]")
    reg = milestones.get("reg", "[Registration Date]")
    dac_date = dac.get("date", "[DAC Date]") if dac else "[DAC Date]"
    dac_num = dac.get("_slug", "").replace("dac-", "").replace("-", " / ") if dac else "[N]"
    share_by = working_days_before(dac_date, 7)
    start = period[0].strftime("%Y-%m-%d") if period else "[Start Date]"
    end = period[1].strftime("%Y-%m-%d") if period else "[End Date]"

    return f"""# Ph.D. Progress Report — {dac_num}

**Title:** [Thesis Title]

**Name of Ph.D. Scholar:** {scholar}
**Registration Number:** [Reg No.]
**Department:** {dept}
**Institution:** {inst}
**Place:** Manipal

**Under the Guidance of:**
{guide}
{dept}, {inst}

**DAC Date:** {dac_date}
**Period Covered:** {start} to {end}
**Share with DAC members by:** {share_by} (7 working days before the meeting)
"""


def gen_introduction(logs, work_units):
    """Section 2: Introduction — significance of work done."""
    # group entries by tag categories
    experiment_entries = [e for e in logs if "experiment" in e["tags"]]
    analysis_entries = [e for e in logs if "analysis" in e["tags"] or "data" in e["tags"]]
    reading_entries = [e for e in logs if "reading" in e["tags"]]

    sections = []
    if experiment_entries:
        sections.append(f"### Experimental work\n\n{len(experiment_entries)} experimental sessions were conducted during this period.")
    if analysis_entries:
        sections.append(f"### Data analysis\n\n{len(analysis_entries)} data analysis sessions were completed.")
    if reading_entries:
        sections.append(f"### Literature review\n\n{len(reading_entries)} reading sessions were conducted to review current literature.")

    if not sections:
        return "## Introduction\n\n[Describe the significance of the work done in the past six months.]\n"

    return "## Introduction\n\n" + "\n\n".join(sections) + "\n"


def gen_objectives(work_units):
    """Section 3: Objectives completed."""
    done = [wu for wu in work_units if wu.get("status") in ("done", "written-up")]
    running = [wu for wu in work_units if wu.get("status") == "running"]
    planned = [wu for wu in work_units if wu.get("status") == "planned"]

    lines = ["## Objectives\n"]
    if done:
        lines.append("**Completed:**")
        for wu in done:
            lines.append(f"- {wu.get('question', wu.get('id', '[unknown]'))}")
    if running:
        lines.append("\n**In progress:**")
        for wu in running:
            lines.append(f"- {wu.get('question', wu.get('id', '[unknown]'))}")
    if planned:
        lines.append("\n**Planned:**")
        for wu in planned:
            lines.append(f"- {wu.get('question', wu.get('id', '[unknown]'))}")
    if len(lines) == 1:
        lines.append("[List objectives completed during this period.]\n")
    return "\n".join(lines) + "\n"


def gen_dac_suggestions(dac):
    """Section 4: DAC suggestions from previous meeting."""
    if not dac or not dac.get("suggestions"):
        return "## DAC suggestions\n\n[No previous DAC on file.]\n"

    lines = ["## DAC suggestions\n"]
    lines.append(f" suggestions from the DAC meeting held on {dac.get('date', '[date]')}:")
    for s in dac["suggestions"]:
        lines.append(f"- {s}")
    return "\n".join(lines) + "\n"


def gen_descriptionOfWork(logs, work_units, dac):
    """Section 5: Description of work done + how DAC suggestions were addressed."""
    lines = ["## Description of the work\n"]

    # group logs by tag
    tag_groups = {}
    for e in logs:
        for t in e["tags"]:
            tag_groups.setdefault(t, []).append(e)

    if tag_groups.get("experiment"):
        lines.append("### Experimental work\n")
        for e in tag_groups["experiment"][:20]:  # cap at 20 entries
            lines.append(f"- **{e['date']}** {e['text']}")
        lines.append("")

    if tag_groups.get("analysis") or tag_groups.get("data"):
        lines.append("### Data analysis\n")
        for e in (tag_groups.get("analysis", []) + tag_groups.get("data", []))[:20]:
            lines.append(f"- **{e['date']}** {e['text']}")
        lines.append("")

    # work-unit details
    active = [wu for wu in work_units if wu.get("status") in ("running", "done", "written-up")]
    if active:
        lines.append("### Work units\n")
        for wu in active:
            lines.append(f"**{wu.get('id', '[id]')}:** {wu.get('question', '[question]')}")
            # extract Log and Trouble sections from body
            body = wu.get("_body", "")
            log_sec = re.search(r"## Log\n([\s\S]*?)(?=\n## |\Z)", body)
            trouble_sec = re.search(r"## Trouble\n([\s\S]*?)(?=\n## |\Z)", body)
            if log_sec and log_sec.group(1).strip():
                lines.append(f"- Log: {log_sec.group(1).strip()[:200]}")
            if trouble_sec and trouble_sec.group(1).strip():
                lines.append(f"- Issues: {trouble_sec.group(1).strip()[:200]}")
        lines.append("")

    # how DAC suggestions were addressed
    if dac and dac.get("suggestions"):
        lines.append("### Addressing DAC suggestions\n")
        for s in dac["suggestions"]:
            lines.append(f"- **Suggestion:** {s}")
            lines.append(f"  **Action taken:** [Describe how this was addressed]\n")

    if len(lines) == 1:
        lines.append("[Detail the research work done in the last six months — methods, observations, results.]\n")

    return "\n".join(lines) + "\n"


def gen_literatureDiscussion(logs, work_units):
    """Section 6: Review of literature, discussion, conclusion."""
    reading = [e for e in logs if "reading" in e["tags"]]
    lines = ["## Review of literature, discussion and conclusion\n"]

    if reading:
        lines.append("### Additional literature reviewed\n")
        for e in reading[:15]:
            lines.append(f"- **{e['date']}** {e['text']}")
        lines.append("")

    lines.append("### Discussion\n\n[Discuss observations and results in the context of literature review.]\n")
    lines.append("### Conclusion\n\n[Highlight major conclusions and limitations.]\n")

    return "\n".join(lines)


def gen_changesToObjectives(dac):
    """Section 7: Changes to objectives."""
    if not dac or not dac.get("changes_to_objectives"):
        return "## Any changes made to existing objectives\n\n[State any changes to objectives with justifications.]\n"

    lines = ["## Any changes made to existing objectives\n"]
    for c in dac["changes_to_objectives"]:
        lines.append(f"- {c}")
    return "\n".join(lines) + "\n"


def gen_planForNext(dac):
    """Section 8: Plan for next six months."""
    lines = ["## Plan for the next six months\n"]

    if dac and dac.get("action_items"):
        pending = [a for a in dac["action_items"] if not a["done"]]
        if pending:
            lines.append("Based on DAC action items:\n")
            for a in pending:
                dl = f" (deadline: {a['deadline']})" if a.get("deadline") else ""
                lines.append(f"- [ ] {a['text']}{dl}")
            return "\n".join(lines) + "\n"

    lines.append("[Experiments/data collection/objectives to be completed.]\n")
    return "\n".join(lines)


def gen_references(logs):
    """Section 9: References."""
    reading = [e for e in logs if "reading" in e["tags"]]
    lines = ["## References\n"]
    if reading:
        lines.append("Papers reviewed during this period:\n")
        for e in reading[:10]:
            lines.append(f"- {e['text']}")
    else:
        lines.append("[Updated reference list based on additional literature review.]\n")
    return "\n".join(lines) + "\n"


def gen_coursework(milestones, start_date, end_date):
    """Section 10: Course work."""
    reg = milestones.get("reg", "")
    lines = ["## Course work\n"]
    if reg:
        reg_date = datetime.strptime(reg, "%Y-%m-%d")
        if (end_date - reg_date).days < 365:
            lines.append("[Coursework completed after registration (first year).]\n")
        else:
            lines.append("[Coursework completed since last DAC meeting.]\n")
    else:
        lines.append("[Coursework status.]\n")
    return "\n".join(lines)


def gen_otherTraining():
    """Section 11: Other training."""
    return "## Other training\n\n[Any training undertaken since last DAC meeting.]\n"


def gen_researchOutput(pubs):
    """Section 12: Major research output."""
    lines = ["## Major research output\n"]

    journals = [p for p in pubs if p.get("type") == "journal"]
    conferences = [p for p in pubs if p.get("type") == "conference"]

    if journals:
        lines.append("### Publications\n")
        for p in journals:
            lines.append(f"- {p.get('title', '[title]')} — {p.get('status', '[status]')}")
        lines.append("")

    if conferences:
        lines.append("### Conference presentations\n")
        for p in conferences:
            lines.append(f"- {p.get('title', '[title]')} — {p.get('status', '[status]')}")
        lines.append("")

    if not journals and not conferences:
        lines.append("[Publications, conference presentations, patents, grants, awards, fellowships.]\n")

    return "\n".join(lines)


def gen_difficulties(dac, logs):
    """Section 13: Difficulties encountered."""
    lines = ["## Difficulties or problems encountered\n"]

    if dac and dac.get("difficulties"):
        for d in dac["difficulties"]:
            lines.append(f"- {d}")
        return "\n".join(lines) + "\n"

    # fallback: pull from work-unit Trouble sections
    trouble_entries = [e for e in logs if "experiment" in e["tags"]]
    if trouble_entries:
        lines.append("Issues encountered during experimental work:\n")
        for e in trouble_entries[:10]:
            lines.append(f"- **{e['date']}** {e['text']}")

    if len(lines) == 1:
        lines.append("[Detail any difficulties or problems encountered since the last DAC meeting.]\n")

    return "\n".join(lines) + "\n"


def gen_meetings(logs, start_date, end_date):
    """Section 14: Meetings with supervisor."""
    meeting_entries = [e for e in logs if "meeting" in e["tags"]]
    lines = ["## Regular meetings with the supervisor\n"]
    if meeting_entries:
        lines.append(f"**Total meetings logged:** {len(meeting_entries)}\n")
        for e in meeting_entries:
            lines.append(f"- {e['date']} {e['time']} — {e['text']}")
    else:
        lines.append("[State number of meetings held with dates. Available for verification from research log book.]\n")
    return "\n".join(lines) + "\n"


# ── HTML template ──────────────────────────────────────────────────────

HTML_TEMPLATE = string.Template("""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Annexure 28 — Progress Report</title>
<style>
  @page { size: A4; margin: 2.5cm; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5; color: #000; max-width: 210mm; margin: 0 auto; padding: 2.5cm; }
  h1 { font-size: 16pt; text-align: center; margin-bottom: 2em; }
  h2 { font-size: 14pt; margin-top: 1.5em; border-bottom: 1px solid #000; padding-bottom: 0.2em; }
  h3 { font-size: 12pt; font-style: italic; margin-top: 1em; }
  p, li { font-size: 12pt; }
  ul { margin-left: 1.5em; }
  .meta { text-align: center; margin-bottom: 2em; font-size: 11pt; color: #444; }
  .checklist { list-style: none; padding-left: 0; }
  .checklist li::before { content: "☐ "; }
  .checklist li.done::before { content: "☑ "; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
$body
</body>
</html>""")


def markdown_to_html(md_text):
    """Convert markdown to simple HTML (stdlib only, no external deps)."""
    html = md_text
    # headings
    html = re.sub(r"^# (.+)$", r"<h1>\1</h1>", html, flags=re.M)
    html = re.sub(r"^## (.+)$", r"<h2>\1</h2>", html, flags=re.M)
    html = re.sub(r"^### (.+)$", r"<h3>\1</h3>", html, flags=re.M)
    # bold
    html = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", html)
    # italic
    html = re.sub(r"\*(.+?)\*", r"<em>\1</em>", html)
    # checklist items
    html = re.sub(r"^- \[ \] (.+)$", r'<li class="checklist">\1</li>', html, flags=re.M)
    html = re.sub(r"^- \[x\] (.+)$", r'<li class="checklist done">\1</li>', html, flags=re.M)
    # regular list items
    html = re.sub(r"^- (.+)$", r"<li>\1</li>", html, flags=re.M)
    # wrap consecutive <li> in <ul>
    html = re.sub(r"((?:<li[^>]*>.*?</li>\n?)+)", r"<ul>\1</ul>", html)
    # paragraphs (lines not already tagged)
    lines = html.split("\n")
    out = []
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("<"):
            out.append(f"<p>{stripped}</p>")
        else:
            out.append(line)
    return "\n".join(out)


# ── main ───────────────────────────────────────────────────────────────

def assemble(months=6, output_dir="daily/reviews"):
    """Assemble Annexure 28 from vault data."""
    end = datetime.now()
    milestones = load_milestones()
    if is_pre_phd(milestones):
        return assemble_monthly(output_dir)

    # load all data
    logs = load_logs(months)
    work_units = load_work_units()
    pubs = load_publications()
    dac = load_latest_dac()
    start = period_start(dac, months)          # real period: since last DAC
    meetings = load_meetings_with_guide(start, end)

    # assemble sections
    sections = [
        gen_title_page(milestones, dac, period=(start, end)),
        gen_introduction(logs, work_units),
        gen_objectives(work_units),
        gen_dac_suggestions(dac),
        gen_descriptionOfWork(logs, work_units, dac),
        gen_literatureDiscussion(logs, work_units),
        gen_changesToObjectives(dac),
        gen_planForNext(dac),
        gen_references(logs),
        gen_coursework(milestones, start, end),
        gen_otherTraining(),
        gen_researchOutput(pubs),
        gen_difficulties(dac, logs),
        gen_meetings(logs, start, end),
    ]

    md_content = "\n\n".join(sections)
    md_content += f"\n\n---\n*Word count: ~{len(md_content.split())} (target: 2000-2500)*\n"
    return write_outputs(md_content, output_dir, end)[:2]


def assemble_monthly(output_dir="daily/reviews"):
    """Pre-PhD: reg not final yet -> plain monthly work report (not Annexure 28).
    No DAC exists, so no DAC sections and no share-by deadline. The file keeps
    the dac-report-YYYY-MM.md name so /report.html lists it; the title inside
    says Pre-PhD. Flips to Annexure 28 automatically once milestones.md's
    reg-note loses PROVISIONAL and the reg date arrives."""
    end = datetime.now()
    start = end - timedelta(days=30)
    logs = load_logs(1)
    work_units = load_work_units()
    pubs = load_publications()

    sections = [
        f"# Pre-PhD Monthly Report — {end.strftime('%Y-%m')}",
        f"**Period Covered:** {start:%Y-%m-%d} to {end:%Y-%m-%d}\n",
        "*Pre-registration mode: this is a plain monthly work summary. The real Annexure 28 draft starts once the joining date is confirmed in milestones.md.*",
        gen_descriptionOfWork(logs, work_units, None),
        gen_literatureDiscussion(logs, work_units),
        gen_researchOutput(pubs),
        "## Carry-forward\n\n[What continues into next month: papers in progress, pending experiments, open questions.]\n",
    ]

    md_content = "\n\n".join(sections)
    md_content += f"\n\n---\n*Word count: ~{len(md_content.split())}*\n"
    return write_outputs(md_content, output_dir, end)[:2]


def main():
    parser = argparse.ArgumentParser(description="Assemble Annexure 28 progress report")
    parser.add_argument("--months", type=int, default=6, help="Months to cover (default: 6)")
    parser.add_argument("--output-dir", default="daily/reviews", help="Output directory")
    args = parser.parse_args()

    pre = is_pre_phd(load_milestones())
    print(f"Assembling {'pre-PhD monthly report' if pre else 'Annexure 28 (last ' + str(args.months) + ' months)'}...")
    md_path, html_path = assemble(args.months, args.output_dir)
    print("Done. Review the draft, then edit as needed.")


if __name__ == "__main__":
    main()
