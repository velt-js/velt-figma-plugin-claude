#!/usr/bin/env node
// validate.mjs — plugin completeness + guide integrity gate. Exits non-zero on hard failures.
// Hard fails: bad manifest, invalid .mcp.json, missing / self-check-failing guide, a non-Opus agent model.
// Warnings: component dirs (skills/agents/commands) not yet populated.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const warns = [];

const exists = async (p) => !!(await fs.stat(path.join(ROOT, p)).catch(() => null));
async function readJSON(p) {
  try { return JSON.parse(await fs.readFile(path.join(ROOT, p), "utf8")); }
  catch (e) { errors.push(`invalid JSON: ${p} (${e.message})`); return null; }
}

// 1. Manifest
const manifest = await readJSON(".claude-plugin/plugin.json");
if (manifest && !manifest.name) errors.push("plugin.json: name is required");
// version is OPTIONAL: omitting it puts the plugin on the git-SHA auto-update channel (matches
// `claude plugin validate`, which only warns). Add a semver version for stable, pinned releases.
if (manifest && !manifest.version) warns.push("plugin.json: no version — using the git-SHA channel (add a semver version for pinned releases)");

// 2. MCP config
if (await exists(".mcp.json")) await readJSON(".mcp.json");
else errors.push("missing .mcp.json");

// 3. Guide present + self-check (single source of truth — the plugin reads guide/ directly)
if (!(await exists("guide"))) errors.push("guide/ missing");
else {
  try {
    execSync(`node "${path.join(ROOT, "scripts/check-guide.mjs")}" --dir guide`, { stdio: ["ignore", "pipe", "pipe"] });
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

// 6. Agent model policy — ABSOLUTE: every agent MUST run on Opus (standing directive: Opus at max effort).
//    Not a cross-port parity check (that's check-parity.mjs) — an absolute assertion so no agent silently
//    drifts to Sonnet. Missing frontmatter, a missing model:, or any non-Opus value is a HARD failure.
const isOpusModel = (v) => v === "opus" || v.startsWith("claude-opus-");
{
  const isFence = (l) => l.trim() === "---";
  const agentFiles = (await fs.readdir(path.join(ROOT, "agents")).catch(() => [])).filter((f) => f.endsWith(".md"));
  if (!agentFiles.length) warns.push("agents/: no agent .md files to check against the Opus model policy");
  for (const f of agentFiles) {
    const rel = "agents/" + f;
    const src = await fs.readFile(path.join(ROOT, rel), "utf8").catch(() => "");
    const lines = src.split("\n");
    const first = lines.findIndex(isFence);
    const end = first >= 0 ? lines.findIndex((l, i) => i > first && isFence(l)) : -1;
    if (first !== 0 || end < 0) { errors.push(rel + ": no YAML frontmatter — cannot verify the Opus model policy"); continue; }
    const modelLine = lines.slice(first + 1, end).find((l) => l.trimStart().startsWith("model:"));
    if (!modelLine) { errors.push(rel + ": frontmatter has no model: field — every agent MUST pin an Opus model (opus or claude-opus-*)"); continue; }
    let model = modelLine.slice(modelLine.indexOf(":") + 1).trim();
    if ((model.startsWith('"') && model.endsWith('"')) || (model.startsWith("'") && model.endsWith("'"))) model = model.slice(1, -1);
    if (!isOpusModel(model)) errors.push(rel + ': model "' + model + '" is NOT Opus — the standing directive pins ALL agents to Opus at max effort (use opus or claude-opus-*); do not downgrade.');
  }
}

for (const w of warns) console.warn("⚠ " + w);
if (errors.length) { for (const e of errors) console.error("✗ " + e); process.exit(1); }
console.log(`✓ validate passed${warns.length ? ` (${warns.length} warning${warns.length > 1 ? "s" : ""})` : ""}`);
