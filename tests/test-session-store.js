#!/usr/bin/env node
/**
 * Unit tests for session-store.js
 * Run: node tests/test-session-store.js
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { saveSession, loadLastSession } = require("../personas/session-store");

let passed = 0;
let failed = 0;

function assert(name, condition) {
  if (condition) { console.log(`  ✓ ${name}`); passed++; }
  else { console.log(`  ✗ ${name}`); failed++; }
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "session-test-"));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

const SAMPLE_SESSION = {
  persona: { name: "Chris Daw", role: "RCIC" },
  narrator: { audience: "Product team" },
  scenes: [
    { ts: "2026-05-24T04:00:00Z", url: "http://localhost:3000", dsl: '@ Test\n"3 Hello', tape: [] },
    { ts: "2026-05-24T04:01:00Z", url: "http://localhost:3000/settings", dsl: '@ Settings\n"3 Real data', tape: [] },
  ],
  startedAt: "2026-05-24T04:00:00Z",
};

// ── Test 1: loadLastSession returns null when no file exists ──
console.log("\n[1] loadLastSession — no file");
{
  const dir = makeTempDir();
  const result = loadLastSession(dir);
  assert("Returns null when no file", result === null);
  cleanup(dir);
}

// ── Test 2: saveSession creates last-session.json ──
console.log("\n[2] saveSession — creates last-session.json");
{
  const dir = makeTempDir();
  saveSession(dir, SAMPLE_SESSION);
  const lastPath = path.join(dir, "last-session.json");
  assert("last-session.json exists", fs.existsSync(lastPath));
  const data = JSON.parse(fs.readFileSync(lastPath, "utf-8"));
  assert("Contains persona name", data.persona.name === "Chris Daw");
  assert("Contains 2 scenes", data.scenes.length === 2);
  assert("Contains startedAt", data.startedAt === "2026-05-24T04:00:00Z");
  cleanup(dir);
}

// ── Test 3: saveSession creates sessions/ directory with timestamped file ──
console.log("\n[3] saveSession — creates sessions/{timestamp}.json");
{
  const dir = makeTempDir();
  saveSession(dir, SAMPLE_SESSION);
  const sessionsDir = path.join(dir, "sessions");
  assert("sessions/ directory exists", fs.existsSync(sessionsDir));
  const files = fs.readdirSync(sessionsDir);
  assert("One history file created", files.length === 1);
  assert("Filename is .json", files[0].endsWith(".json"));
  const historyData = JSON.parse(fs.readFileSync(path.join(sessionsDir, files[0]), "utf-8"));
  assert("History matches session data", historyData.persona.name === "Chris Daw");
  cleanup(dir);
}

// ── Test 4: loadLastSession returns saved data ──
console.log("\n[4] loadLastSession — round-trip");
{
  const dir = makeTempDir();
  saveSession(dir, SAMPLE_SESSION);
  const loaded = loadLastSession(dir);
  assert("Loaded is not null", loaded !== null);
  assert("Persona matches", loaded.persona.name === "Chris Daw");
  assert("Scenes match", loaded.scenes.length === 2);
  assert("Scene DSL preserved", loaded.scenes[0].dsl.includes("Hello"));
  cleanup(dir);
}

// ── Test 5: saveSession overwrites last-session.json ──
console.log("\n[5] saveSession — overwrites last-session.json");
{
  const dir = makeTempDir();
  saveSession(dir, SAMPLE_SESSION);
  const updated = { ...SAMPLE_SESSION, scenes: [{ ts: "2026-05-24T05:00:00Z", url: "http://localhost:3000", dsl: "@ Updated", tape: [] }] };
  saveSession(dir, updated);
  const loaded = loadLastSession(dir);
  assert("Overwritten to 1 scene", loaded.scenes.length === 1);
  assert("New DSL present", loaded.scenes[0].dsl === "@ Updated");
  cleanup(dir);
}

// ── Test 6: saveSession accumulates history files ──
console.log("\n[6] saveSession — accumulates history");
{
  const dir = makeTempDir();
  saveSession(dir, SAMPLE_SESSION);
  // Small delay so timestamp differs
  const t = Date.now(); while (Date.now() - t < 1100) {} // wait >1s for unique timestamp
  saveSession(dir, { ...SAMPLE_SESSION, startedAt: "2026-05-24T05:00:00Z" });
  const files = fs.readdirSync(path.join(dir, "sessions"));
  assert("Two history files", files.length === 2);
  assert("Files have different names", files[0] !== files[1]);
  cleanup(dir);
}

// ── Test 7: loadLastSession handles corrupt JSON ──
console.log("\n[7] loadLastSession — corrupt JSON");
{
  const dir = makeTempDir();
  fs.writeFileSync(path.join(dir, "last-session.json"), "not json{{{");
  const result = loadLastSession(dir);
  assert("Returns null on corrupt JSON", result === null);
  cleanup(dir);
}

// ── Summary ──
console.log(`\n${"=".repeat(40)}`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(40)}`);
process.exit(failed > 0 ? 1 : 0);
