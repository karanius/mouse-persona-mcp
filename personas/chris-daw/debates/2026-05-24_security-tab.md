# Debate: Security Tab — What Should It Contain?

**Date:** 2026-05-24
**Participants:** Chris Daw (RCIC, R409583) + Claude
**Context:** Designing the Security tab for the V9 consultant dashboard

---

## Chris's Position

As an RCIC handling client passports, birth certificates, medical records, and refugee claims, consultant accounts are high-value targets. A breach exposes not just Chris's data but his clients' entire immigration history under regulatory obligation.

## 8 Security Features Identified

### Built (3)
1. **Two-Factor Authentication** — phone SMS verification ✅
2. **Password Management** — change password ✅
3. **Active Sessions** — view devices, revoke sessions ✅

### Needed (5)
4. **Login History** — last 10 logins with IP, device, location, timestamp. "If someone from Russia logged in at 3 AM, I want to see that BEFORE they access refugee claims."
5. **API Access Tokens** — per-integration revokable tokens for QuickBooks, document scanners, AI assistants. Not sharing the main password across tools.
6. **Data Export** — full account export for platform migration or closure. CICC requires 6-year record retention.
7. **Per-Client Data Deletion** — PIPEDA right to deletion at the individual client level, not whole-account. Client requests their data → consultant can export + delete just that client.
8. **CICC Consent Agreement Generator** — auto-generate data processing consent forms: "Chris Daw, RCIC R409583, uses CanaDREAMERS to process your immigration data." Required by CICC Code of Professional Conduct Section 7.

## Claude's Analysis

- Items 4-5 (login history, API tokens) are **table stakes** for any professional tool
- Items 6-7 (data export, per-client deletion) are **privacy compliance** requirements (PIPEDA)
- Item 8 (consent generator) is the **regulatory differentiator** — no other platform does this for RCICs

## Verdict

Build all 8. The first 3 are done. Items 4-5 are next sprint. Items 6-8 are the features that make CanaDREAMERS the compliance platform, not just a practice management tool.
