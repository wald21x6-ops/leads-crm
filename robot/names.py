"""Is this search hit / website the business we asked about? Name and domain matching.

Nothing here fetches: it is given text and returns a score, and callers treat a low score as
"not sure" rather than guess which business is which.
"""
from __future__ import annotations

import re
from urllib.parse import quote

# Meta Ad Library keyword search; `active_status=active` makes "still running" true.
SEARCH_URL = (
    "https://www.facebook.com/ads/library/"
    "?active_status=active&ad_type=all&country={country}"
    "&q={q}&search_type=keyword_unordered&media_type=all"
)

_NOISE = re.compile(r"[^a-z0-9 ]")
_WS = re.compile(r"\s+")

# Words that carry no identity: matching on the words two names share while ignoring these stops
# the score depending on how long a listing title is.
_STOPWORDS = {
    "dr", "drs", "doctor", "mr", "mrs",
    "clinic", "clinics", "the", "and", "centre", "center", "care", "by",
    "face", "body", "glow", "beauty", "wellness",
    "skin", "hair", "laser", "aesthetic", "aesthetics", "cosmetic", "dental",
    "transplant", "specialist", "dermatology", "dermatologist", "studio",
    "solutions", "india", "co", "pvt", "ltd",
}


def search_url(query: str, country: str = "IN") -> str:
    """The Ad Library URL for one keyword search."""
    return SEARCH_URL.format(country=country, q=quote(query))


def _stem(word: str) -> str:
    """Drop a possessive or plural 's' so one apostrophe does not decide a match."""
    return word[:-1] if len(word) > 3 and word.endswith("s") else word


def _ordered_tokens(name: str) -> list[str]:
    text = _WS.sub(" ", _NOISE.sub(" ", str(name or "").lower())).strip()
    words = [_stem(w) for w in text.split() if len(w) > 1]
    meaningful = [w for w in words if w not in _STOPWORDS]
    # A name made entirely of stopwords ("The Skin Clinic") still has to match something.
    return meaningful or words


def _tokens(name: str) -> set[str]:
    return set(_ordered_tokens(name))


def _shares_identity(a: str, b: str) -> bool:
    """Do these two names overlap on the part that IS the name?

    Any shared word is not enough: two businesses often share a surname or a locality while the
    word they LEAD with (the brand) differs. So the overlap has to contain the first meaningful
    word of one of the two names, and a single shared word only counts when it is the first word
    of both and most of both names.
    """
    oa, ob = _ordered_tokens(a), _ordered_tokens(b)
    if not oa or not ob:
        return False
    shared = set(oa) & set(ob)
    if not shared:
        return False
    if len(shared) == 1:
        return oa[0] == ob[0] and max(len(oa), len(ob)) <= 2
    return oa[0] in shared or ob[0] in shared


def similarity(a: str, b: str) -> float:
    """How much of the shorter name the two share. 1.0 = one contains the other.

    Asymmetric on purpose: a listing title often adds a locality or service list to the short
    brand name, and dividing by the longer name would score the business against itself low.
    """
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb or not _shares_identity(a, b):
        return 0.0
    return len(ta & tb) / min(len(ta), len(tb))


def _squash(value: str) -> str:
    """Letters and digits only, so a typed name and a domain can be compared."""
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def domain_label(website: str) -> str:
    """`https://www.acmeplumbing.com/x` -> `acmeplumbing`."""
    text = re.sub(r"^https?://", "", str(website or "").strip().lower())
    text = re.sub(r"^www\.", "", text).split("/")[0]
    return _squash(text.split(".")[0])


# Below this length a squashed name is too generic to be an identity.
MIN_SQUASH = 8


def domain_similarity(website: str, name: str) -> float:
    """1.0 when the business name and the domain say the same thing with the spaces removed."""
    label = domain_label(website)
    other = _squash(name)
    if len(label) < MIN_SQUASH or len(other) < MIN_SQUASH:
        return 0.0
    if label in other or other in label:
        return 1.0
    return 0.0
