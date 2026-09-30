# Leads CRM

A private lead list for agencies that sell to local businesses. It tells you who to call, message or
test today, and makes sure no lead is forgotten. Each person runs their **own copy** with their own
database, so nobody sees anyone else's leads.

- **Today list**: the calls, messages and follow-ups due now, top to bottom.
- **Lead page**: tap-to-call, WhatsApp with your opening line filled in, stage bar, next step, lead score.
- **Upload a list**: a CSV of businesses (`name`, `city`, plus `website`, `phone`, `state`, `business_type`, `source` if you have them).
- **Research robot**: your AI agent researches each new lead — their website, chat and booking tools,
  owner name, phone, marketplace listings — and writes a short opening line built only from what it found.
- **Reply-speed tests**: step-by-step guide for contacting a business the way a customer would, and a
  facts-only report you can show the owner.
- **Works on phones**: add it to your home screen and it opens full screen like an app.

It never sends anything by itself. You send every message.

## Get your own copy

You need free accounts at [Supabase](https://supabase.com) (database) and [Vercel](https://vercel.com)
(hosting), and optionally a domain for an address like `leads.youragency.com`.

Then open an AI coding agent (Claude Code, Codex, Cursor…) in an empty folder and say:

> Clone https://github.com/wald21x6-ops/leads-crm and set it up for me by following its SETUP.md.

It will ask you for a few things only you can do (logins and one DNS record), and handle the rest.
Takes about 30 minutes.

## What's inside

| Folder | What it is |
|---|---|
| `app/` | The CRM website (React + Supabase), based on [Atomic CRM](https://github.com/marmelab/atomic-crm) by Marmelab |
| `robot/` | The research robot (Python, no packages to install) |
| `SETUP.md` | Step-by-step setup, written for your AI agent |
| `CONTRACT.md` | The data both parts share |

MIT licensed — see `LICENSE`.
