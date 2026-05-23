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
    @ Partner Management
    "3 Partner queue. Let's see who applied.
    @ Pending
    " One pending application. Chris Daw, R409583. Submitted today. No priority indicator though — if we had 50 pending, how would I triage?
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
    "3 Name and email visible. No photo though — would help confirm identity.
    @ R409583
    "3 College ID format correct. Let me check verification.
    @ Profile: 100% complete
    "3 Profile complete. Good signal.
  `);

  // Scroll down to see more details
  await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
  await page.waitForTimeout(1000);

  await scene(`
    > Admin checks CICC verification status — was this consultant verified against the live register?
    @ CICC Verified
    "3 Green badge. Let me expand and inspect the evidence.
  `);

  // Click the CICC Verified chevron to expand evidence card
  const ciccBadge = page.locator('text=CICC Verified').first();
  if (await ciccBadge.isVisible().catch(() => false)) {
    await ciccBadge.click({ force: true });
    await page.waitForTimeout(2000);
  }

  // ── Scene 3b: CICC Evidence Audit ──────────────────────────────────
  console.log("  Scene 3b — CICC Evidence Audit");
  await page.evaluate(() => window.scrollBy({ top: 200, behavior: 'smooth' }));
  await page.waitForTimeout(1000);

  await scene(`
    > Admin inspects the CICC verification certificate — full audit record from the live register
    @ Verification Certificate
    "3 Full certificate. Let me check every field.
    @ Christopher Robert Daw
    "3 Name from the live register. Matches the application.
    @ Daw Immigration Solutions Inc
    "3 Company confirmed. Cross-references with the bio.
    @ RCIC-IRB - L3
    "3 L3 with IRB authorization. He selected IRB Hearings in specializations — that's consistent.
    @ Entitled
    "3 Entitled to practice. Good.
  `);

  await scene(`
    @ Evidence integrity verified
    "5 SHA-256 hash matches. This evidence is sealed — untampered since capture. If anyone had edited this in the database, this would show red.
    > Cryptographic integrity hash confirms the evidence chain. Every field traceable to the live CICC register.
  `);

  await scene(`
    @ Verified
    "3 Timestamp and method on record.
    " One thing missing — no E&O expiry date tracked. We know the document is on file but not when it expires. Need to fix that.
    @ Vancouver
    "3 Bio is professional. Twenty years experience stated.
  `);

  // ── Scene 4: Check Documents ────────────────────────────────────────
  console.log("  Scene 4 — Check Documents");
  await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
  await page.waitForTimeout(1000);

  await scene(`
    > Admin reviews uploaded documents — E&O insurance is the critical gate
    @ Insurance
    "3 E&O on file. Let me open and inspect the actual document.
  `);

  // Click View on the E&O document to open the preview modal
  const viewBtn = page.locator('button:has-text("View")').first();
  if (await viewBtn.isVisible().catch(() => false)) {
    await viewBtn.click({ force: true });
    await page.waitForTimeout(2000);

    await scene(`
      > Admin opens the E&O insurance document — inspecting the uploaded certificate
      "3 Document preview loaded. Let me check the contents.
    `);

    // Scroll through the document preview
    const previewImg = page.locator('img[alt*="preview"], img[src*="preview"], .DocPreviewModal img, [class*="preview"] img').first();
    if (await previewImg.isVisible().catch(() => false)) {
      await scene(`
        " Single page PDF. I can see it's an insurance certificate. In production, we'd need to verify: insurer name, coverage amount ($1M minimum), policy period, and named insured.
        "3 For now, the file is on record and the gate will pass.
      `);
    } else {
      await scene(`
        " Document loaded but can't render a preview. The file is on record — that's what the gate checks.
        "3 We should add OCR extraction to pull coverage details automatically.
      `);
    }

    // Close the preview modal
    const closeBtn = page.locator('button:has-text("Close"), button:has-text("×"), [aria-label="Close"]').first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
    } else {
      // Click the backdrop to close
      await page.evaluate(() => {
        const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/70, .fixed.inset-0');
        if (backdrop) backdrop.click();
      });
    }
    await page.waitForTimeout(1000);
  }

  await scene(`
    > Admin finishes document review — E&O gate will pass, but coverage details need future extraction
    @ Express Entry
    "3 Strong specialization set. Four areas including IRB.
    @ English
    "3 Bilingual. Good reach.
  `);

  // ── Scene 5: Approve Decision ───────────────────────────────────────
  console.log("  Scene 5 — Approve Decision");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(1000);

  await scene(`
    > Admin is satisfied — all compliance checks pass. Two gates: E&O insurance and CICC verification with evidence.
    @ Approve
    "5 Both gates will pass. CICC verified with sealed evidence. E&O on file. Profile complete. Approving.
    " Things to improve for next sprint: E&O expiry tracking, photo ID verification, queue priority scoring, and a second-approver workflow for high-risk applications.
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
    "3 Done. Chris Daw is live on the platform.
    > Approval complete. CICC-verified with sealed evidence, E&O on file, integrity hash recorded. Notification sent. Audit trail clean.
    "3 One verified RCIC added to the directory. Next application.
    .
  `);

  // ── DB Guard: Chris must be approved ───────────────────────────────
  const dbCheck = execSync(`docker exec -w /app -e PYTHONPATH=/app canadreamers-platform python3 -c "
import asyncio, asyncpg
async def main():
    conn = await asyncpg.connect('postgresql://postgres:postgres@postgres:5432/postgres?sslmode=disable')
    uid = await conn.fetchval(\\"SELECT id FROM users WHERE email = 'chris@dawimmigration.com'\\")
    pp = await conn.fetchrow('SELECT status FROM partner_profiles WHERE user_id = ' + chr(36) + '1::uuid', str(uid))
    role = await conn.fetchval('SELECT role FROM users WHERE id = ' + chr(36) + '1::uuid', str(uid))
    ok = pp and pp['status'] == 'approved' and role == 'partner:consultant'
    print('PASS' if ok else 'FAIL')
    print(f'status={pp[\\"status\\"] if pp else \\"none\\"} role={role}')
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
