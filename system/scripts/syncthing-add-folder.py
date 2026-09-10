# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Add phd-system folder to Syncthing: GET full config, append folder, PUT back."""
import json
import pathlib
import re
import sys
import urllib.request

HOME = pathlib.Path.home() / "AppData/Local/Syncthing"
cfg_xml = (HOME / "config.xml").read_text(encoding="utf-8")
api_key = re.search(r"<apikey>(.*?)</apikey>", cfg_xml).group(1)
self_id = re.search(r'<device id="([^"]+)" name=', cfg_xml).group(1)

def rest(path, method="GET", body=None):
    # bypass system proxy — 127.0.0.1 must never route through one
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    req = urllib.request.Request(
        f"http://127.0.0.1:8384{path}",
        data=json.dumps(body).encode() if body is not None else None,
        headers={"X-API-Key": api_key, "Content-Type": "application/json"},
        method=method,
    )
    with opener.open(req) as r:
        body = r.read()
        return json.loads(body) if body else {"ok": True}

cfg = rest("/rest/config")
ids = {f["id"] for f in cfg["folders"]}
if "phd-system" not in ids:
    cfg["folders"].append({
        "id": "phd-system",
        "label": "phd-system",
        "path": r"C:\Users\hp\Dev\playground\phd-system",
        "type": "sendreceive",
        "devices": [{"deviceID": self_id}],
    })
    rest("/rest/config", "PUT", cfg)
    print("folder phd-system added")
else:
    print("already present")

for f in rest("/rest/config/folders"):
    print(f["id"], "->", f["path"])
