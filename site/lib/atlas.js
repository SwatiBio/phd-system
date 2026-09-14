/**
 * Atlas module — knowledge graph + timeline view of papers and concepts.
 *
 * Interface:  init(canvasEl, sidebarEl)
 *   One call wires everything: data loading, parsing, graph, timeline, filters, inspection.
 *   The HTML shell only provides DOM containers and imports this module.
 *
 * Internal seam: two renderers (graph, timeline) share the same data shape.
 * Adding a third view means writing renderX() and registering it — no other changes.
 */
import { get, list } from "/site/lib/vault.js";

/* ── frontmatter parser ─────────────────────────────────────────────── */

function parseFM(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const attrs = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-z-]+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith("[") && v.endsWith("]"))
      v = v.slice(1, -1).split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
    else if (v === "[]") v = [];
    attrs[kv[1]] = v;
  }
  const body = text.slice(m[0].length);
  const sparked = body.match(/## Sparked\n([\s\S]*?)(?=\n## |$)/);
  attrs._sparked = sparked ? sparked[1].trim() : "";
  return attrs;
}

/* ── data loading ───────────────────────────────────────────────────── */

async function loadPapers() {
  const raw = await list("research/papers");
  const papers = [];
  for (const f of raw) {
    if (!f.name.endsWith(".md") || f.name.startsWith("digest-")) continue;
    const r = await get(f.path);
    if (!r) continue;
    const fm = parseFM(r.text);
    if (fm.category === "personal") continue;
    const year = fm.year || (fm.date ? String(new Date(fm.date).getFullYear()) : null);
    papers.push({
      ...fm,
      _path: f.path,
      _slug: f.name.replace(/\.md$/, ""),
      _type: "paper",
      _year: year ? Number(year) : null,
      _citations: Number(fm.citations) || 0,
    });
  }
  return papers;
}

async function loadConcepts() {
  const raw = await list("research/concepts");
  const concepts = [];
  for (const f of raw) {
    if (!f.name.endsWith(".md")) continue;
    const r = await get(f.path);
    if (!r) continue;
    const fm = parseFM(r.text);
    concepts.push({ ...fm, _path: f.path, _slug: f.name.replace(/\.md$/, ""), _type: "concept" });
  }
  return concepts;
}

/* ── graph building (shared by both views) ──────────────────────────── */

function buildGraph(papers, concepts) {
  const conceptSlugs = new Set(concepts.map((c) => c._slug));
  const nodes = [];
  const links = [];
  const nodeMap = {};

  for (const c of concepts) {
    const id = `c:${c._slug}`;
    nodes.push({ id, label: c.title || c._slug, type: "concept", data: c });
    nodeMap[id] = true;
  }

  for (const p of papers) {
    const id = `p:${p._slug}`;
    const r = nodeRadius(p._citations);
    nodes.push({ id, label: (p.title || "").slice(0, 40), type: "paper", status: p.status || "to-read", data: p, radius: r });
    nodeMap[id] = true;
    const pconcepts = Array.isArray(p.concepts) ? p.concepts : [];
    for (const cs of pconcepts) {
      const cid = `c:${cs}`;
      if (nodeMap[cid]) links.push({ source: id, target: cid, type: "concept" });
    }
  }

  // shared-author links between papers
  for (let i = 0; i < papers.length; i++) {
    for (let j = i + 1; j < papers.length; j++) {
      const a1 = Array.isArray(papers[i].authors) ? papers[i].authors : [];
      const a2 = Array.isArray(papers[j].authors) ? papers[j].authors : [];
      if (a1.some((x) => a2.includes(x)) && a1.length) {
        links.push({ source: `p:${papers[i]._slug}`, target: `p:${papers[j]._slug}`, type: "author" });
      }
    }
  }

  return { nodes, links };
}

function nodeRadius(citations) {
  if (!citations) return 6;
  return Math.min(6 + Math.sqrt(citations) * 1.2, 22);
}

