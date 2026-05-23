# Admin Review: 7 Corrections Applied

**Date:** 2026-05-23
**Pipeline:** Nuke → Chris (9 scenes) → Admin (7 scenes) → Both PASS
**Evidence hash:** `78702d756627133bb52f0ca10a194d53d76c9f8aa77a3aafc427c7de62d04ba3`

---

## What the Admin Flagged

During the enriched admin review, the admin persona identified these gaps while reviewing Chris Daw's application:

1. "No priority indicator — if we had 50 pending, how would I triage?"
2. "No photo — would help confirm identity"
3. "E&O on file but can't see policy details — coverage, expiry, insurer"
4. "E&O expiry date not tracked"
5. "IRB specialization selected but no license class enforcement"
6. "Have to expand every application to see if CICC verified"
7. "No automated E&O renewal tracking"

---

## 7 Corrections Applied

### 1. E&O Expiry Date Field
**Where:** Consultant onboarding step 4 (Documents & Insurance)
**What:** Date input "Policy Expiry Date" appears after E&O upload. Stored in `documents.expiry_date`.
**Files:** `ApplicationStep.tsx`, `onboard.py`

### 2. E&O Details in Admin
**Where:** Admin partners expanded view
**What:** Shows upload date and expiry date for E&O documents. Expired dates show in red.
**File:** `partners.tsx`

### 3. Queue Time Indicator
**Where:** Admin partners queue row
**What:** Color-coded time since submission. Green (<24h), amber (24-48h), red with "STALE" (>48h).
**File:** `partners.tsx`

### 4. Spec-License Crosscheck Blocking Gate
**Where:** `/apply` endpoint
**What:** If consultant selects IRB specializations but license class doesn't include IRB, application is BLOCKED with a clear error message. Previously only recorded the mismatch.
**File:** `onboard.py`

### 5. Profile Photo Indicator
**Where:** Admin partners expanded detail
**What:** Shows "Photo: ✓" (green) or "Photo: missing" (gray) near the profile header.
**File:** `partners.tsx`

### 6. Verification Status in Queue Row
**Where:** Admin partners queue row (collapsed)
**What:** Shows "✓ Verified" (green) or "⚠ Not verified" (amber) next to College ID. Admin doesn't have to expand to check.
**File:** `partners.tsx`

### 7. E&O Expiry Reminder Cron
**Where:** Daily cron job
**What:** Checks all approved partners' E&O expiry dates. Flags policies expiring within 30 days. Detects already-expired policies.
**File:** `cron_jobs.py`

---

## Pipeline Results

```
=== CHRIS ===
  Login API: 200
  Auth token: true
  Redirected to: /consultant-portal
  E&O insurance attached
  Submit: enabled, submitted
  CICC verification: result in 10s
  [db] PASS — status=pending, cicc_verified=True, registry=1

=== ADMIN ===
  Seed: 1 profile, pending + CICC verified + E&O on file
  Partners page: loaded, Chris visible
  CICC Evidence Audit: certificate expanded, integrity hash verified
  Verify API: 200
  Approve API: 200
  [db] PASS — status=approved
```

---

## What Remains (Next Sprint)

From the stakeholder review and admin observations:

| Item | Source | Priority |
|------|--------|----------|
| Continuous re-verification (rolling 10-day cycle) | Kate Lamb, Cathy Pappas | Critical |
| CICC partnership agreement | Kate Lamb | Strategic |
| Photo ID verification (upload + admin cross-reference) | Kate Lamb, Chris Daw | High |
| Queue priority scoring (risk-based) | Jessica Freeman | Medium |
| Dual-approval workflow for high-risk applications | Chris Daw | Medium |
| E&O coverage amount extraction (OCR) | Chris Daw | Medium |
| Bulk approve/reject | Jessica Freeman | Medium |
| Cache-first verification (skip live if recent) | Alfred | Medium |
| Rejection flow demo for investors | Alfred | Medium |
