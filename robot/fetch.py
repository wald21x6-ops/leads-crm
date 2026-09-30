"""The robot's only door to the web.

  get(url)     a page's raw HTML. Plain download first (free). If that fails and a Firecrawl key is set,
               Firecrawl fetches it instead (1 credit).
  search(q)    web search results [{url, title, description}]. Needs FIRECRAWL_API_KEY (1 credit each);
               without a key it returns [] and the robot skips the search steps.

Keys live in robot/.env (git-ignored):  FIRECRAWL_API_KEY=fc-...
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path

ENV = Path(__file__).parent / ".env"
FIRECRAWL = "https://api.firecrawl.dev"
UA = "Mozilla/5.0 (compatible; leads-crm-robot/1.0)"
TIMEOUT = 30


def env() -> dict:
    """robot/.env, overridden by real environment variables."""
    vals = {}
    if ENV.exists():
        for line in ENV.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                vals[k.strip()] = v.strip().strip('"').strip("'")
    return {**vals, **{k: v for k, v in os.environ.items() if k in vals or k.startswith(("CRM_", "FIRECRAWL_"))}}


def firecrawl_key() -> str:
    return env().get("FIRECRAWL_API_KEY", "")


def _firecrawl(path: str, body: dict) -> dict:
    req = urllib.request.Request(FIRECRAWL + path, data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {firecrawl_key()}",
                                          "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        return {"success": False, "error": f"firecrawl {e.code}: {e.read().decode('utf-8', 'replace')[:200]}"}
    except (urllib.error.URLError, TimeoutError) as e:
        return {"success": False, "error": f"firecrawl: {e}"}


def get(url: str) -> dict:
    """{"ok", "content", "provider", "error_kind"}"""
    url = url if "//" in url else "https://" + url
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml"})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            html = r.read(3_000_000).decode(r.headers.get_content_charset() or "utf-8", "replace")
        if html.strip():
            return {"ok": True, "content": html, "provider": "direct"}
        kind = "empty"
    except urllib.error.HTTPError as e:
        kind = f"http_{e.code}"
    except Exception as e:  # DNS, TLS, timeout: the site could not be reached
        kind = type(e).__name__
    if not firecrawl_key():
        return {"ok": False, "content": "", "provider": "direct", "error_kind": kind}
    res = _firecrawl("/v2/scrape", {"url": url, "formats": ["rawHtml"]})
    html = (res.get("data") or {}).get("rawHtml") or ""
    if res.get("success") and html:
        return {"ok": True, "content": html, "provider": "firecrawl"}
    return {"ok": False, "content": "", "provider": "firecrawl", "error_kind": res.get("error", kind)[:120]}


def search(q: str, n: int = 6) -> dict:
    """{"ok", "data": [{url, title, description}], "error"}"""
    if not firecrawl_key():
        return {"ok": False, "data": [], "error": "no FIRECRAWL_API_KEY in robot/.env"}
    res = _firecrawl("/v2/search", {"query": q, "limit": n})
    if not res.get("success"):
        return {"ok": False, "data": [], "error": res.get("error", "search failed")}
    data = res.get("data") or []
    return {"ok": True, "data": data.get("web", []) if isinstance(data, dict) else data}
