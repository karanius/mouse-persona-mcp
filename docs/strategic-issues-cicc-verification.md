# Strategic Issues: CICC Verification Pipeline

**Date:** 2026-05-23
**Status:** Active
**Stakeholder Review Panel:** Kate Lamb (CICC CEO), Cathy Pappas (CICC Registrar), Jessica Freeman (CICC Operations), Chris Daw (RCIC, 20 years), Alfred (CanaDREAMERS CEO)

---

## Executive Summary

CanaDREAMERS built the first platform to automatically verify immigration consultants against the live CICC Public Register. The verification pipeline works — it pulls a consultant's full name, company, license class, and entitled-to-practice status from the official register in real time.

Five stakeholders reviewed the admin approval workflow. Twenty-five concerns were raised. They cluster into seven strategic issues, ordered by severity. None are bugs. All are architectural decisions that determine whether this platform can operate with regulatory credibility at scale.

---

## Issue 1: Continuous Verification, Not Point-in-Time

**Raised by:** Kate Lamb, Cathy Pappas, Chris Daw

**The problem.** The platform verifies a consultant's CICC status once — at application. A consultant can be entitled to practice on Monday and suspended on Tuesday. The platform would continue displaying "Verified" until the next manual check. For a regulated profession where suspension has immediate effect, a 24-hour (or longer) lag is a public protection failure.

**What exists today.** A daily cron job (`cicc_verify`) smoke-tests one known College ID (R409583) to confirm the pipeline works. A 90-day re-verification schedule is defined but not enforced. No per-consultant re-check happens automatically.

**Resolution path.**
- **Phase 1 (now):** Extend the cron to re-verify ALL approved consultants on a rolling basis — batch 10% daily, full coverage in 10 days. Use the existing `verify_college_id()` function. If a consultant's status changes (not found, not entitled), auto-suspend their partner profile and notify the admin.
- **Phase 2 (post-launch):** Negotiate a data-sharing agreement with CICC for a push notification channel. When the College suspends or revokes, the platform receives a webhook and acts immediately.
- **Phase 3 (scale):** If CICC releases an official API, migrate from Playwright scraping to API calls. Reduce verification latency from 12 seconds to sub-second.

**Dependencies:** CICC partnership (Phase 2), CICC API availability (Phase 3).

---

## Issue 2: Scraping Authorization and Fragility

**Raised by:** Kate Lamb, Cathy Pappas, Alfred

**The problem.** The CICC Public Register is a public website, but automated scraping is not sanctioned. The register uses ASP.NET WebForms with ViewState, Telerik RadGrid, and AJAX postbacks — any of which can change without notice. A single HTML restructure breaks the extraction pipeline silently. The platform makes regulatory compliance determinations using unofficial methods.

**What exists today.** Playwright headless browser navigates to `register.college-ic.ca`, types the College ID, clicks Find, and extracts results from the DOM table. A daily health check confirms the pipeline works against a known ID. If the check fails, it logs to `cron_audit_log` — but nobody is paged.

**Resolution path.**
- **Immediate:** Add alerting when the health check fails — email the admin team, flag it on the Maple dashboard. Today it's a silent log entry.
- **Short-term:** Build a fallback path. If the live scrape fails, check the local `cicc_registry` cache (last known good data) and flag the verification as "cached, pending re-verification." Don't block the application — but don't display "verified" with the same confidence.
- **Medium-term:** Approach CICC with a formal partnership proposal. The platform's verification pipeline is a demonstration of what an API-integrated partnership could look like. The scraping approach is the MVP proof-of-concept; the partnership is the production solution.
- **Legal:** Add a terms-of-service clause acknowledging that CICC verification is based on publicly available register data, not an official College endorsement. This protects the platform while the partnership is negotiated.

**Dependencies:** Legal review, CICC partnership outreach.

---

## Issue 3: Identity Verification Beyond Name Matching

**Raised by:** Kate Lamb, Cathy Pappas, Chris Daw

