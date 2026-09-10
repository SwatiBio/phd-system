---
map: map.md
type: prototype
status: resolved
assignee: hp + agent (this session)

## Resolution

RESOLVED (built) — `scripts/phd.py` (stdlib-only, run via `uv`): `phd log "text" [tags]` (monthly file, date headings, no flags needed) · `phd task "text" [--due] [--every]` (Tasks-plugin syntax) · `phd save [msg]` (git add+commit, auto-init) · `phd week [--last]` (printable logbook HTML with guide signature line, per §19). Alias `phd=uv run .../phd.py` added to ~/.bashrc (active next session). Sweep command deferred to ticket 09. Tested: log + task + week + save all pass (first commit f002485).

## Question (original)

**Script CLI contract** — the exact commands and behaviors for the capture scripts: `log <line>`, `task add <line>`, `run "question"` (new Work Unit), `phd save`, sweep trigger. Decide: argument shapes (no flags at capture — ADHD rule), output style (one line of confirmation), what each script touches (frontmatter, files), error behavior, and where scripts live + how `phd`/`phd save` resolve on Git Bash Windows. Prototype = draft the command table and test one script via uv.
