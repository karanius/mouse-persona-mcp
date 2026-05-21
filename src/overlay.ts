import { readFileSync } from "fs";
import { resolve } from "path";

const overlaySource = readFileSync(
  resolve(__dirname, "..", "overlay.js"),
  "utf-8"
);

export function getOverlayScript(persona: string = "Tester"): string {
  const safe = persona.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return overlaySource.replace("__MP_PERSONA_NAME__", safe);
}
