# Interview: What Should Chris See in the Clients Tab?

**Date:** 2026-05-24
**Format:** Claude interviews Chris Daw (RCIC, R409583, 200+ clients)

---

## Q1: What do you need to see Monday morning?

**Chris:** Three things in the first second: how many active cases, who needs attention today, who's waiting on me. Sorted by urgency, not alphabetically. Deadline tomorrow = top of list.

**Decision:** Urgency-sorted list with attention indicators. No-scroll overview.

## Q2: What fields matter in a client record?

**Chris:** Full name, DOB, nationality, passport, immigration stream, status (intake/submitted/processing/approved/refused), assigned consultant, action timeline. But the most important field is the **NEXT ACTION** — what needs to happen next, and when. If I can't see it in one second, the page is useless.

**Decision:** NEXT ACTION is the primary field. Everything else is secondary.

## Q3: Explain the pipeline stages.

**Chris:** Four stages, not three:
1. **Introduction** — lead, inquiry received, no retainer yet
2. **Intake** — retainer signed, collecting documents, assessing eligibility
3. **Active** — submitted to IRCC, waiting or responding
4. **Resolved** — closed (approved, refused, withdrawn)

**Decision:** 4-stage pipeline: Introduction → Intake → Active → Resolved.

## Q4: How do you track documents per client?

**Chris:** Every application has a document checklist. Express Entry needs: passport, language test, ECA, police clearance, photos, proof of funds, employment letters. Each document has a status: not requested, requested, received, verified, expired. Need to see missing docs at a glance. "If Ahmed's police clearance is missing and it takes 3 weeks, I need to know TODAY."

**Decision:** Per-client document checklist with 5 statuses. Missing documents surface as dashboard alerts.

## Q5: How do you communicate with clients?

**Chris:** Email, WhatsApp, phone — it's a mess. Want a unified message thread per client with every message, document, and note. Must support attachments — "clients send passport photos on WhatsApp, I need to save directly to their document checklist."

**Decision:** Unified per-client message thread with attachment-to-document linking.

## Q6: What about billing?

**Chris:** Retainer amount, hours logged, balance remaining. Yellow flag when under 2 hours remaining. Not a full accounting system — he uses QuickBooks. Just visibility into "has this client paid?" and "am I about to work for free?"

**Decision:** Retainer tracking with balance alerts. External QuickBooks integration, not replacement.

## Q7: If you could only see ONE thing per client in the list view?

**Chris:** "The next action with its deadline. Ahmed — Police clearance due May 30. Priya — LMIA extension due June 5. Maria — Biometrics appointment June 12. I can plan my entire week from that one screen."

**Decision:** The client list IS a prioritized action queue. Each row = name + next action + deadline.

---

## Summary: Clients Tab Architecture

### List View
- Urgency-sorted, not alphabetical
- Each row: client name, immigration stream, status badge, **next action + deadline**
- Pipeline tabs: Introduction | Intake | Active | Resolved
- Search + filter by stream/status

### Client Detail View (click into)
- Identity: name, DOB, nationality, passport
- Immigration stream + current status
- **Next action (prominent)**
- Document checklist with 5 statuses
- Message thread with attachments
- Retainer balance with alert threshold
- Action timeline (everything that happened)
