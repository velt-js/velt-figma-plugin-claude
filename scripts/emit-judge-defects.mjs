#!/usr/bin/env node
// emit-judge-defects.mjs — mechanical Judge work-order assembler.
//
// Reads results/<block>/delta.json (+ contract/smoke) and emits judge-defects.json where EVERY
// measured FAIL is either:
//   - builder-error (actionable),
//   - plan-error(structure|style) (replan ticket),
//   - noise (explicit ledger with reason),
// Ban: diffCount>0 with actionableForBuilder+routeToPlanner==0 and empty noise ledger.
//
// Also dedupes by issueKey across blocks (icon w/h × N → one root order with affectedBlocks[]).
//
// Usage: node scripts/emit-judge-defects.mjs <phaseDir> [--write]
// Exit 0 always writes analysis to stdout; --write persists <phaseDir>/judge-defects.json

import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Layout-only props that are noise on flattenable wrappers / text leaves. */
const LAYOUT_ONLY_PROPS = new Set([
  "align-self", "align-content", "align-items", "justify-content", "justify-items", "justify-self",
  "display", "flex", "flex-grow", "flex-shrink", "flex-basis", "flex-wrap",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "width", "height", "min-width", "min-height", "max-width", "max-height",
]);

// Props that must NEVER be silenced as layout-frame / text-layout noise
const NEVER_NOISE = new Set([
  "content-height", "element-count", "text", "gap", "gap.y", "gap.x",
  "background", "background-color", "border", "border-radius", "box-shadow",
  "opacity", "font-size", "font-family", "font-weight", "color",
  "flex-direction", "(present)", "line-height", "letter-spacing",
]);

export function issueKey(diff) {
  const el = String(diff.element || "").toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
  const prop = String(diff.property || "").toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
  // Collapse width+height on same element into one key
  const p = prop === "box.w" || prop === "width" || prop === "box.h" || prop === "height"
    ? "size" : prop;
  // Avatar/initials cluster into one plan-error root
  if (/^(avatar|initials)\b/.test(el)) return `avatar-initials.${p === "size" ? "size" : "render"}`;
  return `${el}.${p}`;
}

export function classifyDiff(diff, elementMeta = {}) {
  const prop = String(diff.property || "");
  const el = String(diff.element || "");
  const note = String(diff.note || diff.delta || "");
  const nodeKind = elementMeta.nodeKind || "";
  const base = prop.split(".")[0];

  if (prop === "text" || /placeholder|visible text/i.test(note)) {
    return { attribution: "builder-error", KIND: "pixel", reason: "visible text / placeholder" };
  }
  if (el === "(gross)" || prop === "content-height" || prop === "element-count") {
    return { attribution: "builder-error", KIND: "pixel", reason: "gross density / count" };
  }
  if (/selector-binding|probe.?bind|misbind|::before|caret/i.test(note + el + prop)) {
    return { attribution: "plan-error(style)", KIND: "pixel", reason: "probe binding" };
  }
  // Avatar/initials are SDK-rendered (::before / component internals) — Builder CSS rarely owns them.
  if (/^(avatar|initials)\b/i.test(el)) {
    return { attribution: "plan-error(style)", KIND: "pixel", reason: "avatar/initials SDK binding" };
  }
  if (prop === "flex-direction" && /column|row/i.test(note + String(diff.spec) + String(diff.rendered))) {
    return { attribution: "builder-error", KIND: "pixel", reason: "flex-direction row≠column" };
  }
  if (NEVER_NOISE.has(prop) || NEVER_NOISE.has(base)) {
    return { attribution: "builder-error", KIND: "pixel", reason: "gated style/box/gap" };
  }
  // layout-frame: geometry-only wrapper props → noise ledger (not silent drop)
  if (nodeKind === "layout-frame") {
    if (LAYOUT_ONLY_PROPS.has(prop) || /^box\./.test(prop)) {
      return { attribution: "noise", KIND: "pixel", reason: "layout-frame wrapper flatten (geometry-only prop)" };
    }
  }
  // text leaves: Figma often dumps flex/align onto text runs — not Builder-actionable paint
  if (nodeKind === "text" && (LAYOUT_ONLY_PROPS.has(prop) || /^box\./.test(prop))) {
    return { attribution: "noise", KIND: "pixel", reason: "layout prop on text leaf (unattributable)" };
  }
  return { attribution: "builder-error", KIND: "pixel", reason: "default measured fail" };
}

async function loadJson(p) {
  try { return JSON.parse(await fs.readFile(p, "utf8")); } catch { return null; }
}

