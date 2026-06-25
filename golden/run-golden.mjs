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
import { compareDecls, verdictOf } from "../scripts/delta-compare.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const GUIDE = path.join(ROOT, "guide");
const EXPECTED_DIR = path.join(ROOT, "golden", "expected");
const CALIB_DIR = path.join(ROOT, "golden", "calibration");

// Calibrate the measurement Judge engine: a known-GOOD render (vs the velt-harvey-demo spec)
// must PASS, a known-BAD render must FAIL with named diffs. Proves the delta engine is strict.
async function calibrateJudge() {
  const spec = JSON.parse(await fs.readFile(path.join(CALIB_DIR, "spec.json"), "utf8"));
  const run = async (file) => {
    const rendered = JSON.parse(await fs.readFile(path.join(CALIB_DIR, file), "utf8"));
    const els = spec.map((s, i) => ({
      name: s.name,
      present: rendered[i]?.present !== false,
      table: rendered[i]?.present === false ? [] : compareDecls(s.expected, rendered[i].rendered || {}),
    }));
    return verdictOf(els);
  };
  const good = await run("rendered-good.json");
  const bad = await run("rendered-bad.json");
  const problems = [];
  if (good.verdict !== "PASS") problems.push(`known-GOOD render should PASS but got ${good.verdict}: ${JSON.stringify(good.diffs)}`);
  if (bad.verdict !== "FAIL") problems.push(`known-BAD render should FAIL but got ${bad.verdict}`);
  if (bad.diffs.length < 3) problems.push(`known-BAD render should surface multiple named diffs, got ${bad.diffs.length}`);
  if (problems.length) { for (const p of problems) console.error("  ✗ judge-calibration: " + p); return false; }
  console.log(`✓ Judge engine calibrated — GOOD render PASSes; BAD render FAILs with ${bad.diffs.length} named diffs (${bad.diffs.map((d) => d.element + "/" + d.property).slice(0, 4).join(", ")}…)`);
  return true;
}

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
  console.log("  1. Serve the target app; connect figma-desktop + claude-in-chrome MCPs.");
  console.log("  2. (optional) `node scripts/figma-extract.mjs token status` — REST extraction if a token is set, else MCP fallback.");
  console.log("  3. /velt-customize against the Figma frame → Planner EXTRACTS a designSpec + emits a Connect Map.");
  console.log("  4. At the coverage gate, confirm the recommended layer (wireframe).");
  console.log("  5. Build executes the Connect Map: every mustSupply slot supplied (icons from exported SVGs), host props set, exact cssDecls applied.");
  console.log("  6. Judge MEASURES: per-element delta tables vs the designSpec (ΔE<2, ±1px) — PASS only when empty across all states + mustSupply/icon gates pass.");
  console.log("  7. Acceptance: re-running on harvey-playground reproduces the velt-harvey-demo shape (3 wireframe components + icons/ + host props) and every one of the 16 items in PLUGIN-RUN-GAP-ANALYSIS.md now passes.");

  const calibrated = await calibrateJudge();
  if (!calibrated) failed++;

  if (failed) { console.error(`\n✗ golden offline guard FAILED for ${failed} check(s)`); process.exit(1); }
  console.log(`\n✓ golden offline guard passed (${fixtures.length} designs + Judge calibration; all identifiers valid in the guide)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
