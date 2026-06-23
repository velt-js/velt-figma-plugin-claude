#!/usr/bin/env node
// sync-guide.mjs — copy customization-guide/ -> guide/ VERBATIM (zero transformation = zero drift),
// stamp guide/guide.version, and run the self-sufficiency self-check.
// Usage: node scripts/sync-guide.mjs [--source <path>] [--check-only]

import { promises as fs } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = process.argv.slice(2);
const checkOnly = args.includes("--check-only");
const srcIdx = args.indexOf("--source");
const SRC = path.resolve(ROOT, srcIdx >= 0 ? args[srcIdx + 1] : "customization-guide");
const DEST = path.resolve(ROOT, "guide");

// Entry files that must always be present (sanity of a complete guide).
const REQUIRED = [
  "README.md",
  "02-decision-tree.md",
  "rules.md",
  "verifying-a-customization.md",
  "sdk-gaps-and-blockers.md",
  "reference/component-definitions.md",
  "reference/component-catalog.md",
];

// Self-sufficiency invariant: the guide must contain ZERO external/SDK paths.
const FORBIDDEN_PATTERNS = [
  /\bsdk-react\/src\b/,
  /\/sdk\/src\b/,
  /\/Users\//,
  /\bcomponents-map\.ts\b/,
  /node_modules/,
];

async function walk(dir, base = dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full, base)));
    else out.push(path.relative(base, full));
  }
  return out;
}

function gitSha(p) {
  try {
    return execSync(`git -C "${p}" rev-parse --short HEAD`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString().trim();
  } catch { return "nogit"; }
}

async function selfCheck(files, baseDir) {
  const problems = [];
  // 1. required entry files present
  for (const r of REQUIRED) if (!files.includes(r)) problems.push(`missing required file: ${r}`);
  // 2. zero external/SDK paths
  for (const f of files.filter((f) => f.endsWith(".md"))) {
    const text = await fs.readFile(path.join(baseDir, f), "utf8");
    for (const pat of FORBIDDEN_PATTERNS) {
      if (pat.test(text)) problems.push(`self-sufficiency violation in ${f}: matches ${pat}`);
    }
  }
  // 3. internal relative links resolve
  const set = new Set(files);
  const linkRe = /\]\((\.{1,2}\/[^)#]+\.md)(#[^)]*)?\)/g;
  for (const f of files.filter((f) => f.endsWith(".md"))) {
    const text = await fs.readFile(path.join(baseDir, f), "utf8");
    let m;
    while ((m = linkRe.exec(text))) {
      const target = path.normalize(path.join(path.dirname(f), m[1]));
      if (!set.has(target)) problems.push(`broken link in ${f} -> ${m[1]}`);
    }
  }
  return problems;
}

async function main() {
  const srcFiles = await walk(SRC);

  if (!checkOnly) {
    await fs.rm(DEST, { recursive: true, force: true });
    for (const rel of srcFiles) {
      const to = path.join(DEST, rel);
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.copyFile(path.join(SRC, rel), to);
    }
  }

  const checkDir = checkOnly ? SRC : DEST;
  const checkFiles = checkOnly ? srcFiles : await walk(DEST);
  const problems = await selfCheck(checkFiles, checkDir);

  if (problems.length) {
    console.error("✗ guide self-check FAILED:");
    for (const p of problems) console.error("  - " + p);
    process.exit(1);
  }

  if (!checkOnly) {
    let bytes = 0;
    for (const rel of srcFiles) bytes += (await fs.stat(path.join(SRC, rel))).size;
    const version = {
      sha: gitSha(SRC),
      isoTime: new Date().toISOString(),
      fileCount: srcFiles.length,
      bytes,
    };
    await fs.writeFile(path.join(DEST, "guide.version"), JSON.stringify(version, null, 2) + "\n");
    console.log(`✓ synced ${srcFiles.length} files (${bytes} bytes) -> guide/  sha=${version.sha}`);
  }
  console.log(`✓ self-check passed (${checkFiles.length} files, 0 external paths, links resolve)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