/* ── GRAPH RENDERER ─────────────────────────────────────────────────── */

function renderGraph(container, data, onSelect) {
  container.innerHTML = "";
  const width = container.clientWidth;
  const height = container.clientHeight;

  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js";
  script.onload = () => {
    const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${width} ${height}`);
    const g = svg.append("g");
    svg.call(d3.zoom().scaleExtent([0.2, 5]).on("zoom", (e) => g.attr("transform", e.transform)));

    const sim = d3.forceSimulation(data.nodes)
      .force("link", d3.forceLink(data.links).id((d) => d.id).distance(80))
      .force("charge", d3.forceManyBody().strength(-120))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d) => (d.radius || 6) + 4));

    const link = g.append("g").selectAll("line").data(data.links).join("line")
      .attr("class", "link")
      .attr("stroke-dasharray", (d) => d.type === "author" ? "4 2" : "none");

    const node = g.append("g").selectAll("circle").data(data.nodes).join("circle")
      .attr("class", (d) => `node node-${d.type}${d.status ? ` status-${d.status}` : ""}`)
      .attr("r", (d) => d.type === "concept" ? 10 : (d.radius || 6))
      .attr("fill", (d) => d.type === "concept" ? "#6366f1" : undefined)
      .style("cursor", "pointer")
      .call(d3.drag()
        .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on("end", (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    g.append("g").selectAll("text").data(data.nodes.filter((d) => d.type === "concept")).join("text")
      .text((d) => d.label)
      .attr("font-size", "11px").attr("fill", "var(--muted-foreground)")
      .attr("dx", 14).attr("dy", 4);

    node.on("click", (e, d) => { e.stopPropagation(); onSelect(d); });
    svg.on("click", () => onSelect(null));

    sim.on("tick", () => {
      link.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
      node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
      g.selectAll("text").attr("x", (d) => d.x).attr("y", (d) => d.y);
    });
  };
  document.head.appendChild(script);
}

/* ── TIMELINE RENDERER ──────────────────────────────────────────────── */

function renderTimeline(container, papers, concepts, links, onSelect) {
  container.innerHTML = "";
  const W = container.clientWidth || 900;
  const H = container.clientHeight || 500;
  const PAD = { top: 30, bottom: 30, left: 80, right: 30 };

  // --- assign each paper to its first concept ---
  const conceptGroups = {};
  for (const c of concepts) conceptGroups[c._slug] = [];
  conceptGroups["_unlinked"] = [];
  for (const p of papers) {
    const cs = Array.isArray(p.concepts) ? p.concepts : [];
    const slug = cs.length && conceptGroups[cs[0]] ? cs[0] : "_unlinked";
    conceptGroups[slug].push(p);
  }

  // --- sort groups by earliest paper year ---
  const groupEntries = Object.entries(conceptGroups)
    .filter(([, ps]) => ps.length > 0)
    .sort((a, b) => {
      const earliest = (ps) => {
        const ys = ps.map((p) => p._year).filter(Boolean);
        return ys.length ? Math.min(...ys) : 9999;
      };
      return earliest(a[1]) - earliest(b[1]);
    });

  // --- collect all years ---
  const allYears = papers.map((p) => p._year).filter(Boolean);
  if (!allYears.length) {
    container.innerHTML = '<p class="meta" style="padding:1rem">No papers with years found.</p>';
    return;
  }
  const minYear = Math.min(...allYears) - 0.5;
  const maxYear = Math.max(...allYears) + 0.5;
  const yearSpan = maxYear - minYear || 1;
  const innerW = W - PAD.left - PAD.right;
  const xScale = (year) => PAD.left + ((year - minYear) / yearSpan) * innerW;

  // --- compute y positions: each group is a band, papers stack within ---
  const groupGap = 16;
  const rowH = 22;
  const groupY = {};   // slug → top y of group band
  const paperY = {};   // slug → y of this paper
  let curY = PAD.top;

  for (const [slug, ps] of groupEntries) {
    groupY[slug] = curY;
    ps.sort((a, b) => (a._year || 9999) - (b._year || 9999));
    for (let i = 0; i < ps.length; i++) {
      paperY[ps[i]._slug] = curY + i * rowH;
    }
    curY += ps.length * rowH + groupGap;
  }
  const totalH = curY + PAD.bottom;
  container.style.minHeight = totalH + "px";
  container.style.height = totalH + "px";

  // --- build node lookup for links ---
  const nodeById = {};
  for (const p of papers) nodeById[`p:${p._slug}`] = p;

  // --- draw SVG ---
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${totalH}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", totalH);

  // year axis + gridlines
  for (let y = Math.ceil(minYear); y <= Math.floor(maxYear); y++) {
    const x = xScale(y);
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", x); line.setAttribute("y1", PAD.top - 10);
    line.setAttribute("x2", x); line.setAttribute("y2", totalH - PAD.bottom);
    line.setAttribute("stroke", "var(--border)"); line.setAttribute("stroke-opacity", "0.3");
    svg.appendChild(line);
    const txt = document.createElementNS(ns, "text");
    txt.setAttribute("x", x); txt.setAttribute("y", PAD.top - 14);
    txt.setAttribute("text-anchor", "middle"); txt.setAttribute("font-size", "11px");
    txt.setAttribute("fill", "var(--muted-foreground)"); txt.textContent = y;
    svg.appendChild(txt);
  }

  // citation links (curved, no arrows)
  const linksG = document.createElementNS(ns, "g");
  for (const lk of links) {
    if (lk.type !== "concept") continue;
    const src = nodeById[lk.source] || nodeById[lk.target];
    const tgt = nodeById[lk.target] || nodeById[lk.source];
    if (!src || !tgt || !src._year || !tgt._year) continue;
    const x1 = xScale(src._year), y1 = paperY[src._slug];
    const x2 = xScale(tgt._year), y2 = paperY[tgt._slug];
    if (y1 == null || y2 == null) continue;
    const path = document.createElementNS(ns, "path");
    const mx = (x1 + x2) / 2;
    path.setAttribute("d", `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
    path.setAttribute("fill", "none"); path.setAttribute("stroke", "var(--border)");
    path.setAttribute("stroke-opacity", "0.35"); path.setAttribute("stroke-width", "1");
    linksG.appendChild(path);
  }
  svg.appendChild(linksG);

  // concept group labels + horizontal dividers
  for (const [slug] of groupEntries) {
    if (slug === "_unlinked") continue;
    const y = groupY[slug];
    const concept = concepts.find((c) => c._slug === slug);
    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", 4); label.setAttribute("y", y + 11);
    label.setAttribute("font-size", "11px"); label.setAttribute("font-weight", "600");
    label.setAttribute("fill", "#6366f1"); label.textContent = concept?.title || slug;
    svg.appendChild(label);
  }

  // paper nodes
  for (const p of papers) {
    const x = xScale(p._year || minYear);
    const y = paperY[p._slug];
    if (y == null) continue;
    const r = nodeRadius(p._citations);
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", x); circle.setAttribute("cy", y); circle.setAttribute("r", r);
    circle.setAttribute("class", `node node-paper status-${p.status || "to-read"}`);
    circle.style.cursor = "pointer";
    circle.addEventListener("click", (e) => {
      e.stopPropagation();
      onSelect({ id: `p:${p._slug}`, label: (p.title || "").slice(0, 40), type: "paper", status: p.status, data: p });
    });
    svg.appendChild(circle);

    // truncated title next to node
    const txt = document.createElementNS(ns, "text");
    txt.setAttribute("x", x + r + 4); txt.setAttribute("y", y + 4);
    txt.setAttribute("font-size", "10px"); txt.setAttribute("fill", "var(--muted-foreground)");
    txt.textContent = (p.title || "").slice(0, 35) + ((p.title || "").length > 35 ? "…" : "");
    svg.appendChild(txt);
  }

  svg.addEventListener("click", () => onSelect(null));
  container.appendChild(svg);
}

