# Agent instructions

This repo is a self-hosted leads CRM (`app/`, based on Atomic CRM) plus a local research robot
(`robot/`). Each user runs their own private copy with their own database.

- **Setting it up for someone** (e.g. the user pasted this repo's link): follow `SETUP.md` step by step, starting with
  `node scripts/doctor.mjs`. Do not skip any of its checks —
  especially closing public sign-up in step 8.
- **Researching leads:** use the `lead-robot` skill (`.claude/skills/lead-robot/SKILL.md`).
- **Data shape** shared by the app and the robot: `CONTRACT.md`.
- **Changing the app:** `app/AGENTS.md` and `app/CLAUDE.md` describe the codebase.

Hard rules:
- Keys live only in git-ignored files (`app/.env.*.local`, `robot/.env`). Never commit, print in full,
  or paste them into chat, issues or code. The Supabase secret key never goes in a `VITE_` variable.
- The robot and the app never send anything to a business. A person sends every message by hand.
- Research stores only what was observed on public pages, with its source. Blank means unknown, never a flaw.
