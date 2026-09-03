#!/usr/bin/env node
// gate-state-coverage.mjs — says OUT LOUD, before the style stage, how much of the design the live
// data can actually reach.
//
// THE GAP THIS CLOSES. Nothing in the pipeline compared the states the DESIGN defines against the
// states the DOCUMENT can produce. So a run could be structurally blocked from ever seeing most of
// its own target and still proceed to a verdict, styling the rest from Figma values against a DOM
// it never rendered.
//
// MEASURED, Harvey 651. The design draws EIGHT thread-card states. The seeded document produced
// exactly TWO — `default` x62 and `collapsed` x1. Zero unread, zero private, one thread with
// replies, none expanded. Six of eight states were authored blind. The run knew: it wrote
// "STATE-UNREACHABLE" into the stylesheet four separate times, and had no way to act on it.
//
// This gate does not fail a run for thin data — seeding is an operator act, not a code fix. It
// reports the shortfall with the block ids, so the choice is deliberate: seed the document and
// re-snapshot, or accept the states as BLOCKED with a note. What it removes is the third option —
// not noticing.
//
// Usage:
//   node scripts/gate-state-coverage.mjs <phaseDir> [--min <pct>] [--json]
//
// Exit codes: 0 = coverage at/above --min (default: report-only, always 0),
//             3 = below --min when one is given, 1 = usage/error.

import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function readJson(file, fallback = null) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return fallback; }
}

export async function gateStateCoverage(phaseDir) {
  const blocks = await readJson(path.join(phaseDir, "blocks.json"));
  const designed = (blocks?.blocks || []).map((b) => ({ id: b.id, name: b.name || b.id }));
  if (!designed.length) {
    return { ok: true, reason: "blocks.json has no blocks — nothing to measure", designed: 0, reached: 0, coverage: 100, unreachable: [] };
  }

  const snapDir = path.join(phaseDir, "dom-snapshot");
  const files = (await fs.readdir(snapDir).catch(() => [])).filter((f) => f.endsWith(".json"));
  const byBlock = new Map();
  for (const f of files) {
    const snap = await readJson(path.join(snapDir, f));
    if (!snap) continue;
    const id = snap.blockId || f.replace(/\.json$/, "");
    byBlock.set(id, snap);
  }

  const unreachable = [];
  let reached = 0;
  for (const block of designed) {
    const snap = byBlock.get(block.id);
    // No snapshot at all is the same failure as an explicit stateUnreachable: the state was never
    // rendered, so anything styled for it is guesswork either way.
    if (!snap) { unreachable.push({ ...block, why: "no dom-snapshot — the state was never captured" }); continue; }
    if (snap.stateUnreachable === true) { unreachable.push({ ...block, why: snap.reason || "snapshot recorded stateUnreachable — the drive could not produce it" }); continue; }
    if (snap.driven === false) { unreachable.push({ ...block, why: "snapshot exists but the state was never driven" }); continue; }
    reached++;
  }

  const coverage = Math.round((reached / designed.length) * 100);
  return {
    ok: true,
    designed: designed.length,
    reached,
    coverage,
    unreachable,
    reason: unreachable.length === 0
      ? `all ${designed.length} designed state(s) reachable in the live data`
      : `${reached} of ${designed.length} designed states reachable (${coverage}%) — ${unreachable.length} cannot be produced by this document`,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const phaseDir = args.find((a) => !a.startsWith("--"));
  if (!phaseDir) { console.error("usage: gate-state-coverage.mjs <phaseDir> [--min <pct>] [--json]"); process.exit(1); }
  const minIdx = args.indexOf("--min");
  const min = minIdx >= 0 ? Number(args[minIdx + 1]) : null;
  const result = await gateStateCoverage(phaseDir);

  if (args.includes("--json")) { console.log(JSON.stringify(result, null, 2)); }
  else {
    const mark = result.unreachable.length ? "!" : "✓";
    console.log(`${mark} state coverage: ${result.reason}`);
    for (const u of result.unreachable.slice(0, 20)) console.log(`   · ${u.id} — ${u.why}`);
    if (result.unreachable.length > 20) console.log(`   … and ${result.unreachable.length - 20} more`);
    if (result.unreachable.length) {
      console.log("");
      console.log("   These states will be styled from the Figma spec alone, against a DOM nobody rendered.");
      console.log("   Seed the document so the data can produce them (an unread comment, a private one, a");
      console.log("   multi-reply thread), or account each block BLOCKED with a note before the verdict.");
    }
  }
  const below = Number.isFinite(min) && result.coverage < min;
  if (below) console.error(`✗ coverage ${result.coverage}% is below --min ${min}%`);
  process.exit(below ? 3 : 0);
}
