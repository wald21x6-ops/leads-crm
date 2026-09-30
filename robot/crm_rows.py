"""Shared helpers: domains and US area-code → state checks."""
from __future__ import annotations

from urllib.parse import urlparse


def bare_domain(url: str) -> str:
    if not url:
        return ""
    host = urlparse(url if "//" in url else "//" + url).netloc.lower()
    return host.removeprefix("www.")


# Area codes the location check knows (TX and GA so far); a mismatch means the location needs checking.
# Add your states' codes here to extend the check.
AREA_STATE = {**dict.fromkeys("214 469 972 945 817 682 940 903 430 254 512 737 832 713 281 346 210 726 915 806 325 432 361 956 979 936 409".split(), "TX"),
              **dict.fromkeys("404 470 678 770 943 706 762 912 229 478".split(), "GA")}


def area_state(e164: str) -> str:
    return AREA_STATE.get(e164[2:5], "") if e164.startswith("+1") else ""
