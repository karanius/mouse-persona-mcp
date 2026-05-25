#!/usr/bin/env node
// Act 0 — Discovery: Amara Okafor's journey to CanaDREAMERS
// All narrated overlay on real websites. No platform interaction until the final scene.
//
// Flags:
//   --headed     Show the browser window (default: headless)
//   --no-human   Skip thought pauses (automation speed)

const fs = require("fs");
const path = require("path");
let chromium;
try { chromium = require("playwright").chromium; }
catch { console.error("npm i playwright"); process.exit(1); }

const HEADED = process.argv.includes("--headed");
const HUMAN = process.argv.includes("--no-human") ? 0 : 5000;

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

const AMARA_PERSONA = {
  persona: {
    name: "Amara Okafor",
    role: "Senior Data Engineer, Interswitch Group — FSWP applicant",
    voice: "Direct, analytical, quietly determined. First in her family to have a master's degree. Thinks in data: probabilities, thresholds, cutoff scores.",
    priorities: [
      "Close the 11-point CRS gap",
      "Find a verified consultant — not a scam artist",
      "The French strategy — CLB 7 for bilingual bonus"
    ]
  },
  narrator: {
    audience: "investors and product team",
    voice: "Third-person. The pure skilled worker perspective — no employer, no investment, no provincial backing. Just the points system.",
    format: "immigrant perspective + systemic fairness angle"
  }
};

let _browser;

