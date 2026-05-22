import CDP from "chrome-remote-interface";
import { getOverlayScript } from "./overlay.js";

let client: CDP.Client | null = null;
let currentPersona = "Tester";
let cdpPort = 9222;
let scriptId: string | null = null;

const EVAL_TIMEOUT_MS = 10_000;

async function ensureConnected(): Promise<void> {
  if (client) return;
  await connect(cdpPort);
}

export async function connect(port: number = 9222): Promise<void> {
  cdpPort = port;

  if (client) {
    try { await client.close(); } catch {}
    client = null;
    scriptId = null;
  }

  const c = await CDP({ port });
  try {
    c.on("disconnect", () => {
      console.error("[cursor-persona] Chrome disconnected, will reconnect on next tool call");
      client = null;
      scriptId = null;
    });

    await c.Page.enable();
    await c.Runtime.enable();

    const result = await c.Page.addScriptToEvaluateOnNewDocument({
      source: getOverlayScript(currentPersona),
    });
    scriptId = result.identifier;

    await c.Runtime.evaluate({
      expression: getOverlayScript(currentPersona),
    });

    const check = await c.Runtime.evaluate({
      expression: "typeof window.__mp === 'object'",
    });
    if (check.result?.value !== true) {
      console.error("[cursor-persona] Overlay injection failed — window.__mp not found (CSP or sandbox may be blocking)");
    }

    client = c;
    console.error(`[cursor-persona] Connected to Chrome on port ${port}`);
  } catch (e) {
    try { c.close(); } catch {}
    throw e;
  }
}

export async function evaluate(expression: string): Promise<any> {
  await ensureConnected();
  if (!client) throw new Error("Could not connect to Chrome on port " + cdpPort);

  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("CDP evaluate timed out after " + EVAL_TIMEOUT_MS + "ms")), EVAL_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([
      client.Runtime.evaluate({ expression, awaitPromise: true }),
      timeout,
    ]);

    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || "Evaluation failed");
    }
    return result.result?.value;
  } finally {
    clearTimeout(timer!);
  }
}

export async function setPersona(name: string): Promise<void> {
  currentPersona = name;
  await ensureConnected();
  if (!client) return;

  if (scriptId) {
    await client.Page.removeScriptToEvaluateOnNewDocument({ identifier: scriptId });
  }

  const result = await client.Page.addScriptToEvaluateOnNewDocument({
    source: getOverlayScript(name),
  });
  scriptId = result.identifier;

  await evaluate(`window.__mp && window.__mp.setPersona(${JSON.stringify(name)})`);
}

export async function think(text: string, durationMs?: number): Promise<void> {
  const args = durationMs
    ? `${JSON.stringify(text)}, ${durationMs}`
    : JSON.stringify(text);
  await evaluate(`window.__mp && window.__mp.think(${args})`);
}

export async function glideTo(x: number, y: number, durationMs?: number): Promise<void> {
  const args = durationMs ? `${x}, ${y}, ${durationMs}` : `${x}, ${y}`;
  await evaluate(`window.__mp && window.__mp.glideTo(${args})`);
}

export async function glideToSelector(selector: string, durationMs?: number): Promise<"NOT_FOUND" | null> {
  const durArg = durationMs ? `, ${durationMs}` : "";
  const result = await evaluate(`
    (async () => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return 'NOT_FOUND';
      const r = el.getBoundingClientRect();
      await window.__mp.glideTo(r.left + r.width/2, r.top + r.height/2${durArg});
      return 'OK';
    })()
  `);
  return result === "NOT_FOUND" ? "NOT_FOUND" : null;
}

