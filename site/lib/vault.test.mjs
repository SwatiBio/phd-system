/* Black-box test for the vault seam (site/lib/vault.js) — no network: the
   fetcher is a fake, which is the module's own test seam.
   Locks the no-store rule: a bare 404 for a not-yet-existing file must never
   be served from the browser cache after the file starts existing (the
   run-3 registry bug: Chrome heuristically cached the 404 for daily/tags.md
   and the page read it for minutes after the first ad-hoc tag save). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { get, put } from "./vault.js";

function fakeFetcher(status, body = "") {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    return { status, ok: status >= 200 && status < 300, text: async () => body };
  };
  return { fetcher, calls };
}

test("get passes cache: no-store so a cached 404 can never mask a new file", async () => {
  const { fetcher, calls } = fakeFetcher(200, "hello");
  const r = await get("daily/tags.md", fetcher);
  assert.equal(r.text, "hello");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init?.cache, "no-store");
});

test("get maps 404 to null (file does not exist yet)", async () => {
  const { fetcher } = fakeFetcher(404);
  assert.equal(await get("daily/logs/2099-W01.md", fetcher), null);
});

test("get throws a descriptive error on real failures", async () => {
  const { fetcher } = fakeFetcher(500);
  await assert.rejects(() => get("daily/tasks/tasks.md", fetcher), /GET daily\/tasks\/tasks\.md: 500/);
});

test("put posts the JSON write envelope and resolves on ok", async () => {
  const { fetcher, calls } = fakeFetcher(200, '{"ok":true}');
  await put("daily/tags.md", "---\n- thesis\n", "tags: thesis", fetcher);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/write");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    path: "daily/tags.md",
    text: "---\n- thesis\n",
    message: "tags: thesis",
  });
});

/* --- write-through: a session write must beat the stale deployed snapshot ---
   Production serves reads from the deployed asset snapshot, which lags a
   GitHub commit by ~1–2 min. A second save that re-reads after its own first
   save used to build on the stale text and the commit ERASED the first entry. */

test("get serves the text of a put this session made, without the network", async () => {
  const origFetch = globalThis.fetch;
  let netCalls = 0;
  globalThis.fetch = async () => { netCalls++; return { status: 200, ok: true, text: async () => "STALE deployed snapshot" }; };
  try {
    const p = `daily/logs/write-through-${Date.now()}.md`;
    await put(p, "## 2026-09-11\n- entry one\n", "log: one");
    const r = await get(p);
    assert.equal(r.text, "## 2026-09-11\n- entry one\n"); // the written text, not the snapshot
    assert.equal(netCalls, 1); // only the put reached the network; get served the cache
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("get with an injected fetcher bypasses the write-through cache (test seam)", async () => {
  const { fetcher } = fakeFetcher(200, "fresh from network");
  await put("daily/tags.md", "old", "m", fakeFetcher(200, "").fetcher); // seed cache on another path
  const r = await get("daily/logs/2099-W99.md", fetcher);
  assert.equal(r.text, "fresh from network");
});

test("put failure surfaces the server's error detail, not a bare status", async () => {
  const { fetcher } = fakeFetcher(502, JSON.stringify({ error: "github 409: sha was not supplied" }));
  await assert.rejects(
    () => put("daily/logs/2026-W37.md", "t", "m", fetcher),
    /PUT daily\/logs\/2026-W37\.md: 502 — github 409: sha was not supplied/,
  );
});

test("get failure surfaces the server's error detail too", async () => {
  const { fetcher } = fakeFetcher(403, JSON.stringify({ error: "rate limited" }));
  await assert.rejects(() => get("daily/tasks/tasks.md", fetcher), /GET daily\/tasks\/tasks\.md: 403 — rate limited/);
});
