"""Validate admin/config.yml against the Sveltia CMS JSON schema.

Run:  uv run --with pyyaml,jsonschema --no-project validate-cms.py
Downloads the schema to a local cache (gitignored) on first run.
"""
import json, pathlib
import urllib.request
import yaml
from jsonschema import Draft7Validator

SCHEMA_URL = "https://unpkg.com/@sveltia/cms/schema/sveltia-cms.json"
CACHE = pathlib.Path(".sveltia-schema.json")
CONFIG = pathlib.Path("admin/config.yml")

if not CACHE.exists():
    CACHE.write_bytes(urllib.request.urlopen(SCHEMA_URL).read())

schema = json.loads(CACHE.read_text(encoding="utf-8"))
config = yaml.safe_load(CONFIG.read_text(encoding="utf-8"))

errors = sorted(Draft7Validator(schema).iter_errors(config), key=lambda e: list(e.path))
if not errors:
    print("VALID - config matches Sveltia schema")
for e in errors:
    path = ".".join(str(p) for p in e.path) or "(root)"
    print(f"ERROR at {path}: {e.message[:200]}")
    for c in list(e.context or [])[:6]:
        cpath = ".".join(str(p) for p in c.path) or "(root)"
        print(f"    - {cpath}: {c.message[:200]}")
raise SystemExit(1 if errors else 0)
