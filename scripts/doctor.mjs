#!/usr/bin/env node
// Pre-flight check before SETUP.md. Read-only: it changes nothing anywhere.
//   node scripts/doctor.mjs            (with SUPABASE_ACCESS_TOKEN set)
// Exit code 0 = ready for SETUP.md step 1; 1 = something below says FIX.
import { execSync } from "node:child_process";

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
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  fix("SUPABASE_ACCESS_TOKEN is not set — get one at https://supabase.com/dashboard/account/tokens");
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
    let freeOrgs = 0;
    for (const org of orgs) {
      const { plan } = await api(`/organizations/${org.slug ?? org.id}`);
      const count = projects.filter((p) => (p.organization_slug ?? p.organization_id) === (org.slug ?? org.id) && active(p)).length;
      console.log(`        org "${org.name}" (${org.slug ?? org.id}): ${plan} plan, ${count} active project(s)`);
      if (plan === "free") freeOrgs++;
      else ok(`"${org.name}" is on a paid plan — use --org-id ${org.slug ?? org.id} in step 2`);
    }
    // The free plan allows 2 active projects in total across the free organizations a person owns.
    const freeActive = projects.filter(
      (p) => active(p) && orgs.some((o) => (o.slug ?? o.id) === (p.organization_slug ?? p.organization_id)),
    ).length;
    if (orgs.length === 0) fix("no Supabase organization yet — create one at https://supabase.com/dashboard");
    else if (freeOrgs && freeActive >= 2 && freeOrgs === orgs.length)
      fix(`all free project slots are used (${freeActive}/2 active). Pause or delete one project in the Supabase dashboard, or upgrade, then re-run this check`);
    else if (freeOrgs === orgs.length) ok(`free project slot available (${freeActive}/2 used)`);
  } catch (e) {
    fix(`the Supabase token was rejected (${e.message}) — create a new one at https://supabase.com/dashboard/account/tokens`);
  }
}

console.log("Vercel (the hosting)");
const who = run("npx --yes vercel whoami");
who ? ok(`logged in as ${who.split("\n").pop()}`) : note("not logged in yet — run `npx vercel login` in app/ (the human finishes it in the browser)");

console.log(failed ? "\nNot ready: fix the lines marked FIX, then run this again." : "\nReady: continue with SETUP.md step 1.");
process.exit(failed ? 1 : 0);
