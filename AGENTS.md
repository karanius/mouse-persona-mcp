# AGENTS.md — Cursor Persona MCP: Content Generation Guide

This file tells any LLM (Claude, GPT, Gemini, or any agent) how to use the Cursor Persona overlay and generate content for the two perspectives in every scene.

## How to Use the Overlay

The overlay is injected into every browser page via Playwright's `--init-script`. Control it through `browser_evaluate` (or equivalent page.evaluate) calling `window.__mp`.

### Setup (once per session):
```js
// Load a persona profile
page.evaluate(() => __mp.loadPersona({
  persona: { name: 'Chris Daw', role: 'RCIC', voice: 'skeptical veteran...', priorities: ['compliance'] },
  narrator: { audience: 'investors', voice: 'Business impact focus.' }
}))

// Verify what's loaded
page.evaluate(() => __mp.who())
```

### Run a scene:
```js
page.evaluate(() => __mp.x('> Investor-facing narration\n@ Element text to focus\n" Persona thought\n! Element to click\n.'))
```

### DSL operators:
| Op | Meaning |
|----|---------|
| `>` | Narrate (bottom bar) — narrator perspective |
| `@` | Focus element by text match |
| `"` | Thought bubble — persona perspective |
| `!` | Click element |
| `=` | Fill input (field \| value) |
| `~` | Pause (ms) |
| `.` | Clear all |

## Two Perspectives, One Scene

Every scene has TWO voices running simultaneously:

### 1. Persona Voice → Thought Bubbles (`"` in DSL)

The glassmorphism bubble above the cursor. This is the persona's **inner monologue** — what they're thinking as they use the product.

**Source:** `persona` section in `persona.config.json`

**Rules:**
- First person. "I", "me", "my".
- Use the persona's actual vocabulary and expertise level. A 20-year RCIC says "CICC registry" not "the verification website." A first-time immigrant says "I don't understand this" not "the UX is suboptimal."
- React to what they SEE, not what they know about the codebase.
- Include emotional reactions — frustration, approval, confusion, skepticism, relief.
- Reference their professional context. Chris Daw compares to IRCC processes. Priya Sharma compares to her experience finding services in India.
- Keep it natural. These are thoughts, not reviews. Incomplete sentences are fine. Rhetorical questions are good.
- Length: 1-3 sentences. Enough to read in 7 seconds.

**Examples by persona type:**

| Persona | Voice | Example thought |
|---------|-------|-----------------|
| RCIC veteran (Chris Daw) | Skeptical, direct, industry-specific | "'Verified' means nothing without licence class, status, and conditions. A suspended consultant also has a 'verified' registration." |
| Immigrant (Priya Sharma) | Cautious, hopeful, practical | "These badges look official but how do I know they're real? I've been scammed by fake consultants before." |
| CICC leadership (Kate Lamb) | Strategic, metric-focused, regulatory | "Twelve pending applications and no trend line. Is this normal or a backlog? I need week-over-week data." |
| QA engineer (Jordan Reeves) | Technical, systematic, edge-case-aware | "'Run All Monitors' — what happens if two fail simultaneously? Is there a cascading failure path?" |

### 2. Narrator Voice → Bottom Bar (`>` in DSL)

The dark bar at the bottom of the screen. This is the **investor/stakeholder perspective** — what this moment means for the business.

**Source:** `narrator` section in `persona.config.json`

**Rules:**
- Third person. "The consultant", "Chris", "the user" — never "I".
- One sentence. Max two.
- Focus on BUSINESS IMPACT, not UX detail. The thought bubble handles UX — the narrator handles why investors should care.
- Frame around: conversion risk, compliance exposure, competitive advantage, retention signal, revenue implication.
- No jargon from the persona's domain unless it's the point (e.g., "CICC compliance" IS the business value).
- Update the narrator at each major transition, not every step.

**Examples:**

| Scene moment | Bad narrator (too descriptive) | Good narrator (business impact) |
|---|---|---|
| Chris sees "Start Your Journey" | "Chris reads the signup heading" | "Registration language undermines professional credentialing — risk of consultant churn before onboarding completes" |
| Priya checks consultant badges | "Priya looks at the verification badges" | "Trust signal gap: badges without proof-of-verification reduce directory conversion" |
| Kate reviews metrics | "Kate opens the metrics dashboard" | "Leadership dashboard lacks trend data — no board-reportable KPIs without week-over-week" |
| Chris uploads E&O | "Chris uploads his insurance" | "E&O gate enforces CICC compliance — differentiator vs unregulated platforms" |

## How to Generate a Scene

When writing a `run()` or `x()` DSL script:

1. **Read persona.config.json** — know who you are (persona) and who you're narrating for (narrator.audience).
2. **Set the narrator at the start** — one `>` line framing the scene for investors.
3. **Focus on elements** — `@` to scroll and highlight what the persona notices.
4. **React as the persona** — `"` thought bubble in their voice, their vocabulary, their emotional register.
5. **Act as the persona** — `!` click, `=` fill — the mechanical actions.
6. **Update narrator on transitions** — new `>` line when the scene shifts (e.g., moving from signup to wizard).

### Template:

```
> [Investor perspective: what's happening and why it matters]
@ [Element the persona notices first]
" [Persona's honest reaction in their voice]
~ 500
@ [Next element]
" [Another reaction]
! [Action they take]
~ 800
> [Updated investor context for next phase]
```

## Persona Profiles

Stored in `persona.config.json` under `persona`. When switching personas, update the config or pass `persona` in `run()` opts.

For the CanaDREAMERS platform, the 10 test personas are defined in `/Users/k/ai/merge/canadreamers-platform/tests/real_world_data/tests_new.txt`. Each has a specific journey, professional context, and set of priorities.

## Narrator Audiences

The narrator can target different audiences by changing `narrator.audience` in config:

| Audience | Focus |
|----------|-------|
| `investors` | Revenue, conversion, competitive moat, market size |
| `product` | UX friction, feature gaps, user flow completeness |
| `compliance` | Regulatory adherence, risk exposure, audit readiness |
| `engineering` | API behavior, error states, performance, edge cases |

The default is `stakeholders` (blend of investor + product).
