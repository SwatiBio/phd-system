# Decisions Log

<!-- The single store of every decision made in grilling sessions, pre-dating the wayfinder map.
     The map indexes into this file. New decisions from map tickets live in ticket resolutions,
     and get appended here as one-line summaries with links back to the ticket. -->

## Objects

<a id="objects"></a>
### Object model — six objects
1. **Daily Log Entry** — highest-frequency object. Decided.
2. **Task** — three views. Decided.
3. **Paper** (external literature) — two sub-categories. Decided.
4. **Work Unit** — type-agnostic research unit. Decided.
5. **Material** — merged Sample + Compound + Extract. Decided.
6. **Target** — pathogen/protein half of every docking pair. Decided.

<a id="daily-log"></a>
### Daily Log Entry
- **Capture:** append-anytime lines to a monthly file (`logs/2026-09.md`), auto-stamped, optional tags (`#experiment` `#paper` `#coursework` `#meeting` `#pub` `#idea`), optional energy rating. Works both end-of-day and mid-day random moments; skipped days are gaps, not failures.
- **Fun layer:** A = terminal capture + streak/progress bars; B = visual layer natively in Obsidian (Heatmap Calendar month-grid + mood colors). No separate HTML dashboard to maintain.
- **Payoff:** the 6-monthly DAC progress report (Annexure 28) is auto-drafted from tagged log entries — user edits, never starts blank.
- Auto-report confirmed feasible; user explicitly chose it.

<a id="task"></a>
### Task
- Three views, switchable, **list view default**: List / Kanban / Calendar.
- Capture is **priority-free** — sorting happens automatically by tags (formalities → due dates → research → untagged). No decisions asked at capture.
- **No effort field.**
- Recurrence supported via `[every: semester]`-style markers (Tasks plugin syntax).
- Pre-seeded recurring tasks: registration renewal (annual), DAC progress report (6-monthly), DAC presentation, weekly review, semester review, registration fee payment — placeholder dates, user edits with real deadlines.