async function main() {
  const [phaseDir, ...rest] = process.argv.slice(2);
  if (!phaseDir) { console.error("usage: emit-judge-defects.mjs <phaseDir> [--write]"); process.exit(1); }
  const write = rest.includes("--write");
  const resultsDir = path.join(phaseDir, "results");
  const briefsDir = path.join(phaseDir, "briefs");
  const blocks = await loadJson(path.join(phaseDir, "blocks.json")) || { blocks: [] };
  const outBlocks = {};
  const issueIndex = new Map(); // issueKey → {…, affectedBlocks:[]}
  let smokeDefects = [];

  for (const b of blocks.blocks || []) {
    const bid = b.id;
    const delta = await loadJson(path.join(resultsDir, bid, "delta.json"));
    const contract = await loadJson(path.join(resultsDir, bid, "contract.json"));
    const brief = await loadJson(path.join(briefsDir, `${bid}.probes.json`))
      || await loadJson(path.join(briefsDir, `${bid}.json`));
    const metaByName = Object.fromEntries((brief?.browser?.elements || []).map((e) => [e.name, e]));
    const diffs = delta?.diffs || [];
    const defectRows = [];
    const noiseLedger = [];

    for (const d of diffs) {
      const cls = classifyDiff(d, metaByName[d.element] || {});
      const key = issueKey(d);
      const row = {
        block: bid,
        element: d.element,
        property: d.property,
        spec: d.spec,
        rendered: d.rendered,
        delta: d.note || d.delta || "",
        KIND: cls.KIND,
        attribution: cls.attribution,
        issueKey: key,
        pass: false,
      };
      if (cls.attribution === "noise") {
        noiseLedger.push({ ...row, noiseReason: cls.reason });
        continue;
      }
      defectRows.push(row);
      if (!issueIndex.has(key)) {
        issueIndex.set(key, { issueKey: key, ...row, affectedBlocks: [bid], rootCause: cls.reason });
      } else {
        const g = issueIndex.get(key);
        if (!g.affectedBlocks.includes(bid)) g.affectedBlocks.push(bid);
      }
    }

    // Contract MISSING / CONTAINMENT failures
    for (const v of contract?.violations || contract?.diffs || []) {
      const kind = v.kind || "contract";
      const row = {
        block: bid,
        element: v.part || v.selector || "contract",
        property: kind,
        spec: v.requiredAncestor || "present",
        rendered: kind,
        delta: v.note || "",
        KIND: "pixel",
        attribution: /containment|ancestor|cardinality|phantom/i.test(kind) ? "builder-error" : "builder-error",
        issueKey: `contract.${v.part || kind}`,
        pass: false,
      };
      defectRows.push(row);
    }

    const builderRows = defectRows.filter((r) => r.attribution === "builder-error");
    const planRows = defectRows.filter((r) => /^plan-error/.test(r.attribution));
    const silent = (delta && delta.ok === false && diffs.length && !builderRows.length && !planRows.length && !noiseLedger.length);

    outBlocks[bid] = {
      deltaOk: delta ? !!delta.ok : null,
      diffCount: diffs.length,
      defectRows,
      noiseLedger,
      actionableForBuilder: builderRows.length,
      routeToPlanner: planRows.length,
      ...(silent ? { note: "ILLEGAL silent drop prevented — classify residuals" } : {}),
      ...(noiseLedger.length && !builderRows.length && !planRows.length
        ? { note: `all ${noiseLedger.length} residual(s) in noise ledger (layout-frame / collision)` }
        : {}),
    };
  }

  // Smoke defects
  const smokeDir = path.join(resultsDir, "smoke");
  for (const fam of blocks.families || []) {
    const smoke = await loadJson(path.join(smokeDir, `${fam.id}.json`));
    if (!smoke || smoke.ok) continue;
    const failedSteps = (smoke.steps || []).filter((s) => s && s.ok === false);
    for (const step of failedSteps) {
      smokeDefects.push({
        family: fam.id,
        element: step.selector || step.element || step.name,
        property: "interaction",
        spec: "smoke step succeeds",
        rendered: step.error || step.rendered || "failed",
        KIND: /hover/i.test(String(step.name || "") + String(step.error || "")) ? "hover" : "click",
        attribution: "builder-error",
        smokeStep: step.name,
        issueKey: `smoke.${fam.id}.${step.name}`,
        causePacket: step.causePacket || null,
      });
    }
  }

  const totals = {
    builder: Object.values(outBlocks).reduce((n, b) => n + b.actionableForBuilder, 0) + smokeDefects.filter((s) => s.attribution === "builder-error").length,
    plan: Object.values(outBlocks).reduce((n, b) => n + b.routeToPlanner, 0),
    noise: Object.values(outBlocks).reduce((n, b) => n + (b.noiseLedger?.length || 0), 0),
    uniqueIssues: issueIndex.size,
  };

  // Ban silent drop at document level
  const illegalSilent = Object.entries(outBlocks).filter(([, b]) => b.diffCount > 0 && b.actionableForBuilder + b.routeToPlanner === 0 && !(b.noiseLedger || []).length);
  if (illegalSilent.length) {
    totals.illegalSilentBlocks = illegalSilent.map(([k]) => k);
  }

  const doc = {
    stage: "judge",
    run: path.basename(phaseDir),
    generatedAt: new Date().toISOString(),
    emitter: "emit-judge-defects.mjs",
    notes: [
      "Every delta FAIL is builder-error, plan-error(*), or noise-ledger — silent drop banned.",
      "issueKey dedupes width/height and cross-block duplicates; use affectedBlocks for fix blast radius.",
      "content-height, text, flex-direction, paint props are never noise.",
      "avatar/initials → plan-error(style); layout-frame geometry-only props → noise ledger.",
    ],
    smokeDefects,
    issueIndex: [...issueIndex.values()],
    blocks: outBlocks,
    totals,
  };

  console.log(JSON.stringify({ totals, blocks: Object.fromEntries(Object.entries(outBlocks).map(([k, v]) => [k, { diffCount: v.diffCount, actionable: v.actionableForBuilder, planner: v.routeToPlanner, noise: v.noiseLedger?.length || 0 }])), uniqueIssues: totals.uniqueIssues }, null, 2));
  if (write) {
    await fs.writeFile(path.join(phaseDir, "judge-defects.json"), JSON.stringify(doc, null, 2) + "\n");
    console.log(`✓ wrote ${path.join(phaseDir, "judge-defects.json")}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e); process.exit(1); });
