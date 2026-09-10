---
name: weekly-review
description: Run the weekly review — walk the week's logs, tasks, questions and ideas, get the user's verdicts pile by pile, and produce the guide-facing logbook page. Use when the user says "weekly review", "review the week", asks "what did I do this week", or wants the logbook ready for the guide.
---

# Weekly review

Fifteen minutes, five steps. The gathering is a Sunday job; the verdicts are made together. Rule zero: **no guilt** — skipped days, unfinished tasks, and low-energy weeks are data, not failures. Say so if the review starts sounding like a report card.

Every step below ends on a completion criterion. Do not move on before it is met.

## Step 1 · Read the prep (agent only)

The **weekly-review job runs Sunday 18:00 IST** and has already gathered the week into
`daily/reviews/<ISO-week>.md` and `daily/reviews/latest.md` — the numbers, the log lines
newest-first, what slipped, and the three piles. Read that file first, after `git pull`
(PHDOS-28). It only counts; it never judges, so nothing in it is a verdict.

Read the raw sources only for what the prep cannot answer:

- **Logs:** `daily/logs/2026-W37.md` — one file per ISO week, so there is no second file to check and nothing to filter.
- **Meetings:** `daily/meetings/` — count rough fragments; do NOT refine them (that is `refine-meeting`).
- **Milestones:** `system/milestones/milestones.md` — the review page shows the next three; derive more as `reg + offset` (see `/timeline.html`).

**Done when:** you can name, without re-reading: the week's entry count, logged days, done vs overdue tasks, and how many `#question` / `#idea` lines exist.

## Step 2 · Show the week (one screen, newest-first)

Open **`/review.html`** and let the user read it. It is already one screen: the week in
numbers, the log lines newest-first, what slipped, and the three piles. Give the numbers in
one or two lines in chat — do not re-paste the page.

Admin/formality entries are counted and credited *as work* — invisible work becomes visible.

**Done when:** the user has seen the page and said something. Their reaction (or "ok") unblocks Step 3.

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