<a id="paper"></a>
### Paper
- **Two sub-categories:** `personal` (private reading — guide's papers, outside-PhD interests; never shown/exported) and `phd` (shareable research reading; feeds review paper + progress reports).
- Note structure: (a) base — 4 fields (*What it did / How / Key result / What it means for me*) + **unlimited custom fields per paper** (e.g., `diagram-i-liked`).
- (b) escape hatch: cross-paper sparks captured as `#idea` lines in the daily log, harvested into review-paper outlines later.

<a id="work-unit"></a>
### Work Unit
- **Type-agnostic:** one object, `type` tag (`#comp` / `#wetlab` / `#field` / `#analysis`). Designed for all three scenarios (computational / wet-lab / field); reality prunes later.
- **Two-tier:** quick `run` capture (one line + auto-ID + folder) → promoted to full Work Unit when it matters.
- Fields: `id` (`wu-0042`), `question` (only required field), `method`, `inputs`, `outputs`, `status` (`planned → running → done → written-up`), `date` — everything fillable-later.

<a id="material"></a>
### Material (merged from Sample + Compound + Dataset)
- One object with `type` tags: `sample` (site, GPS, collected, collector, storage) / `extract` (derived-from → sample) / `compound` (SMILES, CAS, CID, MW, origin → sample or database).
- **Dataset dissolved** — files belong to: compound libraries (tag on compounds, e.g. `library: pubchem-lichen-v1`), protein structures (Targets), outputs (Work Units). Folders get auto-generated `MANIFEST.md` + `frozen` status convention.
- Traceability: `sample → extract → compound → hit against target` via Material→Material links.
- Extract-vs-compound checkpoint marked for month 1.
- Build Sample template now even though field work is unconfirmed; **inherited samples expected** — `collector` field is first-class.

<a id="targets"></a>
### Target
- Own minimal object: `id` (`tgt-0004`), pathogen, protein/structure name, PDB/source ID, notes.
- Compound × Target pairing is the spine of the results chapter; "all hits against target T" is a one-line filter.

## Views & daily flow

<a id="views"></a>
### Views & reminders
- Milestones: prep-tasks auto-generated at lead time; status `upcoming → in-prep → met/missed`; annexure references linked.
- Reminders: **countdown strip** pinned to every view + **active auto-injection** of prep tasks (b + c combined). Ambient visibility, no ambush deadlines.

## Tools & habitat

<a id="interface"></a>
### Interface — hybrid (c)
- ~2 tiny scripts for 10-second reflexes (log line, quick task, run ID); scripts regenerate dashboards; agent (pi) for all judgment work.
- Capture never depends on an agent being open.

<a id="habitat"></a>
### Where it lives
- Home base: `phd-system` folder, this Windows laptop. Plain files, git-tracked. Same laptop for PhD.
- Phone capture: Obsidian mobile app — vault note as raw inbox; sweep moves lines into logs/tasks.
- Safety net: unswept notes wait in the cloud; the DAC assembler sweeps everything before drafting. Thoughts can be late, never lost.

<a id="sync"></a>
### Sync
- **Remotely Save** (free community plugin) → OneDrive, optional E2E encryption. Not Obsidian Sync (paid). Not Trilium (server-dependent).
- Rule: vault lives in a plain local folder — exactly ONE sync mechanism.
- Sync latency accepted (seconds-to-minutes, fine for inbox use).

<a id="literature"></a>
### Literature stack
- **Zotero** account (user will create) + **ZotLit** plugin: DOI/metadata autofill, citation insertion, literature notes from templates.
- **PDFs live in the vault** (`papers/pdf/`): PDF++ reads/annotates in-app, synced to phone. Zotero stays metadata-only (300MB free tier never fills).
- Flow: find paper → clip/DOI → ZotLit metadata → note with 4-field template → PDF opens in PDF++.

<a id="safety"></a>
### Versioning & backup
- Git + one private GitHub repo (user already has GitHub account; creates repo at end of setup).
- User never runs git — **`phd save`** alias or asks the agent; agent commits with readable messages.
- PDFs/datasets gitignored (OneDrive covers them); text-only history.
- Three layers: OneDrive (loss) + git history (change) + plain text (survivable by hand).

<a id="obsidian"></a>
### Obsidian — the daily face
- Vault = the phd-system folder itself.
- Core: Properties, Bases (papers/materials/WU/milestone tables, cards, map view for field sites), Daily Notes, Templates, Wikilinks/backlinks/graph, Canvas, Web Clipper, Quick Switcher, Obsidian URIs.
- Community: Tasks, Dataview, Kanban, Calendar, Heatmap Calendar, ZotLit, PDF++, QuickAdd, Shell Commands, Homepage, Pandoc export.
- Dashboard = Homepage note: countdown strip, today's tasks, streak heatmap — all queries.
- Log views: A (terminal capture) stays; B is native Obsidian (heatmap/streaks/calendar).

<a id="scripting"></a>
### Scripting boundary rule
- Inside Obsidian: capture reflexes (hotkeys/buttons), views & computed displays (streaks, countdown, tables), auto-IDs & template mechanics.
- Outside: sweep, DAC report assembly, weekly reviews, literature harvesting, restructuring — uv scripts + agent.
- Rule: *daily → script it in Obsidian; weekly or needs thinking → the agent does it.* Logic never written twice.
- Only vetted scripts (DataviewJS/QuickAdd snippets from internet are a security risk).

<a id="defaults"></a>
### Minor defaults
- External calendar sync: skipped (dashboard countdown is more ambient); one-way GCal export possible later.
- Code editor: VS Code for scripts/data files.
- Trilium Notes evaluated and rejected (mobile story, non-plain-file storage, weaker ecosystem).
- In-Obsidian scripting confirmed as wanted and bounded (see scripting boundary).

## Article-driven amendments (Sept 2026, from research-log articles)

*Sources: Stevance logbook guide · Lantsoght (AcademicTransfer) · Surrey AcWriMo thesis diary · OpenStax research log · Stony Brook lab notebook · LSE PhD Log. User adopted all except the "where-I'll-start-tomorrow" closing line (rejected).*

### Daily Log amendments
- **Newest-first display** (Surrey): log views + dashboard render latest entries at top — "the first thing I see is the last thing I did."
- **Admin credit** (Surrey): formalities/admin tasks are counted and credited in the weekly review — invisible work becomes visible.
- **Bad days are data** (Surrey): confirmed no-guilt design — low energy ratings are data points, not failures.

### Work Unit conventions
- **Failure logging is first-class** (Stony Brook): failed runs, crashed jobs, wrong parameters get captured via the cheap two-tier `run` path and become searchable. Rationale: "mistakes I don't want to make twice" + MAHE DAC requires "challenges encountered" to be discussed — failure notes feed the progress report.
- **Short, consistent titles** (Stevance): the one-line question follows stable naming conventions (e.g. `docking — usnic vs DHFR`), never prose paragraphs.
- **Cross-reference by ID** (Stevance): every figure/result traces to `wu-XXXX`; script paths live in outputs. Nothing floats unreferenced. Never delete — strike through (git preserves history).

### Paper amendments
- **"Connection to my thesis" validated as the key field** (OpenStax three-column model: Information | Connection to thesis | Cross-references). Cross-references between papers become explicit wiki-links, not prose mentions.

### Daily Log tag addition
- **`#question` tag** (OpenStax): open questions ("what do I still need to find?") captured as tagged lines; harvested into an **Open Questions** view that the weekly review revisits — the literature-gap tracker.

### Meeting Note amendment
- **Informal interactions recordable** (LSE PhD Log): any substantive interaction with the guide (email, call, WhatsApp) can be captured as a one-line dated record. Cheap insurance for disputes; MAHE's formal record remains DAC minutes, but this is the personal protective layer. Record promptly, never year-end.

### Logbook hard-copy split (Section 19 mandate)
- **Digital log = master record** (vault, phone capture, tags, auto-report — unchanged).
- **Hard copy = compliance artifact:** weekly review generates a clean printable A4 logbook page (week's dated entries, compact table, date + guide signature line), printed into a physical notebook/binder and shown to the guide weekly for review/approval per Section 19. Same pages submitted in full before thesis NOC.
- **Build item:** one-command "print this week's logbook" (print-friendly rendering from tagged entries) — added to build plan under ticket 12.

## Deferred checkpoints
- **Month 1:** extract-level screening? → Material extract promotion. Real workflow from guide → type tags shift.
- **Joining email:** registration date anchors all relative milestone dates; verify publication rules against registration letter.
- **Conference targets:** MPCON 2026 (28–29 Oct, abstract ~30 Sep) noted as nearest; full tracker later.
