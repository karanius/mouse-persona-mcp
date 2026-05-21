#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { connect } from "./cdp.js";
import { registerTools } from "./tools.js";

const args = process.argv.slice(2);
let cdpPort = 9222;
let defaultPersona = process.env.MOUSE_PERSONA_NAME || "Tester";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--cdp-port" && args[i + 1]) {
    const parsed = parseInt(args[i + 1], 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 65535) {
      console.error(`[mouse-persona] Invalid --cdp-port: ${args[i + 1]}`);
      process.exit(1);
    }
    cdpPort = parsed;
    i++;
  }
  if (args[i] === "--persona" && args[i + 1]) {
    defaultPersona = args[i + 1];
    i++;
  }
}

const server = new McpServer({
  name: "mouse-persona",
  version: "0.2.0",
});

registerTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mouse-persona] MCP server started on stdio");

  try {
    await connect(cdpPort);
  } catch {
    console.error(
      `[mouse-persona] Could not connect to Chrome on port ${cdpPort}. ` +
      `Tools will auto-connect on first call.`
    );
  }
}

main().catch((err) => {
  console.error("[mouse-persona] Fatal:", err);
  process.exit(1);
});
