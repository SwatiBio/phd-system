"""Reproduce Sveltia's two load-time warnings at config level.

Sveltia CMS validates at runtime:
  1. a collection `slug:` template may only reference fields that exist in that collection
  2. a relation widget's `search_fields:` may only reference fields of the REFERENCED collection
Our validate-cms.py (jsonschema + adapter conformance) checks neither. This does.

Run:  uv run --with pyyaml --no-project scripts/check-sveltia-relations.py
"""
import pathlib, re, sys
import yaml

config = yaml.safe_load(
    (pathlib.Path(__file__).parent.parent / "site/admin/config.yml").read_text(encoding="utf-8")
)
collections = {c["name"]: c for c in config["collections"]}

def field_names(coll):
    return {f["name"] for f in coll.get("fields") or []}

failures = []

# 1. slug templates reference declared fields (plus CMS-provided {{slug}}/{{year}}...)
BUILTIN = {"slug", "year", "month", "day", "hour", "minute", "second"}
for name, coll in collections.items():
    template = coll.get("slug")
    if not template:
        continue
    declared = field_names(coll)
    for ref in re.findall(r"\{\{([^}]+)\}\}", template):
        ref = ref.strip().split(".")[0]
        if ref not in declared and ref not in BUILTIN:
            failures.append(
                f"{name}: slug '{template}' references '{ref}', "
                f"which is not a field of this collection (declared: {sorted(declared)})"
            )

# 2. relation search_fields must exist in the referenced collection
for name, coll in collections.items():
    for f in coll.get("fields") or []:
        if not isinstance(f, dict) or f.get("widget") != "relation":
            continue
        target = collections.get(f.get("collection"))
        if not target:
            failures.append(f"{name}.{f['name']}: references unknown collection '{f.get('collection')}'")
            continue
        target_fields = field_names(target)
        for sf in f.get("search_fields") or []:
            base = sf.split(".")[0]
            if base not in target_fields:
                failures.append(
                    f"{name}, material/field '{f['name']}': search_field '{sf}' is not a field "
                    f"of the '{f['collection']}' collection (declared: {sorted(target_fields)})"
                )

if failures:
    print("RED — Sveltia runtime errors reproduced:")
    for f in failures:
        print(f"  {f}")
    sys.exit(1)
print("GREEN — every slug template and relation search_field resolves")
