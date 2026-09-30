"""The research robot: researches every CRM lead waiting in `to_research` (CONTRACT.md §8).

Per lead, cheapest first:
  website   search "<name> <city, ST>" if the upload had none (1 credit)
  homepage  plain download (free): chat/booking tools, form, chain signals, business phone, local check
  owner     search owner/founder/president (1 credit) + names printed on the homepage
  reviews   search slow-reply complaint phrases (1 credit) — always stored as unverified
  listings  search the type's lead marketplaces (1 credit, known types only)
  phone     search "<name> <city> phone" only if the homepage had none (1 credit)
Searches need FIRECRAWL_API_KEY in robot/.env; without it they are skipped (see fetch.py).
Then score, write `research` + facts, move the card found -> researched. First lines are written
afterwards by the AI agent from the facts (`lines` / `set-lines`), never by a template.

  python robot/research.py run [--limit N]     research waiting leads
  python robot/research.py run --redo KEY,KEY   re-research named leads (external_key), even if done
  python robot/research.py phones               find a main line for researched leads with none (1 credit each)
  python robot/research.py lines                facts of researched leads that still need a first line
  python robot/research.py set-lines FILE.json  {external_key: sentence} -> CRM
Nothing is ever sent to a business.
"""
from __future__ import annotations

import html as htmllib
import json
import re
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
from crm import Crm  # noqa: E402
from crm_rows import AREA_STATE, area_state, bare_domain  # noqa: E402
from phones import TEL, best_phone, us_e164  # noqa: E402
import names  # noqa: E402  (tested name/domain similarity)
import fetch  # noqa: E402

CACHE = HERE / "cache"
SEARCH_CACHE = CACHE / "search.json"
PAGES = CACHE / "sites"

STATE_TZ = {
    **dict.fromkeys("CT DE DC FL GA IN KY ME MD MA MI NH NJ NY NC OH PA RI SC VT VA WV".split(), "America/New_York"),
    **dict.fromkeys("AL AR IL IA KS LA MN MS MO NE ND OK SD TN TX WI".split(), "America/Chicago"),
    **dict.fromkeys("CO MT NM UT WY ID".split(), "America/Denver"),
    "AZ": "America/Phoenix", "CA": "America/Los_Angeles", "NV": "America/Los_Angeles",
    "OR": "America/Los_Angeles", "WA": "America/Los_Angeles", "AK": "America/Anchorage", "HI": "Pacific/Honolulu",
}
HEALTH = {"medical practice", "dental", "home health / hospice", "senior living"}

# Directory / social hosts are never "their website".
NOT_OWN_SITE = re.compile(
    r"instagram|facebook|fb\.com|yelp|indeed|linkedin|bbb\.org|yellowpages|mapquest|angi\.com|thumbtack|houzz|"
    r"glassdoor|ziprecruiter|nextdoor|google\.|youtube|tiktok|healthgrades|zocdoc|vitals|webmd|npi|doximity|"
    r"x\.com|twitter|avvo|justia|lawyers\.com|findlaw|simplyhired|salary|careerbuilder|buzzfile|zoominfo|"
    r"dnb\.com|opencorporates|bizapedia|chamberofcommerce|manta|porch\.com|homeadvisor|birdeye|superpages|"
    r"opentable|tripadvisor|bit\.ly|weddingwire|theknot|linktr\.ee", re.I)
