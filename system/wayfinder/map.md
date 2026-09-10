# Wayfinder Map · PhD System Build Plan

<!-- local-markdown tracker · tickets live in tickets/ · refer to tickets by NAME, never id -->

## Destination

**AMENDED (user-approved pivot):** the day-one-ready CORE vault is built and running NOW — capture works, seed MAHE milestones visible in the Obsidian dashboard, git backup on, logbook print path working. Remaining decision tickets (Publication, Money, weekly-review agenda, Writing Draft, sweep contract) are resolved **just-in-time** as the build reaches them, instead of all-before-building. Rationale: user motivation/ADHD — visible running progress beats complete planning.

## Notes

- **Domain:** PhD management system for a MAHE PhD (Dr. TMA Pai Scholarship, 3.5 yrs, topic: computational studies of lichen-derived compounds against target pathogens). Hybrid field + computational work, details from guide pending.
- **Skills to consult each session:** `grilling` + `domain-modeling` for grilling tickets; `prototype` for prototype tickets (build cheap HTML/mock artifacts, register in harbor when worth keeping).
- **Standing preferences:**
  - ADHD-aware: one decision per session, plain language, no walls of text. Overwhelm is a signal to slow down, not to push.
  - Scripts run via `uv` (never `python -c`). Plain markdown everywhere. The user NEVER runs git — `phd save` alias / agent does commits.
  - Visuals belong in harbor (workspace `phd-system`).
  - PDFs live in vault `papers/pdf/`; Zotero is metadata brain (ZotLit bridge).
  - Sync: Remotely Save → OneDrive, E2E, ONE sync mechanism only.
