# PhD-OS

A private vault and web app for managing a multi-year PhD. GitHub stores the files, a Cloudflare Worker serves the dashboard, Sveltia CMS edits commit straight to the repo. No database.

## What it does

- **Log what you did** — one line, any time, from the dashboard or your phone. Becomes a Section 19 research logbook row.
- **Track tasks** — add, tick off, set due dates. Recurring tasks (registration renewal, DAC reports) roll forward automatically.
- **Print the logbook** — weekly page with signature block, ready for your guide.
- **See what's next** — deadline strip computed from the registration date. Change `reg:` in milestones, the whole timeline moves.
- **Read papers** — weekly digest searches OpenAlex for your topics. Zotero imports paper notes with one click.
- **Weekly review** — stats gathered automatically every Sunday. Verdicts happen in chat.

Pages: dashboard (`/`), tasks, logbook, timeline, review, archive — plus `/digest.html`, the paper digest, which is public and needs no login.
