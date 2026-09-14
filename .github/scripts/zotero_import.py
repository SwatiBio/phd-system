#!/usr/bin/env python3
"""Zotero -> vault paper-note sync.

Reads top-level items from the user's Zotero library (web API), creates or
updates one Paper note per item in research/papers/, deduped by zotero-key.
Fetches child annotations (highlights + margin notes) from each paper's PDF
and writes them into a sync-owned '## Highlights' section. Human sections
(What it did, How, Key result, What it means for me, Sparked) are never
touched by sync — the existing importer rule.

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
OPENALEX_API = "https://api.openalex.org"

# Field spec for a Paper note. These body sections must match the "papers" collection
# default in site/admin/config.yml — validate-cms.py fails if they drift apart.
# '## Highlights' is a sync-owned section — fully regenerated from Zotero state
# on every run; human sections are never clobbered (existing importer rule).
TEMPLATE_BODY = """# {title}

[Zotero]({zotero_uri})

## Highlights

{highlights}

## What it did

## How

## Key result

## What it means for me

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


def strip_html(html_str):
    """Strip HTML tags and decode common entities. Rough but sufficient for
    Zotero note content (which is simple HTML with <p>, <b>, <i>, etc.)."""
    text = re.sub(r"<br\s*/?>", "\n", html_str)
    text = re.sub(r"</p>\s*<p>", "\n\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    text = text.replace("&quot;", '"').replace("&#39;", "'").replace("&nbsp;", " ")
    return text.strip()


def fetch_annotations(user, item_key):
    """Fetch all annotations (highlights + margin notes) and typed Zotero notes
    for a top-level item.

    Zotero Web API v3 chain:
      /items/{itemKey}/children              -> find PDF attachment + notes
      /items/{attachmentKey}/children?itemType=annotation  -> highlights

    Returns a list of dicts sorted by sort_index:
      [{text, comment, page, sort_index, tags}]
    Empty list when no PDF, no annotations, and no notes.
    """
    annotations = []
    try:
        children = api(f"/users/{user}/items/{item_key}/children")
    except Exception:
        return annotations

    # --- typed Zotero notes (itemType=note) ---
    # These are children of the top-level item, not of the PDF.
    for child in children:
        d = child.get("data", {})
        if d.get("itemType") == "note":
            note_html = d.get("note") or ""
            note_text = strip_html(note_html)
            if note_text:
                annotations.append({
                    "text": note_text,
                    "comment": "",
                    "page": "",
                    "sort_index": f"note-{d.get('dateModified', '')}",
                    "tags": [t.get("tag", "") for t in (d.get("tags") or []) if t.get("tag")],
                })

    # --- PDF annotations (highlights + margin notes) ---
    pdf_key = None
    for child in children:
        d = child.get("data", {})
        if d.get("itemType") == "attachment" and d.get("contentType") == "application/pdf":
            pdf_key = d["key"]
            break
    if not pdf_key:
        annotations.sort(key=lambda a: a["sort_index"])
        return annotations
    try:
        ann_items = api(f"/users/{user}/items/{pdf_key}/children?itemType=annotation&limit=100")
    except Exception:
        annotations.sort(key=lambda a: a["sort_index"])
        return annotations
    for ann in ann_items:
        d = ann.get("data", {})
        annotations.append({
            "text": (d.get("annotationText") or "").strip(),
            "comment": (d.get("annotationComment") or "").strip(),
            "page": (d.get("annotationPageLabel") or "").strip(),
            "sort_index": d.get("annotationSortIndex", ""),
            "tags": [t.get("tag", "") for t in (d.get("tags") or []) if t.get("tag")],
        })
    annotations.sort(key=lambda a: a["sort_index"])
    return annotations

def fetch_citation_count(doi):
    """Get cited_by_count from OpenAlex by DOI. Returns 0 on any failure."""
    if not doi:
        return 0
    try:
        clean = doi.strip()
        if not clean.startswith("http"):
            clean = f"https://doi.org/{clean}"
        req = urllib.request.Request(
            f"{OPENALEX_API}/works/doi:{clean}",
            headers={"User-Agent": "phd-os-import (mailto:swati@example.com)"},
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode("utf-8"))
            return data.get("cited_by_count", 0)
    except Exception:
        return 0

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

def render_highlights(annotations):
    """Render the sync-owned Highlights section body from annotations.

    Each annotation becomes a blockquote (the highlight text) with optional
    margin comment and page reference. Untagged annotations are included but
    have no tag line — they are visible on the paper page but excluded from
    Atlas tag threads by design.
    """
    if not annotations:
        return "_No highlights yet._"
    blocks = []
    for ann in annotations:
        parts = []
        if ann["text"]:
            parts.append(f"> {ann['text']}")
        if ann["comment"]:
            parts.append(f"\n{ann['comment']}")
        meta = []
        if ann["page"]:
            meta.append(f"p. {ann['page']}")
        if ann["tags"]:
            meta.append(" ".join(f"#{t}" for t in ann["tags"]))
        if meta:
            parts.append(f"\n_<small>{' · '.join(meta)}</small>_")
        blocks.append("\n".join(parts))
    return "\n\n".join(blocks)


def render(item, citekey_, annotations=None):
    d = item.get("data", {})
    key = d["key"]
    title = (d.get("title") or "Untitled").strip()
    tags = ", ".join(f'"{t["tag"]}"' for t in d.get("tags") or [])
    # authors: full names from Zotero creators
    creators = d.get("creators") or []
    authors_list = []
    for c in creators:
        name = c.get("name") or f"{c.get('firstName', '')} {c.get('lastName', '')}".strip()
        if name:
            authors_list.append(f'"{name}"')
    authors_yaml = f"authors: [{', '.join(authors_list)}]" if authors_list else "authors: []"
    # citations: fetch from OpenAlex if DOI available
    doi = d.get("DOI") or ""
    citations = fetch_citation_count(doi)
    fm = (
        "---\n"
        f'title: "{title}"\n'
        "category: phd\n"
        "status: to-read\n"
        f"tags: [{tags}]\n"
        f'citekey: "{citekey_}"\n'
        f"zotero-key: {key}\n"
        f"{authors_yaml}\n"
        "concepts: []\n"
        f"citations: {citations}\n"
        "---\n"
    )
    uri = f"zotero://select/library/items/{key}"
    hl = render_highlights(annotations or [])
    return fm + TEMPLATE_BODY.format(title=title, zotero_uri=uri, highlights=hl)

# Human-only sections — sync never touches these.
HUMAN_SECTIONS = ["What it did", "How", "Key result", "What it means for me", "Sparked"]

def extract_human_sections(text):
    """Extract the human-written sections from an existing note body.

    Returns a dict {section_name: content} for each human section found.
    The Highlights section is excluded — it is sync-owned.
    HTML comments (e.g. the Sparked hint) are stripped from content.
    """
    sections = {}
    # split on ## headers
    parts = re.split(r"(?m)^## ", text)
    for part in parts[1:]:  # skip content before first header
        header_line = part.split("\n", 1)
        name = header_line[0].strip()
        if name in HUMAN_SECTIONS:
            content = header_line[1].strip() if len(header_line) > 1 else ""
            # strip HTML comments (e.g. <!-- hint text -->)
            content = re.sub(r"<!--.*?-->", "", content, flags=re.S).strip()
            sections[name] = content
    return sections

def reconcile_highlights(old_body, new_highlights_md):
    """Replace the ## Highlights section in old_body with new_highlights_md.

    Human sections (What it did, How, Key result, What it means for me, Sparked)
    are never clobbered — they pass through unchanged. The Highlights section is
    fully regenerated from Zotero state on every sync run.
    """
    # Find the Highlights section boundaries
    hl_start = re.search(r"(?m)^## Highlights\s*$", old_body)
    if not hl_start:
        # No existing Highlights section — insert after the Zotero link line
        # (before the first human section)
        insert_before = re.search(r"(?m)^## (?:What it did|How|Key result|Sparked)", old_body)
        if insert_before:
            pos = insert_before.start()
            return old_body[:pos].rstrip("\n") + "\n\n## Highlights\n\n" + new_highlights_md + "\n\n" + old_body[pos:]
        else:
            return old_body.rstrip("\n") + "\n\n## Highlights\n\n" + new_highlights_md + "\n"
    # Find the next ## header after Highlights
    next_section = re.search(r"(?m)^## (?!Highlights)", old_body[hl_start.end():])
    if next_section:
        end_pos = hl_start.end() + next_section.start()
        return old_body[:hl_start.end()] + "\n" + new_highlights_md + "\n" + old_body[end_pos:]
    else:
        # Highlights is the last section
        return old_body[:hl_start.end()] + "\n" + new_highlights_md + "\n"

def main():
    user = os.environ["ZOTERO_USER_ID"]
    # only import from the user's "Phd-OS" collection (user decision 2026-09-10)
    colls = api(f"/users/{user}/collections")
    coll = next((c for c in colls if (c.get("data", {}).get("name") or "").lower() == "phd-os"), None)
    if not coll:
        print("collection 'Phd-OS' not found in Zotero library — nothing to import")
        return
    coll_key = coll["data"]["key"]
    items = api(f"/users/{user}/collections/{coll_key}/items?format=json&limit=100&sort=dateModified&direction=desc")
    have = existing_keys()
    SKIP_TYPES = {"attachment", "note", "annotation", "webpage"}
    created, updated, synced = 0, 0, 0
    for it in items:
        d = it.get("data", {})
        if d.get("itemType") in SKIP_TYPES or d.get("title") in (None, ""):
            continue
        zk = d["key"]
        ck = citekey(it)
        # fetch annotations for this paper (highlights + margin notes)
        annotations = fetch_annotations(user, zk)
        if annotations:
            print(f"  {zk}: {len(annotations)} annotation(s)")
        body = render(it, ck, annotations)
        if zk in have:
            path, old = have[zk]
            # --- metadata update (minus status) ---
            old_fm = old.split("---")[1] if old.count("---") >= 2 else ""
            new_fm = body.split("---")[1]
            strip_status = lambda fm: re.sub(r"(?m)^status:.*$", "", fm)
            meta_changed = strip_status(old_fm) != strip_status(new_fm)
            # --- Highlights reconciliation ---
            # Extract human sections from old note
            old_body_text = old.split("---", 2)[2].lstrip("\n") if old.count("---") >= 2 else old
            human_sections = extract_human_sections(old_body_text)
            # Rebuild with: metadata (maybe updated) + fresh Highlights + preserved human sections
            new_hl_md = render_highlights(annotations)
            if meta_changed or annotations:
                # reconstruct body: title + zotero link + highlights + human sections
                title_line = d.get("title") or "Untitled"
                uri = f"zotero://select/library/items/{zk}"
                new_body_text = f"# {title_line}\n\n[Zotero]({uri})\n\n## Highlights\n\n{new_hl_md}\n"
                for sec in HUMAN_SECTIONS:
                    content = human_sections.get(sec, "")
                    new_body_text += f"\n## {sec}\n\n{content}\n"
                new_full = "---" + new_fm + "---\n" + new_body_text
                open(path, "w", encoding="utf-8").write(new_full)
                updated += 1
                synced += len(annotations)
                print(f"  updated {path}")
        else:
            path = os.path.join(PAPERS_DIR, f"{ck}.md")
            n = 2
            while os.path.exists(path):
                path = os.path.join(PAPERS_DIR, f"{ck}-{n}.md"); n += 1
            open(path, "w", encoding="utf-8").write(body)
            created += 1
            synced += len(annotations)
            print(f"  created {path}")
    print(f"done: {created} created, {updated} updated, {synced} annotations synced")

if __name__ == "__main__":
    main()
