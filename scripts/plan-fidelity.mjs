#!/usr/bin/env node
// plan-fidelity.mjs — did the builder actually build the PLAN?
//
// WHY THIS EXISTS
// Every gate at 5a-P checks the emitted code against RULES: lint-primitives asks "is this a legal
// composition", verify-host-wiring asks "is the infra present", icon-lint asks "was the glyph
// pasted". Nothing asks the simpler question — "is this the tree the planner specified". So a
// builder can silently drop a planned node or invent an unplanned one and the whole stage stays
// green. Measured on the first primitives build that reached this stage: one planned surface root
// was never emitted, and four classes appeared that the plan had never heard of.
//
// Both directions matter and they are NOT the same severity:
//   MISSING  a planned primitive or contract class is absent -> ERROR. The style stage plans
//            selectors from plan vcClasses, so a missing class is a rule that can never match, and
//            it surfaces three stages later at skeleton-check as "planned class missing everywhere".
//   EXTRA    a vc-* class the plan does not carry -> WARNING. Real builds legitimately add wrappers
//            the planner did not foresee; that is `beyondPlan`, not a defect. It must be VISIBLE,
//            because an unrecorded extra is also how a plan quietly stops describing the code.
//
// LAYER-AGNOSTIC by construction: it reads plan-primitives.json and the emitted sources, and knows
// nothing about which design, surface or family it is checking.
//
// USAGE   node scripts/plan-fidelity.mjs <phaseDir> --app-dir <dir> [--json]
// EXIT    0 clean (extras are advisory) · 2 a planned node is missing · 1 usage

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const val = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const phaseDir = argv.find((a) => !a.startsWith("--"));
if (!phaseDir) { console.error("usage: plan-fidelity.mjs <phaseDir> --app-dir <dir> [--json]"); process.exit(1); }
const appDir = path.resolve(val("--app-dir", process.cwd()));

const readJson = async (p, d) => fs.readFile(p, "utf8").then(JSON.parse).catch(() => d);
const plan = await readJson(path.join(path.resolve(phaseDir), "plan-primitives.json"), null);
if (!plan) { console.error("✗ plan-primitives.json missing — run the planner first"); process.exit(1); }
const M = await readJson(path.join(ROOT, "manifest/velt-primitives.json"), { primitives: {} });

// Collect the emitted sources. Only files the builder owns: the customization dir plus any host file
// that mounts them. Everything else in an app is none of this gate's business.
const collect = async (dir, out = []) => {
  for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|\.next|\.git/.test(e.name)) await collect(p, out); }
    else if (/\.(tsx|jsx|ts|js)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(p);
  }
  return out;
};
const files = await collect(appDir);
let src = "";
for (const f of files) {
  const t = await fs.readFile(f, "utf8").catch(() => "");
  if (/ui-customization|VeltCollaboration|VeltCustomization/.test(f) || /vc-[a-z]/.test(t)) src += "\n" + t;
}

// --- walk the plan -----------------------------------------------------------------------------
const planned = { primitives: new Set(), classes: new Set(), attrs: [] };
const walk = (n, surfaceId) => {
  if (!n || typeof n !== "object") return;
  if (n.primitive) {
    planned.primitives.add(n.primitive);
    for (const [k, v] of Object.entries(n.ownAttributes || {})) {
      if (typeof v === "string" && /^\{.*\}$/.test(v)) continue;   // a placeholder expression, not a literal
      planned.attrs.push({ surfaceId, primitive: n.primitive, attr: k });
    }
  }
  for (const c of (n.vcClass || "").split(/\s+/).filter(Boolean)) planned.classes.add(c);
  for (const c of n.children || []) walk(c, surfaceId);
};
for (const s of plan.surfaces || []) walk(s.root, s.id || s.component);

const problems = [], advisories = [];
for (const tag of planned.primitives) {
  const react = M.primitives[tag]?.reactName;
  if (!react) continue;                                   // no React wrapper by design
  if (!new RegExp(`<${react}\\b`).test(src))
    problems.push({ kind: "missing-primitive", what: react, note: `planned as <${react}> (${tag}) but no such element is emitted` });
}
for (const cls of planned.classes) {
  if (!new RegExp(`["'\\s]${cls}(["'\\s])`).test(src))
    problems.push({ kind: "missing-class", what: cls, note: `planned contract class '${cls}' appears nowhere in the emitted code — the style stage would plan selectors against a class that cannot match` });
}
for (const a of planned.attrs) {
  if (!new RegExp(`\\b${a.attr}\\s*[:=]`).test(src))
    problems.push({ kind: "missing-attribute", what: `${a.primitive}.${a.attr}`, note: `the plan sets ${a.attr} on ${a.primitive}; it is not set anywhere in the emitted code` });
}
const emitted = new Set();
for (const m of src.matchAll(/className=["']([^"']+)["']/g))
  for (const c of m[1].split(/\s+/)) if (/^vc-/.test(c)) emitted.add(c);
const beyond = new Set((plan.beyondPlan || []).map((b) => (typeof b === "string" ? b : b.vcClass)));
for (const c of emitted)
  if (!planned.classes.has(c) && !beyond.has(c))
    advisories.push({ kind: "unplanned-class", what: c, note: `emitted but absent from the plan. If the builder needed it, record it in plan-primitives.json beyondPlan[] so the plan keeps describing the code; the style stage plans from the PLAN.` });

const out = { ok: !problems.length, plannedPrimitives: planned.primitives.size, plannedClasses: planned.classes.size, emittedClasses: emitted.size, problems, advisories };
if (flag("--json")) console.log(JSON.stringify(out, null, 2));
else {
  for (const a of advisories) console.error(`⚠ ${a.kind.padEnd(18)} ${a.what}\n    ${a.note}`);
  if (problems.length) {
    for (const p of problems) console.error(`✗ ${p.kind.padEnd(18)} ${p.what}\n    ${p.note}`);
    console.error(`\n✗ the build does not match the plan — ${problems.length} planned item(s) missing`);
  } else console.log(`✓ build matches the plan (${planned.primitives.size} primitives, ${planned.classes.size} contract classes)${advisories.length ? ` — ${advisories.length} advisory` : ""}`);
}
process.exit(problems.length ? 2 : 0);
