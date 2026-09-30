# Setup — instructions for the AI agent

You are setting up a private copy of this leads CRM for your user, on **their own** accounts, at an
address like `leads.theiragency.com`. Nothing in this repo contains anyone else's data or keys.

Follow the steps in order. Each step ends with a **Check**: do not move on until it passes.
Works on Windows, macOS and Linux (Node 22+, Python 3.10+, git). No Docker needed.

**Where to run things:** every `npm` and `npx` command runs **inside `app/`**. Only the robot
(step 9) runs from the repo root.

## 0. What the human must do (ask for all of it up front, in one message)

Only a person can do these. Ask for them together, then wait:

1. **Supabase** (the database): an account at https://supabase.com and an access token from
   https://supabase.com/dashboard/account/tokens. The free plan allows **2 active projects per
   organization** — if they already have 2, they must pause one, delete one, or use a paid plan before
   step 2. Also ask which email they will log in to the CRM with — it should be their Supabase
   account email (see step 8).
2. **Vercel** (the hosting, free plan is fine): an account at https://vercel.com. If they belong to more
   than one Vercel team, ask which one to use.
3. **Their address**: the subdomain they want (e.g. `leads.theiragency.com`) and where their domain's
   DNS is managed (Cloudflare, GoDaddy, Namecheap…). They will add one DNS record in step 7. No
   domain? Skip step 7; the app works on its free `*.vercel.app` address.
4. **Optional — research robot searches**: a Firecrawl API key from https://firecrawl.dev (free starter
   credits). Without it the robot still reads each lead's website but skips web searches.

Keep every key out of git: only in the ignored files named below. Never print a key in full.

`$SUPABASE_ACCESS_TOKEN` must be set in the environment for every `npx supabase` command
(bash: `export SUPABASE_ACCESS_TOKEN=...`; PowerShell: `$env:SUPABASE_ACCESS_TOKEN="..."`).

**Check:** from the repo root, `node scripts/doctor.mjs` ends with "Ready" (exit 0). It is read-only.
It checks Node, git, Python, the Supabase token, a **free project slot** and the Vercel login, and says
exactly what to fix. Tell the human any FIX line in plain words, wait, and re-run until it passes.

## 1. Install

```
cd app
npm ci
```
(If `npm ci` fails on the `prepare` step, set `HUSKY=0` and re-run.)

**Check:** `npm run typecheck` exits 0.

## 2. Create the database project (in `app/`)

```
npx supabase orgs list                      # pick their organization id
npx supabase projects create "Leads CRM" --org-id <ORG_ID> --db-password "<GENERATED_PASSWORD>" --region <REGION>
```
Generate a strong database password yourself (letters and digits, 20+ chars) and save it for the
human in `app/.env.setup.local` (git-ignored) as `DB_PASSWORD=...`. Pick the region closest to the
user (`npx supabase projects create --help` lists them, e.g. `ap-south-1`, `us-east-1`, `eu-central-1`).
Note the project ref (the 20-letter id) — below it is `<REF>`. A "2 project limit" error means step 0.1
was not done.

**Check:** `npx supabase projects list` shows the project (a "Cannot find project ref" line on stderr is
harmless). New projects take 1–3 minutes to come up; if the next step fails with a connection error,
wait a minute and retry.

## 3. Load the database structure (in `app/`)

```
npx supabase link --project-ref <REF> --password "<DB_PASSWORD>"
npx supabase db push --linked --include-seed --password "<DB_PASSWORD>"
```
**Check:** `npx supabase migration list --linked --password "<DB_PASSWORD>"` shows every local migration
also applied remotely (no gaps).

## 4. Deploy the server functions (in `app/`)

```
npx supabase projects api-keys --project-ref <REF> -o json --reveal
```
From that output take the **publishable** key (`sb_publishable_...`) and the **secret** key
(`sb_secret_...`, shown in full only with `--reveal`). Then:
```
npx supabase secrets set SB_PUBLISHABLE_KEY=<PUBLISHABLE_KEY> --project-ref <REF>
npx supabase functions deploy --use-api --project-ref <REF>
```
**Check:** `npx supabase functions list --project-ref <REF>` shows `users`, `update_password`,
`merge_contacts`, `delete_note_attachments`, `mcp`, `postmark`, all ACTIVE.

## 5. Point the app at the database (in `app/`)

Create `app/.env.production.local` (git-ignored):
```
VITE_SUPABASE_URL=https://<REF>.supabase.co
VITE_SB_PUBLISHABLE_KEY=<PUBLISHABLE_KEY>
VITE_IS_DEMO=false
VITE_ATTACHMENTS_BUCKET=attachments
```
Only the publishable key goes here — it is designed to be public. **Never** put the secret key in any
`VITE_` variable: everything `VITE_` ends up in the website's code.

