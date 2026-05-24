# Act 1 — The Consultant

**Agent:** Chris Daw + Sarah Chen
**Portal:** Consultant portal + Admin dashboard
**Duration:** Chris registers → Sarah approves → Chris's dashboard unlocks

---

## Chapter 1.1 — Chris Registers

### Scene 1.1.1 — Discovery
- Chris finds CanaDREAMERS as a consultant
- Navigates to /auth?role=consultant
- Thinks: "Let's see if they actually verify consultants or just let anyone sign up."

### Scene 1.1.2 — Sign Up
- Creates account: chris@dawimmigration.com
- Redirects to consultant onboarding

### Scene 1.1.3 — Identity (Step 1)
- Enters: Chris Daw, R409583
- System validates college ID format
- Clicks Next

### Scene 1.1.4 — Practice (Step 2)
- Selects specializations: Start-Up Visa, Provincial Entrepreneur, PNP, FSWP
- Selects languages: English, French
- Clicks Next

### Scene 1.1.5 — Location & Bio (Step 3)
- City: Vancouver
- Bio: "Business immigration specialist with 20 years of RCIC experience..."
- Clicks Next

### Scene 1.1.6 — Documents & Submit (Step 4)
- Uploads E&O insurance certificate (real 5-page CICC liability doc)
- Clicks Submit Application

### Scene 1.1.7 — CICC Verification
- System auto-verifies R409583 against live CICC register
- Pulls: Christopher Robert Daw, Daw Immigration Solutions Inc, RCIC-IRB L3, Entitled
- SHA-256 evidence hash sealed
- Chris sees verification result with his full name from the register
- Thinks: "They pulled my data from the actual register. Not a form I filled — data they confirmed."

### Scene 1.1.8 — Pending Review
- Application moves to "Pending Admin Review"
- Chris waits

---

## Chapter 1.2 — Sarah Reviews

**Agent switch: Sarah Chen**

### Scene 1.2.1 — Admin Login
- Sarah opens admin dashboard (localhost:8000)
- Signs in: admin@test.com

### Scene 1.2.2 — Partners Queue
- Sees 1 pending application: Chris Daw
- Opens the review

### Scene 1.2.3 — CICC Evidence Audit
- Expands CICC Verification Certificate
- Sees: Christopher Robert Daw, R409583, RCIC-IRB L3, Daw Immigration Solutions Inc
- Checks SHA-256 hash — green, integrity verified
- Thinks: "CICC register data is sealed. Clean."

### Scene 1.2.4 — Documents Check
- Opens E&O insurance document (native PDF preview)
- Scrolls through all 5 pages
- Checks coverage, insurer, named insured
- Thinks: "CICC professional liability regulation. On file."

### Scene 1.2.5 — Approval
- Both gates pass: CICC verified + E&O on file
- Clicks Approve
- System sets status=approved, role=partner:consultant

---

## Chapter 1.3 — Chris Returns

**Agent switch: Chris Daw**

### Scene 1.3.1 — Welcome Gate
- Chris logs back in
- Sees: "Welcome to CanaDREAMERS, Christopher Robert Daw"
- RCIC Verified badge — clicks to expand full certificate
- Thinks: "My registered name. My certificate. My platform."

### Scene 1.3.2 — Getting Started (V12 Dashboard)
- Enters dashboard — sees 6-step onboarding guide
- Step 1: Complete your profile
- Step 2: Import your first client
- Thinks: "Clean. Empty. Ready for my practice."

### Scene 1.3.3 — Profile Setup
- Clicks Settings → completes public profile
- Sets hourly rate: $250
- Toggles: Accepting clients = ON
- His profile card now shows in the consultant directory

---

## System State After Act 1

| What changed | Details |
|---|---|
| Chris's account | Approved, CICC verified, profile complete, listed in directory |
| Sarah's dashboard | 1 approved consultant, audit trail recorded |
| Consultant directory | Chris Daw visible with verified badge |
| Ahmed's view | Chris is now discoverable — Act 0 becomes possible |
