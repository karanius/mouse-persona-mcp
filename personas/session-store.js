const fs = require("fs");
const path = require("path");

function saveSession(personaDir, sessionData) {
  const lastPath = path.join(personaDir, "last-session.json");
  fs.writeFileSync(lastPath, JSON.stringify(sessionData, null, 2));

  const sessionsDir = path.join(personaDir, "sessions");
  if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir);
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  fs.writeFileSync(path.join(sessionsDir, `${ts}.json`), JSON.stringify(sessionData, null, 2));
}

function loadLastSession(personaDir) {
  const lastPath = path.join(personaDir, "last-session.json");
  if (!fs.existsSync(lastPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(lastPath, "utf-8"));
  } catch {
    return null;
  }
}

module.exports = { saveSession, loadLastSession };
