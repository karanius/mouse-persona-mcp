#!/usr/bin/env node
// Cursor Persona Recording — Chris Daw, Complete Journey
// Login → Discovery → Consultant Portal → Onboarding → Submit → CICC Verification
// Replay: node this-file.js

const fs = require("fs");
const path = require("path");
let chromium;
try { chromium = require("playwright").chromium; }
catch { console.error("npm i playwright"); process.exit(1); }

const HUMAN = process.argv.includes("--no-human") ? 0 : 5000;
const OVERLAY = path.resolve(__dirname, "..", "overlay.js");
const PERSONA = "Chris Daw";

const SCENES = [
  {
    name: "Scene 1 — Discovery",
    url: "http://localhost:3000",
    dsl: "\n> RCIC consultant Chris Daw discovers the CanaDREAMERS platform for the first time\n@ Stop guessing. Start belonging.\n\" Bold claim. Let's see if they actually understand what regulated consultants need.\n@ Immigration Consultants\n\"3 They have a consultant section.\n@ Sign In\n\"3 Let me sign in and see what they offer consultants.\n! Sign In\n.\n"
  },
  {
    name: "Scene 2 — Role Selection",
    dsl: "\n> Chris Daw sees the role selection — the platform distinguishes between immigrants and consultants\n~ 2000\n@ Consultant\n\" They have a dedicated consultant path. That's a good sign — most platforms lump everyone together.\n! Consultant\n.\n"
  },
  {
    name: "Scene 3 — Login",
    dsl: "\n> Chris Daw logs into his consultant account\n@ Email\n\"3 Let me use my professional email.\n= Email | chris@dawimmigration.com\n@ Password\n= Password | Chris1234!\n! Sign In\n~ 3000\n.\n"
  },
  {
    name: "Scene 4 — Portal Landing",
    dsl: "\n> Chris Daw arrives at the consultant portal — the onboarding workflow begins\n~ 2000\n@ Consultant Portal\n\"3 Four steps. Reasonable workflow.\n@ Your Identity\n\"3 Identity first. Let's see what they validate.\n@ CICC College ID\n\" Good — they ask for the College ID, not just a name. That's the right field. But do they check it against the actual register?\n= Full Name | Chris Daw\n= CICC College ID | R409583\n! Next\n.\n"
  },
  {
    name: "Scene 5 — Specializations",
    dsl: "\n> Step 2 — Chris Daw selects specializations. Platform needs to capture practice scope for matching.\n@ Your Practice\n\"3 Specializations and languages. Standard intake.\n@ Express Entry\n\" Express Entry — that's my bread and butter. Twenty years of CRS calculations.\n! Express Entry\n@ Provincial Nominee Programs\n\"3 PNP too. Alberta and BC mostly.\n! Provincial Nominee Programs\n@ Work Permits\n\"3 Work permits — LMIA-based and exempt.\n! Work Permits\n@ LMIA\n! LMIA\n@ English\n\"3 English is my working language.\n! English\n@ French\n\"3 French too.\n! French\n! Next\n.\n"
  },
  {
    name: "Scene 6 — Location & Bio",
    dsl: "\n> Step 3 — Location and bio. This is where the platform builds the consultant's public profile.\n@ Location & Bio\n\"3 City and bio. Public-facing.\n@ Start typing a Canadian city\n\"3 Let me set my location.\n= Start typing a Canadian city | Vancouver\n~ 1500\n@ Professional Bio\n\" Fifty-word minimum. Fair enough — clients need to know who they're hiring.\n= Professional Bio | Chris Daw is a Regulated Canadian Immigration Consultant (RCIC) with over 20 years of experience in Express Entry, Provincial Nominee Programs, LMIA processing, and work permits. Registered with the College of Immigration and Citizenship Consultants (CICC), Chris has helped hundreds of families and skilled workers navigate Canada's immigration system. Based in Vancouver, he provides bilingual services in English and French, with a focus on compliance, transparency, and client advocacy.\n! Next\n.\n"
  },
  {
    name: "Scene 7 — Documents & Submit",
    dsl: "\n> Step 4 — Documents and insurance. The E&O requirement is a serious credibility signal for investors.\n@ Documents & Insurance\n\"3 E&O insurance and supporting docs.\n@ Professional Liability Insurance\n\" Minimum one million per claim, current policy year, named insured. They know the ENCON group plan requirements. Impressive.\n@ Profile Photo\n\"3 Optional photo. Fine.\n@ Additional Supporting Documents\n\"3 CICC License, credentials, good standing. Right documents.\n@ Submit Application\n\"5 Let's see what happens. If they really verify against the CICC register, my name should come back.\n! Submit Application\n~ 15000\n.\n"
  },
  {
    name: "Scene 8 — Verification Result",
    dsl: "\n> The platform verified Chris Daw's CICC College ID in real time — his name came back from the live register\n~ 3000\n\"5 They pulled my full name from the CICC register. Christopher Robert Daw. That's real verification — not name-matching, not self-attestation. They checked the source.\n\" License class IRB — they even know I can do IRB hearings. This is the first platform that actually verifies credentials properly.\n\"5 Entitled to practice. Confirmed. Twenty years and this is the first time a platform has checked automatically.\n.\n"
  }
];

