#!/usr/bin/env python3
"""Weekly paper digest: search Semantic Scholar for each topic in
research/papers/topics.md, keep papers published in the last N days,
write research/papers/digest-latest.md. Runs on GitHub Actions weekly.

stdlib only. Graceful on API hiccups: partial results still commit.
"""
import json
import urllib.request
import urllib.parse
from datetime import date, timedelta, datetime, timezone

REPO_ROOT = __file__.rsplit("/", 1)[0].replace("/.github/scripts", "").replace("\\.github\\scripts", "")
# resolve from repo layout when run by Actions: repo root = cwd
TOPICS = "research/papers/topics.md"
OUT = "research/papers/digest-latest.md"
DAYS = 8  # overlap a little so nothing indexed late is missed
FIELDS = "title,venue,year,externalIds,publicationDate,tldr,authors"

def read_topics():
    try:
        with open(TOPICS, encoding="utf-8") as f:
            return [l.strip() for l in f if l.strip() and not l.startswith("#")]
    except FileNotFoundError:
        return []

def search_openalex(topic, since):
    q = urllib.parse.urlencode({
        "filter": f"title_and_abstract.search:{topic},from_publication_date:{since}",
        "per-page": 20,
        "sort": "publication_date:desc",
        "mailto": "phd-os-digest",
    })
    req = urllib.request.Request(
        f"https://api.openalex.org/works?{q}",
        headers={"User-Agent": "phd-os-digest (mailto:phd-os-digest)"},
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read().decode("utf-8"))
            break
        except Exception as e:
            print(f"  ! attempt {attempt + 1} failed for '{topic}': {e}")
            if attempt == 2:
                return []
            import time
            time.sleep(3 * (attempt + 1))
    papers = []
    for p in data.get("results") or []:
        pub = p.get("publication_date") or ""
        if not pub or pub < since:
            continue
        doi = (p.get("doi") or "").replace("https://doi.org/", "")
        link = f"https://doi.org/{doi}" if doi else ""
        auths = p.get("authorships") or []
        first = ((auths[0].get("author") or {}).get("display_name") or "?") if auths else "?"
        venue = ((p.get("primary_location") or {}).get("source") or {}).get("display_name") or "—"
        oa = (p.get("best_oa_location") or {})
        oa_url = oa.get("pdf_url") or oa.get("landing_page_url") or ""
        papers.append({
            "title": (p.get("display_name") or "").strip(),
            "link": link,
            "venue": venue,
            "year": (pub[:4]) or "",
            "first": first,
            "oa_url": oa_url,
        })
    seen, uniq = set(), []
    for p in papers:
        k = p["title"].lower()
        if k and k not in seen:
            seen.add(k)
            uniq.append(p)
    return uniq

def main():
    topics = read_topics()
    since = (date.today() - timedelta(days=DAYS)).isoformat()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        f"# New papers — week of {date.today().isoformat()}",
        "",
        f"*Generated {now} from OpenAlex, papers published since {since}. "
        f"Topics live in `research/papers/topics.md`.*",
        "",
    ]
    total = 0
    for topic in topics:
        print(f"topic: {topic}")
        papers = search_openalex(topic, since)
        lines.append(f"## {topic} ({len(papers)})")
        lines.append("")
        if not papers:
            lines.append("*Nothing new this week.*")
            lines.append("")
            continue
        for p in papers:
            total += 1
            title = f"[{p['title']}]({p['link']})" if p["link"] else p["title"]
            oa = f" · [read free]({p['oa_url']})" if p.get("oa_url") else ""
            lines.append(f"- **{title}** — {p['first']} et al., {p['venue']} {p['year']}{oa}")
        lines.append("")
    if total == 0:
        lines.append("*No new papers matched this week.*")
    lines.append(f"*{total} papers total.*")
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {OUT} ({total} papers)")

if __name__ == "__main__":
    main()
