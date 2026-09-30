---
name: lead-robot
description: Research new leads waiting in this CRM and write their first lines. Trigger - "research the new list", "research the new leads", "run the robot", "the list I uploaded", "fill in the new leads", "find phones for the leads". Never sends anything to a business.
---

# Lead robot

Researches every CRM lead in `research_status = 'to_research'` (added through the CRM's "Upload list"),
then you (the agent) write each one's first line from the verified facts. Data contract: `CONTRACT.md`.
Code: `robot/research.py`. Runs on this computer against the user's own database (secret key in
`robot/.env`, git-ignored — never print it). Nothing is deployed and nothing is sent.

Run everything from the repo root, with `PYTHONIOENCODING=utf-8` on Windows. Python 3.10+, no packages.
If `robot/.env` is missing, do step 9 of `SETUP.md` first.

## 1. Credit check first
Searches use Firecrawl credits (1 per search; a lead costs about 4–6; cached searches are free).
Without `FIRECRAWL_API_KEY` in `robot/.env` the robot only reads each lead's own website (free) —
tell the user that leads with no website will stay thin. With a key, check the balance on
https://firecrawl.dev/app before a big batch and use `--limit N` for what fits.

## 2. Research
```
python robot/research.py run [--limit N]
```
Prints one line per lead: score, site, chat tool, owner, phone. Then spot-check at least one lead
against its real website (the fields most likely wrong: owner, chat tool, phone). Re-run a lead from
cache with `run --redo <external_key>[,<key>]` (free).

## 3. First lines
```
python robot/research.py lines          # key || name || type || city || facts
```
Write `{external_key: sentence}` to a JSON file, then `python robot/research.py set-lines FILE.json`.
Rules (CONTRACT.md §7):
- ≤ 25 words, works unchanged in email, WhatsApp or spoken on a call.
- Built only from the facts listed; certain facts, then one question about how fast they reply.
- Never phrase absence as a flaw ("you have no chat" is out). No flattery, no invented numbers.
- Never use complaints (unverified) or an owner marked unconfirmed.
- Pattern that works: "You're advertising on Facebook and listed on Angi. When someone asks for a
  quote at 9pm, how soon do they hear back?"
`set-lines` never overwrites a line a person already wrote.

## 4. Phones (optional)
```
python robot/research.py phones
```
Fills `phone_number` only where it is empty: the business's own contact page first (free), then a
search (1 credit). Report which leads still have no number — those need a person.

## Report to the user
Plain words: how many researched, top scores with the one-line why, how many got a phone, credits
used, and anything that looked wrong. Never send, email, call or message a business.

## Known limits
- Tuned for US businesses: phone numbers are read as US (+1) numbers, and the area-code location
  check only knows TX and GA codes (`robot/crm_rows.py`, extend `AREA_STATE` for other states).
- Chat tools are read from the homepage code. A chat loaded through Google Tag Manager can hide;
  the robot then adds "chat tool loaded through Google Tag Manager (not checked)" to unknowns.
- Owner names from directory lists are stored as `confidence: low`, not scored, no contact created.
