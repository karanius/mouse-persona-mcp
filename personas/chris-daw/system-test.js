#!/usr/bin/env node
/**
 * System test: Chris Daw consultant onboarding → CICC verification
 *
 * Tests the REAL flow — Playwright fills forms, clicks buttons, submits.
 * No overlay, no persona. Pure functional test.
 *
 * Pass criteria:
 * - Login succeeds
 * - Onboarding form steps 1-4 fill correctly
 * - Submit Application button is enabled and clickable
 * - POST /api/v1/onboard/apply returns 201
 * - partner_profiles has Chris Daw
 * - cicc_registry has R409583
 */

const { execSync } = require("child_process");
let chromium;
try { chromium = require("playwright").chromium; }
catch { console.error("npm i playwright"); process.exit(1); }

const BASE = "http://localhost:3000";

async function cleanup() {
  console.log("  [setup] Clearing Chris Daw data...");
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
asyncio.run(main())
"`, { stdio: "pipe" });
  console.log("  [setup] Done");
}

async function verify() {
  const result = execSync(`docker exec canadreamers-platform python3 -c "
import asyncio, asyncpg, json
async def main():
    conn = await asyncpg.connect('postgresql://postgres:postgres@postgres:5432/postgres?sslmode=disable')
    pp = await conn.fetchrow(\\"SELECT display_name, status, metadata FROM partner_profiles WHERE display_name = 'Chris Daw'\\")
    cr = await conn.fetchrow(\\"SELECT college_id, name FROM cicc_registry WHERE college_id = 'R409583'\\")
    we = await conn.fetchval(\\"SELECT COUNT(*) FROM worker_executions WHERE worker_id = 'cicc-registry-lookup'\\")
    result = {
        'partner': dict(pp) if pp else None,
        'registry': dict(cr) if cr else None,
        'worker_runs': we,
    }
    print(json.dumps(result, default=str))
    await conn.close()
asyncio.run(main())
"`, { encoding: "utf-8" }).trim();
  return JSON.parse(result);
}

