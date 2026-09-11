# SETUP — how to reach your system

GitHub is the storage, the Cloudflare app is the face, Sveltia is the editor. Nothing to install on the laptop.

## Use it

1. **App** — https://phd-os.swatibio.workers.dev — sign in with GitHub (allowlist: `SwatiBio` only). Morning brief, digest, archive, logbook.
2. **Editor** — https://phd-os.swatibio.workers.dev/admin/ — Sveltia CMS; edits commit straight to the repo.
3. **Phone** — same URL in the browser; add to home screen. (Installable PWA polish still pending.)

## How it is wired

- **Storage:** private repo `SwatiBio/phd-system`, branch `main`. The laptop copy is the agent workspace — you never touch git.
- **Worker:** `worker.js` on Cloudflare, name `phd-os` — GitHub OAuth gate, `/api/write`, `/api/zotero/save`, `/api/whoami`, path mapping onto `site/`.
- **Deploy:** `npx wrangler deploy` from the vault root. Pushing to GitHub does **not** deploy.
- **Secrets and vars:** listed in PHDOS-DOC-7 (handoff page). Do not re-decide them.

## Verify it is alive

- Signed out, `https://phd-os.swatibio.workers.dev/` → 401 (the gate)
- Signed in: morning brief shows deadline strip, one task card, streak
- Digest → `-> Zotero` puts the paper in the Phd-OS collection; Monday's robot imports it as a paper note
- `/logbook.html?week=` → printable logbook with the guide signature block