CHAT = {  # tested signatures; "ngage" pinned to its domain — "engage" is everywhere
    "Podium": r"podium\.com|podium-widget", "Birdeye": r"birdeye\.com", "GoHighLevel chat": r"leadconnectorhq|msgsndr|widgets\.leadconnector",
    "Intercom": r"widget\.intercom\.io|intercomcdn|intercomSettings", "Drift": r"js\.driftt|drift\.com", "Tawk": r"tawk\.to",
    "LiveChat": r"livechatinc|cdn\.livechat", "Tidio": r"tidio", "Crisp": r"crisp\.chat", "Olark": r"olark",
    "Zendesk chat": r"zopim|zdassets", "HubSpot chat": r"hs-scripts|usemessages", "Smith.ai": r"smith\.ai",
    "Ngage": r"ngagelive|ngage\.(?:com|net)", "ApexChat": r"apexchat", "Signpost": r"signpost\.com", "Weave": r"getweave|weave\.com",
    "Freshchat": r"freshchat|wchat\.freshchat", "FB Messenger": r"customerchat",
    "Chatbot (AI)": r"chatbase|botpress|voiceflow|landbot|manychat|chatling|elfsight.*chat", "Juvo": r"juvoleads",
    "Intaker": r"intaker", "Hatch": r"usehatchapp|hatchapp", "Broadly": r"broadly\.com",
    "ClientChatLive": r"clientchatlive",
    # last resort: any script whose URL says chat (menu text like "Chattanooga" never matches a src)
    "chat widget (unidentified)": r"<script[^>]+src=\"[^\"]*chat[^\"]*\"",
}
BOOK = {
    "ServiceTitan": r"servicetitan", "Housecall Pro": r"housecallpro", "Jobber": r"getjobber|clienthub", "Calendly": r"calendly",
    "Acuity": r"acuityscheduling", "Zocdoc": r"zocdoc", "NexHealth": r"nexhealth", "LocalMed": r"localmed",
    "Tebra/PatientPop": r"patientpop|tebra", "Modento": r"modento", "Setmore": r"setmore", "Vagaro": r"vagaro",
    "Mindbody": r"mindbody|healcode", "Boulevard": r"joinblvd|blvd\.co", "Square": r"squareup\.com/appointments",
    "Phreesia": r"phreesia", "Lawmatics": r"lawmatics", "Clio": r"clio\.com|goclio", "Cal.com": r"cal\.com/",
    "Solutionreach": r"solutionreach",
}
MARKETS = {  # type -> marketplaces where customers send enquiries
    "home services": ["thumbtack.com", "angi.com", "houzz.com", "homeadvisor.com"],
    "law firm": ["avvo.com", "justia.com", "lawyers.com", "martindale.com"],
    "medical practice": ["zocdoc.com", "realself.com", "healthgrades.com"],
    "dental": ["zocdoc.com", "healthgrades.com"],
    "event venue": ["theknot.com", "weddingwire.com"],
    "senior living": ["aplaceformom.com", "caring.com"],
    "home health / hospice": ["caring.com", "aplaceformom.com"],
}
COMPLAINT = re.compile(
    r"never (?:called|heard|got a call|returned|responded|got back)|no (?:response|call ?back|reply|one answered|one ever)|"
    r"didn'?t (?:call|respond|return|get back)|hard to reach|couldn'?t reach|unresponsive|voicemail|ghost", re.I)
# Surname particles kept ("Ann Van Pelt" would be cut to "Ann Van" without them).
_NAME = r"[A-Z][a-z]+ (?:[A-Z]\. )?(?:(?:Van|Von|De|Del|Da|La|Le|St\.) )?[A-Z][a-zA-Z'\-]+"
OWNER_RX = [re.compile(p.replace("NAME", _NAME)) for p in (
    r"(?:Owner|Founder|Co-Founder|President|CEO|Principal|Managing Partner)[:,]?\s+(?:Mr\.|Mrs\.|Ms\.|Dr\.)?\s*(NAME)",
    r"(NAME),? (?:is the |the )?(?:owner|founder|co-founder|president|CEO)\b",
    r"(?:I'?m|I am) (NAME),? (?:the )?(?:owner|founder)")]
NOT_A_NAME = {"The", "Our", "Business", "Family", "Company", "About", "Meet", "Contact", "Home", "Local", "Call"}
STATE_NAMES = dict(zip(
    "alabama alaska arizona arkansas california colorado connecticut delaware florida georgia hawaii idaho illinois "
    "indiana iowa kansas kentucky louisiana maine maryland massachusetts michigan minnesota mississippi missouri "
    "montana nebraska nevada new-hampshire new-jersey new-mexico new-york north-carolina north-dakota ohio oklahoma "
    "oregon pennsylvania rhode-island south-carolina south-dakota tennessee texas utah vermont virginia washington "
    "west-virginia wisconsin wyoming".split(),
    "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR "
    "PA RI SC SD TN TX UT VT VA WA WV WI WY".split(), strict=True))
