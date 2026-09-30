# Agent instructions

This repo is a self-hosted leads CRM (`app/`, based on Atomic CRM) plus a local research robot
(`robot/`). Each user runs their own private copy with their own database.

- **Setting it up for someone** (e.g. the user pasted this repo's link): follow `SETUP.md` from step 0
  — ask the human everything there in one message, install while they answer, then run
  `node scripts/doctor.mjs`. Do not skip any check, especially closing public sign-up in step 8.
- `app/AGENTS.md` is only for changing the app's code later; ignore its `make` commands during setup.
- **Researching leads:** use the `leads-crm-robot` skill (`.claude/skills/leads-crm-robot/SKILL.md`).
- **Data shape** shared by the app and the robot: `CONTRACT.md`.

Hard rules:
- Keys live only in git-ignored files (`app/.env.*.local`, `robot/.env`). Never commit, print in full,
  or paste them into chat, issues or code. The Supabase secret key never goes in a `VITE_` variable.
- The robot and the app never send anything to a business. A person sends every message by hand.
- Research stores only what was observed on public pages, with its source. Blank means unknown, never a flaw.
