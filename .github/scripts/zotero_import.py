#!/usr/bin/env python3
"""Zotero -> vault paper-note sync.

Reads top-level items from the user's Zotero library (web API), creates or
updates one Paper note per item in research/papers/, deduped by zotero-key.
Never touches notes that already exist unless Zotero metadata changed.

Env: ZOTERO_API_KEY, ZOTERO_USER_ID. stdlib only.
Run locally:  ZOTERO_API_KEY=... ZOTERO_USER_ID=... uv run --no-project .github/scripts/zotero_import.py
On Actions:   secrets -> env (see zotero-import.yml)
"""
import json
import os
import re
import sys
import urllib.request

PAPERS_DIR = "research/papers"
API = "https://api.zotero.org"

TEMPLATE_BODY = """# {title}

[Zotero]({zotero_uri})

## What it did

## How

## Key result

## Sparked

<!-- 1-3 lines, rough words: what idea did this paper give you? Optional. -->
"""

def api(path):
    req = urllib.request.Request(
        f"{API}{path}",
        headers={
            "Zotero-API-Key": os.environ["ZOTERO_API_KEY"],
            "User-Agent": "phd-os-import",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))

def citekey(item):
    """Stable readable filename key: lastAuthorYearFirstword (BBT-ish, best effort)."""
    d = item.get("data", {})
    creators = d.get("creators") or []
    last = (creators[0].get("lastName") or creators[0].get("name") or "unknown") if creators else "unknown"
    m = re.search(r"\d{4}", d.get("date") or "")
    year = m.group(0) if m else "nd"
    word = re.sub(r"[^A-Za-z]", "", (d.get("title") or "untitled").split()[0] if d.get("title") else "untitled")
    key = f"{last.lower().replace(' ', '')}{year}{word.lower()}"
    return re.sub(r"[^a-z0-9]", "", key) or "untitled"

def existing_keys():
    keys = {}
    if not os.path.isdir(PAPERS_DIR):
        return keys
    for fn in os.listdir(PAPERS_DIR):
        if not fn.endswith(".md"):
            continue
        path = os.path.join(PAPERS_DIR, fn)
        text = open(path, encoding="utf-8").read()
        m = re.search(r"^zotero-key:\s*(\S+)", text, re.M)
        if m:
            keys[m.group(1)] = (path, text)
    return keys

def render(item, citekey_):
    d = item.get("data", {})
    key = d["key"]
    title = (d.get("title") or "Untitled").strip()
    tags = ", ".join(f'"{t["tag"]}"' for t in d.get("tags") or [])
    fm = (
        "---\n"
        f'title: "{title}"\n'
        "category: phd\n"
        "status: to-read\n"
        f"tags: [{tags}]\n"
        f'citekey: "{citekey_}"\n'
        f"zotero-key: {key}\n"
        "---\n"
    )
    uri = f"zotero://select/library/items/{key}"
    return fm + TEMPLATE_BODY.format(title=title, zotero_uri=uri)

def main():
    user = os.environ["ZOTERO_USER_ID"]
    items = api(f"/users/{user}/items?format=json&limit=100&sort=dateModified&direction=desc")
    have = existing_keys()
    SKIP_TYPES = {"attachment", "note", "annotation", "webpage"}
    created, updated = 0, 0
    for it in items:
        d = it.get("data", {})
        if d.get("itemType") in SKIP_TYPES or d.get("title") in (None, ""):
            continue
        zk = d["key"]
        ck = citekey(it)
        body = render(it, ck)
        if zk in have:
            path, old = have[zk]
            # update only when metadata (minus status) changed; never clobber user sections
            old_fm = old.split("---")[1] if old.count("---") >= 2 else ""
            new_fm = body.split("---")[1]
            strip_status = lambda fm: re.sub(r"(?m)^status:.*$", "", fm)
            if strip_status(old_fm) != strip_status(new_fm):
                new_body = "---" + new_fm + "---\n" + old.split("---", 2)[2].lstrip("\n")
                open(path, "w", encoding="utf-8").write(new_body)
                updated += 1
                print(f"  updated {path}")
        else:
            path = os.path.join(PAPERS_DIR, f"{ck}.md")
            n = 2
            while os.path.exists(path):
                path = os.path.join(PAPERS_DIR, f"{ck}-{n}.md"); n += 1
            open(path, "w", encoding="utf-8").write(body)
            created += 1
            print(f"  created {path}")
    print(f"done: {created} created, {updated} updated")

if __name__ == "__main__":
    main()
