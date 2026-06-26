#!/usr/bin/env node
// verdict-gate-blocks.mjs — the MECHANICAL terminator for the block-by-block loop. Given blocks.json
// (the Figma-derived completeness oracle) and block-report.json (the Judge's per-block dispositions),
// decides PASS / FAIL / INCOMPLETE by EXIT CODE — no agent say-so, no /goal opinion.
//
// The whole point (BLOCK-BY-BLOCK-REDESIGN-PLAN.md §1, §9): a run that builds 5 of 16 blocks, or skips
// a block's state, or has no visual-diff artifact for a block, is INCOMPLETE → CANNOT terminate. So
// "stopped at the happy path" is structurally unreachable: every Figma frame is an accounted block.
//
// block-report.json shape (the Judge writes one entry per built block):
//   { blocks: { "<blockId>": {
//       built: true,
//       driven: true,                              // drive.assert matched in the live DOM
//       capturePng: "...", framePng: "...",        // evidence on disk
//       visualDiff: { diffPct, regions: [ {cssBox, changed, fill}, ... ] },  // from visual-diff.mjs
//       deltaCompare: { ok: true, diffs: [] }      // from delta-compare.mjs (exact style/box/colour)
//   } } }
//
// Usage: node scripts/verdict-gate-blocks.mjs --blocks blocks.json --report block-report.json
//        [--max-region-fill 0.05]   # regions at/above this fill are "real" structural diffs ⇒ FAIL
//
// Exit codes: 0 = PASS, 2 = FAIL, 3 = INCOMPLETE, 1 = usage/error.

import { promises as fs } from "node:fs";

const STATUS_EXIT = { PASS: 0, FAIL: 2, INCOMPLETE: 3 };

export function verdictGateBlocks(blocks, report, { maxRegionFill = 0.05 } = {}) {
  const missing = [];   // coverage / artifact gaps ⇒ INCOMPLETE (cannot terminate)
  const failures = [];  // built + measured but wrong ⇒ FAIL
  const reps = (report && report.blocks) || {};
  const list = blocks.blocks || [];

  for (const b of list) {
    const r = reps[b.id];
    if (!r) { missing.push(`block '${b.id}' (${b.state}) has no report entry — not built`); continue; }
    if (!r.built) { missing.push(`block '${b.id}' not built`); continue; }
    if (!r.driven) { missing.push(`block '${b.id}' state '${b.state}' not driven (drive.assert never matched)`); continue; }
    if (!r.visualDiff || typeof r.visualDiff.diffPct !== "number") { missing.push(`block '${b.id}' has no visual-diff artifact`); continue; }
    if (!r.deltaCompare || typeof r.deltaCompare.ok !== "boolean") { missing.push(`block '${b.id}' has no delta-compare result`); continue; }

    // measured-but-wrong → FAIL. Visual: any SIGNIFICANT region (fill >= threshold = a real structural
    // diff, not 1px drift). Delta: the exact style/box/colour gate must be ok.
    const sig = (r.visualDiff.regions || []).filter((reg) => (reg.fill ?? 1) >= maxRegionFill);
    for (const reg of sig) failures.push(`block '${b.id}': visual diff at ${reg.cssBox || JSON.stringify(reg)} (fill ${reg.fill})`);
    if (!r.deltaCompare.ok) for (const d of (r.deltaCompare.diffs || [{ note: "delta-compare FAIL" }]).slice(0, 6))
      failures.push(`block '${b.id}': ${d.element || ""} ${d.property || ""} ${d.note || ""}`.trim());
  }

  const covered = list.length - missing.filter((m) => m.startsWith("block ") && /not built|no report/.test(m)).length;
  const coverage = list.length ? Math.round(100 * covered / list.length) : 100;
  if (missing.length) return { verdict: "INCOMPLETE", coverage, missing, failures, note: "coverage/artifacts incomplete — a partial build is NOT a pass" };
  if (failures.length) return { verdict: "FAIL", coverage: 100, missing: [], failures };
  return { verdict: "PASS", coverage: 100, missing: [], failures: [] };
}

async function main() {
  const a = process.argv.slice(2);
  const argv = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  const bp = argv("--blocks"), rp = argv("--report"), fill = +argv("--max-region-fill", "0.05");
  if (!bp || !rp) { console.error("usage: verdict-gate-blocks.mjs --blocks <blocks.json> --report <block-report.json> [--max-region-fill 0.05]"); process.exit(1); }
  const blocks = JSON.parse(await fs.readFile(bp, "utf8"));
  const report = JSON.parse(await fs.readFile(rp, "utf8"));
  const r = verdictGateBlocks(blocks, report, { maxRegionFill: fill });
  console.log(`VERDICT: ${r.verdict}  (block coverage ${r.coverage}% of ${(blocks.blocks || []).length})`);
  if (r.missing.length) { console.log("  INCOMPLETE — not built / not driven / artifacts missing:"); for (const m of r.missing.slice(0, 24)) console.log("    · " + m); }
  if (r.failures.length) { console.log("  FAIL — built but does not match:"); for (const f of r.failures.slice(0, 24)) console.log("    · " + f); }
  process.exit(STATUS_EXIT[r.verdict]);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error("✗ " + e.message); process.exit(1); });
