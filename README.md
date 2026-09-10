# PhD System — the map of your vault

**All project context, tickets, and docs live in Lific** (local tracker, http://localhost:3456/PHDOS/). Start: page **PHDOS-DOC-7** (handoff) + **PHDOS-DOC-4** (map). Agent sessions: read those first.

**Rule zero: only `daily/` needs you.** Everything else is machinery or parked.

## 🫵 daily/ — touch daily

| Folder | Job | Your move |
|---|---|---|
| `daily/logs/` | Daily log (MAHE §19 compliance doc) | Log box in the app — one line, any time |
| `daily/tasks/` | All tasks | Add; check off. Sorting + recurrence automatic |
| `daily/meetings/` | Rough piles → refined notes | Dump fragments after meetings. I shape them. `print/` = guide's logbook page |

## 🔬 research/ — fills as PhD starts

| Folder | Job |
|---|---|
| `research/materials/` | Samples · extracts · compounds (`mat-XXXX`) |
| `research/work-units/` | Experiments + runs (`wu-XXXX`) |
| `research/targets/` | Pathogens/proteins docked (`tgt-XXXX`) |
| `research/papers/` | Papers you READ + PDFs (personal 🔒 / phd 📖) |
| `research/data/` | Datasets + MANIFEST.md (frozen = never edit) |

## ⚙️ system/ — mine, ignore

`scripts/` (phd.py) · `skills/` (agent skills) · `templates/` · `milestones/` (MAHE requirements) — visuals live in harbor workspace `phd-system`, context/tickets in Lific

## ⏳ later/ — parked, designed just-in-time

`writing/` (waits for Month-1) · `publications/` · `money/`

---

**Capture lives in the app:** https://phd-os.swatibio.workers.dev — log line, one task, logbook for your guide; longer forms at `/admin` (Sveltia).
**Retired 2026-09-10:** the `phd` CLI (`log` / `task` / `save` / `week`). `system/scripts/phd.py` stays as a helper library for Actions.
**Loop:** capture anywhere → dashboard shows next → weekly review prints logbook → I refine meetings
