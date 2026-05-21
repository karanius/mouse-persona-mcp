/**
 * Chrome DevTools Protocol connector.
 *
 * Connects to a running Chrome instance and injects the overlay script
 * via Page.addScriptToEvaluateOnNewDocument — this persists across
 * navigations, refreshes, and SPA route changes.
 */

import CDP from "chrome-remote-interface";
import { getOverlayScript } from "./overlay.js";

let client: CDP.Client | null = null;
let currentPersona = "Tester";
let cdpPort = 9222;

async function ensureConnected(): Promise<void> {
  if (client) return;
  await connect(cdpPort);
}

export async function connect(port: number = 9222): Promise<void> {
  cdpPort = port;
  try {
    client = await CDP({ port });
    await client.Page.enable();
    await client.Runtime.enable();

    // Inject overlay on every new document (persists across navigation)
    await client.Page.addScriptToEvaluateOnNewDocument({
      source: getOverlayScript(currentPersona),
    });

    // Also inject into the current page immediately
    await client.Runtime.evaluate({
      expression: getOverlayScript(currentPersona),
    });

    console.error(`[mouse-persona] Connected to Chrome on port ${port}`);
  } catch (err) {
    console.error(`[mouse-persona] Failed to connect to Chrome on port ${port}:`, err);
    throw err;
  }
}

export async function evaluate(expression: string): Promise<any> {
  await ensureConnected();
  if (!client) throw new Error("Could not connect to Chrome on port " + cdpPort);
  const result = await client.Runtime.evaluate({
    expression,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Evaluation failed");
  }
  return result.result?.value;
}

export async function setPersona(name: string): Promise<void> {
  currentPersona = name;
  await ensureConnected();
  if (client) {
    await client.Page.addScriptToEvaluateOnNewDocument({
      source: getOverlayScript(name),
    });
    // Update the current page
    await evaluate(`window.__mp && window.__mp.setPersona(${JSON.stringify(name)})`);
  }
}

export async function think(text: string): Promise<void> {
  await evaluate(`window.__mp && window.__mp.think(${JSON.stringify(text)})`);
}

export async function glideTo(x: number, y: number): Promise<void> {
  await evaluate(`window.__mp && window.__mp.glideTo(${x}, ${y})`);
}

export async function glideToSelector(selector: string): Promise<void> {
  await evaluate(`
    (async () => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return;
      const r = el.getBoundingClientRect();
      await window.__mp.glideTo(r.left + r.width/2, r.top + r.height/2);
    })()
  `);
}

export async function highlight(selector: string): Promise<void> {
  await evaluate(`
    (async () => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return;
      const r = el.getBoundingClientRect();
      await window.__mp.glideTo(r.left + r.width/2, r.top + r.height/2);
      window.__mp.highlight(el);
    })()
  `);
}

export async function ripple(): Promise<void> {
  await evaluate(`window.__mp && window.__mp.ripple()`);
}

export async function narrate(text: string): Promise<void> {
  await evaluate(`window.__mp && window.__mp.narrate(${JSON.stringify(text)})`);
}

export async function clearNarrate(): Promise<void> {
  await evaluate(`window.__mp && window.__mp.clearNarrate()`);
}

export async function clear(): Promise<void> {
  await evaluate(`window.__mp && window.__mp.clear()`);
}

export function isConnected(): boolean {
  return client !== null;
}
