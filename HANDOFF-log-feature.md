# Session handoff — "Log what you did" redesign (feature/ui-update)

Status: **PAUSED mid-verification.** All design decisions are final and implemented
(unit-tested green). The e2e save-path check is **unresolved**: two sequential saves
both flash "Saved." but the second save's file write appears to lose the first
entry in stale-router runs. Read the Evidence section before changing code.

## 1. Goal & design (all decided, all implemented)

Redesign of the dashboard log form per the grilled spec (8 questions, user confirmed):

- **Entry**: auto-grow textarea (1-2 rows -> 6 rows, then scroll), Ctrl/Cmd+Enter or
  "Log entry" button submits; multi-line input collapses to ONE bullet
  (`- **HH:MM** text #tags`) — file format and parsers untouched.
- **Chips = shortcuts, text is the source of truth**: clicking a chip inserts
  `#tag` at the caret; clicking a lit chip removes it; lit state derives from the
  text (`hasTag`); deduped.
- **Tags**: 8 curated (`experiment reading idea meeting university writing data
  analysis`) with hover tooltips (`data-tip` -> CSS ::after); any other `#word` is
  free-form.
- **Registry (b2)**: `daily/tags.md`, append-only `- tag — YYYY-MM-DD`; new
  ad-hoc tags registered silently on save (second `/api/write`); consumed ONLY by
  the `#` autosuggest ("Tags" section = curated, "Your tags" = registry).
- **Autosuggest**: `#` at word start opens dropdown; prefix filter; Up/Down +
  Enter/Tab insert, Esc closes, mouse works. Inserts `#tag ` and lights the chip.
- **Today list (Q8)**: last 5 of today's entries under the form, newest first,
  refreshed after each save.
- **Post-save**: "Saved." flash, box clears, chips unlit, streak + today refresh.

## 2. Files changed (all uncommitted)

| File | Change |
| --- | --- |
| `site/lib/tags.js` | NEW — deep module: tag vocabulary + registry rules. Pure, no DOM/fetch. Curated, TAG_DESCRIPTIONS, tagsIn, hasTag, insertTag, removeTag, suggest, newAdHocs, parseRegistry, registryText. Doc comment explains the seam. |
| `site/lib/logs.js` | `norm` now exported; NEW `toEntryLineText(text)` (multi-line -> one line). `iso()` was ALREADY local here (correct). |
| `site/lib/logform.test.mjs` | NEW — node --test, black-box at both seams. 11/11 pass. Includes regression test: `iso` must be LOCAL (see bug 1). |
| `site/index.html` | Textarea + suggest dropdown + today list markup; chip/autosuggest/submit wiring (page only wires DOM to the modules); ISO bug fix (imports `iso` from logs.js). |
| `site/logbook.html` | ISO bug fix (imports `iso` from logs.js). |
| `site/lib/app.css` | textarea, tooltip (chip::after), .suggest dropdown, .log-today, chips[aria-pressed] kept; @starting-style extended with `#log-today > *` + `.suggest`. Motion tokens reused. |
| `.tmp-logrouter.mjs`, `.tmp-logverify.mjs`, `.tmp-vault/`, `.tmp-*.png/.log` | temp verification scaffolding — DELETE before any commit. |

## 3. Bug 1 — FIXED (was pre-existing, user-visible)

**`iso()` was UTC**: `index.html:108` and `logbook.html:56` both defined
`const iso = (d) => d.toISOString().slice(0, 10)`. Between 00:00–05:30 IST the
page's "today" was yesterday — past-midnight entries landed under yesterday's
`## YYYY-MM-DD` section and the today list showed the wrong day. **Fix applied**:
both pages now import the local `iso` from `logs.js` (which was already correct).
Regression test added; proven working (registry date written as local `2026-09-11`
instead of UTC). This is the correct deep-module shape: the seam existed, pages
bypassed it.

## 4. Evidence trail — the OPEN problem (do NOT re-open before reading this)

E2E last run (run-3, driver with polling fix): ALL UI assertions PASS (8 chips,
chip literal light/toggle/insert, autosuggest curated + Enter-accept, save flash,
clear, chips unlit). FAILING cluster (exact outputs):

```
FAIL today list shows the collapsed entry            (empty html — no new row)
FAIL week file has collapsed single-line bullet [[]]  (fetched week had no ## 2026-09-11)
FAIL registry created with #thesis [MISSING]         (fetch /daily/tags.md -> 404)
FAIL # autosuggest offers the custom tag [{items:[],labels:[]}]  (in-page registry empty!)
FAIL today list: 2 entries, newest first [[]]
```

Router write log (`.tmp-router.log`): THREE writes — `[WRITE] daily/logs/2026-W37.md` x2,
`[WRITE] daily/tags.md` — so both saves DID reach the router.