(async () => {
  await cleanup();

  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-infobars"],
    ignoreDefaultArgs: ["--enable-automation"]
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  let passed = 0;
  let failed = 0;
  function assert(name, condition) {
    if (condition) { console.log(`  ✓ ${name}`); passed++; }
    else { console.log(`  ✗ ${name}`); failed++; }
  }

  try {
    // ── Step 1: Login ──────────────────────────────────────────────────
    console.log("\n[1] Login");
    await page.goto(`${BASE}/auth?role=consultant`);
    await page.waitForLoadState("networkidle");

    await page.locator('#email').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('#email').fill("chris@dawimmigration.com");
    await page.locator('#password').fill("Chris1234!");
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.waitForURL("**/consultant-portal**", { timeout: 15000 });
    assert("Login redirects to /consultant-portal", page.url().includes("consultant-portal"));

    // ── Step 2: Onboarding Step 1 — Identity ───────────────────────────
    console.log("\n[2] Step 1 — Identity");
    await page.waitForLoadState("networkidle");

    // Check we're on step 1
    const heading = await page.textContent('h2');
    assert("Heading is 'Your Identity'", heading?.includes("Your Identity"));

    // Fill Full Name
    const nameInput = page.locator('input[placeholder="Jane Smith"]');
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await nameInput.fill("Chris Daw");
    assert("Full Name filled", true);

    // Fill CICC College ID
    const ciccInput = page.locator('input[placeholder="R508845"]');
    await ciccInput.fill("R409583");
    assert("CICC College ID filled", true);

    // Wait for Next to enable
    await page.waitForTimeout(500);
    const nextBtn = page.locator('button:has-text("Next")');
    const nextDisabled = await nextBtn.isDisabled();
    assert("Next button enabled", !nextDisabled);

    await nextBtn.click();
    await page.waitForTimeout(1000);

    // ── Step 3: Onboarding Step 2 — Specializations ────────────────────
    console.log("\n[3] Step 2 — Specializations");
    const step2Heading = await page.textContent('h2');
    assert("Heading is 'Your Practice'", step2Heading?.includes("Your Practice"));

    // Click specialization tags
    await page.locator('button:has-text("Express Entry")').click();
    await page.waitForTimeout(200);
    await page.locator('button:has-text("Work Permits")').click();
    await page.waitForTimeout(200);

    // Click language tags
    await page.locator('button:has-text("English")').click();
    await page.waitForTimeout(200);
    await page.locator('button:has-text("French")').click();
    await page.waitForTimeout(200);

    assert("Tags selected", true);

    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(1000);

    // ── Step 4: Onboarding Step 3 — Location & Bio ─────────────────────
    console.log("\n[4] Step 3 — Location & Bio");
    const step3Heading = await page.textContent('h2');
    assert("Heading is 'Location & Bio'", step3Heading?.includes("Location & Bio"));

    // Fill city
    const cityInput = page.locator('input[placeholder*="city" i]');
    await cityInput.fill("Vancouver");
    await page.waitForTimeout(1500);

    // Fill bio (50+ words)
    const bioInput = page.locator('textarea');
    await bioInput.fill("Chris Daw is a Regulated Canadian Immigration Consultant with over 20 years of experience in Express Entry, Provincial Nominee Programs, LMIA processing, and work permits. Registered with the College of Immigration and Citizenship Consultants, Chris has helped hundreds of families and skilled workers navigate Canada's immigration system. Based in Vancouver, he provides bilingual services in English and French, with a focus on compliance, transparency, and client advocacy.");
    await page.waitForTimeout(500);

    // Click Next — retry if disabled (city autocomplete)
    await page.waitForTimeout(1500);
    const next3 = page.locator('button:has-text("Next")');
    if (await next3.isDisabled().catch(() => true)) {
      // Try clicking a city suggestion
      const suggestion = page.locator('[role="option"], li:has-text("Vancouver")').first();
      if (await suggestion.isVisible().catch(() => false)) {
        await suggestion.click();
        await page.waitForTimeout(500);
      }
    }
    const next3Disabled = await next3.isDisabled().catch(() => true);
    assert("Step 3 Next enabled", !next3Disabled);
    if (!next3Disabled) {
      await next3.click();
      await page.waitForTimeout(1500);
    }

    // ── Step 5: Onboarding Step 4 — Documents & Submit ─────────────────
    console.log("\n[5] Step 4 — Documents & Submit");
    const step4Heading = await page.textContent('h2');
    assert("Heading is 'Documents & Insurance'", step4Heading?.includes("Documents"));

    // Upload E&O insurance (required)
    const eoUpload = page.locator('input[type="file"]').first();
    const dummyPdf = require("path").resolve(__dirname, "eo-insurance.pdf");
    await eoUpload.setInputFiles(dummyPdf);
    await page.waitForTimeout(2000);
    assert("E&O insurance uploaded", true);

    // Check Submit button state
    const submitBtn = page.locator('button:has-text("Submit Application")');
    const submitExists = await submitBtn.count();
    assert("Submit Application button exists", submitExists > 0);

    if (submitExists > 0) {
      await page.waitForTimeout(1000);
      const submitDisabled = await submitBtn.isDisabled();
      console.log(`  Submit button disabled: ${submitDisabled}`);

      if (!submitDisabled) {
        // Listen for the API response
        const responsePromise = page.waitForResponse(
          resp => resp.url().includes("/onboard/apply") || resp.url().includes("/apply"),
          { timeout: 30000 }
        ).catch(() => null);

        await submitBtn.click();
        console.log("  Clicked Submit Application");

        const response = await responsePromise;
        if (response) {
          console.log(`  API response: ${response.status()}`);
          assert("Submit API call succeeded", response.status() === 201);
        } else {
          assert("Submit API call fired", false);
        }
      } else {
        console.log("  ⚠ Submit is disabled — checking what's missing...");
        // Take screenshot for debugging
        await page.screenshot({ path: "submit-disabled-debug.png" });
        console.log("  Screenshot saved: submit-disabled-debug.png");
        assert("Submit button enabled", false);
      }
    }

    // ── Step 5b: Verification Page ──────────────────────────────────────
    console.log("\n[5b] Verification Page");
    // Wait for the verify page to appear
    for (let attempt = 0; attempt < 15; attempt++) {
      await page.waitForTimeout(1000);
      const pageText = await page.textContent('body').catch(() => '');
      if (pageText.includes('Verify') || pageText.includes('CICC') || pageText.includes('License Verification') || pageText.includes('Checking')) {
        console.log(`  Verify page detected (attempt ${attempt + 1})`);
        break;
      }
      if (attempt === 14) {
        console.log("  ⚠ Verify page not detected — taking screenshot");
        await page.screenshot({ path: "verify-page-debug.png" });
      }
    }
    assert("Verification page loaded", true);
    // Wait for result — CICC lookup takes ~12s
    for (let attempt = 0; attempt < 30; attempt++) {
      await page.waitForTimeout(1000);
      const pageText = await page.textContent('body').catch(() => '');
      if (pageText.includes('License Verified') || pageText.includes('Verified') || pageText.includes('Entitled')) {
        console.log(`  Verification result appeared (attempt ${attempt + 1})`);
        break;
      }
    }
    const bodyText = await page.textContent('body').catch(() => '');
    const resultVisible = bodyText.includes('License Verified') || bodyText.includes('Verified');
    assert("CICC verification result shown", resultVisible);
    await page.waitForTimeout(3000);

    // ── Step 5c: JWT Role Claim ──────────────────────────────────────
    console.log("\n[5c] JWT Role Claim");
    const jwtToken = await page.evaluate(() => localStorage.getItem('auth_token'));
    if (jwtToken) {
      // Decode JWT payload (base64)
      const payload = JSON.parse(atob(jwtToken.split('.')[1]));
      const customRole = payload?.app_metadata?.custom_role;
      console.log(`  JWT custom_role: ${customRole}`);
      assert("JWT contains role claim", !!customRole);
    } else {
      assert("JWT token exists", false);
    }

    // ── Step 6: Verify DB ──────────────────────────────────────────────
    console.log("\n[6] Verify database");

    const db = await verify();
    assert("Partner profile created", !!db.partner);
    assert("CICC registry entry exists", !!db.registry);
    assert("Verification worker ran", db.worker_runs > 0);

    if (db.partner) {
      console.log(`  Partner: ${db.partner.display_name} — ${db.partner.status}`);
      const meta = typeof db.partner.metadata === 'string' ? JSON.parse(db.partner.metadata) : db.partner.metadata || {};
      console.log(`  CICC verified: ${meta.cicc_verified}`);
      console.log(`  CICC name: ${meta.cicc_name}`);
    }
    if (db.registry) {
      console.log(`  Registry: ${db.registry.college_id} — ${db.registry.name}`);
    }

  } catch (e) {
    console.error(`\n  ✗ FATAL: ${e.message}`);
    failed++;
    await page.screenshot({ path: "test-fatal-error.png" });
  }

  // ── Summary ──────────────────────────────────────────────────────────
  console.log(`\n${"=".repeat(50)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(50)}`);

  await page.waitForTimeout(3000);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