(async () => {
  // ── Pre-run cleanup ────────────────────────────────────────────────────
  const { execSync } = require("child_process");
  try {
    execSync(`docker exec canadreamers-platform python3 -c "
import asyncio, asyncpg
async def main():
    conn = await asyncpg.connect('postgresql://postgres:postgres@postgres:5432/postgres?sslmode=disable')
    await conn.execute(\\"DELETE FROM partner_profiles WHERE display_name = 'Chris Daw'\\")
    await conn.execute(\\"DELETE FROM service_providers WHERE name = 'Chris Daw'\\")
    await conn.execute(\\"DELETE FROM cicc_registry WHERE college_id = 'R409583'\\")
    await conn.execute(\\"DELETE FROM worker_executions WHERE worker_id LIKE '%cicc%'\\")
    await conn.execute(\\"UPDATE users SET role = 'user' WHERE email = 'chris@dawimmigration.com'\\")
    await conn.close()
    print('Chris Daw data cleared')
asyncio.run(main())
"`, { stdio: "inherit" });
  } catch(e) { console.log("Cleanup skipped:", e.message); }

  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-infobars"],
    ignoreDefaultArgs: ["--enable-automation", "--disable-blink-features=AutomationControlled"]
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    storageState: { cookies: [], origins: [] }
  });
  const page = await context.newPage();
  const overlay = fs.readFileSync(OVERLAY, "utf-8").replace("__MP_PERSONA_NAME__", PERSONA);
  await page.addInitScript(overlay);

  // ── Run all scenes ─────────────────────────────────────────────────────
  await page.goto("http://localhost:3000");
  await page.waitForLoadState("networkidle");
  await page.evaluate(([p,h]) => { window.__mp.setPersona(p); window.__mp.setHuman(h); }, [PERSONA, HUMAN]);

  for (let i = 0; i < SCENES.length; i++) {
    const scene = SCENES[i];
    if (scene.url && i > 0) {
      await page.goto(scene.url);
      await page.waitForLoadState("networkidle");
    }
    // Always re-set persona — overlay re-injects on every navigation
    await page.evaluate(([p,h]) => {
      if (window.__mp) { window.__mp.setPersona(p); window.__mp.setHuman(h); }
    }, [PERSONA, HUMAN]);
    console.log("  " + scene.name);
    await page.evaluate(([h,s]) => { window.__mp.setHuman(h); return window.__mp.x(s); }, [HUMAN, scene.dsl]);
    // After login scene, wait for redirect to consultant portal
    if (scene.name.includes("Login")) {
      await page.waitForURL("**/consultant-portal**", { timeout: 15000 }).catch(() => {});
      await page.waitForLoadState("networkidle");
    }
    await new Promise(r => setTimeout(r, 1000));
    // Re-set persona again in case the scene triggered a navigation
    await page.evaluate(([p,h]) => {
      if (window.__mp) { window.__mp.setPersona(p); window.__mp.setHuman(h); }
    }, [PERSONA, HUMAN]);
  }

  console.log("Done.");
  await new Promise(r => setTimeout(r, 5000));
  await browser.close();
})();
