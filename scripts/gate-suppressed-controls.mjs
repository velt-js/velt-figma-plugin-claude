#!/usr/bin/env node
// gate-suppressed-controls.mjs — refuses a style plan that permanently switches OFF a working control.
//
// THE MISTAKE THIS CLOSES. The suppression rule — "anything the Figma frame does not draw gets
// display:none" — is right for leftover SDK chrome and WRONG for anything that only appears on
// interaction. A Figma frame is a still photograph of one state. It cannot draw a search input that
// only exists after you click the magnifier, so "not drawn" gets read as "not wanted".
//
// MEASURED, Harvey 651 — the generated stylesheet states the reasoning itself:
//     /* the design's top bar draws the magnifier ONLY (node 651:33840); the search input is not
//        drawn in this Loop, so it is suppressed rather than left raw */
//     .vc-header-search-input { display: none !important; }
// Live, the search box can never be opened. A working SDK feature was disabled to match a photo.
//
// HOW IT DECIDES. Not by guessing intent — by asking the manifest. `bindsClick: true` means the SDK
// component binds its OWN click handler, i.e. the element is an interactive control rather than
// decoration. Suppressing the subtree that contains one removes a real affordance. Decorative
// chrome (bindsClick false/null) is still free to be suppressed, which is the common, correct case.
//
// The right fix for a genuinely state-dependent control is a STATE RULE — hidden at rest, shown in
// the state the design draws it in — never a permanent `display:none`.
//
// Usage:
//   node scripts/gate-suppressed-controls.mjs <phaseDir> [--json] [--warn-only]
//
// Exit codes: 0 = clean (or --warn-only), 2 = an interactive control is permanently suppressed,
//             1 = usage/error.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Declarations that take an element out of the layout entirely, at rest. */
const SUPPRESSING = [
  (p, v) => p === "display" && /^\s*none\b/i.test(v),
  (p, v) => p === "visibility" && /^\s*hidden\b/i.test(v),
  (p, v) => p === "content-visibility" && /^\s*hidden\b/i.test(v),
];

/**
 * A rule is a REST suppression only when it applies with no state qualifier. A rule scoped to a
 * state (`state: "hover"`, or a selector carrying `:hover` / `[data-*-state=...]`) is the correct
 * way to hide something conditionally and must not be flagged.
 */
function isRestSuppression(rule) {
  const state = String(rule.state || "default").toLowerCase();
  if (state && state !== "default" && state !== "resting") return false;
  const sel = String(rule.selector || "");
  if (/:hover|:focus|:active|:checked|\[data-[a-z-]*state|\[data-vc-[a-z-]+=/.test(sel)) return false;
  const decls = rule.decls || {};
  return Object.entries(decls).some(([p, v]) => SUPPRESSING.some((f) => f(String(p).toLowerCase().trim(), String(v))));
}

/** The trailing class of a class selector, or the tag of a bare tag selector. */
function selectorKey(selector) {
  const sel = String(selector || "").trim();
  const classes = [...sel.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((m) => m[1]);
  if (classes.length) return { kind: "class", value: classes[classes.length - 1] };
  const tag = sel.match(/(^|\s|>)([a-z][a-z0-9-]*)\s*$/);
  if (tag) return { kind: "tag", value: tag[2] };
  return null;
}

/**
 * Native form controls. `bindsClick` marks primitives that bind their OWN click, which is the right
 * signal for buttons — but it is FALSE for a text field, because typing is not clicking.
 * MEASURED: `velt-comment-sidebar-search-v2-input` carries bindsClick:false, so a bindsClick-only
 * gate waved through the very rule that disabled search. A suppressed subtree containing a real
 * `<input>` is just as dead as one containing a button.
 */
const NATIVE_CONTROL_TAGS = new Set(["input", "textarea", "select", "button", "a"]);

/**
 * Backstop for primitives whose interactivity the manifest cannot see — the control is rendered by
 * a descendant the snapshot did not reach, or it is keyboard-only. Name-based and deliberately
 * narrow: only the four suffix families that are affordances by construction.
 */
const CONTROL_NAME = /(?:-input|-search|-button|-trigger|-toggle)(?:-v\d+)?$/;

/** Every tag inside (and including) the nodes a selector matches. */
function tagsUnderSelector(tree, key) {
  const found = new Set();
  const collect = (node) => {
    if (!node || typeof node !== "object") return;
    if (typeof node.tag === "string") found.add(node.tag);
    for (const c of node.children || []) collect(c);
  };
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    const classes = node.classes || [];
    const hit = key.kind === "class" ? classes.includes(key.value) : node.tag === key.value;
    if (hit) collect(node);
    for (const c of node.children || []) walk(c);
  };
  walk(tree);
  return found;
}

async function readJson(file, fallback = null) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return fallback; }
}