Mirror (`.tmp-vault/daily/logs/2026-W37.md`) after run-3 = **real file + ONLY
save2's bullet** ("12:32 Wrote thesis outline #thesis #writing" under a fresh
`## 2026-09-11`). **save1's bullet ("Ran the assay Then wrote it up #meeting") is
absent** even though save1 flashed "Saved.".

So the second save's `appendEntry` base was the REAL file, NOT (real + save1) —
as if the page's `get()` hit a router whose overlay did not have save1's PUT,
and the in-page registry was also empty at step-9 (registry.set runs before the
"Saved." flash, so it should NOT be empty) — as if the page state was lost
mid-run.

**Ranked hypotheses for the next agent (in order of likelihood):**

1. **Stale router process skewing runs.** `pkill` is unavailable (Git Bash);
   `netstat/taskkill` dance has left orphan routers on :8791 at least once
   (earlier run's driver talked to an OLD router with no [WRITE] logging and a
   stale in-memory overlay, silently corrupting results). Mid-run, save1's PUT may
   land on one instance while the page's subsequent GETs and save2 land on another
   (or vice versa). **Decisive instrument**: log EVERY request (method + path +
   timestamp) in the router; before each run verify the listening PID equals the
   PID the newly spawned node prints; after the run count processes.
2. **Page reload mid-run via vault.js 401 redirect.** `put()` does
   `location.href = "/login"` on any 401 — a redirect would reset registry state
   and explain the empty in-page registry at step-9. The router never sends 401,
   but confirm with: `performance.getEntriesByType("navigation")[0].type` +
   `location.search` at each step, plus a `sessionStorage` boot marker.
3. **GET overlay key mismatch.** PUT keys are stored as exact JSON `path`
   (`daily/logs/...`); GET checks `p.slice(1)` after `normalize(decodeURIComponent)`.
   Appears equal, but verify by logging the key on both sides.

Do NOT trust any assertion that reads the DOM/vault more than ~600ms after a save
previously — that was the run-2 timing bug (page refresh takes longer; the new
poll helper in the driver is the fix; keep it).

## 5. Commands

```bash
# unit
cd C:/Users/hp/Dev/playground/phd-system/site && node --test lib/logform.test.mjs

# e2e  (two terminals)
# 1: router
cd C:/Users/hp/Dev/playground/phd-system && node .tmp-logrouter.mjs   # :8791, overlay-backed PUTs, never touches real vault
# 2: browser + driver
BROWSER_BIN="C:/Program Files/Google/Chrome/Application/chrome.exe" node "C:\Users\hp\.agents\skills\web-browser\scripts\start.js" --headless
node .tmp-logverify.mjs   # asserts + writes .tmp-logfeature.png
```

Router serves the REAL vault on GET (reads are honest); PUTs go to an in-memory
overlay + `.tmp-vault/` mirror. Before each run: kill :8791 listeners
(`netstat -ano | grep :8791`, `taskkill //F //PID <pid>`), `rm -rf .tmp-vault`.

## 6. Context reminders

- Live app: https://phd-os.swatibio.workers.dev (GitHub login, allowlist SwatiBio;
  admin /admin/). Branch preview: https://feature-ui-update.phd-os.swatibio.workers.dev
  (only pushed commits — today's work NOT there). Deploy: `npx wrangler deploy`.
- Branch `feature/ui-update`; NEVER commit/push without asking the user.
- Real week file has only `## 2026-09-10`; machine TZ = IST (UTC+5:30); the
  ISO-local fix matters at 00:00–05:30 IST.
- Consumers of the log format (untouched, must stay so): `site/lib/logs.js`
  (parseLog/appendEntry), `.github/scripts/weekly_review.py` (line-based),
  `logbook.html`, weekly-review skill session.
- App tooling notes: `py`/`uv` for Python; node v22 available; no npm scripts;
  CDN basecoat styles `.input` (textarea has no type attr, matches
  `.input:not([type])`).
- In-app tooltip CSS uses `data-tip` + `.chip::after`; motion tokens: quick 150ms,
  fast 250ms, slow 400ms, ease-smooth-out; @starting-style reveal pattern.

## 7. Next agent's first moves (recommended)

1. Re-read section 4 evidence, add request logging to `.tmp-logrouter.mjs`
   (hypothesis 1 + 3), kill all :8791 processes, re-run the driver, diff the
   write log against the assertions.
2. If the vanished-entry cluster reproduces cleanly, add the reload probe
   (hypothesis 2).
3. Once green: delete all `.tmp-*` + `.tmp-vault/`, re-run unit tests, present
   the diff to the user for review (do not commit).