# Franchise disclaimers, not the bare word: "not a franchise" is a common local-business boast.
FRANCHISE = re.compile(r"independently owned and operated|franchise opportunit|become a franchisee|own a franchise", re.I)


# ---------- web (every fetch goes through fetch.py) ----------

def search(q: str) -> list[dict]:
    if not fetch.firecrawl_key():
        return []
    cache = json.loads(SEARCH_CACHE.read_text(encoding="utf-8")) if SEARCH_CACHE.exists() else {}
    if q not in cache:
        time.sleep(4)  # Firecrawl 429s when unpaced (tested)
        res = fetch.search(q)
        if not res.get("ok"):
            return []  # failures are not cached, so a later run retries
        cache[q] = res.get("data") or []
        SEARCH_CACHE.write_text(json.dumps(cache, indent=1), encoding="utf-8")
    return cache[q]


def homepage(url: str) -> tuple[str, str]:
    """(html, how) — cached per domain."""
    f = PAGES / (re.sub(r"\W+", "_", bare_domain(url))[:60] + ".json")
    if not f.exists():
        f.write_text(json.dumps(fetch.get(url)), encoding="utf-8")
    res = json.loads(f.read_text(encoding="utf-8"))
    return (res.get("content") or "", f"{res.get('provider', '')}:{'ok' if res.get('ok') else res.get('error_kind') or 'fail'}")


def contact_phone(website: str, state: str) -> tuple[str, str]:
    """(E.164, url) from the site's own contact page — the link on the homepage, else /contact-us, /contact.
    Plain download first (free). Cached per page."""
    home, _ = homepage(website)
    base = re.match(r"https?://[^/]+", website if "//" in website else "https://" + website)[0]
    links = re.findall(r'href="((?:https?://[^"]*)?/[^"#?]*contact[^"#?]*)"', home, re.I)
    for url in list(dict.fromkeys(links[:2] + [base + "/contact-us", base + "/contact"])):
        url = url if url.startswith("http") else base + url
        if bare_domain(url) != bare_domain(website):
            continue
        f = PAGES / (re.sub(r"\W+", "_", bare_domain(url) + "_" + url.split(bare_domain(url), 1)[1])[:90] + ".json")
        if not f.exists():
            f.write_text(json.dumps(fetch.get(url)), encoding="utf-8")
        res = json.loads(f.read_text(encoding="utf-8"))
        phone = read_site(res.get("content") or "", state)["phone"] if res.get("ok") else ""
        if phone:
            return phone, url
    return "", ""


def snippet(hit: dict) -> str:
    return f"{hit.get('title', '')} :: {hit.get('description', '')}".replace("\n", " ")


# ---------- steps ----------

def find_website(name: str, where: str) -> tuple[str | None, str]:
    best, score = None, 0.0
    for hit in search(f"{name} {where}"):
        url = hit.get("url", "")
        if not url or NOT_OWN_SITE.search(url):
            continue
        s = max(names.domain_similarity(url, name), names.similarity(hit.get("title", ""), name))
        if s > score:
            best, score = url, s
    if score >= 0.5:
        return best, "exact" if score >= 0.99 else "likely"
    return None, "none"


def about(hit: dict, name: str) -> bool:
    """The search hit is a page about this business, not a list or another firm (tested 2026-09-29:
    complaint and owner hits were from other painters and a 30-business Yellow Pages list)."""
    return names.similarity(hit.get("title", ""), name) >= 0.6


def _slug_state(slug: str) -> str:
    slug = slug.lower()
    m = re.search(r"-([a-z]{2})$", slug)
    return STATE_NAMES.get(slug) or (m[1].upper() if m and m[1].upper() in STATE_NAMES.values() else "")


