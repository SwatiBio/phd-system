# Agents — PhD-OS

## What this is

GitHub private repo (`SwatiBio/phd-system`, branch `main`) serving as a vault. Cloudflare Worker (`worker.js`) handles GitHub OAuth, proxies writes to the GitHub API, and serves the repo as static assets. Sveltia CMS at `/admin/` edits commit straight to the repo. No separate database.

**Deployed at:** https://phd-os.swatibio.workers.dev/
- `/` — dashboard (today view, log form, streak, next milestone)
- `/tasks.html` — task manager
- `/logbook.html` — printable logbook
- `/timeline.html` — milestone timeline
- `/review.html` — weekly review
- `/digest.html` — paper digest (public, no login)
- `/atlas.html` — knowledge graph (papers + concepts)
- `/admin/` — Sveltia CMS (separate login)
- Branch preview: `https://<branch-name>.phd-os.swatibio.workers.dev/`

**Project tracker:** Lific at http://localhost:3456/PHDOS/ — context, tickets, decisions. Start with handoff **PHDOS-DOC-7** and wayfinder map **PHDOS-DOC-4**.

## Tech stack

- **Runtime:** Cloudflare Workers (V8 isolates, not Node.js)
- **Auth:** GitHub OAuth → HMAC-signed session cookie (30 days), allowlist `SwatiBio`
- **Frontend:** Vanilla JS modules, Basecoat UI, Tailwind (CDN), Phosphor icons
- **CMS:** Sveltia CMS (Decap/Netlify CMS fork), config at `site/admin/config.yml`
- **Data:** Markdown with YAML frontmatter, served as static assets
- **Python:** `py` launcher or `uv run` — never bare `python`
- **Deploy:** `npx wrangler deploy` (worker + assets), secrets in Cloudflare dashboard

## Where things live

| Folder | Contents | Notes |
|---|---|---|
| `daily/` | Logs, tasks, meetings, reviews | **Only folder agents write to.** |
| `daily/logs/` | ISO-week files (`YYYY-Www.md`) | Consumed by `site/lib/logs.js`, `weekly_review.py`, `logbook.html` |
| `daily/tasks/*.md` | One file per task, YAML frontmatter (`title, status, due, recurring`) | Consumed by `site/lib/tasks.js`, `weekly_review.py`, `phd.py`; object model in `config.yml` |
| `daily/meetings/` | Rough piles, refined notes | Fragments separated by `---` |
| `research/` | Materials, work-units, targets, papers | YAML frontmatter is the object model |
| `research/papers/` | Paper notes | Body sections must match `config.yml` defaults |
| `system/` | Scripts, templates, milestones | Do not edit without reason |
| `site/` | Static frontend | Pages wire DOM to `site/lib/*.js` modules |
| `site/lib/` | Deep modules | Each owns one concept; pages consume it |
| `site/admin/config.yml` | CMS config | **Single object definition.** `validate-cms.py` checks adapter drift. |
| `later/` | Writing, publications, money | Parked |
| `.github/workflows/` | 4 CI workflows | See GitHub Actions section below |
| `.github/scripts/` | Python scripts for workflows | `paper_digest.py`, `weekly_review.py`, `zotero_import.py` |

## Rules

**Deploy** — `npx wrangler deploy` uploads both `worker.js` and the entire repo as static assets. `git push` does NOT deploy. `run_worker_first = true` is critical — without it, Cloudflare skips the worker and serves vault files publicly. After deploy, the asset snapshot lags by 1-2 minutes. Secrets (OAuth, session key) live in the Cloudflare dashboard, preserved by `keep_vars = true`.

**Write-through cache** — `site/lib/vault.js` keeps a session-local `lastWrites` map. A file this session wrote is served from memory, not the stale snapshot. Prevents second-save data loss. Do not bypass in page code.

**Sveltia CMS docs — fetch before editing CMS code.** `config.yml` is Decap-compatible, but Sveltia has its own schema. Before editing `site/admin/config.yml` or CMS-related code, fetch `https://sveltiacms.app/llms.txt` and read the relevant page it links as `/en/docs/<page>.md`. For validation, use the official checker: `node scripts/validate-config.mjs site/admin/config.yml` (from repo `sveltia/ai-tools`, needs Node).
Watch for: Sveltia is still pre-1.0 beta (check releases for breaking changes); no Editorial Workflow/Git Gateway; `logo_url` deprecated. Docs live at `sveltiacms.app` (the `.org` domain fails). Our own `validate-cms.py` additionally checks adapter drift with `zotero_import.py`.

**Object model** — `site/admin/config.yml` defines what a "paper", "material", "target", or "work-unit" is. Two adapters create objects: the CMS form and `.github/scripts/zotero_import.py`. `validate-cms.py` catches drift. Changing a field in `config.yml` means updating both adapters.

**Python** — `py` or `uv run`. Never bare `python`. Prefix `PYTHONIOENCODING=utf-8` for non-ASCII output.

**Never commit without asking.** Present the diff, state what changes, wait for confirmation.

## GitHub Actions

All run as `phd-os-bot`, commit back to the repo. None deploy the site.

| Workflow | Trigger | What it does |
|---|---|---|
| `validate.yml` | Push/PR to `config.yml`, `zotero_import.py`, `validate-cms.py`, `research/**/*.md` | Schema conformance + adapter agreement |
| `paper-digest.yml` | Monday 01:00 UTC | OpenAlex search → `research/papers/digest-latest.md` |
| `zotero-import.yml` | Monday 02:00 UTC | Zotero collection → `research/papers/` (needs `ZOTERO_API_KEY`, `ZOTERO_USER_ID` secrets) |
| `weekly-review.yml` | Sunday 12:30 UTC | Week stats → `daily/reviews/latest.md` |

All support `workflow_dispatch`. After any commit, asset snapshot takes 1-2 minutes.

## Business logic

Log format, task format, milestone grammar, MAHE requirements, tag vocabulary, paper note structure, weekly review flow — see [`docs/business-logic.md`](docs/business-logic.md).

## Active work

Branch `feature/ui-update` — log form redesign (chips, autosuggest, today list). Paused on e2e save-path bug. Read `HANDOFF-log-feature.md` before touching log-related code.
