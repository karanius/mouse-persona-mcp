# Mouse Persona MCP

Visual persona overlay for browser demos. Injected via Playwright's `--init-script`. All commands go through `browser_evaluate` calling `window.__mp`.

## Quick API

```js
// Discover top N visible elements
() => __mp.d(3)

// Run a scene as a persona (persona name, DSL script)
() => __mp.x('Chris Daw', '> narrate text\n@ element text\n" thought bubble\n! click target\n.')
```

## DSL Operators

| Op | Meaning | Example |
|----|---------|---------|
| `>` | Narrate (bottom bar) | `> Scene 1: Chris arrives` |
| `@` | Focus element by text match | `@ Sign In` |
| `"` | Thought bubble (on focused element) | `" This button is patronizing` |
| `!` | Click element by text match | `! Sign In` |
| `=` | Fill input (field \| value) | `= Email \| chris@test.com` |
| `~` | Pause (ms) | `~ 1500` |
| `.` | Clear all overlays | `.` |

`@` followed by `"` on the next line = commentOn (scroll + glide + ripple + highlight + thought).

## Typical workflow

```
1. browser_navigate(url)
2. browser_evaluate(() => __mp.d(3))          // see what's on the page
3. browser_evaluate(() => __mp.x('Persona', '...DSL...'))  // run the scene
```

## Config

All defaults in `persona.config.json`: timing, colors, scroll zones, typing speed, bubble style.

## Human mode

ON by default (7s per thought with countdown). Disable with `{human: false}` in run() opts.

## Recording

Every `run()`/`x()` call auto-records. The tape is returned in the result. Save as a replayable Playwright script in `recordings/`.
