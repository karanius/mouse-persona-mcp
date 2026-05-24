#!/bin/bash
# Start a persona MCP server with auto-loaded profile + session memory
#
# Usage: start-persona.sh <persona-dir> <playwright-config>
# Example: start-persona.sh personas/chris-daw /Users/k/ai/.playwright-mcp-chris.json

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PERSONA_DIR="$1"
CONFIG="$2"

if [ -z "$PERSONA_DIR" ] || [ -z "$CONFIG" ]; then
  echo "Usage: start-persona.sh <persona-dir> <config-path>"
  exit 1
fi

# Build init.js with latest profile + session
node "$SCRIPT_DIR/build-init.js" "$PERSONA_DIR"

# Start Playwright MCP
exec npx @playwright/mcp@latest --config "$CONFIG"
