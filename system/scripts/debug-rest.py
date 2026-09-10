# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
import json
import urllib.error
import urllib.request

url = "http://127.0.0.1:8384/rest/config"
req = urllib.request.Request(url, headers={"X-API-Key": "cVwcsDsQoeoGExmgM2Ug4RioiPrYWfs2"})
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
try:
    with opener.open(req) as r:
        print("OK", r.status, len(r.read()))
except urllib.error.HTTPError as e:
    print("HTTP", e.code, "url:", e.full_url)
    print("headers:", dict(e.headers))
    print("body:", e.read()[:500])
