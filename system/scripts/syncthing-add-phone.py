# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Pair the phone with the laptop's Syncthing and share the phd-system folder."""
import json
import pathlib
import re
import sys
import urllib.request

HOME = pathlib.Path.home() / "AppData/Local/Syncthing"
cfg_xml = (HOME / "config.xml").read_text(encoding="utf-8")
api_key = re.search(r"<apikey>(.*?)</apikey>", cfg_xml).group(1)

PHONE_ID = "BIQ2YQ3-LNVUD7P-TK7LSAN-XROSTND-ZOWRG5S-QMRFYZA-GEQD4MQ-CKVXPQ2"

def rest(path, method="GET", body=None):
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

have = {d["deviceID"] for d in cfg["devices"]}
if PHONE_ID not in have:
    cfg["devices"].append({
        "deviceID": PHONE_ID,
        "name": "phone",
        "compression": "metadata",
        "introducer": False,
    })
    print("phone device added")

for f in cfg["folders"]:
    if f["id"] == "phd-system":
        fids = {d["deviceID"] for d in f["devices"]}
        if PHONE_ID not in fids:
            f["devices"].append({"deviceID": PHONE_ID})
            print("folder shared with phone")

rest("/rest/config", "PUT", cfg)
print("config applied — pairing live")