- **Skills:** `refine-meeting` spec LOCKED at `phd-system/skills/refine-meeting/` (SKILL.md + dac-note.md), build-pending. **When building it: load the `writing-great-skills` skill first and re-check the files against it before activation.** Activation gates: tickets 05 + 08. Later skills (review-paper assembly via writing-beats pattern) remain fog.
- **Skill location (user decision):** ALL decided content lives inside `phd-system/`, git-versioned — including skills (`skills/<name>/`). Agent-discovery locations get copies/symlinks as an activation step in the build plan; the vault stays the single source.
- **Decisions already made** (before this map) are indexed in [Decisions so far](#decisions-so-far); detail lives in `decisions-log.md`. Do not re-decide them; challenge only if a new ticket's answer conflicts.

## Decisions so far

<!-- Pre-map decisions (indexed from decisions-log.md) + closed tickets (one line each) -->

- [Objects: Daily Log, Task, Paper, Work Unit, Material, Target](decisions-log.md#objects): six-object model; type-agnostic Work Unit with two-tier run→WU promotion; Material merges sample/extract/compound with type tags
- [Daily Log design](decisions-log.md#daily-log): append-anytime monthly files, optional tags + energy, streak/heatmap fun layer, auto-drafted DAC reports from tagged entries, no guilt mechanics
- [Task views](decisions-log.md#task): list default (auto-sorted by tags, priority-free capture) + kanban + calendar, switchable; recurrence supported; recurring tasks pre-seeded
- [Paper object](decisions-log.md#paper): personal 🔒 vs phd 📖 categories; 4-field note + unlimited custom fields; #idea escape hatch into daily log
- [Interface](decisions-log.md#interface): hybrid — scripts for 10-second capture, agent for judgment work, HTML dashboards optional
- [Home & devices](decisions-log.md#habitat): vault = `phd-system` folder on this laptop; phone = Obsidian mobile for capture + paper reading
- [Sync](decisions-log.md#sync): Remotely Save (free) → OneDrive with E2E; exactly one sync mechanism
- [Literature stack](decisions-log.md#literature): Zotero + ZotLit; PDFs in vault, read/annotate in PDF++; PDF storage decision (a) locked
- [Safety](decisions-log.md#safety): git + private GitHub repo; user never touches git; heavy files gitignored
- [Obsidian stack](decisions-log.md#obsidian): Bases, Dataview, Tasks, Kanban, Calendar, Heatmap, Templater, QuickAdd, Shell Commands, Homepage, PDF++, Web Clipper
- [Scripting boundary](decisions-log.md#scripting): daily → in-Obsidian scripting; weekly/judgment → scripts + agent; logic never written twice
- [Defaults](decisions-log.md#defaults): external calendar skipped; VS Code for scripts/data
- [Meeting Note object](tickets/01-meeting-note-object.md): rough monthly piles → `refine-meeting` skill shapes them (read-only pile, argued formats); type guide/dac; action items auto-spawn Tasks; DAC action items = next report's plan section — ticket **Vault folder structure** unblocked
- [Seed data](tickets/11-seed-data.md): 10 milestones with exact annexure-level requirements + recurring tasks incl. weekly logbook mandate — spec at [seed-data-spec.md](seed-data-spec.md)
- **BUILD SESSION 1 (pivot)**: vault skeleton + scripts (`phd log/task/save/week`) + seed milestones (provisional reg = 2026-09-15) + Home dashboard + SETUP.md + .obsidian config + templates + rough pile + README. First commit `f002485`. Tickets **05 resolved** (structure), **06 resolved** (CLI built; sweep deferred to 09), **07 resolved-config** (activation = plugin install in 13). Aliases/phd.py live in scripts/, vault is single source
- **DISCOVERY (Section 19): MAHE mandates the research logbook** — daily recording + WEEKLY supervisor review/approval as official contact record + submitted before thesis NOC. The daily log is a compliance document; weekly review produces the guide-reviewable excerpt
- **Month-1 reality checkpoint created** (tickets/15-month-1-reality-checkpoint.md): external-reality task that will unblock Writing Draft + extract promotion + seed dates + rubric/publication verification once the PhD starts
- [MAHE Annexure 28 exact fields](research/annexure-28-fields.md): progress report = 2000–2500 words covering previous 6 months, 7-working-days pre-DAC deadline chain, never combined; poor/very-poor rubric triggers interim DAC + scholarship withholding; protocol = 15 mandatory sections; thesis structure + semester timeline extracted — ticket **DAC report assembler spec** unblocked

## Not yet specified

<!-- Fog: in-scope, can't phrase sharply yet. Graduates as tickets resolve. -->

- **Extract-object promotion** — if the guide confirms screening happens at crude-extract level, Material's `type: extract` may need its own workflow fields (checkpoint: month 1, after first guide meeting — will graduate to blocked-by **Month-1 reality checkpoint** ticket)
- **Field-label printing + GPS workflow** — if field collection starts: how sample IDs get onto physical bags, how GPS coordinates are captured in-field
- **Field notes analog→photo pipeline** (Lantsoght): paper notes in the field (dust/rain/no outlet), photographed into the vault same-day; refine skill may transcribe. Activates only if field work starts
- **Annexure 29 rubric exact weights** — grade names confirmed (excellent→very poor), table weights not extractable from PDF; verify from physical annexure / registration letter
- **Publication requirements per cohort** — verify the 2-publication / Q1 rules against the user's actual registration letter (arrives with joining email)
- **Conference tracker cadence** — which conferences, which deadlines refresh yearly; depends on research pace (year 1+)
- **Data checksum/manifest automation details** — MANIFEST.md generation frequency and frozen-dataset verification mechanics
- **Phone quick-capture ergonomics** — after a month of real use: is the vault inbox fast enough, or revisit Keep/Telegram sweep

## Out of scope

- **Learning git as a skill** — the user uses `phd save`; git tuition is a separate future effort
- **Alternative phone inbox apps (Keep/Telegram/Joplin)** — inbox model settled: Obsidian vault + Remotely Save; revisit only via fog item above
- **Wet-lab LIMS-style features** — no electronic lab notebook machinery beyond Work Unit/Material records; revisit only if the guide's workflow demands it
