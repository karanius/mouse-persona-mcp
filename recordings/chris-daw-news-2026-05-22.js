#!/usr/bin/env node
// Cursor Persona Recording — Chris Daw
// Generated: 2026-05-22
// Replay: node this-file.js

const fs = require("fs");
const path = require("path");
let chromium;
try { chromium = require("playwright").chromium; }
catch { console.error("npm i playwright"); process.exit(1); }

const HUMAN = process.argv.includes("--no-human") ? 0 : 7000;
const OVERLAY = path.resolve(__dirname, "..", "overlay.js");
const PERSONA = "Chris Daw";

const SCENES = [
  {
    name: "Scene 1",
    dsl: "> RCIC reviews immigration news — policy changes drive platform value\n@ Americans\n\" Every time there is political chaos down south, my phone rings.\n~ 500\n@ Express Entry\n\" If this review is real, it could reshape how I advise every client.\n~ 500\n@ citizenship\n\" They will be disappointed when they learn about Canadian tax obligations.\n."
  }
];

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-infobars"],
    ignoreDefaultArgs: ["--enable-automation", "--disable-blink-features=AutomationControlled"]
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    storageState: { cookies: [], origins: [] }
  });
  const page = await context.newPage();
  const overlay = fs.readFileSync(OVERLAY, "utf-8").replace("__MP_PERSONA_NAME__", PERSONA);
  await page.addInitScript(overlay);
  await page.goto("https://news.google.com/search?q=canada%20immigration&hl=en-US&gl=US&ceid=US%3Aen");
  await page.waitForLoadState("networkidle");
  await page.evaluate(([p,h]) => { window.__mp.setPersona(p); window.__mp.setHuman(h); }, [PERSONA, HUMAN]);

  for (let i = 0; i < SCENES.length; i++) {
    console.log("  " + SCENES[i].name);
    await page.evaluate(([h,s]) => { window.__mp.setHuman(h); return window.__mp.x(s); }, [HUMAN, SCENES[i].dsl]);
    await new Promise(r => setTimeout(r, 500));
  }

  console.log("Done.");
  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
})();
