# SETUP — 15 minutes, 6 steps

**Do step 2 first** — it lights up the dashboard. The rest is any order, any pace.

## 1 · Open the vault ✅
Obsidian → *Open folder as vault* → `C:\Users\hp\Dev\playground\phd-system`. Reading this in Obsidian = done.

## 2 · Two plugins → dashboard alive
Community plugins → turn off **Restricted mode** → Browse:
1. **Dataview** — install, enable → open `Home.md` → deadline strip + streak render
2. **Tasks** — install, enable → task dates go smart (red when overdue)

Errors on Home.md? Settings → Dataview → enable **JavaScript Queries**.

## 3 · Rest of the plugins (any order)
Calendar · Heatmap Calendar · Kanban · Templater · QuickAdd · Homepage (set to `Home.md`) · Shell Commands · PDF++ · ZotLit

## 4 · Zotero (literature autofill)
Create account (zotero.org) → install Zotero app → install **Better BibTeX** in Zotero → ZotLit in Obsidian → connect. Template: `system/templates/paper-note.md`.

## 5 · GitHub backup
Create **private** repo → in vault folder:
`git remote add origin git@github.com:<you>/phd-system.git && git push -u origin main`
After this: `phd save` does everything.

## 6 · Phone capture + sync
Install **Obsidian mobile** → install **Remotely Save** on both devices → same OneDrive account → same remote folder → set E2E sync password on both.
Phone capture = open `daily/meetings/rough-YYYY-MM.md` or daily log → one line → done.

---

## Verify alive
- `Home.md`: 🔴 strip renders, streak shows 🟩
- Terminal: `phd log "test"` → appears in `daily/logs/2026-09.md`
- `phd week` → logbook page opens in browser
- Write a rough fragment → say "refine the meeting pile" → I shape it
