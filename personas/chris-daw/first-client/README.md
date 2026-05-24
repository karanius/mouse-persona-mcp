# Chris Daw's First Client — Onboarding Spec

**Date:** 2026-05-24
**Source:** Chris Daw interview (RCIC, R409583, 20 years, 200+ clients)

---

## What Chris Uploads

### Option A: Document Import (preferred)
Two files → system extracts everything:

1. **Retainer Agreement** (.pdf or .docx)
   - Client's full name, DOB, nationality
   - Contact info (email, phone, address)
   - Immigration stream agreed upon
   - Retainer amount and billing terms
   - Signed date

2. **Intake Questionnaire** (.pdf or .docx)
   - 4-page standard RCIC intake form
   - Full immigration history
   - Employment history
   - Education credentials
   - Language test scores
   - Family composition
   - Everything IRCC needs

### Option B: Manual Entry (fallback)
13 fields, ~3 minutes:

| # | Field | Example |
|---|---|---|
| 1 | Full Name | Ahmed Al-Rashid |
| 2 | Date of Birth | 1988-03-15 |
| 3 | Nationality | Syria |
| 4 | Passport Number | N12345678 |
| 5 | Passport Expiry | 2028-12-01 |
| 6 | Email | ahmed@email.com |
| 7 | Phone | +1 604-555-0123 |
| 8 | Address (Canada) | 456 Main St, Vancouver, BC |
| 9 | Address (Home Country) | Damascus, Syria |
| 10 | Marital Status | Married |
| 11 | Number of Dependents | 2 |
| 12 | Immigration Stream | Express Entry — FSWP |
| 13 | Retainer Amount | $3,500 |

---

## What the System Generates

Once the client is created (via import or manual), the system auto-generates:

### 1. Document Checklist
Based on the immigration stream. All statuses start at "Not Requested."

**Express Entry — FSWP (12 docs):**
- [ ] Passport (certified copy)
- [ ] Language test results (IELTS/TEF/CELPIP)
- [ ] Educational Credential Assessment (ECA)
- [ ] Police clearance (per country of residence 6+ months)
- [ ] Photos (IRCC specification)
- [ ] Proof of funds (bank statements, 3 months)
- [ ] Employment reference letters (per position)
- [ ] Birth certificate
- [ ] Marriage certificate (if applicable)
- [ ] Medical exam results
- [ ] Proof of Canadian work experience (if CEC)
- [ ] Provincial nomination letter (if PNP)

**Spousal Sponsorship (8 docs):**
- [ ] Passport (both sponsor and applicant)
- [ ] Marriage/common-law certificate
- [ ] Relationship proof (photos, communication history)
- [ ] Sponsor income documents (NOA, T4, pay stubs)
- [ ] Police clearance
- [ ] Medical exam results
- [ ] Photos (IRCC specification)
- [ ] IMM forms (IMM 1344, IMM 5532, IMM 5540)

**Work Permit — LMIA (6 docs):**
- [ ] Passport
- [ ] Job offer letter
- [ ] LMIA approval letter
- [ ] Police clearance
- [ ] Medical exam (if required)
- [ ] Photos

### 2. Milestone Timeline
Auto-generated based on stream processing times:

| Milestone | Target |
|---|---|
| Application prep complete | +2 weeks from intake |
| Submit to IRCC | +3 weeks from intake |
| Biometrics appointment | +4-6 weeks from submission |
| Medical exam (if required) | +8 weeks from submission |
| Processing estimate | Stream-dependent (6-12 months) |

### 3. Retainer Tracking Card
- Starting balance: retainer amount from intake
- Hours logged: 0
- Hourly rate: from consultant profile
- Alert threshold: 2 hours remaining

### 4. Welcome Message (draft)
Pre-filled template in Outbox:
```
Dear [Client Name],

Thank you for retaining Daw Immigration Solutions Inc. for your
[Immigration Stream] application.

Your RCIC: Christopher Robert Daw (R409583)

Next steps:
1. Please upload the following documents to your client portal: [auto-generated list]
2. We'll review each document as it arrives
3. Target submission date: [calculated from timeline]

You can reach me through the secure message system in your portal,
or at chris@dawimmigration.com.

Best regards,
Chris Daw, RCIC
```

### 5. First Task
Added to Today's Focus:
- **"Send welcome message to [Client Name]"** — Due: today
- **"Request missing documents"** — Due: +1 day
- **"Follow up on document request"** — Due: +7 days

---

## The Self-Driving Loop

```
Day 0:  Import client → system generates everything
Day 0:  Today's Focus: "Send welcome message"
Day 1:  Today's Focus: "Request documents from [client]"
Day 7:  Today's Focus: "3 docs still missing — send reminder"
Day 14: Today's Focus: "All docs received — begin application prep"
Day 21: Today's Focus: "Application ready — submit to IRCC"
Day 22: Case status → "Submitted", timeline updates
...
Day 180: "Decision received — notify client"
```

The consultant doesn't plan. The system plans. The consultant executes.

---

## Sample Files Needed

To test the first client flow end-to-end, we need:

1. `retainer-agreement-ahmed.pdf` — sample retainer for Ahmed Al-Rashid
2. `intake-questionnaire-ahmed.pdf` — filled intake form for Express Entry FSWP
3. Or: manually enter the 13 fields from the table above

These files should live in `first-client/samples/` for replay testing.
