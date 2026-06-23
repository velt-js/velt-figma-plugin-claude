#!/usr/bin/env node
// run-golden.mjs — the golden regression guard.
//
// OFFLINE (runs here, no browser): for each expected fixture, assert the design's
// surface + every identifier the golden build relies on STILL EXISTS in the bundled guide.
// This catches the failure mode where the guide evolves and silently breaks the golden
// expectations (R10 / drift guard) — without needing a live app.
//
// E2E (manual / CI, needs the live env): the checklist printed at the end — run the
// playground, run /velt-customize against a Figma frame replicating each design, and
// assert the Judge reaches the expected verdict with a clean rules scan.

import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const GUIDE = path.join(ROOT, "guide");
const EXPECTED_DIR = path.join(ROOT, "golden", "expected");

async function guideText() {
  // concatenate all guide/reference + key guide pages once, for fast substring checks
  const files = [];
  async function walk(d) {
    for (const e of await fs.readdir(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.name.endsWith(".md")) files.push(full);
    }
  }
  await walk(GUIDE);
  return (await Promise.all(files.map((f) => fs.readFile(f, "utf8")))).join("\n");
}

async function main() {
  const text = await guideText();
  const catalog = await fs.readFile(path.join(GUIDE, "reference", "component-catalog.md"), "utf8");
  const fixtures = (await fs.readdir(EXPECTED_DIR)).filter((f) => f.endsWith(".expected.json"));

  let failed = 0;
  for (const file of fixtures) {
    const exp = JSON.parse(await fs.readFile(path.join(EXPECTED_DIR, file), "utf8"));
    const problems = [];

    if (!catalog.includes(exp.surface)) problems.push(`surface not in component-catalog: ${exp.surface}`);
    if (!["css", "wireframe", "primitive", "headless", "mixed"].includes(exp.layer))
      problems.push(`invalid layer: ${exp.layer}`);
    for (const id of exp.identifiers || []) {
      if (!text.includes(id)) problems.push(`identifier not found in guide (R10 drift!): ${id}`);
    }

    if (problems.length) {
      failed++;
      console.error(`✗ ${exp.design}`);
      for (const p of problems) console.error("    - " + p);
    } else {
      console.log(`✓ ${exp.design} — surface + ${exp.identifiers.length} identifiers verified in guide (expect ${exp.expectedVerdict})`);
    }
  }

  console.log("\n--- E2E checklist (run with the live plugin + Chrome + the playground) ---");
  console.log("  1. In sdk/: `npx ng serve --port 4200` → http://localhost:4200 (the golden playground).");
  console.log("  2. Install this plugin; connect figma-desktop + claude-in-chrome MCPs.");
  console.log("  3. /velt-customize against a Figma frame replicating each golden design.");
  console.log("  4. At the coverage gate, confirm the recommended layer (wireframe for both).");
  console.log("  5. Assert: Judge verdict == expectedVerdict (PASS) with evidence, and a clean rules scan.");
  console.log("  6. Assert: the playground still reproduces both designs (visual regression of the loop itself).");

  if (failed) { console.error(`\n✗ golden offline guard FAILED for ${failed} design(s)`); process.exit(1); }
  console.log(`\n✓ golden offline guard passed (${fixtures.length} designs; all identifiers still valid in the guide)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
