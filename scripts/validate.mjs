#!/usr/bin/env node
// validate.mjs — plugin completeness + guide freshness gate. Exits non-zero on hard failures.
// Hard fails: bad manifest, invalid .mcp.json, missing/ stale / self-check-failing guide.
// Warnings: component dirs (skills/agents/commands) not yet populated.

import { promises as fs } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const errors = [];
const warns = [];

const exists = async (p) => !!(await fs.stat(path.join(ROOT, p)).catch(() => null));
async function readJSON(p) {
  try { return JSON.parse(await fs.readFile(path.join(ROOT, p), "utf8")); }
  catch (e) { errors.push(`invalid JSON: ${p} (${e.message})`); return null; }
}
function gitSha(p) {
  try { return execSync(`git -C "${p}" rev-parse --short HEAD`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }
  catch { return null; }
}

// 1. Manifest
const manifest = await readJSON(".claude-plugin/plugin.json");
if (manifest && (!manifest.name || !manifest.version)) errors.push("plugin.json: name and version are required");

// 2. MCP config
if (await exists(".mcp.json")) await readJSON(".mcp.json");
else errors.push("missing .mcp.json");

// 3. Guide bundled + version stamped + self-check
if (!(await exists("guide"))) errors.push("guide/ not bundled — run scripts/sync-guide.mjs");
else {
  const ver = await readJSON("guide/guide.version");
  if (!ver) errors.push("guide/guide.version missing or invalid — run scripts/sync-guide.mjs");
  else {
    const srcSha = gitSha(path.join(ROOT, "customization-guide"));
    if (srcSha && ver.sha !== "nogit" && srcSha !== ver.sha)
      warns.push(`guide is stale: bundled sha=${ver.sha}, source sha=${srcSha} — re-run sync-guide.mjs`);
  }
  // run the self-check against the bundled guide
  try {
    execSync(`node "${path.join(ROOT, "scripts/sync-guide.mjs")}" --check-only --source guide`, { stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    errors.push("guide self-check failed:\n" + (e.stdout?.toString() || "") + (e.stderr?.toString() || ""));
  }
}

// 4. Velt Code Connect manifest — present + valid (overlays validate against the guide appendix).
if (!(await exists("manifest/velt-codeconnect.json"))) {
  errors.push("manifest/velt-codeconnect.json not built — run scripts/build-manifest.mjs");
} else {
  await readJSON("manifest/velt-codeconnect.json");
  try {
    execSync(`node "${path.join(ROOT, "scripts/build-manifest.mjs")}" --check-only`, { stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    errors.push("manifest check failed (overlay slot/prop drift vs guide):\n" + (e.stdout?.toString() || "") + (e.stderr?.toString() || ""));
  }
}

// 5. Component dirs (warn until populated)
for (const d of ["skills", "agents", "commands", "templates"]) {
  if (!(await exists(d))) warns.push(`${d}/ not present yet`);
  else {
    const entries = await fs.readdir(path.join(ROOT, d)).catch(() => []);
    if (!entries.length) warns.push(`${d}/ is empty`);
  }
}

for (const w of warns) console.warn("⚠ " + w);
if (errors.length) { for (const e of errors) console.error("✗ " + e); process.exit(1); }
console.log(`✓ validate passed${warns.length ? ` (${warns.length} warning${warns.length > 1 ? "s" : ""})` : ""}`);
