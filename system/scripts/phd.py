#!/usr/bin/env python3
"""phd — capture commands for the PhD system vault.

Usage (from Git Bash, after alias setup):
  phd log "finished docking prep"            # append to this month's log
  phd log "read Silva 2024" paper,idea       # with tags
  phd task "email guide about IPAC"          # quick task
  phd task "renew registration" --due 2027-03-01
  phd save                                   # git commit everything
  phd week                                   # printable logbook page (this week)
"""
import argparse
import datetime as dt
import pathlib
import subprocess
import sys

VAULT = pathlib.Path(__file__).resolve().parent.parent.parent  # vault root (script lives in system/scripts/)
PROVISIONAL_NOTE = "PROVISIONAL"


def month_log_path(now: dt.datetime) -> pathlib.Path:
    return VAULT / "daily" / "logs" / f"{now:%Y-%m}.md"


def read_text(p: pathlib.Path) -> str:
    return p.read_text(encoding="utf-8") if p.exists() else ""


def cmd_log(args) -> None:
    now = dt.datetime.now()
    p = month_log_path(now)
    text = args.text.strip()
    if args.tags:
        tags = " ".join("#" + t.strip().lstrip("#") for t in args.tags.split(",") if t.strip())
        text = f"{text} {tags}"
    if not p.exists():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(f"# Log · {now:%B %Y}\n", encoding="utf-8")
    content = read_text(p)
    day_heading = f"## {now:%Y-%m-%d}\n"
    if day_heading not in content:
        with p.open("a", encoding="utf-8") as f:
            f.write(f"\n{day_heading}\n")
    with p.open("a", encoding="utf-8") as f:
        f.write(f"- **{now:%H:%M}** {text}\n")
    print(f"logged: {text}")


def slugify(s: str) -> str:
    import re
    parts = re.findall(r"[\w]+", s.lower(), re.UNICODE)
    return "-".join(parts)[:60] or "task"


def cmd_task(args) -> None:
    """One file per task (daily/tasks/<slug>.md) — mirrors create() in
    site/lib/tasks.js so both adapters produce the same object."""
    folder = VAULT / "daily" / "tasks"
    folder.mkdir(parents=True, exist_ok=True)
    base = slugify(args.text)
    slug = base
    n = 2
    while (folder / f"{slug}.md").exists():
        slug = f"{base}-{n}"
        n += 1
    recurring = args.every.strip().lower().removeprefix("every ").strip() if args.every else None
    fm = ["title: " + args.text.strip(), "status: todo"]
    if args.due:
        fm.append(f"due: {args.due}")
    if recurring:
        fm.append(f"recurring: {recurring}")
    p = folder / f"{slug}.md"
    p.write_text("---\n" + "\n".join(fm) + "\n---\n", encoding="utf-8")
    print(f"task added: {args.text.strip()} -> {p.relative_to(VAULT)}")


def cmd_save(args) -> None:
    git = lambda *a: subprocess.run(["git", *a], cwd=VAULT, capture_output=True, text=True)  # noqa: E731
    if not (VAULT / ".git").exists():
        git("init")
        git("config", "user.name", git("config", "user.name").stdout.strip() or "phd-system")
        print("git repo initialised")
    git("add", "-A")
    status = git("status", "--porcelain")
    if not status.stdout.strip():
        print("nothing to save")
        return
    msg = f"phd save {dt.datetime.now():%Y-%m-%d %H:%M}"
    if args.message:
        msg += f" — {args.message}"
    git("commit", "-m", msg)
    print(f"saved ({len(status.stdout.splitlines())} files)")


def cmd_week(args) -> None:
    today = dt.date.today()
    week_start = today - dt.timedelta(days=today.weekday())  # Monday
    week_end = week_start + dt.timedelta(days=6)
    rows = []
    for logf in sorted((VAULT / "daily" / "logs").glob("*.md")):
        current_day = None
        for raw in read_text(logf).splitlines():
            line = raw.rstrip()
            if line.startswith("## "):
                try:
                    current_day = dt.date.fromisoformat(line[3:].strip())
                except ValueError:
                    current_day = None
            elif line.startswith("- ") and current_day and week_start <= current_day <= week_end:
                rows.append((current_day, line[2:]))
    if args.last:
        week_start, week_end = week_start - dt.timedelta(days=7), week_end - dt.timedelta(days=7)
        rows = [(d, t) for d, t in rows if week_start <= d <= week_end]
    out = VAULT / "daily" / "meetings" / "print" / f"logbook-{week_start:%Y-W%V}.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    trs = "".join(
        f"<tr><td class='d'>{d:%a %d %b}</td><td>{t}</td></tr>" for d, t in rows
    ) or "<tr><td colspan='2' class='empty'>No entries this week.</td></tr>"
    html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><title>Research Logbook {week_start:%d %b}–{week_end:%d %b %Y}</title>
<style>
body {{ font-family: Georgia, serif; max-width: 800px; margin: 2rem auto; color: #1a1a1a; }}
h1 {{ font-size: 1.2rem; border-bottom: 2px solid #1a1a1a; padding-bottom: .3rem; }}
table {{ width: 100%; border-collapse: collapse; }}
td, th {{ border: 1px solid #999; padding: 6px 10px; vertical-align: top; font-size: 0.95rem; }}
td.d {{ white-space: nowrap; font-weight: bold; width: 110px; background: #f4f4f4; }}
.empty {{ text-align: center; color: #777; }}
.meta {{ font-size: .8rem; color: #555; }}
.sign {{ margin-top: 3rem; display: flex; justify-content: space-between; }}
.sign div {{ width: 45%; border-top: 1px solid #1a1a1a; padding-top: 4px; font-size: .85rem; }}
@media print {{ .noprint {{ display: none }} }}
</style></head><body>
<h1>Research Logbook — {week_start:%d %b} to {week_end:%d %b %Y}</h1>
<p class="meta">Maintained in the PhD system vault · submitted weekly per MAHE PhD Guidelines §19</p>
<table><tr><th>Date</th><th>Work carried out</th></tr>{trs}</table>
<div class="sign"><div>Scholar signature: ______________</div><div>Supervisor review/approval: ______________</div></div>
</body></html>"""
    out.write_text(html, encoding="utf-8")
    print(f"logbook page written: {out.relative_to(VAULT)}\nOpen it in a browser and print to PDF / paper.")


def main() -> int:
    ap = argparse.ArgumentParser(prog="phd", description="PhD system capture commands")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("log", help="append a line to this month's log")
    p.add_argument("text")
    p.add_argument("tags", nargs="?", default="", help="comma-separated tags, e.g. paper,idea")
    p.set_defaults(fn=cmd_log)

    p = sub.add_parser("task", help="add a task")
    p.add_argument("text")
    p.add_argument("--due", default=None, help="YYYY-MM-DD")
    p.add_argument("--every", default=None, help="recurrence, e.g. 'every 6 months'")
    p.set_defaults(fn=cmd_task)

    p = sub.add_parser("save", help="git commit the vault")
    p.add_argument("message", nargs="?", default=None)
    p.set_defaults(fn=cmd_save)

    p = sub.add_parser("week", help="printable logbook page for this week")
    p.add_argument("--last", action="store_true", help="previous week instead")
    p.set_defaults(fn=cmd_week)

    args = ap.parse_args()
    args.fn(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