Build with `NODE_ENV=CI` set (otherwise the build opens a bundle-size report in the browser):
bash `NODE_ENV=CI npm run build`; PowerShell `$env:NODE_ENV="CI"; npm run build`.

**Check:** the build succeeds, and `grep -r "sb_secret" dist` prints nothing (exit code 1 = pass).

## 6. Put it online (in `app/`)

Use the Vercel team the human chose (`npx vercel teams list`); add `--scope <TEAM>` to every command
below if they have more than one.
```
npx vercel login                     # only if `npx vercel whoami` fails; the human finishes it in the browser
npx vercel link --yes --project leads-crm
printf 'https://<REF>.supabase.co' | npx vercel env add VITE_SUPABASE_URL production
printf '<PUBLISHABLE_KEY>'          | npx vercel env add VITE_SB_PUBLISHABLE_KEY production
printf 'false'                      | npx vercel env add VITE_IS_DEMO production
printf 'attachments'                | npx vercel env add VITE_ATTACHMENTS_BUCKET production
printf '0'                          | npx vercel env add HUSKY production
npx vercel deploy --prod --yes
```
**Check:** the `*.vercel.app` address it prints returns HTTP 200 and shows a sign-up page (the first-run
screen, because there are no users yet).

## 7. Their own address (skip if no domain; in `app/`)

```
npx vercel domains add <THEIR_ADDRESS> leads-crm
```
Vercel prints the DNS record to add — usually a **CNAME** `leads` → `cname.vercel-dns.com` (or an A
record → `76.76.21.21`). Give the human that exact record for their DNS provider. On Cloudflare, set the
record to **DNS only** (grey cloud).

**Check:** `https://<THEIR_ADDRESS>` returns 200 with a valid certificate (can take a few minutes after
the record is added).

## 8. Login settings, first admin, close sign-up

`<APP_URL>` below is their own address, or the `*.vercel.app` address if they have no domain.
```
npx supabase secrets set CRM_BASE_URL=<APP_URL> --project-ref <REF>
curl -X PATCH "https://api.supabase.com/v1/projects/<REF>/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"site_url":"<APP_URL>","uri_allow_list":"<APP_URL>/**,https://<VERCEL_APP>.vercel.app/**,http://localhost:5173/**","external_anonymous_users_enabled":false}'
```
Now ask the human to open `<APP_URL>`, sign up with their email and click the confirmation email.
**The first person to sign up becomes the admin.** Supabase's built-in email only sends to members of
their Supabase organization (and only a few per hour), which is why this should be their Supabase
account email.

Once they confirm they are logged in, **close public sign-up** — otherwise anyone who finds the
address can create an account and see every lead:
```
curl -X PATCH "https://api.supabase.com/v1/projects/<REF>/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"disable_signup":true}'
```
**Check (mandatory):** a sign-up attempt with a real-looking new address is refused:
```
curl -s -X POST "https://<REF>.supabase.co/auth/v1/signup" -H "apikey: <PUBLISHABLE_KEY>" \
  -H "Content-Type: application/json" -d '{"email":"nobody.test.signup@gmail.com","password":"Xx-123456789"}'
```
must return `signup_disabled` (HTTP 422). Do not use `example.com` for this test — Supabase rejects that
domain before the rule, so it proves nothing.

Teammates are added later by the admin inside the app (Settings → Users). Their invite email uses the
same built-in email service, so either add them to the Supabase organization too, or set up custom
SMTP in Supabase (Authentication → Emails).

## 9. Research robot (runs on this computer, from the repo root)

Copy `robot/.env.example` to `robot/.env` and fill in the values. Keep comments on their own lines:
```
CRM_URL=https://<REF>.supabase.co
CRM_SERVICE_KEY=<SECRET_KEY>
FIRECRAWL_API_KEY=
```
`CRM_SERVICE_KEY` is the `sb_secret_...` key: full database access, never share or commit it.
`FIRECRAWL_API_KEY` is optional — leave it empty if they have none.

On Windows set `PYTHONIOENCODING=utf-8` before running the robot.

**Check:** `python robot/research.py lines` prints `0 lead(s) need a first line`.

From now on the human uploads a list in the app ("Upload list"), then asks you to "research the new
leads" — the `lead-robot` skill in `.claude/skills/lead-robot/SKILL.md` explains how you run it.

## 10. Hand over

Tell the human, in plain words:
- the address, and that they are the admin;
- that sign-up is closed and how to add teammates (step 8);
- where their keys are (`app/.env.setup.local`, `app/.env.production.local`, `robot/.env`) and that
  these files must never be shared or committed;
- how to add leads (Upload list: CSV with `name`, `city` required; `website`, `phone`, `state`,
  `business_type`, `source` optional) and that you can research them on request.

## Updating later

`git pull`, then in `app/`: repeat step 3 (new migrations), step 4 (functions) and
`npx vercel deploy --prod --yes`. Their data is never touched by an update.
