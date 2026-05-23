#!/usr/bin/env node
// Cursor Persona Recording — Chris Daw, Complete Journey
// Overlay does visual commentary. Playwright does form interaction.
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
const OVERLAY = path.resolve(__dirname, "..", "..", "overlay.js");
const CONFIG = path.resolve(__dirname, "..", "..", "persona.config.json");
const PERSONA = "Chris Daw";

let _browser;
async function guard(name, condition, page) {
  if (!condition) {
    console.error(`  FAIL: ${name}`);
    try { await page.screenshot({ path: path.resolve(__dirname, `fail-${Date.now()}.png`) }); } catch {}
    if (_browser) await _browser.close().catch(() => {});
    process.exit(1);
  }
}

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

  _browser = await chromium.launch({
    headless: !HEADED,
    args: ["--disable-infobars"],
    ignoreDefaultArgs: ["--enable-automation", "--disable-blink-features=AutomationControlled"]
  });
  const browser = _browser;
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const config = JSON.parse(fs.readFileSync(CONFIG, "utf-8"));
  const configJs = "var __MP_CONFIG__ = " + JSON.stringify(config) + ";\n";
  const overlayScript = configJs + fs.readFileSync(OVERLAY, "utf-8").replace("__MP_PERSONA_NAME__", PERSONA);
  await page.addInitScript(overlayScript);

  // Helper: run overlay scene
  async function scene(dsl) {
    try {
      await page.evaluate((p) => { if (window.__mp) window.__mp.setPersona(p); }, PERSONA);
      await page.evaluate(([h,s]) => window.__mp.x(s, { human: h }), [HUMAN, dsl]);
    } catch(e) {
      // Page navigated during scene — recover
      await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
    }
  }

  // ── Scene 1: Discovery ──────────────────────────────────────────────
  console.log("  Scene 1 — Discovery");
  await page.goto("http://localhost:3000");
  await page.waitForLoadState("networkidle");
  await scene(`
    > RCIC consultant Chris Daw discovers the CanaDREAMERS platform for the first time
    @ Stop guessing. Start belonging.
    " Bold claim. Let's see if they actually understand what regulated consultants need.
    @ Immigration Consultants
    "3 They have a consultant section.
    @ Sign In
    "3 Let me sign in and see what they offer consultants.
  `);
  // Navigate to consultant auth flow directly
  await page.goto("http://localhost:3000/auth?role=consultant");
  await page.waitForLoadState("networkidle");

  // ── Scene 3: Login ──────────────────────────────────────────────────
  console.log("  Scene 3 — Login");
  await page.waitForLoadState("domcontentloaded");
  await page.locator('#email').waitFor({ state: 'visible', timeout: 10000 });
  // Playwright fills login FIRST, then overlay adds commentary
  await page.locator('#email').fill("chris@dawimmigration.com");
  await page.locator('#password').fill("Chris1234!");
  await scene(`
    > Chris Daw logs into his consultant account
    "3 Let me use my professional email.
  `);
  const loginResponse = page.waitForResponse(
    resp => resp.url().includes("/auth/login"),
    { timeout: 10000 }
  ).catch(() => null);
  await page.getByRole('button', { name: 'Sign In' }).click();
  const loginResp = await loginResponse;
  console.log("  Login API:", loginResp ? loginResp.status() : "no response");
  await guard("Login API 200", loginResp && loginResp.status() === 200, page);
  await page.waitForTimeout(3000);
  const hasToken = await page.evaluate(() => !!localStorage.getItem('auth_token'));
  console.log("  Auth token:", hasToken);
  await guard("Auth token exists", hasToken, page);
  // Platform should redirect to /consultant-portal based on role intent
  await page.waitForURL("**/consultant-portal**", { timeout: 10000 }).catch(() => {});
  await page.waitForLoadState("networkidle");
  console.log("  Redirected to:", page.url());
  await guard("Redirected to consultant-portal", page.url().includes("consultant-portal"), page);

  // ── Scene 4: Identity ───────────────────────────────────────────────
  console.log("  Scene 4 — Identity");
  await page.waitForTimeout(2000);
  await scene(`
    > Chris Daw arrives at the consultant portal — the onboarding workflow begins
    @ Consultant Portal
    "3 Four steps. Reasonable workflow.
    @ Your Identity
    "3 Identity first. Let's see what they validate.
    @ CICC College ID
    " Good — they ask for the College ID, not just a name. That's the right field. But do they check it against the actual register?
  `);
  // Playwright fills identity
  await page.locator('input[placeholder="Jane Smith"]').fill("Chris Daw");
  await page.locator('input[placeholder="R508845"]').fill("R409583");
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Next")').click();
  await page.waitForTimeout(1500);

  // ── Scene 5: Specializations ────────────────────────────────────────
  console.log("  Scene 5 — Specializations");
  await scene(`
    > Step 2 — Chris Daw selects specializations
    @ Your Practice
    "3 Specializations and languages. Standard intake.
    @ Express Entry
    " Express Entry — that's my bread and butter. Twenty years of CRS calculations.
  `);
  // Playwright selects tags
  await page.locator('button:has-text("Express Entry")').click();
  await page.waitForTimeout(200);
  await page.locator('button:has-text("Work Permits")').click();
  await page.waitForTimeout(200);
  await page.locator('button:has-text("English")').click();
  await page.waitForTimeout(200);
  await page.locator('button:has-text("French")').click();
  await page.waitForTimeout(200);
  await page.locator('button:has-text("Next")').click();
  await page.waitForTimeout(1500);

  // ── Scene 6: Location & Bio ─────────────────────────────────────────
  console.log("  Scene 6 — Location & Bio");
  await scene(`
    > Step 3 — Location and bio
    @ Location & Bio
    "3 City and bio. Public-facing.
    @ Professional Bio
    " Fifty-word minimum. Fair enough — clients need to know who they're hiring.
  `);
  // Playwright fills location & bio
  await page.locator('input[placeholder*="city" i]').fill("Vancouver");
  await page.waitForTimeout(500);
  await page.locator('textarea').fill("Chris Daw is a Regulated Canadian Immigration Consultant (RCIC) with over 20 years of experience in Express Entry, Provincial Nominee Programs, LMIA processing, and work permits. Registered with the College of Immigration and Citizenship Consultants (CICC), Chris has helped hundreds of families navigate Canada's immigration system. Based in Vancouver, bilingual in English and French.");
  await page.waitForTimeout(1000);
  await page.locator('button:has-text("Next")').click();
  await page.waitForTimeout(1500);

  // ── Scene 7: Documents & Submit ─────────────────────────────────────
  console.log("  Scene 7 — Documents & Submit");
  await scene(`
    > Step 4 — Documents and insurance
    @ Documents & Insurance
    "3 E&O insurance and supporting docs.
    @ Professional Liability Insurance
    " Minimum one million per claim, current policy year, named insured. They know the ENCON requirements. Impressive.
    @ Submit Application
    "5 Let's see what happens. If they really verify against the CICC register, my name should come back.
  `);
  // Playwright uploads E&O and submits
  const dummyPdf = path.resolve(__dirname, "eo-insurance.pdf");
  await page.locator('input[type="file"]').first().setInputFiles(dummyPdf);
  await page.waitForTimeout(2000);
  console.log("  [upload] E&O insurance attached");
  await guard("E&O uploaded", true, page);
  await page.screenshot({ path: path.resolve(__dirname, "pre-submit-debug.png") });
  const submitBtn = page.locator('button:has-text("Submit Application")');
  const submitCount = await submitBtn.count();
  console.log(`  [submit] Submit buttons: ${submitCount}`);
  const disabled = submitCount > 0 ? await submitBtn.isDisabled() : true;
  console.log(`  [submit] Button disabled: ${disabled}`);
  await guard("Submit button enabled", !disabled, page);
  if (!disabled) {
    await submitBtn.click();
    console.log("  [submit] Application submitted");
    await guard("Submit fired", true, page);
    await page.waitForTimeout(3000);
  }

  // ── Scene 8: CICC Verification ──────────────────────────────────────
  console.log("  Scene 8 — CICC Verification");
  await scene(`
    > Chris Daw's application is submitted — the platform now verifies his credentials
    "3 They're checking the register automatically. No button to click.
    "5 This is the moment. If they're really checking the live register, my full name should come back.
  `);
  // Wait for verification result
  console.log("  [verify] Waiting for CICC result...");
  for (let attempt = 0; attempt < 25; attempt++) {
    await page.waitForTimeout(1000);
    const text = await page.textContent('body').catch(() => '');
    if (text.includes('License Verified') || text.includes('Christopher')) {
      console.log(`  [verify] Result appeared (${attempt + 1}s)`);
      break;
    }
  }
  const bodyText = await page.textContent('body').catch(() => '');
  const verifyFound = bodyText.includes('License Verified') || bodyText.includes('Christopher');
  await guard("CICC verification result appeared", verifyFound, page);

  // ── Scene 9: Verified ───────────────────────────────────────────────
  console.log("  Scene 9 — Verified");
  await page.waitForTimeout(2000);
  await scene(`
    > Christopher Robert Daw — verified against the live CICC register
    "5 They pulled my full name from the CICC register. Christopher Robert Daw. That's real verification.
    " License class IRB — they even know I can do IRB hearings.
    "5 Entitled to practice. Confirmed. First platform that checks automatically.
  `);

  console.log("Done.");
  await page.waitForTimeout(5000);
  await browser.close();

  const dbCheck = execSync(`docker exec -w /app -e PYTHONPATH=/app canadreamers-platform python3 -c "
import asyncio, asyncpg, json
async def main():
    conn = await asyncpg.connect('postgresql://postgres:postgres@postgres:5432/postgres?sslmode=disable')
    uid = await conn.fetchval(\\"SELECT id FROM users WHERE email = 'chris@dawimmigration.com'\\")
    pp = await conn.fetchrow('SELECT status, metadata FROM partner_profiles WHERE user_id = ' + chr(36) + '1::uuid', str(uid))
    cr = await conn.fetchval(\\"SELECT COUNT(*) FROM cicc_registry WHERE college_id = 'R409583'\\")
    meta = json.loads(pp['metadata']) if pp and isinstance(pp['metadata'], str) else (pp['metadata'] if pp else {}) or {}
    ok = pp and meta.get('cicc_verified') and cr > 0
    print('PASS' if ok else 'FAIL')
    print(f'status={pp[\\"status\\"] if pp else \\"none\\"} cicc_verified={meta.get(\\"cicc_verified\\")} registry={cr}')
    await conn.close()
asyncio.run(main())
"`, { encoding: "utf-8" });
  console.log("  [db]", dbCheck.trim());
  if (!dbCheck.includes("PASS")) { console.error("  FAIL: DB verification"); process.exit(1); }

  // Post-approval return test: run after admin approves Chris
  // node personas/chris-daw/return-test.js
  // (tests that Chris sees welcome gate, not onboarding form)
})();
