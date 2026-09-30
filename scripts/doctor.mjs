#!/usr/bin/env node
// Pre-flight check before SETUP.md. Read-only: it changes nothing anywhere.
//   node scripts/doctor.mjs            (with SUPABASE_ACCESS_TOKEN set)
// Exit code 0 = ready for SETUP.md step 1; 1 = something below says FIX.
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

let failed = false;
const ok = (msg) => console.log(`  OK    ${msg}`);
const fix = (msg) => {
  failed = true;
  console.log(`  FIX   ${msg}`);
};
const note = (msg) => console.log(`  NOTE  ${msg}`);

const run = (cmd) => {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"], timeout: 60000 }).toString().trim();
  } catch {
    return "";
  }
};
const version = (text) => (text.match(/(\d+)\.(\d+)/) || []).slice(1).map(Number);

console.log("Tools");
const [nodeMajor] = version(process.version);
nodeMajor >= 22 ? ok(`Node ${process.version}`) : fix(`Node ${process.version} — install Node 22 or newer`);
run("git --version") ? ok(run("git --version")) : fix("git not found — install git");
const py = run("python --version") || run("python3 --version");
const [pyMajor, pyMinor] = version(py);
py && (pyMajor > 3 || (pyMajor === 3 && pyMinor >= 10))
  ? ok(py)
  : fix(`Python 3.10+ not found${py ? ` (found ${py})` : ""} — needed for the research robot`);

console.log("Supabase (the database)");
// The token comes from the environment, or from the git-ignored .env.setup.local at the repo root.
const setupFile = new URL("../.env.setup.local", import.meta.url);
const fromFile = existsSync(setupFile)
  ? (readFileSync(setupFile, "utf8").match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m)?.[1] ?? "").replace(/\s+#.*$/, "").trim()
  : "";
const token = process.env.SUPABASE_ACCESS_TOKEN || fromFile;
if (!token) {
  fix("no Supabase access token — the human pastes it into .env.setup.local at the repo root as SUPABASE_ACCESS_TOKEN=... (get one at https://supabase.com/dashboard/account/tokens)");
} else {
  const api = async (path) => {
    const res = await fetch(`https://api.supabase.com/v1${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  };
  try {
    const orgs = await api("/organizations");
    const projects = await api("/projects");
    const active = (p) => !["INACTIVE", "PAUSED", "REMOVED", "GOING_DOWN"].includes(p.status);
    const orgOf = (p) => p.organization_slug ?? p.organization_id;
    const paid = [];
    const freeIds = new Set();
    for (const org of orgs) {
      const id = org.slug ?? org.id;
      const { plan } = await api(`/organizations/${id}`);
      (plan === "free" ? freeIds : { add: () => paid.push(org) }).add(id);
      console.log(`        org "${org.name}" (${id}): ${plan} plan`);
    }
    // The free plan allows 2 active projects in total across the free organizations a person owns.
    const freeActive = projects.filter((p) => active(p) && freeIds.has(orgOf(p)));
    if (orgs.length === 0) {
      fix("no Supabase organization yet — create one at https://supabase.com/dashboard");
    } else if (paid.length) {
      ok(`"${paid[0].name}" is on a paid plan — use --org-id ${paid[0].slug ?? paid[0].id} in step 2`);
    } else if (freeActive.length >= 2) {
      fix(`both free project slots are in use (${freeActive.length}/2). Projects using them:`);
      for (const p of freeActive) console.log(`          - "${p.name}" (${p.ref}), created ${String(p.created_at).slice(0, 10)}`);
      console.log("        Pausing one takes whatever app uses it offline until it is restored. Ask the human which");
      console.log("        one (if any) they can pause or delete in the Supabase dashboard, or to upgrade. Never do it for them.");
    } else {
      ok(`free project slot available (${freeActive.length}/2 used) — use --org-id ${[...freeIds][0]} in step 2`);
    }
  } catch (e) {
    fix(`the Supabase token was rejected (${e.message}) — create a new one at https://supabase.com/dashboard/account/tokens`);
  }
}

console.log("Vercel (the hosting)");
const who = run("npx --yes vercel whoami");
who ? ok(`logged in as ${who.split("\n").pop()}`) : note("not logged in yet — run `npx vercel login` in app/ (the human finishes it in the browser)");

console.log(failed ? "\nNot ready: fix the lines marked FIX, then run this again." : "\nReady: continue with SETUP.md step 1.");
process.exit(failed ? 1 : 0);
