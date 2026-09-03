#!/usr/bin/env node
// gate-unverified-style.mjs — makes `unknown→verify` MEAN something.
//
// THE RULE, as it already exists in prose (velt-planner-style.md, brief-scaffold.mjs,
// dom-snapshot.mjs, velt-orchestrator.md, velt-operating-brief):
//
//   "A snapshot marked `stateUnreachable` → plan its rules anyway from the spec but tag each
//    `unknown→verify`; the judge treats them unverified, never passed."
//
// That sentence was written in five files and read by NONE. Nothing in scripts/ consumed the tag,
// so a run could plan a whole state blind, tag every rule of it honestly, and still terminate PASS.
//
// MEASURED — this is the defect that gate exists to stop. On the Harvey 651 run the thread-expanded
// states could not be driven (1 of 62 live annotations had replies, none expanded), so the planner
// correctly tagged their rules and the stylesheet even says so in a comment:
//     "STATE-UNREACHABLE ... planned unknown->verify"
// The build shipped anyway. Live, the expanded thread renders reply avatars as 32x32 SQUARES beside
// the parent card's 20px circle, because `.vc-reply-avatar` never got a rule at all — nobody ever
// rendered the state to look at it. The plugin's own maxim applies to its own rule:
// *a rule which is only prose is not implemented.*
//
// WHAT CLEARS A TAG. A tagged rule is cleared when the block it belongs to was actually reached and
// measured later in the run — i.e. block-report.json has that block with `driven: true` AND a
// deltaCompare result. Reaching the state is the whole point; a tag is a debt, and driving the state
// is how it is paid. Anything still tagged at verdict time is a rule that was authored blind and
// never checked against a rendered DOM.
//
// Usage:
//   node scripts/gate-unverified-style.mjs <phaseDir> [--json] [--warn-only]
//
// Exit codes: 0 = nothing unverified (or --warn-only), 3 = INCOMPLETE (unverified rules remain),
//             1 = usage/error.

import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const UNKNOWN_TAG = /unknown\s*(?:→|->)\s*verify/i;

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

/** Rules the style planner flagged as authored-without-a-rendered-DOM. */
function taggedRules(planStyle) {
  const rules = planStyle?.rules || [];
  return rules
    .map((r, i) => ({ ...r, _index: i }))
    .filter((r) => Array.isArray(r.tags) && r.tags.some((t) => UNKNOWN_TAG.test(String(t))));
}

/**
 * Blocks that were genuinely reached and measured.
 *
 * `driven` alone is not enough — a block can be driven and then not compared, which is exactly the
 * silent-pass shape this gate exists to close. Both must be present.
 */
function verifiedBlockIds(blockReport) {
  const blocks = blockReport?.blocks || {};
  const out = new Set();
  for (const [id, entry] of Object.entries(blocks)) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.driven === true && entry.deltaCompare) out.add(id);
  }
  return out;
}

export async function gateUnverifiedStyle(phaseDir) {
  const planStyle = await readJson(path.join(phaseDir, "plan-style.json"));
  if (!planStyle) {
    return { ok: true, reason: "no plan-style.json — nothing to gate", tagged: 0, unverified: [] };
  }
  const tagged = taggedRules(planStyle);
  if (!tagged.length) {
    return { ok: true, reason: "no rules tagged unknown→verify", tagged: 0, unverified: [] };
  }

  const blockReport = await readJson(path.join(phaseDir, "block-report.json"), {});
  const verified = verifiedBlockIds(blockReport);

  // A rule with no blockIds cannot be attributed to a state that could clear it, so it can never be
  // cleared by driving — report it rather than letting an unattributed rule slip through.
  const unverified = [];
  for (const rule of tagged) {
    const ids = Array.isArray(rule.blockIds) ? rule.blockIds : [];
    const cleared = ids.length > 0 && ids.every((id) => verified.has(id));
    if (!cleared) {
      unverified.push({
        selector: rule.selector,
        state: rule.state || "default",
        specNodeId: rule.specNodeId || null,
        blockIds: ids,
        why: ids.length === 0
          ? "rule carries no blockIds — no state can ever clear it"
          : `block(s) never driven+compared: ${ids.filter((id) => !verified.has(id)).join(", ")}`,
      });
    }
  }

  return {
    ok: unverified.length === 0,
    tagged: tagged.length,
    verifiedBlocks: [...verified],
    unverified,
    reason: unverified.length === 0
      ? `all ${tagged.length} unknown→verify rule(s) cleared by a driven+compared block`
      : `${unverified.length} of ${tagged.length} unknown→verify rule(s) were never checked against a rendered DOM`,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const phaseDir = args.find((a) => !a.startsWith("--"));
  if (!phaseDir) {
    console.error("usage: gate-unverified-style.mjs <phaseDir> [--json] [--warn-only]");
    process.exit(1);
  }
  const asJson = args.includes("--json");
  const warnOnly = args.includes("--warn-only");
  const result = await gateUnverifiedStyle(phaseDir);

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.ok) {
    console.log(`✓ unknown→verify: ${result.reason}`);
  } else {
    console.error(`✗ unknown→verify: ${result.reason}`);
    for (const u of result.unverified.slice(0, 20)) {
      console.error(`   ${u.selector}  [state: ${u.state}]  — ${u.why}`);
    }
    if (result.unverified.length > 20) {
      console.error(`   … and ${result.unverified.length - 20} more`);
    }
    console.error("");
    console.error("   These rules were authored from the Figma spec against a DOM nobody rendered.");
    console.error("   Drive the state and re-measure, or record the block BLOCKED with a note.");
  }
  process.exit(result.ok || warnOnly ? 0 : 3);
}
