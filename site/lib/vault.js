/* The vault seam, in one place.
 *
 * Every page in the app reads and writes vault files (tasks, logs, milestones).
 * Previously each page carried its own copy of this pair — the error shape and
 * the 401 → /login redirect were re-invented seven times. Deletion test: remove
 * this module and that complexity reappears in every caller. So the redirect
 * and the error messages live here, once.
 *
 * Interface (everything a caller must know):
 *   get(path)  → { text }            read a vault file
 *             → null                 the file does not exist (404)
 *             → throws Error         "GET path: <status>" on real failures
 *   put(path, text, message)
 *             → resolves             committed
 *             → NEVER resolves       session expired; the user is being sent to
 *                                    /login and the page should stop doing work
 *   Both accept an optional second fetcher argument (tests pass a fake; no
 *   network). The default is the global fetch.
 */

export async function get(path, fetcher = fetch) {
  const r = await fetcher(`/${path}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GET ${path}: ${r.status}`);
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
  if (!r.ok) throw new Error(`PUT ${path}: ${r.status}`);
}