def read_site(html: str, state: str) -> dict:
    text = re.sub(r"<[^>]+>", " ", html)
    # Location pages in one state are service areas (16 Dallas suburbs on a local painter); pages across
    # several states are a multi-state brand.
    states = {_slug_state(s) for s in re.findall(r'href="[^"]*/locations?/([a-z0-9\-]+)', html, re.I)} - {""}
    owners = []
    for rx in OWNER_RX:
        owners += [n for n in rx.findall(text) if n.split()[0] not in NOT_A_NAME]
    # A brand site lists its head office too; the number in the lead's own state is the local line.
    tels = [p for p in (us_e164(m) for m in TEL.findall(html)) if p]
    local = [p for p in tels if area_state(p) == state]
    meta = re.search(r'<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']+)', html, re.I)
    chat = [k for k, v in CHAT.items() if re.search(v, html, re.I)]
    return {
        "chat": chat[:-1] if len(chat) > 1 and chat[-1] == "chat widget (unidentified)" else chat,
        "tag_manager": bool(re.search(r"googletagmanager\.com/gtm\.js", html)),
        "booking": [k for k, v in BOOK.items() if re.search(v, html, re.I)],
        "form": bool(re.search(r"<form|wpforms|gform|hsForm|typeform|jotform|formstack", html, re.I)),
        "chain": "; ".join(x for x in [f"location pages in {len(states)} states" if len(states) >= 2 else "",
                                       "franchise wording" if FRANCHISE.search(html) else ""] if x),
        "phone": Counter(local).most_common(1)[0][0] if local else best_phone(html),
        "owners": list(dict.fromkeys(owners)),
        "summary": htmllib.unescape(meta[1]).strip() if meta else "",
    }


def find_owner(name: str, where: str, own_domain: str) -> list[tuple[str, str, str]]:
    """(name, source url, confidence): medium when the hit is this business's own page or about it,
    low when the name sits in a list of many businesses."""
    found = []
    for hit in search(f'"{name}" {where} owner OR founder OR president'):
        url = hit.get("url", "")
        conf = "medium" if (own_domain and own_domain in url) or about(hit, name) else "low"
        for rx in OWNER_RX:
            found += [(n, url, conf) for n in rx.findall(snippet(hit)) if n.split()[0] not in NOT_A_NAME]
    return sorted(dict.fromkeys(found), key=lambda f: f[2] != "medium")


def find_complaints(name: str, where: str, own_domain: str) -> list[dict]:
    hits = search(f'"{name}" {where} reviews "never called" OR "no response" OR "never heard back" OR "didn\'t call back"')
    out = []
    for h in hits:
        desc = h.get("description", "")
        m = COMPLAINT.search(desc)
        if not m or not about(h, name) or (own_domain and own_domain in h.get("url", "")):
            continue
        # the sentence around the match, so a person can judge it without opening the page
        start = max(desc.rfind(".", 0, m.start()) + 1, m.start() - 120)
        end = desc.find(".", m.end())
        end = min(end + 1 if end >= 0 else len(desc), m.end() + 120)
        out.append({"quote": desc[start:end].strip(), "url": h.get("url", ""), "verified_by_human": False})
    return out[:2]


def find_marketplaces(name: str, where: str, btype: str) -> list[dict]:
    sites = MARKETS.get(btype)
    if not sites:
        return []
    hits = search(f'"{name}" {where} site:' + " OR site:".join(sites))
    seen = {}
    for h in hits:
        for s in sites:
            if s in h.get("url", "") and s not in seen:
                seen[s] = h["url"]
    return [{"name": s, "url": u} for s, u in seen.items()]


BIG_CITIES = ("dallas", "houston", "austin", "san antonio", "fort worth", "el paso", "atlanta", "phoenix", "denver",
              "chicago", "miami", "orlando", "tampa", "charlotte", "nashville", "las vegas", "los angeles", "san diego")


def other_city(text: str, where: str) -> str:
    """A big city named in a hit's title/url that isn't the lead's own city."""
    text, own = re.sub(r"[\W_]+", " ", text.lower()), where.lower()
    squashed = text.replace(" ", "")
    return next((c for c in BIG_CITIES if c not in own and (f" {c} " in f" {text} " or c.replace(" ", "") in squashed)), "")


