import { readFileSync } from "fs";
import { resolve } from "path";

const overlaySource = readFileSync(
  resolve(__dirname, "..", "overlay.js"),
  "utf-8"
);

let config: Record<string, any> = {};
try {
  config = JSON.parse(
    readFileSync(resolve(__dirname, "..", "persona.config.json"), "utf-8")
  );
} catch {}

export function getOverlayScript(persona?: string): string {
  const name = persona || (config.persona && config.persona.name) || "Tester";
  const safe = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const configJs = "var __MP_CONFIG__ = " + JSON.stringify(config) + ";\n";
  return configJs + overlaySource.replace("__MP_PERSONA_NAME__", safe);
}
