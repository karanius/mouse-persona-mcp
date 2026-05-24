# The Movie — CanaDREAMERS Episode 1

**Title:** DigiChris
**Tagline:** "Immigration is broken. Not the policy — the process."
**Runtime:** 5 acts, 3 perspectives, 1 platform

## Cast

| Agent | Role | Portal |
|---|---|---|
| Ahmed Al-Rashid | Entrepreneur, Start-Up Visa applicant | Immigrant portal (localhost:3000) |
| Chris Daw | RCIC, business immigration specialist | Consultant portal (localhost:3000/consultant-portal) |
| Sarah Chen | Head of Partner Operations | Admin dashboard (localhost:8000) |

## Story Arc

Ahmed is a Syrian tech founder in Dubai who wants to bring his AgTech startup to Canada. He discovers CanaDREAMERS, explores his options, finds Chris Daw — a verified RCIC specializing in Start-Up Visa. Chris guides Ahmed through the process. Sarah ensures the platform's compliance layer protects everyone.

Three people. Three portals. One journey.

## Acts

## Programs

### [Start-Up Visa Program](startup-visa-program/)
Ahmed Al-Rashid — Syrian tech founder, AgTech AI startup, Dubai → Vancouver

- [Act 0 — Discovery](startup-visa-program/act-0-discovery.md) — Ahmed finds CanaDREAMERS
- [Act 1 — The Consultant](startup-visa-program/act-1-consultant.md) — Chris registers and gets approved
- [Act 2 — The Immigrant](startup-visa-program/act-2-immigrant.md) — Ahmed signs up and builds his profile
- [Act 3 — The Match](startup-visa-program/act-3-match.md) — Ahmed finds Chris, books consultation, signs retainer
- [Act 4 — The Case](startup-visa-program/act-4-case.md) — Chris manages Ahmed's Start-Up Visa application
- [Act 5 — The Journey](startup-visa-program/act-5-journey.md) — Application submitted, both portals track to decision

### Provincial Entrepreneur
*Coming next*

### Provincial Nominee Program (PNP)
*Coming next*

### Federal Skilled Worker (FSWP)
*Coming next*

## Production Notes

Each act is a chapter. Each chapter has scenes. Each scene specifies:
- Which agent is active (Ahmed, Chris, or Sarah)
- Which portal they're on
- What they see, do, and think (DSL overlay narration)
- What changes in the system (DB, API calls, state transitions)
- What the other agents see as a result

Scenes are designed to be driven by the MCP persona agents. Each agent's browser records their perspective automatically via the session memory loop.
