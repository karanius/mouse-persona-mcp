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

(async () => {
  // ── Seed: Chris Daw with pending application + CICC verified + E&O ──
  const { execSync } = require("child_process");
  try {
    execSync(`docker exec canadreamers-platform python3 << 'PYEOF'
import asyncio, asyncpg, json
async def main():
    conn = await asyncpg.connect('postgresql://postgres:postgres@postgres:5432/postgres?sslmode=disable')
    # Clean Chris
    await conn.execute("DELETE FROM partner_profiles WHERE display_name = 'Chris Daw'")
    await conn.execute("DELETE FROM service_providers WHERE name = 'Chris Daw'")
    await conn.execute("DELETE FROM cicc_registry WHERE college_id = 'R409583'")
    # Get Chris's user_id
    row = await conn.fetchrow("SELECT id FROM users WHERE email = 'chris@dawimmigration.com'")
    if not row:
        print('Chris user not found!')
        return
    uid = str(row['id'])
    await conn.execute(f"UPDATE users SET role = 'partner:consultant' WHERE id = '{uid}'::uuid")
    # Create pending partner profile with CICC verified
    creds = json.dumps({'college_id': 'R409583'})
    meta = json.dumps({
        'cicc_verified': True,
        'cicc_verified_at': '2026-05-23T04:00:00Z',
        'cicc_verified_by': 'automated_iframe_lookup',
        'cicc_name': 'Christopher Robert Daw',
        'cicc_license_class': 'RCIC-IRB - L3',
        'cicc_entitled_to_practice': True,
        'cicc_college_id': 'R409583',
        'cicc_evidence': {
            'name': 'Christopher Robert Daw',
            'company': 'Daw Immigration Solutions Inc',
            'license_class': 'RCIC-IRB - L3',
            'entitled_to_practice': True
        }
    })
    from backend.infra.crypto import encrypt_field
    enc_name = encrypt_field('Chris Daw')
    enc_creds = encrypt_field(creds)
    await conn.execute("INSERT INTO partner_profiles (user_id, taxonomy_path, display_name, credentials, status, onboarding_step, metadata) VALUES ($1::uuid, 'consultant.rcic', $2, $3, 'pending', 'pending_review', $4::jsonb)", uid, enc_name, enc_creds, meta)
    # Create service provider
    specs = json.dumps(['Express Entry', 'Work Permits', 'LMIA', 'IRB Hearings'])
    langs = json.dumps(['English', 'French'])
    await conn.execute(f"INSERT INTO service_providers (user_id, provider_type, name, bio, license_no, verified, location_city, specializations, languages) VALUES ('{uid}'::uuid, 'consultant', 'Chris Daw', 'Chris Daw is a Regulated Canadian Immigration Consultant (RCIC) with over 20 years of experience in Express Entry, Provincial Nominee Programs, LMIA processing, and work permits.', 'R409583', true, 'Vancouver', '{specs}', '{langs}')")
    # Create E&O document
    import uuid
    await conn.execute(f"INSERT INTO documents (user_id, doc_type, s3_key, status) VALUES ('{uid}'::uuid, 'liability_insurance', '{str(uuid.uuid4())}', 'pending')")
    # Create CICC registry entry
    await conn.execute("INSERT INTO cicc_registry (college_id, name, company, license_class, entitled_to_practice, scraped_at) VALUES ('R409583', 'Christopher Robert Daw', 'Daw Immigration Solutions Inc', 'RCIC-IRB - L3', true, NOW()) ON CONFLICT (college_id) DO NOTHING")
    # Ensure cicc_evidence is in metadata (approve gate requires it)
    pid = await conn.fetchval("SELECT id FROM partner_profiles WHERE user_id = $1::uuid", uid)
    await conn.execute("""UPDATE partner_profiles SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"cicc_evidence": {"name": "Christopher Robert Daw", "company": "Daw Immigration Solutions Inc", "license_class": "RCIC-IRB - L3", "entitled_to_practice": true}}'::jsonb WHERE id = $1::uuid""", str(pid))
    # Verify it stuck
    check = await conn.fetchval("SELECT metadata->'cicc_evidence'->>'name' FROM partner_profiles WHERE id = $1::uuid", str(pid))
    print(f'cicc_evidence.name = {check}')
    await conn.close()
    print('Chris Daw seeded: pending + CICC verified + E&O on file')
asyncio.run(main())
PYEOF`, { stdio: "inherit" });
  } catch(e) { console.log("Seed skipped:", e.message); }

  const browser = await chromium.launch({
    headless: !HEADED,
    args: ["--disable-infobars"],
    ignoreDefaultArgs: ["--enable-automation", "--disable-blink-features=AutomationControlled"]
  });
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

  // Fill login
  const emailInput = page.locator('input[type="email"]');
  const passInput = page.locator('input[type="password"]');
  await emailInput.fill("admin@test.com");
  await passInput.fill("Admin1234!");
  await scene(`
    > Platform administrator logs in to review pending consultant applications
    "3 Let's check the partner queue.
  `);
  await page.locator('button:has-text("Sign in")').click();
  await page.waitForTimeout(3000);
  console.log("  Logged in:", page.url());

  // ── Scene 2: Navigate to Partners ───────────────────────────────────
  console.log("  Scene 2 — Partners Queue");
  await page.goto(page.url().replace(/\/[^/]*$/, '/partners'));
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  await scene(`
    > Admin opens the partner management queue — pending applications waiting for review
    "3 One pending application. Chris Daw.
  `);

  // ── Scene 3: Review Chris's Application ─────────────────────────────
  console.log("  Scene 3 — Review Application");

  // Click on Chris Daw's row to expand
  const chrisRow = page.locator('text=Chris Daw').first();
  if (await chrisRow.isVisible().catch(() => false)) {
    await chrisRow.click();
    await page.waitForTimeout(2000);
  }

  await scene(`
    > Admin reviews Chris Daw's application — checking credentials, verification, and documents
    " CICC verified automatically. Christopher Robert Daw, RCIC-IRB L3, entitled to practice. Good.
    "3 E&O insurance on file. Bio looks professional. Vancouver.
    " Express Entry, Work Permits, LMIA, IRB Hearings — strong specialization set. Twenty years experience.
  `);

  // ── Scene 4: Approve ────────────────────────────────────────────────
  console.log("  Scene 4 — Approve");

  await scene(`
    > Admin is satisfied — CICC verified, E&O on file, profile complete. Ready to approve.
    "5 Everything checks out. Both gates will pass. Approving Chris Daw.
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

  // ── Scene 5: Confirmed ──────────────────────────────────────────────
  console.log("  Scene 5 — Confirmed");
  await page.waitForTimeout(2000);

  await scene(`
    > Chris Daw is approved. He can now access the consultant dashboard and start accepting clients.
    "5 Approved. Chris Daw is now a verified consultant on the platform. Notification sent.
  `);

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
