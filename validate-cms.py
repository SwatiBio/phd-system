"""Validate the object definition.

Two jobs, one seam — both answer "is what we call an object coherent?":

  1. SCHEMA      site/admin/config.yml must match the Sveltia CMS JSON schema.
  2. CONFORMANCE every adapter that creates an object must agree with the one
                 definition in config.yml. Today there are two adapters: the CMS
                 form, and .github/scripts/zotero_import.py. Drift between them is
                 how a Paper ended up meaning three different things.

Run:  uv run --with pyyaml,jsonschema --no-project validate-cms.py
Downloads the schema to a local cache (gitignored) on first run.
"""
import json, pathlib, re, sys
import urllib.request
import yaml
from jsonschema import Draft7Validator

SCHEMA_URL = "https://unpkg.com/@sveltia/cms/schema/sveltia-cms.json"
CACHE = pathlib.Path(".sveltia-schema.json")
CONFIG = pathlib.Path("site/admin/config.yml")
ROOT = pathlib.Path(".")
FAILED = False

if not CACHE.exists():
    CACHE.write_bytes(urllib.request.urlopen(SCHEMA_URL).read())

schema = json.loads(CACHE.read_text(encoding="utf-8"))
config = yaml.safe_load(CONFIG.read_text(encoding="utf-8"))

# ---------------------------------------------------------------- 1. schema
errors = sorted(Draft7Validator(schema).iter_errors(config), key=lambda e: list(e.path))
if not errors:
    print("VALID      config matches the Sveltia schema")
for e in errors:
    FAILED = True
    path = ".".join(str(p) for p in e.path) or "(root)"
    print(f"ERROR      {path}: {e.message[:200]}")
    for c in list(e.context or [])[:6]:
        cpath = ".".join(str(p) for p in c.path) or "(root)"
        print(f"    -      {cpath}: {c.message[:200]}")

# ------------------------------------------------------- 2. conformance
COLLECTIONS = {c["name"]: c for c in config.get("collections", []) or []}
problems = []


def declared(name):
    """Keys a collection owns, plus the ones the CMS itself writes."""
    coll = COLLECTIONS.get(name) or {}
    keys = {"title"}                      # Sveltia labels entries by title
    for f in coll.get("fields") or []:
        if isinstance(f, dict) and f.get("name"):
            keys.add(f["name"])
    return keys


def sections(text):
    return [ln.strip() for ln in str(text).splitlines() if ln.strip().startswith("## ")]


def body_default(name):
    for f in (COLLECTIONS.get(name) or {}).get("fields") or []:
        if isinstance(f, dict) and f.get("name") == "body" and f.get("default"):
            return sections(f["default"])
    return None


# 2a. the importer is an adapter at the same seam as the CMS form
#     Papers is split into two filtered collections (papers-phd / papers-personal,
#     PHDOS-42) editing the same folder — every split must agree with the importer.
sys.path.insert(0, str(ROOT / ".github" / "scripts"))
try:
    import zotero_import
    paper_splits = [n for n, c in COLLECTIONS.items()
                    if c.get("folder") == "research/papers"]
    if not paper_splits:
        problems.append("no CMS collection covers research/papers — papers are uneditable")
    importer_sections = sections(zotero_import.TEMPLATE_BODY)
    for name in paper_splits:
        want, got = body_default(name), importer_sections
        if want != got:
            problems.append(
                f"{name}: zotero_import.TEMPLATE_BODY sections do not match the CMS body default\n"
                f"           CMS:      {want}\n           importer: {got}"
            )
except Exception as exc:                                       # noqa: BLE001
    problems.append(f"could not load zotero_import.py to compare paper sections: {exc}")

# 2b. concepts folder must exist (created on first concept)
concepts_coll = COLLECTIONS.get("concepts")
if concepts_coll and concepts_coll.get("folder"):
    concepts_dir = ROOT / concepts_coll["folder"]
    if not concepts_dir.is_dir():
        problems.append(f"concepts folder '{concepts_coll['folder']}' does not exist — create it")

# 2c. whatever any adapter already wrote must use declared fields
for name, coll in COLLECTIONS.items():
    folder = coll.get("folder")
    if not folder:
        continue
    allowed = declared(name)
    for path in sorted((ROOT / folder).glob("*.md")):
        fm = re.match(r"^---\n(.*?)\n---", path.read_text(encoding="utf-8"), re.S)
        if not fm:
            continue
        for line in fm.group(1).splitlines():
            key = line.split(":", 1)[0].strip()
            if key and key not in allowed:
                problems.append(
                    f"{path}: frontmatter key '{key}' is not declared in the '{name}' collection "
                    f"(declared: {sorted(allowed)})"
                )

if problems:
    FAILED = True
    print(f"DRIFT      {len(problems)} object-definition problem(s):")
    for p in problems:
        print(f"    -      {p}")
else:
    print("VALID      every adapter agrees with config.yml")

raise SystemExit(1 if FAILED else 0)
