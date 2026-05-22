#!/usr/bin/env node
// Cursor Persona Recording — Chris Daw
// Generated: 2026-05-22
// Replay: node this-file.js

const fs = require("fs");
const path = require("path");
let chromium;
try { chromium = require("playwright").chromium; }
catch { console.error("npm i playwright"); process.exit(1); }

const HUMAN = process.argv.includes("--no-human") ? 0 : 7000;
const OVERLAY = path.resolve(__dirname, "..", "overlay.js");
const PERSONA = "Chris Daw";
const EMAIL = "chris.daw.replay." + Date.now() + "@immigration.ca";

const SCENES = [
  {
    name: "Scene 1: Landing to Account Creation",
    dsl: "> RCIC veteran evaluates CanaDREAMERS — consultant acquisition\n@ Stop guessing. Start belonging.\n\" Tagline for immigrants, not consultants. Where is the professional entrance?\n~ 500\n@ Immigration Consultants\n\" They say RCIC specifically. They understand regulation.\n~ 500\n> Onboarding friction = supply-side churn\n@ Sign In\n\" Consultant Portal, not User Dashboard.\n! Sign In\n~ 800\n! Consultant Portal\n~ 800\n! Sign up\n~ 500\n@ Start Your Journey\n\" I am a 20-year veteran. This should say Professional Registration.\n~ 500\n= Full Name | Christopher Robert Daw\n~ 200\n= Email | EMAIL_PLACEHOLDER\n~ 200\n= Password | SecurePass2026!\n~ 500\n@ Create Account\n\" Let us see the onboarding wizard.\n! Create Account\n~ 2000\n."
  },
  {
    name: "Scene 2: Wizard Identity + Practice",
    dsl: "> CICC College ID anchors verification\n@ Your Identity\n\" R409583 — my full CICC record.\n~ 300\n= Full Name | Christopher Robert Daw\n~ 200\n= CICC College ID | R409583\n~ 800\n@ CICC Registry Match\n\" RCIC, Active. Real verification.\n~ 500\n! Next\n~ 800\n> Specializations drive directory matching\n@ Your Practice\n\" What clients search by.\n! Refugee & Asylum\n~ 150\n! IRB Hearings\n~ 150\n! Express Entry\n~ 150\n! Compliance & Appeals\n~ 150\n! English\n~ 150\n! French\n~ 200\n! Next\n~ 800\n."
  },
  {
    name: "Scene 3: Bio + Documents",
    dsl: "> Bio quality = client conversion\n@ Location & Bio\n\" Twenty years in one paragraph.\n~ 300\n= City | Waterloo, ON\n~ 200\n.",
    afterSteps: "fill_bio"
  },
  {
    name: "Scene 4: Submit + Verify + Review",
    dsl: "> E&O gate — regulatory moat\n@ eo_certificate.pdf\n\" ENCON group plan. The credential that matters.\n~ 500\n! Submit Application\n~ 2000\n> CICC verification — compliance differentiator\n@ Verify Your CICC License\n\" R409583. Active, RCIC, no conditions.\n~ 500\n! Verify My License\n~ 2000\n> Application submitted — registration to verified consultant\n@ Application Under Review\n\" Three minutes from landing to here. Not bad — but I have notes.\n~ 500\n@ Pending Admin Review\n\" No timeline, no queue position. My bar for as soon as possible is very low.\n~ 500\n@ This page updates automatically\n\" Auto-updates — good. But send me an email.\n.",
    beforeSteps: "upload_eo"
  }
];

const EO_CERT = "/Users/k/ai/merge/canadreamers-platform/tests/real_world_data/personas/chris_daw/eo_certificate.pdf";

(async () => {
  console.log("Chris Daw's Onboarding" + (HUMAN ? " (human: " + HUMAN + "ms)" : " (fast)"));
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
  await page.goto("http://localhost:3000");
  await page.waitForLoadState("networkidle");
  await page.evaluate(([p,h]) => { window.__mp.setPersona(p); window.__mp.setHuman(h); }, [PERSONA, HUMAN]);

  for (let i = 0; i < SCENES.length; i++) {
    const scene = SCENES[i];
    console.log("  " + scene.name);

    if (scene.beforeSteps === "upload_eo") {
      const fi = await page.$('input[type="file"]');
      if (fi) { await fi.setInputFiles(EO_CERT); console.log("    E&O uploaded"); }
      await new Promise(r => setTimeout(r, 1000));
    }

    const dsl = scene.dsl.replace("EMAIL_PLACEHOLDER", EMAIL);
    await page.evaluate(([h,s]) => { window.__mp.setHuman(h); return window.__mp.x(s); }, [HUMAN, dsl]);

    if (scene.afterSteps === "fill_bio") {
      await page.locator('textarea').first().fill('Christopher Robert Daw, RCIC. Twenty years of practice specializing in refugee protection, IRB hearings, Express Entry applications, and compliance matters. Former member of the Canadian Bar Association Immigration Law Section. Recognized for representing clients in complex refugee claims, detention reviews, and pre-removal risk assessments. Honest counsel, realistic expectations, relentless advocacy. Waterloo, Ontario. English and French.');
      await page.waitForTimeout(500);
      await page.locator('button:has-text("Next")').click();
      await page.waitForTimeout(1000);
    }

    console.log("    done");
    await new Promise(r => setTimeout(r, 500));
  }

  console.log("\nJourney complete.");
  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
})();