export async function highlight(selector: string, durationMs?: number): Promise<"NOT_FOUND" | null> {
  const durArg = durationMs ? `, ${durationMs}` : "";
  const result = await evaluate(`
    (async () => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return 'NOT_FOUND';
      const r = el.getBoundingClientRect();
      await window.__mp.glideTo(r.left + r.width/2, r.top + r.height/2${durArg});
      window.__mp.highlight(el);
      return 'OK';
    })()
  `);
  return result === "NOT_FOUND" ? "NOT_FOUND" : null;
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

export async function queryElement(selector: string): Promise<{ exists: boolean; rect?: { x: number; y: number; w: number; h: number }; text?: string }> {
  const result = await evaluate(`
    (() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return JSON.stringify({ exists: false });
      const r = el.getBoundingClientRect();
      return JSON.stringify({
        exists: true,
        rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
        text: (el.textContent || '').trim().slice(0, 200)
      });
    })()
  `);
  if (typeof result !== "string") return { exists: false };
  return JSON.parse(result);
}

export async function runBatch(steps: Array<{ action: string; params?: Record<string, any>; delay_ms?: number }>): Promise<string[]> {
  const stepCode = steps.map((s) => {
    const delayMs = Number(s.delay_ms) || 0;
    const d = delayMs > 0 ? `await new Promise(r => setTimeout(r, ${delayMs}));` : "";
    const dur = s.params?.duration_ms ? Number(s.params.duration_ms) || 600 : undefined;
    switch (s.action) {
      case "glide": {
        const x = Number(s.params?.x) || 0;
        const y = Number(s.params?.y) || 0;
        return `${d}await window.__mp.glideTo(${x}, ${y}${dur ? ", " + dur : ""}); results.push("glide done");`;
      }
      case "glide_to": return `${d}{ const el = document.querySelector(${JSON.stringify(s.params?.selector || "")}); if (!el) { results.push("glide_to: NOT_FOUND"); } else { const r = el.getBoundingClientRect(); await window.__mp.glideTo(r.left+r.width/2, r.top+r.height/2${dur ? ", " + dur : ""}); results.push("glide_to done"); } }`;
      case "ripple": return `${d}window.__mp.ripple(); results.push("ripple done");`;
      case "think": return `${d}window.__mp.think(${JSON.stringify(s.params?.text || "")}${dur ? ", " + dur : ""}); results.push("think done");`;
      case "highlight": return `${d}{ const el = document.querySelector(${JSON.stringify(s.params?.selector || "")}); if (!el) { results.push("highlight: NOT_FOUND"); } else { const r = el.getBoundingClientRect(); await window.__mp.glideTo(r.left+r.width/2, r.top+r.height/2${dur ? ", " + dur : ""}); window.__mp.highlight(el); results.push("highlight done"); } }`;
      case "narrate": return `${d}window.__mp.narrate(${JSON.stringify(s.params?.text || "")}); results.push("narrate done");`;
      case "clear_narrate": return `${d}window.__mp.clearNarrate(); results.push("clear_narrate done");`;
      case "clear": return `${d}window.__mp.clear(); results.push("clear done");`;
      case "set_persona": return `${d}window.__mp.setPersona(${JSON.stringify(s.params?.name || "")}); results.push("set_persona done");`;
      default: return `results.push("unknown action: " + ${JSON.stringify(s.action)});`;
    }
  }).join("\n");

  const result = await evaluate(`
    (async () => {
      const results = [];
      ${stepCode}
      return JSON.stringify(results);
    })()
  `);
  if (typeof result !== "string") return [];
  const results: string[] = JSON.parse(result);

  const lastPersona = steps.filter(s => s.action === "set_persona").pop();
  if (lastPersona?.params?.name) {
    currentPersona = String(lastPersona.params.name);
  }

  return results;
}

export function isConnected(): boolean {
  return client !== null;
}

// --- Recording support ---

export async function startRecording(): Promise<void> {
  await evaluate("window.__mp && window.__mp.startRecording()");
}

export async function stopRecording(): Promise<any[]> {
  const result = await evaluate("window.__mp ? JSON.stringify(window.__mp.stopRecording()) : '[]'");
  if (typeof result !== "string") return [];
  return JSON.parse(result);
}

export async function getRecording(): Promise<any[]> {
  const result = await evaluate("window.__mp ? JSON.stringify(window.__mp.getRecording()) : '[]'");
  if (typeof result !== "string") return [];
  return JSON.parse(result);
}

export async function getCurrentUrl(): Promise<string> {
  const result = await evaluate("location.href");
  return typeof result === "string" ? result : "http://localhost:3000";
}

export interface RecordingEntry {
  t: number;
  fn: string;
  args: any[];
}

/**
 * Generate a self-contained replay script from recorded actions.
 * The output is a single .js file that:
 *   - Bundles the overlay inline (no external file dependencies)
 *   - Accepts --speed N flag for playback speed
 *   - Requires only `npm i playwright` (one-time)
 *   - Runs with `node recording.js`
 */
export function generateReplayScript(tape: RecordingEntry[], url: string, persona?: string): string {
  const overlaySource = getOverlayScript(persona || currentPersona);

  const lines: string[] = [
    `// Cursor Persona recording — generated ${new Date().toISOString()}`,
    `// Replay:  node this-file.js [--speed N]`,
    `// Example: node recording.js --speed 2`,
    `//`,
    `// Requirements: npm i playwright  (one-time)`,
    ``,
    `// --- speed flag ---`,
    `const speedIdx = process.argv.indexOf("--speed");`,
    `const SPEED = speedIdx !== -1 ? parseFloat(process.argv[speedIdx + 1]) || 1 : 1;`,
    ``,
    `// --- overlay (bundled, ${Math.round(overlaySource.length / 1024)}KB) ---`,
    `const OVERLAY_JS = ${JSON.stringify(overlaySource)};`,
    ``,
    `let chromium;`,
    `try { chromium = require("playwright").chromium; }`,
    `catch (e) {`,
    `  console.error("\\n  Playwright not found. Install it:\\n\\n    npm i playwright\\n");`,
    `  process.exit(1);`,
    `}`,
    ``,
    `(async () => {`,
    `  const browser = await chromium.launch({ headless: false, args: ['--disable-infobars'], ignoreDefaultArgs: ['--enable-automation'] });`,
    `  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });`,
    `  const page = await context.newPage();`,
    `  await page.addInitScript(OVERLAY_JS);`,
    `  await page.goto(${JSON.stringify(url)});`,
    `  await page.waitForLoadState("networkidle");`,
    `  if (SPEED !== 1) console.log("Replay speed: " + SPEED + "x");`,
    ``,
  ];

  let prevT = 0;
  for (const entry of tape) {
    const delay = entry.t - prevT;
    prevT = entry.t;
    if (delay > 50) {
      lines.push(`  await new Promise(r => setTimeout(r, ${Math.round(delay)} / SPEED));`);
    }
    const args = entry.args.map((a: any) => JSON.stringify(a)).join(", ");
    lines.push(`  await page.evaluate(() => window.__mp.${entry.fn}(${args}));`);
  }

  lines.push(``);
  lines.push(`  await new Promise(r => setTimeout(r, 2000));`);
  lines.push(`  await page.screenshot({ path: "recording-final.png" });`);
  lines.push(`  console.log("Done. Screenshot saved to recording-final.png");`);
  lines.push(`  await browser.close();`);
  lines.push(`})();`);

  return lines.join("\n");
}
