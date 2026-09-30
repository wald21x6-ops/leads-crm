"""Phone helpers: find a business's main line in page code or text. US numbers only, stored E.164.

tel: links win over numbers in text; among several numbers the most repeated one wins.
"""
from __future__ import annotations

import re
from collections import Counter

TEL = re.compile(r"tel:\+?([\d\-\.\s\(\)]{10,20})", re.I)
# Not glued to letters/digits/slashes: page code (GUIDs, CDN hashes) is full of 10-digit runs.
TEXT = re.compile(r"(?<![\w/.=%-])(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})(?![\w/])")


def us_e164(digits: str) -> str:
    d = re.sub(r"\D", "", digits)
    if len(d) == 11 and d.startswith("1"):
        d = d[1:]
    return f"+1{d}" if len(d) == 10 and d[0] in "23456789" else ""


def best_phone(content: str) -> str:
    tels = [p for p in (us_e164(m) for m in TEL.findall(content)) if p]
    if tels:
        return Counter(tels).most_common(1)[0][0]
    texts = [p for p in (us_e164("".join(m)) for m in TEXT.findall(content)) if p]
    return Counter(texts).most_common(1)[0][0] if texts else ""
