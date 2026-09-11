/* The vault seam, in one place.
 *
 * Every page in the app reads and writes vault files (tasks, logs, milestones).
 * Previously each page carried its own copy of this pair — the error shape and
 * the 401 → /login redirect were re-invented seven times. Deletion test: remove
 * this module and that complexity reappears in every caller. So the redirect
 * and the error messages live here, once.
 *
 * Reads vs writes: production serves reads from the DEPLOYED asset snapshot,
 * which lags a GitHub commit by a minute or two (Workers Builds). A file this
 * session just wrote is fresher than anything the network can say, so put()
 * remembers its text and get() serves it back — write-through. Without this,
 * a second save built its appendEntry on the stale snapshot and the commit
 * ERASED the first entry. In-memory only: a reload falls back to the deployed
 * snapshot, which auto-deploy refreshes within ~1–2 minutes.
 *
 * Interface (everything a caller must know):
 *   get(path)  → { text }            read a vault file (session writes win over
 *                                    the possibly-stale deployed snapshot)
 *             → null                 the file does not exist (404)
 *             → throws Error         "GET path: <status> — <detail>"; detail is
 *                                    the server's error field, when present
 *   put(path, text, message)
 *             → resolves             committed; get(path) now returns `text`
 *             → throws Error         "PUT path: <status> — <detail>" on failure
 *             → NEVER resolves       session expired (401): the user is being
 *                                    sent to /login and the page should stop
 *   list(folder) → [{ name, path }]  files in a folder (empty if none yet)
 *   All accept an optional final fetcher argument (tests pass a fake; no
 *   network, and the write-through cache is bypassed for fakes).
 */

/* Session-local write-through cache: path -> text of the last successful put. */
const lastWrites = new Map();

export async function get(path, fetcher = fetch) {
  if (fetcher === fetch && lastWrites.has(path)) return { text: lastWrites.get(path) };
  // no-store: a bare 404 for a file that does not exist YET (first save of a
  // week file, first ad-hoc tag) must never come back from the browser cache
  // after the file starts existing — that read would lie for minutes.
  const r = await fetcher(`/${path}`, { cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GET ${path}: ${r.status}${await detail(r)}`);
  return { text: await r.text() };
}

export async function put(path, text, message, fetcher = fetch) {
  const r = await fetcher("/api/write", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, text, message }),
  });
  if (r.status === 401) {
    // Not signed in any more — go and come back. The hanging promise is
    // deliberate: callers `await put(...)` and must stop, not double-write.
    location.href = "/login";
    return new Promise(() => {});
  }
  if (!r.ok) throw new Error(`PUT ${path}: ${r.status}${await detail(r)}`);
  if (fetcher === fetch) lastWrites.set(path, text); // fresher than any future read
}

/* list(folder) → [{ name, path }] for the files directly inside the folder,
   [] when the folder does not exist yet (first task before any exists).
   One file per task (daily/tasks/) needs directory reads, not just single-file
   GET/PUT — enumeration belongs at the vault seam, not in pages. */
export async function list(folder, fetcher = fetch) {
  const r = await fetcher(`/api/list?folder=${encodeURIComponent(folder)}`, { cache: "no-store" });
  if (r.status === 404) return [];
  if (!r.ok) throw new Error(`LIST ${folder}: ${r.status}${await detail(r)}`);
  const entries = await r.json().catch(() => []);
  return Array.isArray(entries) ? entries.filter((e) => e.type === "file") : [];
}

/* The server's error field, when it sends one — "PUT x: 502" alone once hid a
   GitHub 401 (dead session token) behind an unrecoverable message. */
async function detail(r) {
  try {
    const d = JSON.parse(await r.text()).error;
    return d ? ` — ${d}` : "";
  } catch {
    return "";
  }
}