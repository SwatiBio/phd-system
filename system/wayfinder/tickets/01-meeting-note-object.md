---
map: map.md
type: grilling
status: resolved
assignee: hp + agent (this session)
blocked-by: []
---

## Resolution

RESOLVED — **Meeting Note object:** one object, `type: guide | dac`.

**Capture:** user writes rough notes however they fall out (voice, fragments, phone) into **monthly rough files** `meetings/rough-YYYY-MM.md`, fragments separated by `---` (Matt Pocock writing-fragments format). The agent is never present at capture. One file per month (~42 over the PhD), consistent with `logs/YYYY-MM.md`.

**Refine:** custom skill `refine-meeting` (built in build phase, modeled on Pocock's writing-shape) reads the rough pile **read-only** and shapes it into the Meeting Note: decisions · feedback · action items (each auto-spawning a Task with due date) · links (work units, papers, drafts) · type. Format choices are argued with the user, not guessed. Size-adaptive: a two-line guide chat refines to a two-line note; DAC meetings get full structure + grading received + Annexure 23 filing pointer. Consumed fragments get struck/archived; file moves to `meetings/archive/` when empty.

**The loop:** DAC note action items → next progress report's "plan" section; tagged log since last DAC → "work carried out" section. Both halves of Annexure 28 pre-assembled.

**Build items surfaced:** `refine-meeting` skill enters the build plan (ticket 14). Later skills (review-paper assembly via writing-beats pattern) remain fog.

**Audit (writing-great-skills, passed with fixes):** model-invoked (agent notices unrefined pile — user must not have to remember); every step gets exhaustive completion criteria ("every fragment shaped/deferred/struck — none skipped") against premature completion; DAC-specific rules disclosed to `dac-note.md` behind a pointer (sprawl cut); field spec NOT restated in skill — it points at the object template (single source of truth); ADHD carve-out: default classification rules inline, argue formats only on genuinely ambiguous fragments. Depends on tickets 05 + 08 in build order.

**SPEC LOCKED** — skill files at `phd-system/skills/refine-meeting/` (SKILL.md + dac-note.md), marked build-pending in-file. **Build instruction: when building/testing in the build phase, load the `writing-great-skills` skill first and re-check the files against it** (no-op hunt, leading-word pass, relevance check) before activation. Activation gates: tickets 05 + 08 done. **Location rule (user decision): everything lives in the vault, git-versioned; agent-discovery locations get copies/symlinks at activation** (Vault structure ticket 05 includes `skills/` in the tree + the copy/symlink step in the build plan).

## Question

**Meeting Note object** — what does a record of a guide/DAC meeting contain, and how does it feed the half-yearly progress report? Cover: fields (date, attendees, decisions, action items), guide-meeting vs DAC-meeting differences, link to Tasks created from action items, and how decisions/feedback flow into the DAC report draft.