def find_phone(name: str, where: str, own_domain: str = "", state: str = "") -> tuple[str, str]:
    """(E.164, source url) from search snippets about this business only; an in-state number wins."""
    found = []
    for hit in search(f'"{name}" {where} phone'):
        url = hit.get("url", "")
        if not (about(hit, name) or (own_domain and own_domain in url)):
            continue  # directory pages list many businesses' numbers
        if other_city(f"{hit.get('title', '')} {url}", where):
            continue  # short names collide: a Dallas firm can match a same-name Houston firm
        p = best_phone(hit.get("description", ""))
        if p:
            found.append((p, url))
    local = [f for f in found if area_state(f[0]) == state]
    return (local or found or [("", "")])[0]


def phone_doubt(phone: str, st: str) -> str:
    # AREA_STATE only knows our metros' states, so an unknown code is only a doubt there
    if phone and st in set(AREA_STATE.values()) and area_state(phone) != st:
        return f"phone area code {phone[2:5]} is not a {st} code"
    return ""


def score(r: dict) -> tuple[int, str]:
    s, why = 0, []

    def add(n: int, w: str) -> None:
        nonlocal s
        s += n
        why.append(f"{'+' if n > 0 else ''}{n} {w}")

    if r["site_read"] and not r["chat"]:
        add(2, "no chat/text tool")
    if r["complaints"]:
        add(2, "slow-reply complaint in search results (unverified)")
    if r["marketplaces"]:
        add(1, "on lead marketplaces")
    if r["owner_sure"]:
        add(1, "owner named")
    if not r["website"]:
        add(-2, "own website not found")
    if r["chain"]:
        add(-2, "possible chain")
    if r["location_doubt"]:
        add(-1, "location unconfirmed")
    return s, "; ".join(why)


def paid_signals(source: str) -> tuple[dict, list[dict]]:
    """What the upload's `source` proves: where we found them is itself evidence they pay for enquiries."""
    kind, _, query = source.partition(":")
    if kind == "meta-ads":
        url = names.search_url(query, country="US")
        return ({"ads": True, "jobs": None, "evidence": [url]},
                [{"text": f"Found running Facebook/Instagram ads (Meta Ad Library search \"{query}\")", "source": url}])
    if kind.startswith("indeed"):
        return ({"ads": None, "jobs": True, "evidence": [f"Indeed search: {query}"]},
                [{"text": f"Found hiring on Indeed (search \"{query}\")", "source": "https://www.indeed.com"}])
    return {"ads": None, "jobs": None, "evidence": []}, []


