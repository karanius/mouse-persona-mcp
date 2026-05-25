#!/usr/bin/env node
// Act 2 — Amara Okafor: Pathfinder → Dashboard
// 10 scenes. Flags: --headed, --no-human

const fs = require("fs");
const path = require("path");
let chromium;
try { chromium = require("playwright").chromium; }
catch { console.error("npm i playwright"); process.exit(1); }

const HEADED = process.argv.includes("--headed");
const HUMAN = process.argv.includes("--no-human") ? 0 : 5000;
const PERSONA = "Amara Okafor";

function findUp(name) {
  let d = __dirname;
  for (let i = 0; i < 10; i++) {
    const f = path.join(d, name);
    if (fs.existsSync(f)) return f;
    const parent = path.dirname(d);
    if (parent === d) break;
    d = parent;
  }
  throw new Error(name + " not found from " + __dirname);
}
const OVERLAY = findUp("overlay.js");
const CONFIG = findUp("persona.config.json");

const SCENES = [
  { name: "Scene 1", dsl: "\n  > Amara Okafor lands on CanaDREAMERS. Lagos, 11 PM. CRS 470, eleven points short.\n  @ Stop guessing. Start belonging.\n  \"5 Let me see if they verify their consultants. I've seen too many fake agents in Lagos.\n  @ Find a Consultant\n  \"3 Let me find who does FSWP.\n  ! Find a Consultant\n" },
  { name: "Scene 2", dsl: "\n  > Chris Daw. CICC verified, Federal Skilled Worker specialist, $250. From the database, not a mock.\n  @ Chris Daw\n  \"5 CICC Verified. FSWP. $250 consultation. He can't disappear with my money.\n  @ Sign In\n  ! Sign In\n" },
  { name: "Scene 3", dsl: "\n  > Two portals. Amara picks User Dashboard.\n  ! User Dashboard\n" },
  { name: "Scene 4", dsl: "\n  @ Sign up\n  ! Sign up\n" },
  { name: "Scene 5", dsl: "\n  > Amara signs up. Three fields. The identity she's about to leave behind.\n  = Full Name | Amara Okafor\n  = Email | amara.okafor@interswitch.com\n  = Password | AmaraCanada2026!\n  \"3 My Interswitch email. The company I'm about to leave.\n  ! Create Account\n" },
  { name: "Scene 6", dsl: "\n  > The Pathfinder. Three questions. Where are you?\n  @ Outside Canada\n  \"3 Lagos. Not in Canada. Not yet.\n  ! Outside Canada\n" },
  { name: "Scene 7", dsl: "\n  > What brings you? Five paths.\n  @ I want to work and live in Canada\n  \"3 Work and live. The honest path.\n  ! I want to work and live in Canada\n" },
  { name: "Scene 8", dsl: "\n  > Do you have a job offer? The fork.\n  @ No, not yet\n  \"5 No job offer. No employer. Express Entry. FSWP. Just me and the points system.\n  ! No, not yet\n" },
  { name: "Scene 9", dsl: "\n  > Three clicks. Skilled Worker Applicant. The platform knows who Amara is.\n  @ Your journey is set\n  \"3 Skilled Worker Applicant. Three clicks, not five forms. The platform gets it.\n  @ Continue to Dashboard\n  \"3 Let me see what's on the other side.\n  ! Continue to Dashboard\n" },
  { name: "Scene 10", dsl: "\n  > Amara lands on her dashboard. Skilled Worker Applicant. The Pathfinder resolved her archetype in three clicks. The journey begins here.\n  \"5 I'm in. The platform knows I'm a skilled worker outside Canada with no job offer. Express Entry. FSWP. Now I need to build my profile, get my CRS score, and find Chris Daw.\n" }
];

(async () => {
  const browser = await chromium.launch({
    headless: !HEADED,
    args: ["--disable-infobars"],
    ignoreDefaultArgs: ["--enable-automation", "--disable-blink-features=AutomationControlled"]
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const config = JSON.parse(fs.readFileSync(CONFIG, "utf-8"));
  const configJs = "var __MP_CONFIG__ = " + JSON.stringify(config) + ";\n";
  const overlayScript = configJs + fs.readFileSync(OVERLAY, "utf-8").replace("__MP_PERSONA_NAME__", PERSONA);
  await page.addInitScript(overlayScript);
  await page.goto("http://localhost:3000/");
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => window.__mp && window.__mp.setPersona, { timeout: 10000 });
  await page.evaluate(([p,h]) => { window.__mp.setPersona(p); window.__mp.setHuman(h); }, [PERSONA, HUMAN]);

  for (let i = 0; i < SCENES.length; i++) {
    console.log("  " + SCENES[i].name);
    try {
      await page.evaluate(([h,s]) => { window.__mp.setHuman(h); return window.__mp.x(s); }, [HUMAN, SCENES[i].dsl]);
    } catch(e) {
      await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
    }
    await new Promise(r => setTimeout(r, 500));
  }

  const s = await page.evaluate(() => window.__mp ? window.__mp.session() : null);
  if (s) {
    const sd = path.resolve(__dirname, "sessions");
    if (!fs.existsSync(sd)) fs.mkdirSync(sd, { recursive: true });
    fs.writeFileSync(path.resolve(__dirname, "last-session.json"), JSON.stringify(s, null, 2));
    console.log("  Session saved (" + s.scenes.length + " scenes)");
  }

  console.log("\n  Act 2 complete. Amara → Skilled Worker Applicant → Dashboard.");
  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
})();