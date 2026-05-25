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

## Timing (Config-Driven)

All timing comes from `persona.config.json` — no hardcoded values in overlay.js.

| Setting | Default | What it does |
|---------|---------|--------------|
| `timing.humanPauseMs` | 5000 | Reading pause per thought (with countdown) |
| `timing.thoughtDurationMs` | 4000 | Base thought bubble display time |
| `timing.glideDurationMs` | 600 | Cursor travel animation |
| `timing.actionTimeoutMs` | 15000 | Max wait per DSL action |
| `timing.sceneTimeoutMs` | 90000 | Max wait per scene |

**Per-thought duration**: `"N text` where N = seconds. Example: `"3 quick thought` = 3s, `"5 key moment` = 5s. Default (no number) uses `thoughtDurationMs`.

**Human mode**: ON by default (5s pause with countdown). Disable: pass `{human: 0}` in `x()` opts, or `--no-human` flag in replay scripts.

## Scroll Behavior

`_scrollForBubble` detects nested scrollable containers (`overflow-auto`, `overflow-scroll`) and uses `scrollIntoView({ block: 'center' })` instead of `window.scrollBy`. This handles admin dashboards and modals where content lives inside a scrollable div, not the main document.

## Replay Scripts

Pre-built journeys in `personas/`:

```bash
# Chris Daw — consultant onboarding (9 scenes)
node personas/chris-daw/replay.js --headed --no-human

# Admin — review and approve (7 scenes)
node personas/admin/replay.js --headed --no-human

# Return test — Chris logs back in after approval
node personas/chris-daw/return-test.js
```

Flags: `--headed` (show browser), `--no-human` (skip reading pauses).

Cleanup uses user_id-based DB queries — all PII fields (display_name, credentials, etc.) are AES-GCM encrypted and cannot be matched by plaintext.

## Session Memory (Automatic)

Every replay auto-saves the session on exit:
- `personas/{name}/last-session.json` — overwritten each run (working memory for next drive)
- `personas/{name}/sessions/{timestamp}.json` — append-only history

On start, replays load `last-session.json` and log the previous session summary. When driving via MCP browser tools, call `window.__mp.sessionJSON()` and save via Bash at the end.

## Recording (Automatic)

Every `x()` call is automatically accumulated in a session tape. At the end of any journey, export and save:

```js
// Get the replay script
() => __mp.exportReplay()  // returns a runnable Node.js script as a string

// Get raw session data
() => __mp.session()  // returns {persona, narrator, scenes: [{ts, url, dsl, tape}]}
```

## Typical Workflow

```
1. browser_navigate(url)
2. browser_evaluate(() => __mp.loadPersona({...}))  // once per session
3. browser_evaluate(() => __mp.x('...DSL...'))       // repeat for each scene
4. browser_evaluate(() => __mp.session())            // save session (use filename param)
5. browser_evaluate(() => __mp.exportReplayFile())   // save replay (use filename param)
```

Step 4-5 MUST happen at the end of every journey. The overlay accumulates all scenes automatically — the LLM just exports and saves once.

## MCP Double-Encoding Prevention

**CRITICAL**: The Playwright MCP `filename` parameter JSON-encodes the return value before writing to disk. If your function returns a **string**, the file gets double-encoded (`"\"hello\""`). If it returns an **object**, the file is correct (`{"key":"value"}`).

**Rules for MCP `filename` saves:**
- `() => __mp.session()` → returns object → **correct** ✅
- `() => __mp.sessionJSON()` → returns object → **correct** ✅ (aliased to session())
- `() => __mp.exportReplayFile()` → returns `{__type, code}` object → **correct** ✅ (extract `.code` field with Bash after)
- `() => JSON.stringify(__mp.session())` → returns string → **DOUBLE-ENCODED** ❌ never do this
- `() => __mp.exportReplay()` → returns string → **DOUBLE-ENCODED** ❌ use exportReplayFile() instead

**After saving a replay file**, extract the code field:
```bash
node -e "const f=require('fs'); const d=JSON.parse(f.readFileSync('file.json','utf-8')); f.writeFileSync('file.js', d.code);"
```

## Session Auto-Persist (localStorage)

Sessions and personas auto-persist to `localStorage` after every `x()` call and `loadPersona()`. This means:
- Persona badge survives page navigation (no need to re-call `loadPersona()`)
- Recorded scenes accumulate across page changes
- `clearSession()` wipes both memory and localStorage for a fresh start
- Max 100 scenes stored in localStorage (tapes stripped to save space)
- Full tapes kept in memory for `exportReplay()` / `session()`
