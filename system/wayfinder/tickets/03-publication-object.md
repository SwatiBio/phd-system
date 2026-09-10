---
map: map.md
type: grilling
status: resolved
assignee: hp + agent (this session)
blocked-by: []
---

## Resolution

RESOLVED — **Publication object:** one note per publication (few per PhD; each carries reviewer comments, dates, certificates).

- **Journal status machine (8 states):** `idea → drafting → guide-review → submitted → under-review → revision → accepted → published` — user chose detailed: months of limbo get precisely named, states cost nothing (frontmatter flips).
- **Conference machine (5 states):** `abstract → submitted → accepted → presented → certificate` — certificate is the real final state (MAHE evidence, filed in `later/publications/certificates/`).
- **Fields (frontmatter):** type · status · venue · index (Scopus/WoS/Q1) · submitted/accepted dates · requirement flags (first-author, thesis-related, MAHE-affiliation). Custom fields allowed (same pattern as Paper notes).
- **Built:** template `system/templates/publication-note.md` + tracker `later/publications/Publications.md` (Bases table with All/Journals/Conferences views).
- Distinctly named from the Paper object (papers-you-read) — no shapeshifter.

## Question

**Publication object** — how are the user's OWN papers and conference submissions tracked? Cover: status machine (idea → draft → submitted → revision → accepted → published), the MAHE requirements as targets (2 first-author Scopus/WoS, or 1 Q1>3 IF + 2 conference presentations with certificates), venue/deadline fields, and how the tracker surfaces "am I on pace?" without guilt mechanics.
