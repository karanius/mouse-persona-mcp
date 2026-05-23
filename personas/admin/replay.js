#!/usr/bin/env node
// Admin Persona Replay — Review and Approve Chris Daw
// Independent: seeds Chris's pending application before starting
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
const PERSONA = "Admin";

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
  // ── Seed: Chris Daw with pending application + CICC verified + E&O ──
  const { execSync } = require("child_process");
  try {
    execSync(`docker cp ${path.resolve(__dirname, "seed-chris.py")} canadreamers-platform:/tmp/seed-chris.py`, { stdio: "pipe" });
    const seedOutput = execSync(`docker exec -w /app -e PYTHONPATH=/app canadreamers-platform python3 /tmp/seed-chris.py`, { encoding: "utf-8" });
    console.log(seedOutput.trim());
    if (!seedOutput.includes("seeded: 1")) { console.error("FAIL: Seed"); process.exit(1); }
  } catch(e) { console.log("Seed skipped:", e.message); }

  _browser = await chromium.launch({
    headless: !HEADED,
    args: ["--disable-infobars"],
    ignoreDefaultArgs: ["--enable-automation", "--disable-blink-features=AutomationControlled"]
  });
  const browser = _browser;
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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
      await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
    }
  }

  // ── Scene 1: Admin Login ────────────────────────────────────────────
  console.log("  Scene 1 — Admin Login");
  await page.goto("http://localhost:8000/admin/login");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  await scene(`
    > Platform administrator opens the admin dashboard to review pending applications
    @ CanaDREAMERS
    "3 Admin dashboard. Let me sign in.
  `);
  const emailInput = page.locator('input[type="email"]');
  const passInput = page.locator('input[type="password"]');
  await emailInput.fill("admin@test.com");
  await passInput.fill("Admin1234!");
  await scene(`
    @ Sign in
    "3 Morning check — time to review the queue.
  `);
  await page.locator('button:has-text("Sign in")').click();
  await page.waitForTimeout(3000);
  console.log("  Logged in:", page.url());
  await guard("Admin login succeeded", !page.url().includes("login"), page);

  // ── Scene 2: Navigate to Partners Queue ─────────────────────────────
  console.log("  Scene 2 — Partners Queue");
  await page.goto(page.url().replace(/\/[^/]*$/, '/partners'));
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  const hasPartnerMgmt = await page.textContent('body').then(t => t.includes('Partner Management')).catch(() => false);
  await guard("Partners page loaded", hasPartnerMgmt, page);

  const hasChris = await page.textContent('body').then(t => t.includes('Chris Daw')).catch(() => false);
  await guard("Chris Daw visible in queue", hasChris, page);

  await scene(`
    > Admin opens the partner management queue — new consultant applications waiting for compliance review
    @ Partners
    "3 Partner queue. Let's see who applied.
    @ Pending
    " One pending application. Chris Daw, R409583. Submitted today.
    @ Chris Daw
    "3 RCIC from Vancouver. Let me expand and review.
  `);

  // Click Chris's row expand arrow (the chevron, not the text)
  const expandBtn = page.locator('button:near(:text("Chris Daw"))').first();
  if (await expandBtn.isVisible().catch(() => false)) {
    await expandBtn.click({ force: true });
  } else {
    // Fallback: click via JS avoiding overlay
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('div, tr, td, span, p, button'))
        .find(e => e.textContent.includes('Chris Daw') && !e.closest('#mp-root') && !e.closest('.mp-thought') && e.offsetParent !== null);
      if (el) el.click();
    });
  }
  await page.waitForTimeout(2000);
  const expanded = await page.textContent('body').then(t => t.includes('Approve') || t.includes('CICC') || t.includes('R409583')).catch(() => false);
  await guard("Chris row expanded", expanded, page);

  // ── Scene 3: Review Profile ─────────────────────────────────────────
  console.log("  Scene 3 — Review Profile");
  await scene(`
    > Admin expands Chris Daw's application — reviewing identity, credentials, and practice details
    @ Chris Daw
    " Full name matches the College ID. R409583.
    @ R409583
    "3 College ID format is correct. Let me check the verification.
  `);

  // Scroll down to see more details
  await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
  await page.waitForTimeout(1000);

  await scene(`
    > Admin checks CICC verification status — was this consultant verified against the live register?
    @ CICC
    " CICC verified. Christopher Robert Daw, RCIC-IRB L3, entitled to practice. Verified automatically against the live register. Good.
    @ Vancouver
    "3 Based in Vancouver. Bio looks professional.
  `);

  // ── Scene 4: Check Documents ────────────────────────────────────────
  console.log("  Scene 4 — Check Documents");
  await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
  await page.waitForTimeout(1000);

  await scene(`
    > Admin reviews uploaded documents — E&O insurance is the critical gate
    @ Insurance
    " E&O insurance on file. Required for all RCIC consultants. Gate will pass.
    @ Express Entry
    "3 Specializations: Express Entry, Work Permits, LMIA, IRB Hearings. Strong set.
    @ English
    "3 Bilingual — English and French. Good for a national platform.
  `);

  // ── Scene 5: Approve Decision ───────────────────────────────────────
  console.log("  Scene 5 — Approve Decision");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(1000);

  await scene(`
    > Admin is satisfied — all compliance checks pass. Two gates: E&O insurance and CICC verification with evidence.
    @ Approve
    "5 Everything checks out. CICC verified with evidence from the live register. E&O insurance on file. Profile complete. Both gates will pass. Approving Chris Daw.
  `);

  // First: attach CICC evidence via the verify-with-evidence endpoint
  const verifyResult = await page.evaluate(async () => {
    const token = localStorage.getItem("admin_token");
    const qRes = await fetch("/api/v1/partner-admin/partners/queue", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const qBody = await qRes.json();
    const queue = qBody?.data || qBody || [];
    const chris = Array.isArray(queue) ? queue.find(p => JSON.stringify(p.credentials || '').includes('R409583')) : null;
    if (!chris) return { error: "Chris not in queue" };

    // Verify with evidence
    const vRes = await fetch(`/api/v1/partner-admin/partners/${chris.id}/verify-with-evidence`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ user_type: "superadmin", action: "admin.verify", data: {
        college_id: "R409583",
        name: "Christopher Robert Daw",
        company: "Daw Immigration Solutions Inc",
        license_class: "RCIC-IRB - L3",
        entitled_to_practice: "Yes"
      }})
    });
    const vBody = await vRes.json().catch(() => null);

    // Now approve
    const aRes = await fetch(`/api/v1/partner-admin/partners/${chris.id}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ user_type: "superadmin", action: "admin.approve", data: {} })
    });
    const aBody = await aRes.json().catch(() => null);
    return { id: chris.id, verify: vRes.status, approve: aRes.status, approveBody: aBody };
  });
  console.log("  [approve]", JSON.stringify(verifyResult));
  await guard("Verify API succeeded", verifyResult?.verify === 200, page);
  await guard("Approve API succeeded", verifyResult?.approve === 200, page);

  // ── Scene 6: Confirmed ──────────────────────────────────────────────
  console.log("  Scene 6 — Confirmed");
  // Refresh the page to see updated status
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  await scene(`
    > Chris Daw is approved. Both gates passed. He can now access the consultant dashboard and start accepting clients.
    @ Approved
    "5 Done. Chris Daw is now a verified consultant on the platform. CICC-verified, E&O on file, profile complete.
    > Approval notification sent. Audit trail recorded. The platform now has a verified RCIC available for client matching.
    "3 Next application.
    .
  `);

  // ── DB Guard: Chris must be approved ───────────────────────────────
  const dbCheck = execSync(`docker exec -w /app -e PYTHONPATH=/app canadreamers-platform python3 -c "
import asyncio, asyncpg
async def main():
    conn = await asyncpg.connect('postgresql://postgres:postgres@postgres:5432/postgres?sslmode=disable')
    uid = await conn.fetchval(\\"SELECT id FROM users WHERE email = 'chris@dawimmigration.com'\\")
    pp = await conn.fetchrow('SELECT status FROM partner_profiles WHERE user_id = ' + chr(36) + '1::uuid', str(uid))
    print('PASS' if pp and pp['status'] == 'approved' else 'FAIL')
    print(f'status={pp[\\"status\\"] if pp else \\"none\\"}')
    await conn.close()
asyncio.run(main())
"`, { encoding: "utf-8" });
  console.log("  [db]", dbCheck.trim());
  if (!dbCheck.includes("PASS")) { console.error("  FAIL: DB — Chris not approved"); process.exit(1); }

  console.log("Done.");
  await page.waitForTimeout(3000);
  await browser.close();

  // ── Verify DB ───────────────────────────────────────────────────────
  try {
    const result = execSync(`docker exec canadreamers-platform python3 << 'PYEOF'
import asyncio, asyncpg, json
async def main():
    conn = await asyncpg.connect('postgresql://postgres:postgres@postgres:5432/postgres?sslmode=disable')
    uid = await conn.fetchval("SELECT id FROM users WHERE email = 'chris@dawimmigration.com'")
    pp = await conn.fetchrow("SELECT status, onboarding_step FROM partner_profiles WHERE user_id = $1::uuid", str(uid))
    if pp:
        print(f'Partner: Chris Daw — status: {pp["status"]}, step: {pp["onboarding_step"]}')
    else:
        print('NO PARTNER')
    await conn.close()
asyncio.run(main())
PYEOF`, { encoding: "utf-8" });
    console.log("  [db]", result.trim());
  } catch(e) { console.log("  [db] check failed"); }
})();
