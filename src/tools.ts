import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as cdp from "./cdp.js";

function err(msg: string) {
  return { isError: true as const, content: [{ type: "text" as const, text: msg }] };
}

function ok(msg: string) {
  return { content: [{ type: "text" as const, text: msg }] };
}

export function registerTools(server: McpServer): void {
  server.tool(
    "persona_set",
    "Set the active persona name displayed next to the cursor",
    { name: z.string().describe("Persona name, e.g. 'Chris Daw'") },
    async ({ name }) => {
      try {
        await cdp.setPersona(name);
        return ok(`Persona set to: ${name}`);
      } catch (e: any) {
        return err(`Failed to set persona: ${e.message}`);
      }
    }
  );

  server.tool(
    "persona_think",
    "Show a thought bubble near the cursor with the persona's inner monologue. Auto-dismisses after duration_ms (default 3500ms).",
    {
      text: z.string().describe("The thought text to display"),
      duration_ms: z.number().optional().describe("How long the thought bubble stays visible (default 3500)"),
    },
    async ({ text, duration_ms }) => {
      try {
        await cdp.think(text, duration_ms);
        return ok(`Thought: "${text}"`);
      } catch (e: any) {
        return err(`Failed to show thought: ${e.message}`);
      }
    }
  );

  server.tool(
    "persona_glide",
    "Smoothly move the cursor to viewport coordinates with ease-out animation. Coordinates are pixels from top-left of the viewport.",
    {
      x: z.number().describe("Target X coordinate (pixels from left edge of viewport)"),
      y: z.number().describe("Target Y coordinate (pixels from top edge of viewport)"),
      duration_ms: z.number().optional().describe("Animation duration in ms (default 600)"),
    },
    async ({ x, y, duration_ms }) => {
      try {
        await cdp.glideTo(x, y, duration_ms);
        return ok(`Cursor glided to (${x}, ${y})`);
      } catch (e: any) {
        return err(`Failed to glide: ${e.message}`);
      }
    }
  );

  server.tool(
    "persona_glide_to",
    "Smoothly move the cursor to the center of an element matched by CSS selector. Returns an error if the selector matches nothing.",
    {
      selector: z.string().describe("CSS selector of the target element"),
      duration_ms: z.number().optional().describe("Animation duration in ms (default 600)"),
    },
    async ({ selector, duration_ms }) => {
      try {
        const miss = await cdp.glideToSelector(selector, duration_ms);
        if (miss) return err(`Selector not found: ${selector}`);
        return ok(`Cursor glided to: ${selector}`);
      } catch (e: any) {
        return err(`Failed to glide to selector: ${e.message}`);
      }
    }
  );

  server.tool(
    "persona_highlight",
    "Glide the cursor to an element and draw a green highlight border around it (fades after 3s). Returns an error if the selector matches nothing.",
    {
      selector: z.string().describe("CSS selector of the element to highlight"),
      duration_ms: z.number().optional().describe("Glide animation duration in ms (default 600)"),
    },
    async ({ selector, duration_ms }) => {
      try {
        const miss = await cdp.highlight(selector, duration_ms);
        if (miss) return err(`Selector not found: ${selector}`);
        return ok(`Highlighted: ${selector}`);
      } catch (e: any) {
        return err(`Failed to highlight: ${e.message}`);
      }
    }
  );

  server.tool(
    "persona_ripple",
    "Show a red click ripple animation at the current cursor position (0.7s animation)",
    {},
    async () => {
      try {
        await cdp.ripple();
        return ok("Click ripple shown");
      } catch (e: any) {
        return err(`Failed to show ripple: ${e.message}`);
      }
    }
  );

  server.tool(
    "persona_narrate",
    "Show a narrator text bar at the bottom of the screen. Stays until explicitly cleared with persona_clear_narrate.",
    { text: z.string().describe("Narrator text to display") },
    async ({ text }) => {
      try {
        await cdp.narrate(text);
        return ok(`Narrating: ${text}`);
      } catch (e: any) {
        return err(`Failed to narrate: ${e.message}`);
      }
    }
  );

  server.tool(
    "persona_clear_narrate",
    "Remove the narrator text bar from the bottom of the screen",
    {},
    async () => {
      try {
        await cdp.clearNarrate();
        return ok("Narrator cleared");
      } catch (e: any) {
        return err(`Failed to clear narrate: ${e.message}`);
      }
    }
  );

  server.tool(
    "persona_clear",
    "Remove all visual overlays (thought bubbles, narrator bar)",
    {},
    async () => {
      try {
        await cdp.clear();
        return ok("All overlays cleared");
      } catch (e: any) {
        return err(`Failed to clear: ${e.message}`);
      }
    }
  );

  server.tool(
    "persona_query",
    "Check if a CSS selector matches an element and return its bounding rect and text content. Use this to verify targets before gliding or highlighting.",
    { selector: z.string().describe("CSS selector to query") },
    async ({ selector }) => {
      try {
        const info = await cdp.queryElement(selector);
        return ok(JSON.stringify(info));
      } catch (e: any) {
        return err(`Failed to query element: ${e.message}`);
      }
    }
  );

  server.tool(
    "persona_action",
    "Execute a sequence of persona actions in a single round-trip. Each step runs sequentially in the browser. Supported actions: glide, glide_to, ripple, think, highlight, narrate, clear_narrate, clear, set_persona. Use delay_ms between steps for timing.",
    {
      steps: z.array(z.object({
        action: z.enum(["glide", "glide_to", "ripple", "think", "highlight", "narrate", "clear_narrate", "clear", "set_persona"])
          .describe("The action to perform"),
        params: z.record(z.string(), z.any()).optional()
          .describe("Action parameters: glide needs {x, y, duration_ms?}, glide_to/highlight need {selector, duration_ms?}, think needs {text, duration_ms?}, narrate needs {text}, set_persona needs {name}"),
        delay_ms: z.number().optional()
          .describe("Delay in ms before executing this step"),
      })).describe("Ordered list of actions to execute"),
    },
    async ({ steps }) => {
      try {
        const results = await cdp.runBatch(steps);
        return ok(JSON.stringify(results));
      } catch (e: any) {
        return err(`Batch execution failed: ${e.message}`);
      }
    }
  );
}