def research_one(c: dict, redo: bool = False) -> tuple[dict, dict | None]:
    """Returns (company patch, owner contact or None)."""
    name, city, st = c["name"], c.get("city") or "", (c.get("state_abbr") or "").upper()
    where = f"{city}, {st}".strip(", ")
    btype = (c.get("business_type") or "").strip().lower()
    facts, unknowns = [], []

    website, match = c.get("website"), "exact"
    if website and NOT_OWN_SITE.search(website):
        unknowns.append(f"uploaded website is a listing ({bare_domain(website)})")
        website = None
    if not website:
        website, match = find_website(name, where)
    html, how = homepage(website) if website else ("", "")
    site = read_site(html, st) if html else {"chat": [], "tag_manager": False, "booking": [], "form": None,
                                             "chain": "", "phone": "", "owners": [], "summary": ""}
    site_read = bool(html)

    if site_read:
        if site["chat"]:
            facts.append({"text": f"Website has a chat/text tool ({', '.join(site['chat'])})", "source": website})
        else:
            facts.append({"text": "No chat, text or instant-reply tool found on the website homepage", "source": website})
            if site["tag_manager"]:  # a tag manager can inject a chat widget the page code doesn't show
                unknowns.append("chat tool loaded through Google Tag Manager (not checked)")
        if site["form"]:
            facts.append({"text": "Website has an enquiry/contact form", "source": website})
        if site["booking"]:
            facts.append({"text": f"Website uses online booking ({', '.join(site['booking'])})", "source": website})
    elif website:
        unknowns.append("website could not be read")
    else:
        unknowns.append("own website")

    owner_name, owner_src, owner_conf = None, None, None
    if site["owners"]:
        owner_name, owner_src, owner_conf = site["owners"][0], website, "high"
    else:
        found = find_owner(name, where, bare_domain(website or ""))
        if found:
            owner_name, owner_src, owner_conf = found[0]
    owner_sure = owner_conf in ("high", "medium")
    if not owner_sure:
        unknowns.append("owner name" + (f" (unconfirmed: {owner_name})" if owner_name else ""))

    complaints = find_complaints(name, where, bare_domain(website or ""))
    markets = find_marketplaces(name, where, btype)
    if markets:
        facts.append({"text": f"Listed on {', '.join(m['name'] for m in markets)}", "source": markets[0]["url"]})
    pays, pay_facts = paid_signals(c.get("source") or "")
    facts += pay_facts

    phone, phone_src = c.get("phone_number"), "already in CRM"  # never overwrite a number a person may have set
    if not phone:
        phone, phone_src = site["phone"], website
    if not phone:
        phone, phone_src = find_phone(name, where, bare_domain(website or ""), st)
    if not phone:
        unknowns.append("phone number")
    location_doubt = phone_doubt(phone, st)
    if location_doubt:
        unknowns.append(f"location: {location_doubt}")
    if site["chain"]:
        unknowns.append(f"possible chain ({site['chain']})")
    if not btype:
        unknowns.append("business type")

    r = {"site_read": site_read, "chat": site["chat"], "complaints": complaints, "marketplaces": markets,
         "owner_sure": owner_sure, "website": website, "chain": site["chain"], "location_doubt": location_doubt}
    pts, why = score(r)
    research = {
        "version": 1,
        "researched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "website": {"url": website, "match": match if website else "none", "fetched": site_read},
        "chain": {"is_chain": bool(site["chain"]), "signal": site["chain"]},
        "instant_reply": {"chat_tools": site["chat"], "booking_tools": site["booking"], "has_form": site["form"]},
        "owner": {"name": owner_name, "source_url": owner_src, "confidence": owner_conf} if owner_name else None,
        "complaints": complaints,
        "marketplaces": markets,
        "pays_for_enquiries": pays,
        "healthcare": btype in HEALTH,
        "score_why": why,
        "facts": facts,
        "unknowns": unknowns,
        "fetch": how,
        "phone_source": phone_src or None,
    }
    summary = re.split(r"(?<=[.!?])\s", site["summary"])[0][:200]
    patch = {"research": research, "score": pts, "research_status": "done",
             "website": website, "phone_number": phone or None,
             "timezone": c.get("timezone") or STATE_TZ.get(st),
             "description": (not redo and c.get("description")) or summary or f"{btype or 'business'} in {where}."}
    owner = None
    if owner_sure:
        first, _, last = owner_name.partition(" ")
        owner = {"first_name": first, "last_name": last, "title": "Owner"}
    return patch, owner


# ---------- commands ----------