/* ── UI WIRING ──────────────────────────────────────────────────────── */

function wireFilters(container, papers, onUpdate) {
  const counts = {};
  for (const p of papers) counts[p.status || "to-read"] = (counts[p.status || "to-read"] || 0) + 1;
  let active = null;

  function render() {
    const chips = [["all", papers.length], ...Object.entries(counts)];
    container.innerHTML = chips.map(([k, n]) =>
      `<button class="filter-chip" data-filter="${k}" aria-pressed="${(!active && k === "all") || active === k}">${k} (${n})</button>`
    ).join("");
    container.addEventListener("click", (e) => {
      const b = e.target.closest(".filter-chip");
      if (!b) return;
      active = b.dataset.filter === "all" ? null : b.dataset.filter;
      render();
      onUpdate(active);
    });
  }
  render();
}

function wireInspect(panel, node) {
  if (!node) { panel.hidden = true; return; }
  panel.hidden = false;
  const d = node.data;
  document.getElementById("inspect-title").textContent = d.title || node.label;
  const meta = [];
  if (d.authors?.length) meta.push(d.authors.slice(0, 3).join(", ") + (d.authors.length > 3 ? " et al." : ""));
  if (d.status) meta.push(d.status);
  if (d._citations) meta.push(`Cited by: ${d._citations}`);
  document.getElementById("inspect-meta").textContent = meta.join(" · ");
  const con = Array.isArray(d.concepts) ? d.concepts : [];
  document.getElementById("inspect-concepts").textContent = con.length ? `Concepts: ${con.join(", ")}` : "";
  document.getElementById("inspect-sparked").textContent = d._sparked ? `Sparked: ${d._sparked.slice(0, 120)}` : "";
  document.getElementById("inspect-link").href = `/admin/#/collections/${node.type === "concept" ? "concepts" : "papers"}/entries/${d._slug}`;
}

