// PhDOS Worker — GitHub OAuth gate + write proxy (pattern: udit-001/workouts).
// READS: vault files deploy with the site (assets dir = repo root) and are
// gated by login — same as workouts' content/. WRITES: the user's own OAuth
// token (scope: repo), returned at login, is stored in the signed session and
// used server-side by /api/write. Browser holds no credentials; no PAT needed.

const encoder = new TextEncoder();
const SESSION_DAYS = 30;

/* ---------- session helpers (HMAC-signed cookie, from workouts _auth.js) ---------- */
const b64url = (bytes) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};
const unb64url = (v) => {
  const padded = v.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded + "=".repeat((4 - (padded.length % 4)) % 4)), (c) => c.charCodeAt(0));
};
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(msg))));
}
async function signSession(secret, data) {
  const payload = b64url(encoder.encode(JSON.stringify(data)));
  return `${payload}.${await hmac(secret, payload)}`;
}
async function verifySession(secret, token) {
  if (!token?.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if (sig !== (await hmac(secret, payload))) return null;
  try {
    const s = JSON.parse(new TextDecoder().decode(unb64url(payload)));
    return s.exp && s.exp * 1000 > Date.now() ? s : null;
  } catch { return null; }
}
function parseCookies(request) {
  const out = {};
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) out[k] = decodeURIComponent(v.join("=") || "");
  }
  return out;
}

/* ---------- config from env ---------- */
const env_ = (env) => ({
  repo: env.GITHUB_REPO || "SwatiBio/phd-system",
  branch: env.GITHUB_BRANCH || "main",
  allowed: new Set((env.AUTH_ALLOWED_GITHUB_LOGINS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)),
  clientId: env.GITHUB_CLIENT_ID,
  clientSecret: env.GITHUB_CLIENT_SECRET,
  sessionSecret: env.AUTH_SESSION_SECRET,
  cookieName: "phdos_session",
});
const isPublic = (p) =>
  p === "/login" || p === "/logout" || p.startsWith("/oauth/") || p.startsWith("/admin");

/* ---------- login page (quiet) ---------- */
const loginPage = (msg, next) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>PhD-OS — sign in</title>
<style>*{box-sizing:border-box;margin:0}body{font-family:Inter,system-ui,sans-serif;background:#fff;color:#000;
min-height:100vh;display:grid;place-items:center;padding:24px}main{max-width:22rem;width:100%}
h1{font-size:22px;font-weight:600;letter-spacing:-.01em}p{color:rgb(0 0 0/64%);font-size:15px;margin-top:8px}
a{display:block;text-align:center;margin-top:24px;padding:12px 20px;background:#000;color:#fff;border-radius:8px;
text-decoration:none;font-weight:500}a:hover{background:rgb(0 0 0/82%)}small{display:block;margin-top:16px;color:rgb(0 0 0/56%)}</style>
</head><body><main><h1>PhD-OS</h1><p>${msg}</p>
<a href="/oauth/start?next=${encodeURIComponent(next || "/")}">Sign in with GitHub</a>
<small>Your vault stays private — this gate only proves who you are.</small></main></body></html>`;

/* ---------- github helpers ---------- */
const GH = "https://api.github.com";
async function ghApi(token, repo, path, init = {}) {
  const r = await fetch(`${GH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.raw",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  return r;
}
const safePath = (p) => {
  if (!p || p.includes("..") || p.startsWith("/")) return null;
  const ok = ["daily/", "research/", "later/", "system/milestones/", "system/templates/"];
  return ok.some((pre) => p.startsWith(pre)) ? p : null;
};