**The problem.** The approve gate checks that a name returned from the CICC register matches the applicant's claimed name. But anyone can enter a valid College ID and claim to be that person. There is no photo ID verification, no secondary identifier, no proof that the human on the platform is the human on the register.

**What exists today.** The two gates are: (1) E&O insurance on file, and (2) CICC evidence with a name match. Neither confirms identity beyond self-attestation.

**Resolution path.**
- **Phase 1 (now):** Add a government-issued ID upload requirement to the Documents step. The admin manually cross-references the photo ID against the CICC register name during review. This is low-tech but immediately defensible.
- **Phase 2 (post-launch):** Integrate an identity verification service (e.g., Jumio, Onfido, or Canada's digital identity framework). Automated face-match against the uploaded ID + a liveness check.
- **Phase 3 (CICC partnership):** If the College provides a verification API with consultant photos or unique identifiers beyond College ID, use those as the authoritative identity source.

**Dependencies:** ID verification vendor selection (Phase 2), CICC partnership (Phase 3).

---

## Issue 4: License Class Scope Enforcement

**Raised by:** Cathy Pappas, Chris Daw

**The problem.** The CICC register returns a license class (L1, L2, L3, IRB). These are not interchangeable:
- **L1** — RCIC: authorized to represent clients for a fee across all immigration matters except IRB
- **L2** — restricted to international students at designated learning institutions
- **L3** — restricted to refugees under specific agreements
- **IRB** — authorized for Immigration and Refugee Board hearings

The platform currently treats all classes as equivalent. An L2 consultant appearing in the directory alongside an L1/IRB consultant misrepresents their scope of practice. If the platform routes an IRB case to a non-IRB consultant, it creates a regulatory violation.

**What exists today.** The license class is captured and displayed (`RCIC-IRB - L3`) but not enforced. The specializations tag picker includes "IRB Hearings" but doesn't cross-check against the license class. A spec-license-crosscheck worker exists but only runs as a non-blocking audit — it records mismatches but doesn't prevent them.

**Resolution path.**
- **Immediate:** Make the spec-license-crosscheck worker a blocking gate. If a consultant selects "IRB Hearings" but their license class doesn't include IRB authorization, block the application with a clear message.
- **Short-term:** Display the license class prominently on the public profile. Add a scope indicator: "This consultant is authorized for: [list based on license class]."
- **Medium-term:** Filter the consultant directory by scope. When an immigrant searches for IRB representation, only show consultants with IRB authorization.

**Dependencies:** License class mapping table (L1→scopes, L2→scopes, etc.), directory filter UI.

---

## Issue 5: Verification Scalability

**Raised by:** Jessica Freeman, Alfred

**The problem.** The CICC verification uses a global `asyncio.Lock()` — only one lookup runs at a time. Each lookup takes ~12 seconds (Playwright browser, network round-trip, page render). At 100 applications/day, the verification queue is 20 minutes deep. At 500/day, it's unsustainable.

**What exists today.** Single Playwright browser instance, serial execution, no retry logic, no circuit breaker, no cache-first fallback. The browser singleton persists between calls but crashes require cold restart.

**Resolution path.**
- **Immediate:** Add a cache-first strategy. Before launching Playwright, check `cicc_registry` for a recent entry (< 7 days). If found, use cached data and skip the live lookup. Only scrape live for new College IDs or stale cache entries.
- **Short-term:** Add retry logic with exponential backoff. If the first lookup fails, retry once after 5 seconds. Add a circuit breaker: if 3 consecutive lookups fail, stop trying for 5 minutes and use cached data.
- **Medium-term:** Move verification to a background job queue. The `/verify` endpoint returns immediately with "verification in progress." The consultant sees a polling UI that updates when the job completes. Decouple the 12-second lookup from the HTTP request.
- **Scale:** Run multiple Playwright browser instances in parallel (browser pool). Remove the global lock. Each lookup gets its own browser context.

**Dependencies:** Job queue infrastructure (Redis/Celery or in-process), browser pool management.

---

## Issue 6: E&O Insurance Depth

**Raised by:** Chris Daw

**The problem.** The platform confirms a document is "on file" but doesn't verify the policy is current, the coverage limits meet ENCON group plan minimums ($1M per claim), the insurer is legitimate, or the policy hasn't expired. An uploaded PDF is not proof of active coverage.

**What exists today.** File upload with magic-byte validation (must be a real PDF/image). Backend checks `doc_type = 'liability_insurance'` exists. The `documents` table has an `expiry_date` column but it's never populated. No OCR extraction of policy details.

**Resolution path.**
- **Phase 1 (now):** Add an expiry date field to the E&O upload step. The consultant enters the policy expiry date manually. The platform tracks it and sends renewal reminders 30 days before expiry.
- **Phase 2 (post-launch):** Use the existing document extractor (GPT-4o-mini OCR) to automatically extract coverage amount, policy period, and named insured from the uploaded certificate. Cross-reference against the consultant's name.
- **Phase 3 (integration):** Integrate with ENCON or other E&O providers for real-time policy verification. The platform confirms active coverage directly with the insurer.

**Dependencies:** Document extractor integration (Phase 2), insurer API (Phase 3).

---

## Issue 7: CICC Partnership Agreement

**Raised by:** Kate Lamb (directly), implied by all reviewers

**The problem.** The platform makes regulatory compliance determinations using unofficial methods without College authorization. Kate Lamb's position is clear: "I would require a formal partnership agreement before any consultant verification claims reference the CICC."

**What exists today.** A technically functional verification pipeline that demonstrates what an integrated partnership could deliver. The pipeline is the proof-of-concept; the partnership is the production requirement.

**Resolution path.**
- **Step 1:** Prepare a partnership proposal for CICC. Include: what the platform does, how verification works, what data is used, what the platform displays to the public, what safeguards are in place.
- **Step 2:** Demonstrate the platform to CICC leadership. Use the Chris Daw persona replay to show the verification flow end-to-end. Show the Maple admin page with the queue, verification evidence, and approval gates.
- **Step 3:** Propose a formal data-sharing agreement. The platform becomes an authorized verification channel. CICC provides: API access (or sanctioned scraping), push notifications for status changes, license class scope definitions. The platform provides: consultant activity data, complaint forwarding, compliance reporting.
- **Step 4:** Co-brand the verification badge. Instead of "CICC Verified" (which implies College endorsement without authorization), display "Verified against the CICC Public Register" with a timestamp and link to the live register.

**Dependencies:** Legal counsel, CICC relationship (initial outreach), partnership proposal document.

---

## Priority Matrix

| Issue | Severity | Effort | Phase |
|-------|----------|--------|-------|
| 1. Continuous verification | Critical | Medium | Now + Post-launch |
| 2. Scraping authorization | Critical | Low (alerting) / High (partnership) | Now + Medium-term |
| 3. Identity verification | High | Low (ID upload) / High (automated) | Now + Post-launch |
| 4. License class enforcement | High | Low | Now |
| 5. Verification scalability | High | Medium | Short-term |
| 6. E&O insurance depth | Medium | Low (expiry field) / Medium (OCR) | Now + Post-launch |
| 7. CICC partnership | Strategic | High | Medium-term |

---

## What's Strong

The stakeholders acknowledged several strengths:

- **"The bones are solid."** (Chris Daw) — The two-gate system, audit trail, and worker evidence are professional-grade.
- **"The competitive narrative is strong."** (Alfred) — No other platform verifies against the live CICC register.
- **"Tighten the operational edges and this is fundable."** (Alfred) — The demo is investor-ready with the persona replays.
- **"The specialization list is comprehensive."** (Chris Daw) — Including IRB Hearings and Compliance & Appeals shows domain knowledge.
- **"E&O insurance requirement is impressive."** (Chris Daw) — Knowing the ENCON group plan requirements signals regulatory literacy.

The platform has built the hardest part — live verification against a source of truth. The strategic issues are about hardening it for production, not rebuilding it.
