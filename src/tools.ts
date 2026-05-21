/**
 * MCP tool definitions for the Mouse Persona server.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as cdp from "./cdp.js";

export function registerTools(server: McpServer): void {
  server.tool(
    "persona_set",
    "Set the active persona name displayed next to the cursor",
    { name: z.string().describe("Persona name, e.g. 'Chris Daw'") },
    async ({ name }) => {
      await cdp.setPersona(name);
      return { content: [{ type: "text", text: `Persona set to: ${name}` }] };
    }
  );

  server.tool(
    "persona_think",
    "Show a thought bubble above the cursor with the persona's inner monologue",
    { text: z.string().describe("The thought text to display") },
    async ({ text }) => {
      await cdp.think(text);
      return { content: [{ type: "text", text: `💭 "${text}"` }] };
    }
  );

  server.tool(
    "persona_glide",
    "Smoothly move the cursor to specific coordinates with ease-out animation",
    {
      x: z.number().describe("Target X coordinate"),
      y: z.number().describe("Target Y coordinate"),
    },
    async ({ x, y }) => {
      await cdp.glideTo(x, y);
      return { content: [{ type: "text", text: `Cursor glided to (${x}, ${y})` }] };
    }
  );

  server.tool(
    "persona_glide_to",
    "Smoothly move the cursor to the center of an element matched by CSS selector",
    { selector: z.string().describe("CSS selector of the target element") },
    async ({ selector }) => {
      await cdp.glideToSelector(selector);
      return { content: [{ type: "text", text: `Cursor glided to: ${selector}` }] };
    }
  );

  server.tool(
    "persona_highlight",
    "Draw a green highlight border around an element and glide the cursor to it",
    { selector: z.string().describe("CSS selector of the element to highlight") },
    async ({ selector }) => {
      await cdp.highlight(selector);
      return { content: [{ type: "text", text: `Highlighted: ${selector}` }] };
    }
  );

  server.tool(
    "persona_ripple",
    "Show a red click ripple animation at the current cursor position",
    {},
    async () => {
      await cdp.ripple();
      return { content: [{ type: "text", text: "Click ripple shown" }] };
    }
  );

  server.tool(
    "persona_narrate",
    "Show a narrator text bar at the bottom of the screen for scene titles",
    { text: z.string().describe("Narrator text to display") },
    async ({ text }) => {
      await cdp.narrate(text);
      return { content: [{ type: "text", text: `Narrating: ${text}` }] };
    }
  );

  server.tool(
    "persona_clear_narrate",
    "Remove the narrator text bar from the bottom of the screen",
    {},
    async () => {
      await cdp.clearNarrate();
      return { content: [{ type: "text", text: "Narrator cleared" }] };
    }
  );

  server.tool(
    "persona_clear",
    "Remove all visual overlays (thoughts, highlights, narrator)",
    {},
    async () => {
      await cdp.clear();
      return { content: [{ type: "text", text: "All overlays cleared" }] };
    }
  );
}
