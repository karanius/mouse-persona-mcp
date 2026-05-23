#!/usr/bin/env node
// Post-approval return test — Chris Daw
// Run AFTER the admin replay has approved Chris's application.
// Verifies: Chris logs in and sees the welcome gate, not the onboarding form.
//
// Usage: node personas/chris-daw/return-test.js [--headed]

let chromium;
try { chromium = require("playwright").chromium; }
catch { console.error("npm i playwright"); process.exit(1); }

const path = require("path");
const HEADED = process.argv.includes("--headed");

let _browser;
async function guard(name, condition, page) {
  if (!condition) {
    console.error(`  FAIL: ${name}`);
    try {
      await page.screenshot({ path: path.resolve(__dirname, `return-fail-${Date.now()}.png`) });
    } catch {}
    if (_browser) await _browser.close().catch(() => {});
    process.exit(1);
  }
}

(async () => {
  _browser = await chromium.launch({
    headless: !HEADED,
    args: ["--disable-infobars"],
    ignoreDefaultArgs: ["--enable-automation", "--disable-blink-features=AutomationControlled"]
  });
  const browser = _browser;
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // Step 1 — Navigate to consultant auth
  console.log("  Navigating to consultant login...");
  await page.goto("http://localhost:3000/auth?role=consultant");
  await page.waitForLoadState("networkidle");

  // Step 2 — Fill credentials
  await page.locator("#email").waitFor({ state: "visible", timeout: 10000 });
  await page.locator("#email").fill("chris@dawimmigration.com");
  await page.locator("#password").fill("Chris1234!");

  // Step 3 — Sign in
  await page.getByRole("button", { name: "Sign In", exact: true }).click();

  // Step 4 — Wait for redirect
  await page.waitForTimeout(5000);

  // Step 5 — Assert URL
  const url = page.url();
  console.log("  Redirected to:", url);
  await guard("URL includes consultant-portal", url.includes("consultant-portal"), page);

  // Step 6 — Assert welcome gate content, not onboarding form
  const body = await page.textContent("body").catch(() => "");
  const seesWelcome = body.includes("Welcome") || body.includes("Enter Your Portal");
  const seesOnboarding = body.includes("Your Identity") || body.includes("Step 1");
  console.log("  Sees welcome gate:", seesWelcome);
  console.log("  Sees onboarding form:", seesOnboarding);
  await guard("Sees welcome gate (not onboarding)", seesWelcome && !seesOnboarding, page);

  await browser.close();
  console.log("PASS: Chris sees welcome gate");
  process.exit(0);
})();