(async () => {
  const { loadLastSession, saveSession } = require(path.resolve(__dirname, "..", "..", "..", "session-store"));
  const lastSession = loadLastSession(__dirname);
  if (lastSession) {
    console.log(`  Previous session: ${lastSession.scenes?.length || 0} scenes from ${lastSession.startedAt || "unknown"}`);
  }

  _browser = await chromium.launch({
    headless: !HEADED,
    args: ["--disable-infobars"],
    ignoreDefaultArgs: ["--enable-automation", "--disable-blink-features=AutomationControlled"]
  });
  const browser = _browser;
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const config = JSON.parse(fs.readFileSync(CONFIG, "utf-8"));
  const configJs = "var __MP_CONFIG__ = " + JSON.stringify(config) + ";\n";
  const overlayScript = configJs + fs.readFileSync(OVERLAY, "utf-8");
  await page.addInitScript(overlayScript);

  async function scene(dsl) {
    try {
      await page.evaluate((p) => { if (window.__mp) window.__mp.loadPersona(p); }, AMARA_PERSONA);
      await page.evaluate(([h,s]) => window.__mp.x(s, { human: h }), [HUMAN, dsl]);
    } catch(e) {
      await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
    }
  }

  // ── Chapter 0.1 — The Gap ─────────────────────────────────────────────
  // Scene 0.1.1 — The Number (narrated on blank page)
  console.log("  Chapter 0.1 — The Gap");
  await page.goto("about:blank");
  await page.waitForTimeout(1000);
  await scene(`
    > Amara Okafor. Senior Data Engineer at Interswitch, Lagos. Builds fraud detection systems for 40 million users. Earns $16,000 CAD a year.
    "5 I build systems that move $4 billion a year. I earn less than a junior developer in Toronto makes in two months.
    .
  `);

  // Scene 0.1.2 — The Comparison (LinkedIn public page)
  console.log("  Scene 0.1.2 — LinkedIn");
  await page.goto("https://www.linkedin.com");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);
  await scene(`
    > Amara scrolls LinkedIn. Her classmate Tunde moved to Toronto two years ago. Data engineer at Shopify. $115,000 a year. Seven times her salary.
    "5 Tunde was not smarter than me. He was not a better engineer. He just left.
    .
  `);

  // Scene 0.1.3 — The Conversation (narrated)
  console.log("  Scene 0.1.3 — The Conversation");
  await page.goto("about:blank");
  await page.waitForTimeout(500);
  await scene(`
    > Evening. Phone call with her mother in Enugu. Amara sends money for her cousin's wedding. She always sends money.
    "5 If I make this work, I can send more. I can bring Emeka after he finishes. I can buy Mama a house that doesn't leak when it rains.
    .
  `);

  // ── Chapter 0.2 — The Research ────────────────────────────────────────
  // Scene 0.2.1 — The Express Entry Page
  console.log("  Chapter 0.2 — The Research");
  await page.goto("https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry.html");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);
  await scene(`
    > Saturday morning. Amara opens the Express Entry page on Canada.ca. She has been researching this for 8 months.
    @ Express Entry
    "3 Create a profile. Get a CRS score. Wait for a draw. If your score is above the cutoff, you get invited.
    " Simple system. But the cutoffs keep climbing. And there haven't been general draws in over a year.
    .
  `);

  // Scene 0.2.2 — The STEM Angle
  console.log("  Scene 0.2.2 — STEM Category");
  await page.goto("https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/rounds-invitations/category-based-selection.html");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);
  await scene(`
    > She reads about category-based selection. STEM draws for science, technology, engineering, and math workers. Her NOC: 21220 — Cybersecurity specialists.
    @ STEM
    "3 STEM draws. April 2024: cutoff 491. December 2023: cutoff 481. July 2023: cutoff 486.
    "5 481 is the lowest. I'm at 470. Eleven points. That's it. Eleven points between this life and a different one.
    .
  `);

  // Scene 0.2.3 — The CRS Calculator
  console.log("  Scene 0.2.3 — CRS Calculator");
  await page.goto("https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/criteria-comprehensive-ranking-system/grid.html");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);
  await scene(`
    > She opens the CRS calculator for the hundredth time.
    "3 Age 31: 99 points. Master's degree: 135. English CLB 10: 136. Skill transferability: 100. Total: 470.
    " I've taken IELTS twice. Education is maxed. I'm already 31. Next year I lose points. The clock is running against me.
    .
  `);

  // Scene 0.2.4 — The French Idea
  console.log("  Scene 0.2.4 — The French Idea");
  await page.goto("https://www.canadavisa.com/canada-immigration-discussion-board/");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);
  await scene(`
    > A forum post: "How I gained 37 CRS points with French." She learned French in secondary school. Six years of it.
    "3 CLB 7 in French: 37 CRS points through SOL points and the bilingual bonus.
    "5 470 plus 37 equals 507. Above every STEM cutoff. Je peux faire ça. I can do this.
    " But I need a consultant. One mistake and I wait another year. And I need a real one — not the kind that disappears with your money.
    .
  `);

  // ── Chapter 0.3 — Finding CanaDREAMERS ────────────────────────────────
  // Scene 0.3.1 — The Search
  console.log("  Chapter 0.3 — Finding CanaDREAMERS");
  await page.goto("https://www.google.com");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);
  const searchBox = page.locator('textarea[name="q"], input[name="q"]').first();
  await searchBox.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  await searchBox.fill("verified immigration consultant Canada FSWP express entry").catch(() => {});
  await page.waitForTimeout(1500);
  await scene(`
    > Amara searches for a verified consultant. She knows about the CICC. She needs an RCIC — registered, verified, accountable.
    "3 Hundreds of results. My colleague paid a Lagos agent two million naira and the application was never filed.
    " I need someone on the CICC register. Not a website with stock photos. A real person with a real registration number.
    .
  `);

  // Scene 0.3.2 — The Platform
  console.log("  Scene 0.3.2 — CanaDREAMERS");
  await page.goto("http://localhost:3000");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);
  await scene(`
    > Amara finds CanaDREAMERS. Verified consultants only. Every consultant is CICC-registered.
    @ Stop guessing
    "3 Verified consultants only. That's the right filter.
    @ Immigration Consultants
    " Let me find someone who does FSWP.
    .
  `);

  // Navigate to consultant listing if available
  const consultantLink = page.locator('a:has-text("Consultants"), a:has-text("Find"), a:has-text("Browse")').first();
  await consultantLink.click().catch(() => {});
  await page.waitForTimeout(3000);

  await scene(`
    > She finds Chris Daw. RCIC R409583, Vancouver, FSWP specialist. Fee range: $3,000-6,000. Three completed cases, 100% success rate.
    "5 Three cases, all successful. He's not the cheapest but he's verified. $3,000 is the low end. That's three months of my rent. But Tunde's agent charged $5,000 and it worked.
    " The difference is accountability. If Chris is on this platform and CICC-verified, he can't disappear with my money.
    .
  `);

  // Scene 0.3.3 — The Decision
  console.log("  Scene 0.3.3 — The Decision");
  await scene(`
    > Sunday evening. Amara sits on her balcony in Lekki. The Lagos skyline is orange with dust and sunset. She opens the screenshot of Chris's profile.
    "3 I have been thinking about this for 8 months.
    "3 The CRS gap is 11 points. The French strategy is real. The money is there.
    "5 I am running out of birthdays.
    .
  `);

  // Look for Sign Up button
  const signUp = page.locator('a:has-text("Sign Up"), button:has-text("Sign Up"), a:has-text("Get Started")').first();
  const signUpVisible = await signUp.isVisible().catch(() => false);
  if (signUpVisible) {
    await scene(`
      > Amara clicks Sign Up. The decision is made.
      @ Sign Up
      "3 Let's see if this platform is real.
      ! Sign Up
    `);
  } else {
    await scene(`
      > Amara decides. She will sign up tomorrow morning. The decision is made.
      "5 Tomorrow. I sign up tomorrow. And then the algorithm starts.
      .
    `);
  }

  // ── Save session ──────────────────────────────────────────────────────
  console.log("  Act 0 complete — saving session");
  const sess = await page.evaluate(() => window.__mp ? window.__mp.session() : null);
  if (sess) {
    saveSession(__dirname, sess);
    console.log("  Session saved");
  }

  await page.waitForTimeout(3000);
  await browser.close();
  console.log("\n  Act 0 — Discovery: Complete");
  console.log("  Amara Okafor has found CanaDREAMERS. CRS 470. Gap: 11 points. Strategy: French.");
  console.log("  Next: Act 2 — The Immigrant (sign up, profile, eligibility assessment)");
  process.exit(0);
})();
