#!/usr/bin/env node
/**
 * Mouse Persona MCP Server
 *
 * Provides visual cursor control tools for LLM-driven browser demos.
 * Connects to Chrome via CDP and injects a persistent overlay that
 * survives page navigations.
 *
 * Usage:
 *   npx @canadreamers/mouse-persona-mcp --cdp-port 9222
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { connect } from "./cdp.js";
import { registerTools } from "./tools.js";

const args = process.argv.slice(2);
let cdpPort = 9222;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--cdp-port" && args[i + 1]) {
    cdpPort = parseInt(args[i + 1], 10);
    i++;
  }
}

const server = new McpServer({
  name: "mouse-persona",
  version: "0.1.0",
});

registerTools(server);

async function main() {
  // Connect to Chrome via CDP
  try {
    await connect(cdpPort);
  } catch {
    console.error(
      `[mouse-persona] Could not connect to Chrome on port ${cdpPort}. ` +
      `Make sure Chrome is running with --remote-debugging-port=${cdpPort}`
    );
    // Don't exit — tools will report errors when called
  }

  // Start MCP server on stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mouse-persona] MCP server started on stdio");
}

main().catch((err) => {
  console.error("[mouse-persona] Fatal:", err);
  process.exit(1);
});
