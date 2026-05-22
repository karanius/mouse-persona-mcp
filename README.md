# Cursor Persona MCP

Visual cursor controller for LLM-driven browser demos. Shows a custom cursor, persona label, thought bubbles, click ripples, and green highlights — all persistent across page navigations.

Works alongside the [Playwright MCP](https://github.com/microsoft/playwright-mcp). Playwright handles browser automation. Cursor Persona handles what the audience **sees**.

## Tools

| Tool | Description |
|------|-------------|
| `persona_set` | Set the persona name ("Chris Daw") |
| `persona_think` | Show thought bubble ("I need to find my portal") |
| `persona_glide` | Move cursor to coordinates with ease-out |
| `persona_glide_to` | Move cursor to a CSS selector |
| `persona_highlight` | Green border + glide cursor to element |
| `persona_ripple` | Red click ripple at cursor position |
| `persona_narrate` | Scene title bar at bottom of screen |
| `persona_clear` | Remove all overlays |

## Setup

```json
{
  "mcpServers": {
    "cursor-persona": {
      "command": "node",
      "args": ["/path/to/cursor-persona-mcp/dist/index.js", "--cdp-port", "9222"]
    }
  }
}
```

Chrome must be running with `--remote-debugging-port=9222`.

## How it works

Connects to Chrome via CDP and injects the overlay using `Page.addScriptToEvaluateOnNewDocument` — this persists across navigations, refreshes, and SPA routing. No re-injection needed.

## Built by CanaDREAMERS