/* ── PUBLIC INTERFACE ────────────────────────────────────────────────── */

export async function init(canvasEl, sidebarEl) {
  const [papers, concepts] = await Promise.all([loadPapers(), loadConcepts()]);
  const { nodes, links } = buildGraph(papers, concepts);

  let viewMode = "graph";
  let activeFilter = null;
  const filtered = () => {
    if (!activeFilter) return nodes;
    return nodes.map((n) => ({ ...n, _hidden: n.type === "paper" && n.status !== activeFilter }));
  };

  // --- wire toggle ---
  const toggleEl = sidebarEl.querySelector("#view-toggle");
  if (toggleEl) {
    toggleEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-view]");
      if (!btn) return;
      viewMode = btn.dataset.view;
      toggleEl.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.view === viewMode));
      draw();
    });
  }

  // --- wire filters ---
  const filtersEl = sidebarEl.querySelector("#filters");
  if (filtersEl) wireFilters(filtersEl, papers, (f) => { activeFilter = f; draw(); });

  // --- draw ---
  function draw() {
    if (viewMode === "graph") {
      renderGraph(canvasEl, { nodes: filtered(), links }, onSelect);
    } else {
      const vis = activeFilter ? papers.filter((p) => p.status === activeFilter) : papers;
      const visSlugs = new Set(vis.map((p) => p._slug));
      const visLinks = links.filter((lk) => {
        const s = String(lk.source).replace(/^p:/, "");
        const t = String(lk.target).replace(/^p:/, "");
        return visSlugs.has(s) || visSlugs.has(t);
      });
      renderTimeline(canvasEl, vis, concepts, visLinks, onSelect);
    }
  }

  function onSelect(node) { wireInspect(document.getElementById("inspect"), node); }
  draw();
}
