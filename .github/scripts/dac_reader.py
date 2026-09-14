"""DAC file reader — adapter at the DAC seam.

Parses system/dac/dac-YYYY-MM.md files into structured data.
Two adapters consume this: the report assembler (dac_report.py)
and potentially the weekly review or dashboard.

Interface:
    load_latest_dac(dac_dir) -> dict | None
    load_all_dacs(dac_dir) -> list[dict]
"""
import os
import re
from datetime import datetime


def _parse_frontmatter(text):
    """Extract YAML-ish frontmatter from markdown (stdlib only, no yaml lib).
    
    Handles multi-line values (e.g., members list with - {name: ..., role: ...}).
    """
    m = re.match(r"^---\n([\s\S]*?)\n---", text)
    if not m:
        return {}, text
    raw_lines = m[1].split("\n")
    fm = {}
    i = 0
    while i < len(raw_lines):
        line = raw_lines[i]
        kv = re.match(r"^([a-z_-]+):\s*(.*)$", line)
        if not kv:
            i += 1
            continue
        key, val = kv.group(1).strip(), kv.group(2).strip()
        # collect multi-line list values (lines starting with '  - ')
        list_items = [val] if val else []
        while i + 1 < len(raw_lines) and re.match(r"^\s+- ", raw_lines[i + 1]):
            i += 1
            list_items.append(raw_lines[i].strip().lstrip("- ").strip())
        if len(list_items) > 1 or (list_items and list_items[0] == ""):
            # multi-line list
            fm[key] = _parse_yaml_list(list_items)
        elif val.startswith("[") and val.endswith("]"):
            fm[key] = [x.strip().strip('"') for x in val[1:-1].split(",") if x.strip()]
        else:
            fm[key] = val
        i += 1
    return fm, text[m.end():]


def _parse_yaml_list(items):
    """Parse a YAML list that may contain {key: val} objects or plain strings."""
    result = []
    for item in items:
        item = item.strip()
        if not item:
            continue
        # check for {name: ..., role: ...} objects
        obj_match = re.findall(r"\{[^}]+\}", item)
        if obj_match:
            for om in obj_match:
                obj = {}
                for pair in om.strip("{}").split(","):
                    if ":" in pair:
                        k, v = pair.split(":", 1)
                        obj[k.strip()] = v.strip().strip('"')
                if obj:
                    result.append(obj)
        else:
            result.append(item.strip().strip('"'))
    return result


def _parse_checklist(text):
    """Parse markdown checklist into [{text, done, deadline}]."""
    items = []
    for m in re.finditer(r"^-\s*\[([ x])\]\s*(.+)$", text, re.M):
        done = m.group(1) == "x"
        raw = m.group(2).strip()
        # extract deadline: "by YYYY-MM" or "by YYYY-MM-DD"
        deadline = None
        dm = re.search(r"\bby\s+(\d{4}-\d{2}(?:-\d{2})?)\b", raw)
        if dm:
            deadline = dm.group(1)
            raw = raw[: dm.start()].rstrip() + raw[dm.end() :].lstrip()
        items.append({"text": raw, "done": done, "deadline": deadline})
    return items


def _parse_list(text):
    """Parse markdown unordered list into [str]."""
    return [m.group(1).strip() for m in re.finditer(r"^-\s+(.+)$", text, re.M)]


def _extract_section(body, heading):
    """Extract content under a ## heading until the next ## or end."""
    pattern = rf"^##\s+{re.escape(heading)}\s*\n([\s\S]*?)(?=\n##\s|\Z)"
    m = re.search(pattern, body, re.M)
    return m.group(1).strip() if m else ""


def parse_dac(text):
    """Parse a DAC file's full text into a structured dict."""
    fm, body = _parse_frontmatter(text)
    return {
        "date": fm.get("date", ""),
        "members": fm.get("members", []),
        "rating": fm.get("rating", ""),
        "suggestions": _parse_list(_extract_section(body, "Suggestions")),
        "changes_to_objectives": _parse_list(_extract_section(body, "Changes to objectives")),
        "action_items": _parse_checklist(_extract_section(body, "Action items")),
        "difficulties": _parse_list(_extract_section(body, "Difficulties")),
        "body": body,
    }


def load_all_dacs(dac_dir="system/dac"):
    """Return all DAC files sorted by date (oldest first)."""
    if not os.path.isdir(dac_dir):
        return []
    dacs = []
    for fn in os.listdir(dac_dir):
        if not fn.endswith(".md"):
            continue
        path = os.path.join(dac_dir, fn)
        text = open(path, encoding="utf-8").read()
        dac = parse_dac(text)
        dac["_path"] = path
        dac["_slug"] = fn.replace(".md", "")
        dacs.append(dac)
    dacs.sort(key=lambda d: d.get("date", "0000-00"))
    return dacs


def load_latest_dac(dac_dir="system/dac"):
    """Return the most recent DAC file, or None."""
    all_dacs = load_all_dacs(dac_dir)
    return all_dacs[-1] if all_dacs else None


if __name__ == "__main__":
    # quick test
    import json
    latest = load_latest_dac()
    if latest:
        print(json.dumps(latest, indent=2, default=str))
    else:
        print("No DAC files found in system/dac/")
