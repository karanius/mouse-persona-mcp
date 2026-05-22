# Cursor Persona MCP

Visual persona overlay for browser demos. Injected via Playwright's `--init-script`. All commands go through `browser_evaluate` calling `window.__mp`.

## Quick API

```js
// Load a persona profile (once per session)
() => __mp.loadPersona({persona: {name: 'Chris Daw', role: 'RCIC', voice: '...', priorities: [...]}, narrator: {audience: 'investors', voice: '...'}})

// Get current persona + narrator context
() => __mp.who()

// Discover top N visible elements
() => __mp.d(3)

// Run a scene (persona already loaded)
() => __mp.x('> narrate text\n@ element text\n" thought bubble\n! click target\n.')

// Run a scene with persona name (one-off, no loadPersona needed)
() => __mp.x('Chris Daw', '> narrate\n@ element\n" thought\n.')
```

## DSL Operators

| Op | Meaning | Example |
|----|---------|---------|
| `>` | Narrate (bottom bar) — INVESTOR perspective | `> Consultant encounters registration friction` |
| `@` | Focus element by text match | `@ Sign In` |
| `"` | Thought bubble — PERSONA perspective | `" This should say Professional Registration` |
| `!` | Click element by text match | `! Sign In` |
| `=` | Fill input (field \| value) | `= Email \| chris@test.com` |
| `~` | Pause (ms) | `~ 1500` |
| `.` | Clear all overlays | `.` |

`@` followed by `"` on next line = commentOn (scroll + glide + ripple + highlight + thought).

## Two Perspectives

Every scene has two voices — read `AGENTS.md` for full guide:
- **`"` (thought bubble)** = persona's inner monologue. First person, their vocabulary, their emotional register.
- **`>` (narrator bar)** = investor/stakeholder context. Third person, business impact, one sentence.

## Persona Profiles

Pre-built profiles in `personas/` directory (chris-daw.json, kate-lamb.json, priya-sharma.json). Load with `loadPersona()`. Each includes persona voice, narrator audience, and badge colors.

## Persona Config

`persona.config.json` defines base defaults: timing, scroll, style. Persona profiles override relevant fields at runtime.

## Human Mode

ON by default (7s per thought with countdown). Disable: pass `{human: false}` in run() opts.

## Recording

Every `run()`/`x()` auto-records. Tape returned in result. Save as replayable Playwright script in `recordings/`.

## Typical Workflow

```
1. browser_navigate(url)
2. browser_evaluate(() => __mp.loadPersona({...}))  // once per session
3. browser_evaluate(() => __mp.d(3))                 // see what's on the page
4. browser_evaluate(() => __mp.x('> investor context\n@ element\n" persona thought\n.'))
```
