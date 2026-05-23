# Admin Workflow — Stakeholder Review Transcript
**Date:** 2026-05-23
**Reviewers:** Kate Lamb (CICC CEO), Cathy Pappas (Registrar), Jessica Freeman (Operations), Chris Daw (RCIC), Alfred (CEO)

---

## Kate Lamb — CEO, CICC

**1. Name-matching is insufficient identity verification.** Scraping a name from the Public Register and comparing it to a self-reported name is not proof of identity. Anyone can enter R409583 and claim to be Christopher Daw. The platform must require government-issued photo ID cross-referenced against the register entry. Name matching alone does not meet our identity verification standards.

**2. Scraping the Public Register is unauthorized access.** The CICC does not provide an API for third-party verification. Automated Playwright scraping of our register is not a sanctioned verification method. The College offers official verification letters and direct confirmation channels. Relying on scraping means the platform could misparse data, miss disciplinary conditions, or operate on stale HTML after a site redesign — creating false confidence.

**3. License class and conditions are not fully captured.** "Entitled to Practice: Yes" is binary, but practice entitlements carry conditions — supervised practice, restricted scope, undertakings, or practice limitations imposed by our Discipline Committee. The platform must surface the full status, not a simplified boolean.

**4. Daily cron checks do not catch suspensions in real time.** When we suspend a licensee, public protection requires immediate effect. A 24-hour window where a suspended consultant remains "verified" on this platform is unacceptable. The platform should check status at the point of each client interaction, not on a daily schedule.

**5. No mechanism for the College to revoke or flag consultants.** The platform operates unilaterally. There is no inbound channel for the CICC to notify the platform of suspensions, complaints, or disciplinary proceedings. We need a formal data-sharing agreement and a push notification mechanism from the College to the platform.

> The fundamental issue: this platform is making regulatory compliance determinations using unofficial methods without College authorization. I would require a formal partnership agreement before any consultant verification claims reference the CICC.

---

## Cathy Pappas — Registrar, CICC

**1. No authorized API exists — scraping is fragile, not sanctioned.** The College does not offer a public API for the register. Scraping the ASP.NET WebForms page is brittle (ViewState, postback chains, table structure changes). We tolerate public access for individual lookups, but automated bulk scraping was never contemplated in our terms of use. A single page restructure breaks your entire verification pipeline silently.

**2. "Entitled to Practice" is a point-in-time snapshot, not a license.** That field reflects status at the moment of query. A consultant can be entitled today and suspended tomorrow following a complaint. Your daily cron on one known ID only proves the scraper works — it does not re-verify every consultant in your system. Stale data is dangerous: you could display "verified" for someone we suspended at 9 AM.

**3. License class mapping is incomplete.** L1 (Regulated Canadian Immigration Consultant) is the only class authorized to represent clients for a fee. L2 is restricted to international students at designated institutions. L3 is restricted to refugees under specific agreements. IRB members are not RCICs at all. If your platform treats all classes as equivalent authorization to provide immigration advice, you are misrepresenting scope of practice.

**4. Name matching is insufficient for identity confirmation.** The register contains the consultant's name as filed with us. Your approve gate checking that a name "exists" does not confirm the person on your platform is the person on the register. No photo, no signature, no secondary identifier.

**5. You have no mechanism for revocation propagation.** When we revoke or suspend, your cached cicc_evidence remains unchanged until the next scrape — if one even runs against that specific ID. There is no webhook, no push notification from the College. The liability gap between our action and your platform reflecting it is your risk entirely.

---

## Jessica Freeman — Director of Operations, CICC

**1. Verification is a serial bottleneck.** The CICC lookup uses a global asyncio.Lock() — only one verification can run at a time across the entire system. At 12 seconds per lookup, 100 applications means a 20-minute backlog just for verification. If admin A triggers a verify, admin B's verify request blocks until A's finishes. This is the single biggest scalability wall.

**2. The queue has no prioritization or assignment.** get_approval_queue() returns all pending applications ordered by created_at DESC — pure reverse-chronological, no risk scoring, no assignment to specific admins. Two admins looking at the same queue could approve or reject the same application simultaneously. There is no record locking, no "claimed by" field, no optimistic concurrency control on status transitions.

**3. SLA is measured but not enforced.** The time-to-approval endpoint computes average and median hours after the fact. The stale endpoint flags applications pending over 48 hours. But nothing alerts proactively when an application is approaching the SLA threshold — no escalation trigger, no automatic reassignment, no dashboard alert at 24 hours warning.

