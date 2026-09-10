---
name: weekly-review
description: Run the weekly review — walk the week's logs, tasks, questions and ideas, get the user's verdicts pile by pile, and produce the guide-facing logbook page. Use when the user says "weekly review", "review the week", asks "what did I do this week", or wants the logbook ready for the guide.
---

# Weekly review

Fifteen minutes, five steps. The robot work is yours (the agent's); the verdicts are the user's. Rule zero: **no guilt** — skipped days, unfinished tasks, and low-energy weeks are data, not failures. Say so if the review starts sounding like a report card.

Every step below ends on a completion criterion. Do not move on before it is met.

## Step 1 · Gather (prep — agent only)

`git pull` first (PHDOS-28). Then read, silently:

- **Logs:** `daily/logs/` — every file that could hold entries from this week (a week can span two monthly files; scan both, not just the current one). Newest-first.
- **Tasks:** `daily/tasks/tasks.md` — done this week, overdue, and rolling over.
- **Tagged lines:** every `#question`, `#idea`, `#admin`-ish entry from the week's logs.
- **Meetings:** any rough fragments in `daily/meetings/` from this week (do NOT refine them — that is the `refine-meeting` skill's job; just count them).
- **Milestones:** `system/milestones/milestones.md` — anything due within 14 days.

**Done when:** you can name, without re-reading: the week's entry count, logged days, done vs overdue tasks, and how many `#question` / `#idea` lines exist. If you cannot, keep gathering.

## Step 2 · Show the week (one screen, newest-first)

Present the review page in chat:

- **The week in numbers** — logged days (streak), entries, tasks done. Admin/formality entries counted and credited *as work* — invisible work becomes visible.
- **What you did** — the week's log lines, newest-first, lightly grouped by tag.
- **What slipped** — overdue tasks, skipped days. One line, no commentary.

**Done when:** the user has seen the page and said something. Their reaction (or "ok") unblocks Step 3. Do not start asking verdicts before this.

## Step 3 · Work the piles (decide — one pile at a time)

Never present two piles at once. Each pile gets the user's verdict per item; you record, they choose. If a pile is empty, say "none this week" and move on — do not manufacture work.

Order:

1. **Open questions** (`#question` lines) — verdicts: answer-now (agent researches on the spot), park (rides to next week), or kill.
2. **Ideas** (`#idea` lines) — weekly is the *light* pass: obvious promote-or-drop only. Parking is the default safe answer; the monthly review does the full promote/park/drop.
3. **Rolled-over tasks** — each overdue task: re-date, split, or drop. Dropping a task the user never needed is a win, not a failure.

**Done when:** every item in every non-empty pile has a verdict recorded. Zero vague "let's see" items left.

## Step 4 · Logbook for the guide (compliance)

Open the live logbook view and have the user print it from the browser (PHDOS-29: this is a site view now, not a file):

```
/logbook.html
```

Verify it shows THIS week (Monday-today; a save takes ~1 min to appear after deploy). Then tell the user: print -> sign -> hand to the guide weekly. The hard copy is the compliance artifact; the digital log stays the master record.

**Done when:** the user has the logbook view open on screen with this week's entries visible and knows to print it. If a day's entries are missing, check they were actually logged and deployed.

## Step 5 · Wrap (agent)

- Name **next week's one thing** — derive it: earliest due date among open tasks, or the next milestone's prep task. One line, ask the user to confirm or replace.
- Commit everything the review touched (git add + commit + push).
- **Push prompt** (PHDOS-28): if anything is uncommitted or unpushed, ask "push your work to remote?" — one yes/no, then do it.

**Done when:** git is clean (or the user explicitly said "not now"), next week's one thing is agreed, and the logbook file exists.

## Edges

- **Empty week** (no entries): say it plainly, show streak, do NOT fill the page with apology or motivational text. Ask what the week was; log the answer as one entry if the user gives it.
- **Mid-week invocation** ("review the week" on Wednesday): review Monday→now, generate the logbook only if the user asks; otherwise defer Step 4 to Sunday.
- **User is tired/overwhelmed**: collapse to Steps 1-2 + Step 4 only (show the week, produce the logbook), park all verdicts. Say that is what you are doing.
- **First review ever** (no streak, no data): run Steps 1-2 on whatever exists, celebrate nothing loudly, set up next week's one thing.