def run(limit: int | None, redo: list[str]) -> None:
    crm = Crm()
    if redo:  # CONTRACT: a done company is only re-researched when named explicitly
        waiting = crm.get("companies", select="*", external_key=f"in.({','.join(json.dumps(k) for k in redo)})")
    else:
        waiting = crm.get("companies", select="*", research_status="eq.to_research", order="id.asc")
    if limit:
        waiting = waiting[:limit]
    print(f"{len(waiting)} lead(s) {'to redo' if redo else 'waiting for research'}")
    if not fetch.firecrawl_key():
        print("  search is OFF (no FIRECRAWL_API_KEY in robot/.env): websites are read, nothing is searched")
    for c in waiting:
        crm.update("companies", {"research_status": "researching"}, id=f"eq.{c['id']}")
        try:
            patch, owner = research_one(c, redo=bool(redo))
        except Exception as exc:  # one bad lead must not stop the batch
            crm.update("companies", {"research_status": "failed",
                                     "research": {"version": 1, "error": repr(exc)[:300]}}, id=f"eq.{c['id']}")
            print(f"  FAILED {c['name']}: {exc!r}"[:200])
            continue
        crm.update("companies", patch, id=f"eq.{c['id']}")
        if owner and not crm.get("contacts", select="id", company_id=f"eq.{c['id']}", title="eq.Owner"):
            now = datetime.now(timezone.utc).isoformat()  # Atomic sorts contacts by last_seen; null sinks them
            crm.insert("contacts", {**owner, "company_id": c["id"], "sales_id": c.get("sales_id"),
                                    "email_jsonb": [], "phone_jsonb": [], "tags": [], "first_seen": now, "last_seen": now})
        crm.update("deals", {"stage": "researched"}, company_id=f"eq.{c['id']}", stage="eq.found")
        r = patch["research"]
        print(f"  {c['name'][:34]:34} score {patch['score']:>2} | site:{'yes' if r['website']['url'] else 'no':3} "
              f"| chat:{','.join(r['instant_reply']['chat_tools'])[:18]:18} | owner:{(r['owner'] or {}).get('name') or '-'} "
              f"| phone:{patch['phone_number'] or '-'}")


def phones() -> None:
    """Main line for researched leads that have none: own contact page first (usually free), then a search
    (1 credit). Never overwrites a number."""
    crm = Crm()
    rows = crm.get("companies", select="id,name,city,state_abbr,website,research",
                   phone_number="is.null", research_status="eq.done", order="id.asc")
    print(f"{len(rows)} lead(s) with no phone")
    for c in rows:
        st = (c.get("state_abbr") or "").upper()
        phone, src = contact_phone(c["website"], st) if c.get("website") else ("", "")
        if not phone:
            phone, src = find_phone(c["name"], f"{c.get('city') or ''}, {st}".strip(", "),
                                    bare_domain(c.get("website") or ""), st)
        if not phone:
            print(f"  -  {c['name'][:40]:40} not found")
            continue
        research = c.get("research") or {"version": 1}
        unknowns = [u for u in research.get("unknowns", []) if u != "phone number"]
        if phone_doubt(phone, st):
            unknowns.append(f"location: {phone_doubt(phone, st)}")
        done = crm.update("companies", {"phone_number": phone,
                                        "research": {**research, "phone_source": src, "unknowns": unknowns}},
                          id=f"eq.{c['id']}", phone_number="is.null")
        print(f"  {'+ ' if done else 'kept'} {c['name'][:40]:40} {phone} {phone_doubt(phone, st)} <- {src[:70]}")


def lines() -> None:
    crm = Crm()
    rows = crm.get("companies", select="external_key,name,business_type,city,research",
                   research_status="eq.done", first_line="is.null")
    for c in rows:
        facts = " / ".join(f["text"] for f in (c.get("research") or {}).get("facts", []))
        print(f"{c['external_key']} || {c['name']} || {c.get('business_type') or '?'} || {c.get('city')} || {facts or '(no facts)'}")
    print(f"{len(rows)} lead(s) need a first line")


def set_lines(path: str) -> None:
    crm = Crm()
    for key, sentence in json.loads(Path(path).read_text(encoding="utf-8")).items():
        if len(sentence.split()) > 25:
            print(f"  skip {key}: over 25 words")
            continue
        done = crm.update("companies", {"first_line": sentence}, external_key=f"eq.{key}", first_line="is.null")
        print(f"  {'set ' if done else 'kept'} {key}")


if __name__ == "__main__":
    PAGES.mkdir(parents=True, exist_ok=True)
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "run":
        run(int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None,
            sys.argv[sys.argv.index("--redo") + 1].split(",") if "--redo" in sys.argv else [])
    elif cmd == "phones":
        phones()
    elif cmd == "lines":
        lines()
    elif cmd == "set-lines" and len(sys.argv) > 2:
        set_lines(sys.argv[2])
    else:
        print(__doc__)