**4. Browser automation is fragile at scale.** The verification module maintains a single Playwright browser instance in process memory. Any crash, timeout, or CICC site change kills the browser and forces a cold restart. There is no retry logic, no circuit breaker, and no fallback cache-first strategy that could skip the live lookup when a recent scrape already exists in cicc_registry.

**5. No batch processing path.** Every action operates on a single partner ID. If 100 applications arrive, the admin clicks 100 times to verify, then 100 times to approve. There is no bulk-verify, bulk-approve, or auto-approve-if-all-gates-pass workflow.

---

## Chris Daw — RCIC, 20 years

**1. CICC verification is point-in-time, not continuous.** You checked my status when I applied. But what happens if my license gets suspended next month? If the platform isn't polling the College register on a recurring basis, you could have an unauthorized practitioner active on the platform for months.

**2. E&O insurance verification lacks depth.** You confirmed a document is "on file," but did anyone verify the policy is current, the coverage limits meet minimum standards, and the insurer is legitimate? An uploaded PDF is not proof of active coverage. You need expiry date tracking and renewal reminders at minimum.

**3. No distinction between RCIC and RCIC-IRB authorization levels.** My L3 designation means I can represent at the Immigration and Refugee Board. A standard RCIC cannot. If the platform routes IRB cases to someone without that authorization, you've created a regulatory violation.

**4. Single-approver workflow with no audit trail.** One admin clicks Approve and it's done? For a regulated profession, I'd expect dual approval or at least a logged review rationale. If a bad actor gets through, you need to trace exactly what was checked and by whom.

**5. Rejection categories are too coarse.** "CICC inactive" and "missing document" don't cover scenarios like disciplinary history, practice restrictions, or geographic limitations on practice. The College publishes disciplinary decisions. If you're not checking those, you're missing the most important signal of practitioner quality.

> The bones are solid. But "verified at signup" is table stakes — what matters is verified continuously.

---

## Alfred — CEO, CanaDREAMERS

**1. Scalability cost of live Playwright lookups.** 12 seconds per verification is fine at 10 consultants/day. At 500/day that's 100 minutes of browser compute running serially. We need a cost model: what's the Render bill at 1,000 monthly applications? Caching verified consultants and only re-checking on renewal would cut ongoing cost dramatically.

**2. The moat is real but fragile.** Nobody else verifies against the live CICC register — that's a genuine differentiator. But it depends on CICC's website not changing. One HTML restructure breaks the pipeline. The daily health check cron is smart, but I want an SLA: if the cron fails, who gets paged, and what's the manual fallback?

**3. Bad actor liability.** If someone passes CICC verification with a stolen identity or name collision, we approved them. The two-gate system (CICC + E&O) is defensible, but we need a written policy: what happens post-approval if a complaint comes in? Audit trail is necessary but not sufficient — we need a suspension workflow and a liability disclaimer.

**4. Demo readiness is close but not complete.** The Chris Daw 9-scene replay is strong for investors. What concerns me: is the rejection flow equally polished? Investors who understand compliance will want to see a rejection, not just an approval. Show the escalation path.

**5. Missing before launch: rate limiting, concurrent verification queuing, and a consultant-facing status page.** Consultants waiting 12+ seconds with no feedback will submit twice. We need a job queue with status polling, not synchronous verification.

> The competitive narrative is strong. Tighten the operational edges and this is fundable.

---

## Summary: Top Themes

| Theme | Raised by | Priority |
|-------|-----------|----------|
| **Continuous verification, not point-in-time** | Kate, Cathy, Chris | Critical |
| **Scraping is unauthorized + fragile** | Kate, Cathy, Alfred | Critical |
| **Identity verification beyond name matching** | Kate, Cathy, Chris | High |
| **License class scope enforcement** | Cathy, Chris | High |
| **Serial bottleneck (12s lock)** | Jessica, Alfred | High |
| **E&O insurance depth (expiry, coverage)** | Chris | Medium |
| **No CICC push channel for suspensions** | Kate, Cathy | Medium |
| **No batch/bulk operations** | Jessica | Medium |
| **Queue assignment + concurrency** | Jessica | Medium |
| **Rejection flow demo for investors** | Alfred | Medium |
| **Formal CICC partnership agreement** | Kate | Strategic |
