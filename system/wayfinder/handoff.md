# Handoff — PhD system, session state

*Drop this file into any fresh agent session. Read with `wayfinder/map.md` + `wayfinder/decisions-log.md`.*

## The human

- **Swati** (GitHub: `SwatiBio`). PhD at MAHE starting ~Sept 2026 — Dr. TMA Pai scholarship, 3.5 yrs, topic: *computational studies of lichen-derived compounds against target pathogens*. Guide's exact workflow unknown until Month 1 (hybrid field/computational hinted).
- **ADHD, low attention span.** Interaction rules: ONE question at a time, plain words, no walls of text, overwhelm = slow down. Boring tools get abandoned — delight is a requirement, not decoration.
- **Output style: Focus** — answer first, front-load every line, cap lists at 5, no preamble.

## Where the system lives

- **Vault:** `C:\Users\hp\Dev\playground\phd-system` — git repo, pushed to `https://github.com/SwatiBio/phd-system` (private, branch `main`).
- **Location rule (user decision):** everything decided lives inside the vault, git-versioned. Agent-discovery locations get copies/symlinks at activation; vault = single source.
- **Structure (4 top-level folders, ADHD-motivated):** `daily/` (logs · tasks · meetings) · `research/` (materials · work-units · targets · papers · data) · `system/` (scripts · skills · templates · wayfinder · milestones · harbor) · `later/` (writing · publications · money — designed just-in-time).

## What is RUNNING right now

- **Capture scripts** — `system/scripts/phd.py`, run via `uv` (alias `phd` in `~/.bashrc`, active in NEW terminal sessions):
  `phd log "text" [tags]` · `phd task "text" [--due] [--every]` · `phd save [msg]` (git add+commit) · `phd week [--last]` (printable logbook page with guide signature line — MAHE §19 mandate).
- **Dashboard** — `Home.md`: 🔴/🟡 deadline strip, top-5 tasks, streak, pile gauge (Dataview + Tasks plugins installed and verified by user).
- **Seed milestones** — `system/milestones/milestones.md`: 10 MAHE milestones with exact annexure requirements; **all dates PROVISIONAL (reg = 2026-09-15)** until registration letter lands (Month-1 checkpoint ticket 15).
- **Git backup** — pushed; `.gitignore` excludes `.obsidian/plugins/` (Remotely Save's embedded OAuth creds trip GitHub push protection — lesson learned, rule recorded).
- **Syncthing** — v2.1.5 (winget `Syncthing.Syncthing`), vault folder registered, phone paired (device `BIQ2YQ3-...-CKVXPQ2`, folder shared, config PUT applied). Autostart: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\syncthing.vbs`. **Remotely Save was ABANDONED** (OAuth hell) → Syncthing replaced it; SETUP.md still mentions it (stale — update).

## Wayfinder state (map amended: BUILD-AS-YOU-GO pivot)

- **Resolved:** 01 Meeting Note · 03 Publication (8-state journal / 5-state conference machines) · 05 Vault structure · 06 Script CLI · 07 Obsidian config · 11 Seed data · R1 Annexure research.
- **Parked:** 02 Writing Draft + 04 Money (deferred until first expense) — both behind reality/checkpoint triggers.
- **Frontier (just-in-time):** 08 templates (partially built: daily/meeting/paper/publication exist) · 09 Sweep contract · 10 DAC report assembler · 12 Weekly review ritual · 13 Setup bundle · 15 Month-1 checkpoint.
- **MAHE discovery (big):** §19 mandates the research logbook — recorded DAILY, submitted to guide WEEKLY for review/approval, full logbook before thesis NOC. The daily log is a compliance document; hard copy printed from `phd week`.

## Setup checklist state (ticket 13)

✅ Obsidian desktop (winget 1.13.7) · Dataview + Tasks · Zotero + Better BibTeX · ZotLit (tested: DOI → note) · GitHub (pushed) · Syncthing laptop-side.
⏳ Pending user: **accept folder offer on phone → set location Documents → install Obsidian mobile → open vault**. Optional plugins (Calendar, Heatmap, Kanban, etc.).
🧹 Pending agent: rotate Syncthing API key (it appeared in chat — `system/config` via REST after phone sync confirmed); ZotLit note-template polish to the 4-field Paper format; update SETUP.md (remove Remotely Save, add Syncthing instructions).

## ⏳ OPEN DECISION — awaiting user answer

**User finds Obsidian boring ("meh, don't feel like using it").** Options presented; recommendation accepted in principle? **NOT yet confirmed** — user was asked: *"What should opening PhDOS feel like? Describe the vibe in one sentence."* Awaiting reply. Plan: build a custom local web UI (`phd ui`) over the same markdown vault — Obsidian demoted to backup/PDF-reader. Do NOT redesign the data layer — only faces change.

## Environment quirks (learned the hard way)

- **System proxy intercepts localhost** — Python urllib needs `ProxyHandler({})` bypass (see `syncthing-add-folder.py`). Likely killed the OneDrive OAuth too.
- **Git Bash mangles `schtasks /Flags`** into paths — use PowerShell or Startup-folder VBS instead. No admin rights (Register-ScheduledTask denied).
- **Dataview:** use `dv.pages('"folder"')` (filesystem-index), never `dv.page("path")` (link-index, breaks after disk moves). `dv.io` is dead — use `dv.io.load()`. Luxon date math: use `.ts` epoch arithmetic.
- **Obsidian:** after ANY disk-level file move, user must `Ctrl+R` (stale link index).
- Windows firewall has **syncthing.exe Inbound = Block** rules (user was told to allow via GUI — unconfirmed).
- Firewall/scheduled tasks aside, user has no admin workflow — prefer user-writable mechanisms.
- `phd.py` paths assume the 4-folder structure (`daily/logs`, `daily/tasks`, `daily/meetings/print`); it resolves vault root as `parent.parent.parent` of the script (script lives in `system/scripts/`).