/* ---------- worker ---------- */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cfg = env_(env);
    const next = url.searchParams.get("next") || "/";
    const redirect = (to) => Response.redirect(new URL(to, url.origin).toString(), 302);

    // missing config → explain, don't 500
    if (!cfg.sessionSecret || !cfg.clientId || !cfg.clientSecret) {
      return new Response(loginPage("Setup incomplete — worker secrets are missing (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, AUTH_SESSION_SECRET).", "/"), { headers: { "content-type": "text/html" } });
    }
    // public routes
    if (isPublic(url.pathname)) {
      if (url.pathname === "/login") {
        return new Response(loginPage("Your vault, one glance a day.", next), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      }
      if (url.pathname === "/logout") {
        return new Response(null, { status: 302, headers: { Location: "/login", "Set-Cookie": `${cfg.cookieName}=; Max-Age=0; Path=/; HttpOnly; Secure` } });
      }
      if (url.pathname === "/oauth/start") {
        const state = await signSession(cfg.sessionSecret, { n: crypto.randomUUID().slice(0, 8), next, exp: Math.floor(Date.now() / 1000) + 600 });
        const auth = new URL("https://github.com/login/oauth/authorize");
        auth.searchParams.set("client_id", cfg.clientId);
        auth.searchParams.set("redirect_uri", `${url.origin}/oauth/callback`);
        auth.searchParams.set("scope", "repo");
        auth.searchParams.set("state", state);
        return redirect(auth.toString());
      }
      if (url.pathname === "/oauth/callback") {
        const state = await verifySession(cfg.sessionSecret, url.searchParams.get("state") || "");
        if (!state) return new Response(loginPage("Sign-in expired — try again.", "/"), { status: 400, headers: { "content-type": "text/html" } });
        const tok = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: cfg.clientId, client_secret: cfg.clientSecret, code: url.searchParams.get("code") }),
        }).then((r) => r.json());
        if (!tok.access_token) return new Response(loginPage("GitHub sign-in failed — no token returned.", "/"), { status: 401, headers: { "content-type": "text/html" } });
        const me = await fetch(`${GH}/user`, { headers: { Authorization: `Bearer ${tok.access_token}` } }).then((r) => r.json());
        if (!cfg.allowed.has((me.login || "").toLowerCase())) {
          return new Response(loginPage(`Signed in as ${me.login || "?"}, but this app is private. Ask the owner to allowlist you.`, "/"), { status: 403, headers: { "content-type": "text/html" } });
        }
        const session = await signSession(cfg.sessionSecret, { login: me.login, gh: tok.access_token, exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400 });
        return new Response(null, { status: 302, headers: { Location: state.next || "/", "Set-Cookie": `${cfg.cookieName}=${encodeURIComponent(session)}; Max-Age=${SESSION_DAYS * 86400}; Path=/; HttpOnly; Secure; SameSite=Lax` } });
      }
      // /admin and other public paths → static assets
      return env.ASSETS.fetch(request);
    }

    // gated: session required
    const session = await verifySession(cfg.sessionSecret, parseCookies(request)[cfg.cookieName] || "");
    if (!session) {
      if ((request.headers.get("accept") || "").includes("text/html") && request.method === "GET") {
        return redirect(`/login?next=${encodeURIComponent(url.pathname + url.search)}`);
      }
      return new Response(JSON.stringify({ error: "authentication required" }), { status: 401, headers: { "content-type": "application/json" } });
    }

    // /api/write — commit via the user's own OAuth token (stored in session)
    if (url.pathname === "/api/write") {
      if (request.method !== "PUT") return new Response(JSON.stringify({ error: "method" }), { status: 405, headers: { "content-type": "application/json" } });
      const body = await request.json();
      const p = safePath(body.path);
      if (!p || typeof body.text !== "string") return new Response(JSON.stringify({ error: "bad request" }), { status: 400, headers: { "content-type": "application/json" } });
      const meta = await ghApi(session.gh, cfg.repo, `/repos/${cfg.repo}/contents/${p}`).then((r) => (r.status === 404 ? null : r.json()));
      const put = await ghApi(session.gh, cfg.repo, `/repos/${cfg.repo}/contents/${p}`, {
        method: "PUT",
        body: JSON.stringify({
          message: (body.message || "app edit").slice(0, 200),
          content: btoa(unescape(encodeURIComponent(body.text))),
          branch: cfg.branch,
          ...(meta?.sha ? { sha: meta.sha } : {}),
        }),
      });
      if (!put.ok) return new Response(JSON.stringify({ error: `github ${put.status}` }), { status: 502, headers: { "content-type": "application/json" } });
      return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
    }

    // gated static assets
    return env.ASSETS.fetch(request);
  },
};
