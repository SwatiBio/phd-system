# Research · MAHE Annexure Fields (R1)

**Source:** MAHE PhD Guidelines (Jan) PDF — https://www.manipal.edu/content/dam/manipal/mu/documents/mahe/PhD/Handbooks%20Downloads/MAHE%20PhD%20guidelines-Jan.pdf
**Status:** Found via direct fetch. The annexure *template pages* themselves are not reproduced verbatim in the extractable text, but the governing sections (5, 11, 12) fully specify content, word count, timelines, and grading. Rubric grade names found; exact rubric table weights not extractable — flagged below.
**Resolved by:** direct fetch (researcher subagent failed on provider error).

---

## Annexure 28 — Half-yearly Progress Report (Section 11 + 12)

**What it must contain:** details of work carried out in the **previous six months**.

**Constraints:**
- **Explanatory, ~2000–2500 words**
- Scholar shares guide-approved report with DAC members (student portal or email) **7 working days before** the DAC meeting (portal locks after due date)
- DAC members review/comment within 1 week; ≥4 members accept → meeting scheduled
- Scholar presents progress at DAC; report approved there
- Coordinator sends DAC-approved report + minutes to CDS within 10 days
- **DAC reports must NOT be combined** (one per 6-month period, even during extension)
- Grading per rubric (Annexure 29) recorded in recommendation sheet

**Implied sections** (from sections 11/12 + registration-letter semester plan): work carried out this period; publications/papers status; course work status; plan for next period; guide remarks; DAC recommendation & grading.

## Annexure 29 — Progress Grading Rubric

- Scale includes at least: **excellent / good / satisfactory / poor / very poor** (exact table not extractable — treat grade names as confirmed, weights as unknown)
- **poor / very poor** → progress "not satisfactory" → repeat (interim) DAC within 3 months; scholarship withheld until DAC recommends continuation
- Registration cancellation risk if two consecutive reports missed

## Annexure 25 — IPAC Research Protocol (15 mandatory sections)

Title + scholar name/affiliation · Guide/co-guide name/affiliation · Introduction · Literature Review · Research Gaps identified · Objectives · Detailed Methodology · Expected Outcome · Importance + link to SDGs · Research Time Plan · Pilot study/preliminary work · Expenses break-up + funding source (scholarship NOT listed as expense) · References · DAC-suggested coursework with credits · Similarity check report (<15%, exclude <3-word matches, signed).

**Format:** 15–20 pages A4, 1-inch margins (font size guidance truncated in extract).

## Annexures 37–40 — Thesis structure

Cover page (38) · Certificate (39) · **Structured abstract ≤2000 words** · Declaration of originality (35) · Acknowledgement · Contents · List of tables · List of figures · Abbreviations · Chapters (content as recommended by DAC) · Summary & conclusion · Bibliography (Vancouver/Harvard/APA per DAC) · List of thesis publications + authors/affiliations · List of conference presentations · Annexures (ethics approvals, questionnaires) · One-page biodata.
**Word count undertaking (Annexure 40) if thesis < 30,000 words.** Turnitin <15%. Thesis PDF ≤10MB per file.

## Timeline hooks for seed data (from Section 5)

- Sem 1: coursework registration immediately; DAC constituted ≤1 month; preliminary DAC ≤2 months (ratifies topic + coursework); IPAC protocol per registration letter; renewal at semester end
- Sem 2: 1st draft of review/original article to guide; coursework (12 credits) complete; **DAC-1** (reviews coursework status)
- Sem 4: first paper submitted to journal
- Sem 5: draft of second article to guide
- Sem 7 (full-time): final DAC-6 + synopsis presentation (ideally ≤1 month after final DAC); NOC from CDS within 3 months of synopsis; thesis submission follows

## Implications for log tagging (feeds ticket 10)

| Annexure 28 section | Fed by |
|---|---|
| Work carried out this period | `#experiment` `#analysis` `#field` log lines + Work Unit written-ups |
| Publications status | `#pub` lines + Publication object statuses |
| Course work status | `#coursework` lines + grades |
| Plan for next period | weekly-review outputs + DAC meeting action items |
| Papers read / literature | `#paper` lines (supports "work carried out") |

**Automatable:** ~80% of the 2000–2500 words can be drafted from the vault (log + work units + publications + meetings). Scholar adds narrative + guide remarks.
**Deadline chain to encode:** report approved by guide → 7 working days before DAC → CDS within 10 days after. Sweep + reminder system must treat "7 working days" as the lead-time anchor.
