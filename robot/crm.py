"""Read and write CRM rows (CONTRACT.md) through Supabase's REST API.

Credentials: robot/.env (CRM_URL, CRM_SERVICE_KEY), git-ignored. The service key bypasses row
security, so it stays on this computer and only this module uses it.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request

from fetch import env


class Crm:
    def __init__(self) -> None:
        e = env()
        missing = [k for k in ("CRM_URL", "CRM_SERVICE_KEY") if not e.get(k)]
        if missing:
            raise SystemExit(f"robot/.env is missing {', '.join(missing)} (see robot/.env.example)")
        self.base = e["CRM_URL"].rstrip("/") + "/rest/v1/"
        self.key = e["CRM_SERVICE_KEY"]

    def _req(self, method: str, path: str, body=None, prefer: str = "") -> list | dict | None:
        headers = {"apikey": self.key, "Content-Type": "application/json"}
        if prefer:
            headers["Prefer"] = prefer
        req = urllib.request.Request(self.base + path, method=method, headers=headers,
                                     data=json.dumps(body).encode() if body is not None else None)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                raw = r.read().decode()
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"{method} {path}: {e.code} {e.read().decode()[:300]}") from None
        return json.loads(raw) if raw else None

    def get(self, table: str, **params: str) -> list:
        return self._req("GET", f"{table}?{urllib.parse.urlencode(params)}")

    def update(self, table: str, data: dict, **filters: str) -> list:
        return self._req("PATCH", f"{table}?{urllib.parse.urlencode(filters)}", data,
                         prefer="return=representation")

    def insert(self, table: str, row: dict) -> dict:
        return self._req("POST", table, row, prefer="return=representation")[0]
