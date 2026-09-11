---
name: refine-meeting
description: Refine rough meeting fragments into structured Meeting Notes. Use when the user dumps rough notes after meeting their guide or DAC, mentions refining or shaping meeting notes, or the monthly rough pile (meetings/rough-YYYY-MM.md) has unrefined fragments.
---

<!-- SPEC LOCKED — build-pending. Build with the writing-great-skills skill (audit fixes already applied).
     Activation requires: vault structure (ticket 05, done) + Meeting Note spec (ticket 08, done:
     system/templates/meeting-note.md). Remaining activation step: copy/symlink this skill into an
     agent-discovery location, per the LOCATION RULE below.
     LOCATION RULE (user decision): all system content lives inside phd-system/ (this folder), git-versioned.
     This skill is NOT agent-discovered here — the build phase copies/symlinks it into an agent-discovery
     location (e.g. project .agents/skills/ or ~/.agents/skills/) as an activation step. -->

The user has a rough pile: fragments from one or more meetings with their guide or DAC, written however
they fell out — voice-transcribed, half-sentences, bullets. Your job is to **shape** the pile into
structured Meeting Notes. The pile is **read-only** to you: never edit, reorder, or delete a fragment;
shape into a separate note file. Consumed fragments get struck through (`~~...~~`), never deleted.

**Leading rule: the pile is the quarry.** Pull, split, merge, paraphrase — but never lose a fragment:
every fragment ends up shaped, deferred-with-reason, or struck. None silently skipped.

## Steps

### 1. Read the pile

Read `daily/meetings/rough-YYYY-MM.md` for the current month end-to-end, plus any prior month's file that
still holds unconsumed fragments. Fragments are separated by `---`.

✓ Done when: every fragment is inventoried — you can name each one and say which meeting it belongs to.
If fragments are ambiguous about which meeting they belong to, ask once, then proceed.

### 2. Shape each fragment into a Meeting Note

For each unconsumed fragment: determine its type (`guide` or `dac` — a DAC meeting is any scheduled
Doctoral Advisory Committee session; if unclear, ask once), then shape it into a Meeting Note at
`daily/meetings/<YYYY-MM-DD>-<type>.md`, using the Meeting Note template as the field spec — **never restate
the template's fields here**.

**Default classification rules — apply silently, do not ask:**

- A commitment the user (or guide) made → **action item**: add a Task file under `daily/tasks/` with a
  due date when the pile states one, referencing the note
- A position the guide or committee took ("agreed", "approved", "wants X changed") → **decision/feedback**
- The user's own plan or intent → **action item** if it has a do-er and a deadline, otherwise
  **context** in the note body
- Literature, work units, or drafts the fragment references → **links** (citekey or file path)
- Everything else → **context**, in the note body, in the fragment's own voice

**Argue the format only when the fragment plausibly lands in two categories and the choice changes the
note's structure.** Otherwise shape silently — per-fragment questions are friction the user should not
pay for an unambiguous pile.

Notes are size-adaptive: a two-line guide chat shapes to a two-line note. Do not pad.

✓ Done when: every fragment in the pile is shaped into a note, deferred with a stated reason, or struck
as consumed — none silently skipped.

### 3. Wire the action items

Every action item exists as a Task in `daily/tasks/` (one file per task, frontmatter title/status/due,
`#meeting` tag and reference back to its Meeting Note in the body); every shaped note lists its Tasks.

✓ Done when: no action item lives only in prose, and no Task exists without a source note.

### 4. Archive

Strike consumed fragments in place. When a month's file holds only struck fragments, move it to
`meetings/archive/`. Report back in one line: "Shaped N fragments → M notes, K tasks, R deferred."

✓ Done when: the current month's pile contains only unconsumed fragments, or is archived.

## DAC meetings

When a fragment (or meeting) is a DAC session, load [dac-note.md](dac-note.md) and follow it — DAC
notes carry requirements guide notes never touch (grading, annexure filing, report chain).

## Out of scope

- Editing the rough pile (read-only)
- Drafting the half-yearly DAC progress report (that is the DAC report assembler, a separate flow)
- Writing anything the pile doesn't support — gaps go to the user as explicit questions, once each
