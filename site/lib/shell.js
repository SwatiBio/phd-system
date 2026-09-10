/* Shared shell for PhD-OS (feature/ui-update).
   Injects the Basecoat sidebar + top row (hamburger, theme toggle) into every
   page, marks the active link from the URL, hides Sign out when anonymous.
   User-facing content keeps loading below on the page itself.
   Runs after basecoat's all.min.js (both deferred), so the sidebar is
   initialized via basecoat.initAll() right after injection. */

const NAV = [
  {
    label: "Daily",
    items: [
      { href: "/", icon: "house", title: "Today", page: "" },
      { href: "/tasks.html", icon: "check-square", title: "Tasks", page: "tasks.html" },
      { href: "/logbook.html", icon: "book-open", title: "Logbook", page: "logbook.html" },
    ],
  },
  {
    label: "Progress",
    items: [
      { href: "/timeline.html", icon: "calendar-dots", title: "Timeline", page: "timeline.html" },
      { href: "/review.html", icon: "file-text", title: "Week in review", page: "review.html" },
      { href: "/archive.html", icon: "archive", title: "Archive", page: "archive.html" },
    ],
  },
  {
    label: "Research",
    items: [
      { href: "/digest.html", icon: "newspaper", title: "Paper digest", page: "digest.html" },
      { href: "/admin/", icon: "gear", title: "CMS", page: "admin" },
    ],
  },
];

const current = () => {
  const path = location.pathname;
  if (path === "/" || path.endsWith("/index.html")) return "";
  const base = path.split("/").pop() || "";
  return base.startsWith("admin") ? "admin" : base;
};

const group = (g, activePage) => `
  <div role="group" aria-labelledby="grp-${g.label.toLowerCase()}">
    <h3 id="grp-${g.label.toLowerCase()}">${g.label}</h3>
    <ul>
      ${g.items
        .map(
          (i) =>
            `<li><a href="${i.href}" ${i.page === activePage ? 'data-active="true" aria-current="page"' : ""}>
              <i class="ph ph-${i.icon}"></i><span>${i.title}</span>
            </a></li>`,
        )
        .join("")}
    </ul>
  </div>`;

const sidebarHTML = `
<aside id="sidebar" class="sidebar" data-side="left">
  <nav aria-label="Sidebar navigation">
    <header>
      <a href="/" class="flex items-center gap-2">
        <span class="text-lg font-semibold" style="color: var(--sidebar-foreground)">PhD-OS</span>
      </a>
    </header>
    <section class="scrollbar-sm">
      ${NAV.map((g) => group(g, current())).join("")}
    </section>
    <footer>
      <ul>
        <li>
          <a href="/logout"><i class="ph ph-sign-out"></i><span>Sign out</span></a>
        </li>
      </ul>
    </footer>
  </nav>
</aside>`;

const titleFor = (page) => {
  for (const g of NAV) for (const i of g.items) if (i.page === page) return i.title;
  return "PhD-OS";
};

const topRowHTML = `
<div class="app-bar">
  <div class="app-bar-side">
    <button type="button" class="iconbtn menu-toggle" aria-label="Open navigation"
            onclick="document.getElementById('sidebar')?.toggle()">
      <i class="ph ph-list"></i>
    </button>
    <span class="app-bar-title">${titleFor(current())}</span>
  </div>
  <div class="app-bar-side">
    <button type="button" class="iconbtn theme-icons" id="theme-toggle" aria-label="Toggle dark mode"
            onclick="window.basecoat?.theme?.toggle()">
      <i class="ph ph-sun icon-sun"></i>
      <i class="ph ph-moon icon-moon"></i>
    </button>
  </div>
</div>`;

/* inject: sidebar before <main>, top row as first child of <main> */
const main = document.querySelector("main");
document.body.insertAdjacentHTML("afterbegin", sidebarHTML);
if (main) main.insertAdjacentHTML("afterbegin", topRowHTML);

/* let basecoat initialize the freshly injected sidebar */
try { window.basecoat?.initAll?.(); } catch (_) {}

/* hide Sign out when anonymous (matches the old per-page whoami checks) */
fetch("/api/whoami")
  .then((r) => (r.ok ? r.json() : {}))
  .then((j) => {
    if (!j.login) document.querySelectorAll('a[href="/logout"]').forEach((a) => (a.hidden = true));
  })
  .catch(() => {});