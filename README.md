# PhD-OS

A private vault and web app for managing a 3.5-year MAHE PhD. GitHub stores the files, a Cloudflare Worker serves the dashboard, Sveltia CMS edits commit straight to the repo. No database.

**Live:** https://phd-os.swatibio.workers.dev — sign in with GitHub

## What it does

- **Log what you did** — one line, any time, from the dashboard or your phone. Becomes a Section 19 research logbook row.
- **Track tasks** — add, tick off, set due dates. Recurring tasks (registration renewal, DAC reports) roll forward automatically.
- **Print the logbook** — weekly page with signature block, ready for your guide.
- **See what's next** — deadline strip computed from the registration date. Change `reg:` in milestones, the whole timeline moves.
- **Read papers** — weekly digest searches OpenAlex for your topics. Zotero imports paper notes with one click.
- **Weekly review** — stats gathered automatically every Sunday. Verdicts happen in chat.

## Where things live

| You touch | Machinery |
|---|---|
| `daily/logs/` — one file per ISO week | `site/` — dashboard, tasks, logbook, timeline |
| `daily/tasks/tasks.md` — all tasks | `site/lib/` — modules (logs, tasks, milestones, tags, vault) |
| `daily/meetings/` — rough piles | `system/scripts/` — helper library for Actions |
| `research/papers/` — paper notes | `.github/workflows/` — 4 automation workflows |

Everything else is parked (`later/`) or read-only (`system/`).

## How it works

Storage is a private GitHub repo (`SwatiBio/phd-system`). The Cloudflare Worker gates every request behind GitHub OAuth, then serves files from the repo. Writes go through the worker to the GitHub API — the browser holds no credentials.

Deploy: `npx wrangler deploy`. Pushing to GitHub does not deploy.

## Automation

| Workflow | Runs | What |
|---|---|---|
| Paper digest | Monday 01:00 UTC | OpenAlex search → `research/papers/digest-latest.md` |
| Zotero import | Monday 02:00 UTC | Zotero collection → paper notes |
| Weekly review | Sunday 12:30 UTC | Week stats → `daily/reviews/latest.md` |
| Validate | On push/PR | CMS schema + adapter conformance |

All commit back as `phd-os-bot`. None deploy the site.