async function loadManifestClickyTags() {
  const manifest = await readJson(path.join(ROOT, "manifest", "velt-primitives.json"), null);
  const primitives = manifest?.primitives || manifest?.tags || manifest?.items || {};
  const clicky = new Set();
  for (const [tag, entry] of Object.entries(primitives)) {
    if (entry && entry.bindsClick === true) clicky.add(tag);
  }
  return clicky;
}

export async function gateSuppressedControls(phaseDir) {
  const planStyle = await readJson(path.join(phaseDir, "plan-style.json"));
  if (!planStyle) return { ok: true, reason: "no plan-style.json — nothing to gate", offenders: [] };

  const clicky = await loadManifestClickyTags();
  if (!clicky.size) return { ok: true, reason: "manifest carries no bindsClick data — gate inert", offenders: [] };

  // Snapshot trees are how a CSS selector is resolved to real tags. Without them the gate cannot
  // know what a selector covers, so it reports inert rather than guessing.
  const snapDir = path.join(phaseDir, "dom-snapshot");
  const files = (await fs.readdir(snapDir).catch(() => [])).filter((f) => f.endsWith(".json"));
  if (!files.length) return { ok: true, reason: "no dom-snapshot trees — gate inert", offenders: [] };
  const trees = [];
  for (const f of files) {
    const snap = await readJson(path.join(snapDir, f));
    if (snap?.tree) trees.push({ blockId: snap.blockId || f.replace(/\.json$/, ""), tree: snap.tree });
  }

  const offenders = [];
  for (const rule of planStyle.rules || []) {
    if (!isRestSuppression(rule)) continue;
    const key = selectorKey(rule.selector);
    if (!key) continue;
    const hitTags = new Set();
    for (const { tree } of trees) for (const t of tagsUnderSelector(tree, key)) hitTags.add(t);
    const controls = [];
    for (const t of hitTags) {
      if (clicky.has(t)) controls.push({ tag: t, signal: "bindsClick" });
      else if (NATIVE_CONTROL_TAGS.has(t)) controls.push({ tag: t, signal: "native control" });
      else if (t.startsWith("velt-") && CONTROL_NAME.test(t)) controls.push({ tag: t, signal: "control-shaped name" });
    }
    if (controls.length) {
      offenders.push({
        selector: rule.selector,
        decls: rule.decls,
        specNodeId: rule.specNodeId || null,
        suppresses: controls,
        why: "suppressing this subtree at rest removes a working affordance the user can never reach again",
      });
    }
  }

  return {
    ok: offenders.length === 0,
    offenders,
    reason: offenders.length === 0
      ? "no interactive control is suppressed at rest"
      : `${offenders.length} rule(s) permanently hide an interactive control`,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const phaseDir = args.find((a) => !a.startsWith("--"));
  if (!phaseDir) { console.error("usage: gate-suppressed-controls.mjs <phaseDir> [--json] [--warn-only]"); process.exit(1); }
  const result = await gateSuppressedControls(phaseDir);
  if (args.includes("--json")) console.log(JSON.stringify(result, null, 2));
  else if (result.ok) console.log(`✓ suppressed-controls: ${result.reason}`);
  else {
    console.error(`✗ suppressed-controls: ${result.reason}`);
    for (const o of result.offenders) {
      console.error(`   ${o.selector}  →  ${JSON.stringify(o.decls)}`);
      console.error(`      hides: ${o.suppresses.map((c) => `${c.tag} (${c.signal})`).join(", ")}`);
    }
    console.error("");
    console.error("   A Figma frame is one state, not the whole control. If the design only draws the");
    console.error("   resting form, hide it with a STATE rule — not a permanent display:none.");
  }
  process.exit(result.ok || args.includes("--warn-only") ? 0 : 2);
}
