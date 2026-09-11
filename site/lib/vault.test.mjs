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
