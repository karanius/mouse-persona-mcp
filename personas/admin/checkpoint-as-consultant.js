#!/usr/bin/env node
// Checkpoint: Reset admin@test.com as an approved consultant
//
// Login at: http://localhost:3000/auth?role=consultant
// Email: admin@test.com  |  Password: Admin1234!
//
// Clear localStorage in browser, then you'll see:
// Welcome Gate → Getting Started → Dashboard

const { execSync } = require("child_process");
const path = require("path");

console.log("=== Checkpoint: Admin as Consultant ===");

const seedScript = path.resolve(__dirname, "seed-as-consultant.py");
try {
  execSync(`docker cp ${seedScript} canadreamers-platform:/tmp/seed-as-consultant.py`, { stdio: "pipe" });
  const output = execSync(`docker exec -w /app -e PYTHONPATH=/app canadreamers-platform python3 /tmp/seed-as-consultant.py`, { encoding: "utf-8" });
  console.log(output.trim());
} catch(e) {
  console.error("Failed:", e.message);
  process.exit(1);
}

console.log("");
console.log("  Login at: http://localhost:3000/auth?role=consultant");
console.log("  Email:    admin@test.com");
console.log("  Password: Admin1234!");
console.log("");
console.log("  Clear localStorage in browser, then you'll see:");
console.log("  Welcome Gate → Getting Started → Dashboard");
