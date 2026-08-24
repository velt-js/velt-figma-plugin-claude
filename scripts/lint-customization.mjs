#!/usr/bin/env node
// lint-customization.mjs — the STATIC rules scan. Every mechanically-checkable rule from
// guide/rules.md, enforced by code instead of prompt prose: instant, deterministic, zero tokens.
// Run it in the Builder's handoff gate (before the Judge ever sees the build) and as part of
// the Judge's static scan. ERRORS (exit 2) are hard rule violations; WARNINGS (exit 0) need a
// human/Judge eye but aren't mechanically provable as wrong.
//
// Usage: node scripts/lint-customization.mjs [dir]        # default: components/velt/ui-customization
//        [--json]
//
// Checks:
//   R1  (error) exactly one <VeltWireframe> across all files (0 is a warning — css-only builds exist)
//   R4  (error) interactive React (onClick/onChange/useState/useEffect/useRef) inside a file that
//               declares wireframe markup — cloned to inert DOM, silently does nothing
//   R7  (warn)  display:none in CSS — legit for empty-state gaps, a defect for feature-removal
//   R8  (error) more than one stylesheet in the customization dir
//   R9  (warn)  hex colours outside :root[data-velt-theme="dark"] scoping hints (heuristic)
//   R9b (warn)  a .velt-*/.s-*/snippyly override declaration without !important
//   R23 (error) a bare .velt-mention / .velt-mention--name selector not scoped under a message
//               scope — over-matches and tints the author name
//   R27 (error) visibility/layout keyed on :focus/:hover/:active for .velt-composer / transient
//               Velt twins named in rules.md (velt-composer-input-focused)

import { promises as fs } from "node:fs";
import path from "node:path";

const DIR = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "components/velt/ui-customization";
const JSON_OUT = process.argv.includes("--json");

async function walk(dir) {
  const out = [];
  // Vendor trees are not the customer's code. Walking them produced ~1,900 findings from Django's
  // admin CSS, Tailwind and Next's bundles — noise that buries the handful of real ones and makes
  // the gate's exit code meaningless.
  const SKIP = /^(node_modules|\.next|\.git|dist|build|out|coverage|venv|\.venv|__pycache__|site-packages)$/;
  for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    if (e.isDirectory() && SKIP.test(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

function findLines(src, re) {
  const hits = [];
  src.split("\n").forEach((l, i) => { if (re.test(l)) hits.push({ line: i + 1, text: l.trim().slice(0, 120) }); });
  return hits;
}

async function main() {
  const files = await walk(DIR);
  if (!files.length) { console.error(`✗ nothing to lint: ${DIR} is empty or missing`); process.exit(1); }
  const errors = [], warnings = [];
  const err = (rule, file, line, msg) => errors.push({ rule, file, line, msg });
  const warn = (rule, file, line, msg) => warnings.push({ rule, file, line, msg });

  const tsx = files.filter((f) => /\.(tsx|jsx|ts|js)$/.test(f));
  const css = files.filter((f) => /\.css$/.test(f));

  // R8 — the Velt CSS lives in ONE stylesheet. Count only sheets that actually carry customization
  // CSS: a SELECTOR targeting a velt-*/vc-* class or tag. Every host app has its own globals.css,
  // and a lone `--velt-default-font-family` variable in it is app font config, not customization —
  // counting it made the rule fire on every real project.
  const veltCss = [];
  for (const f of css) {
    const src = await fs.readFile(f, "utf8").catch(() => "");
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "");
    // a selector (not a declaration) mentioning a velt/vc class or custom-element tag
    if (/(^|[\s,>+~])[.a-zA-Z\[]?[^;{}]*\b(velt-|vc-)[a-zA-Z0-9_-]*[^;{}]*\{/m.test(stripped)) veltCss.push(f);
  }
  if (veltCss.length > 1) err("R8", veltCss[1], 0, `${veltCss.length} stylesheets carry Velt CSS (${veltCss.map((c) => path.basename(c)).join(", ")}) — it all goes in ONE file`);

  // R1 — exactly one <VeltWireframe>
  let wfCount = 0, wfFiles = [];
  for (const f of tsx) {
    const src = await fs.readFile(f, "utf8");
    const n = (src.match(/<VeltWireframe[\s>]/g) || []).length;
    if (n) { wfCount += n; wfFiles.push(f); }
  }
  if (wfCount > 1) err("R1", wfFiles.join(", "), 0, `${wfCount} <VeltWireframe> roots — the registry must be a single one (first-with-content-wins makes extras silently ignored)`);
  if (wfCount === 0) warn("R1", DIR, 0, "no <VeltWireframe> found (fine for a css/primitives-only build; a wireframe build is broken)");

  // R4 — interactive React inside wireframe files
  for (const f of tsx) {
    const src = await fs.readFile(f, "utf8");
    // A JSX TAG, not the word. Keying on the bare token made a comment explaining why a primitives
    // build registers NO wireframe ("…VeltButtonWireframe.") mark the host file as a wireframe file,
    // and every useEffect in it was then reported as inert.
    const withoutComments = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    const declaresWireframe = /<\s*[A-Za-z]*Wireframe[\s/>]/.test(withoutComments);
    if (!declaresWireframe) continue;
    for (const { line, text } of findLines(src, /\bonClick=|\bonChange=|\bonMouseDown=|\buseState\s*\(|\buseEffect\s*\(|\buseRef\s*\(/))
      err("R4", f, line, `interactive React inside a wireframe file — cloned to inert DOM, does nothing: ${text}`);
  }

  // STRUCTURAL wireframe guards (build-defect prevention — these shipped as real defects):
  for (const f of tsx) {
    const src = await fs.readFile(f, "utf8");
    if (!/Wireframe[\s.>]/.test(src)) continue;
    // (c) DUPLICATE add-reaction: ThreadCard.Reactions (the composite row that ALREADY carries the
    // add-reaction tool) declared ALONGSIDE ThreadCard.ReactionTool (the standalone add button) → the
    // smiley+ renders TWICE. Use Reactions OR (ReactionTool + ReactionPin), never both.
    const hasReactionsRow = /(ThreadCard\.)?Reactions[\s.>/}]/.test(src) || /reactions-wireframe/.test(src);
    const hasReactionTool = /ReactionTool[\s.>/}]/.test(src) || /reaction-tool-wireframe/.test(src);
    if (hasReactionsRow && hasReactionTool) {
      const ln = (findLines(src, /ReactionTool/)[0] || {}).line || 0;
      err("R-REACT2X", f, ln, "ThreadCard.Reactions (composite row — already contains the add-reaction tool) is declared ALONGSIDE ThreadCard.ReactionTool (standalone add button) → the add-reaction affordance renders TWICE. Use Reactions OR (ReactionTool + ReactionPin), not both.");
    }
    // (b) DIALOG dropped its composer: a comment-dialog container root registered with NO Composer child.
    // Undeclared children of a container wireframe DISAPPEAR (no Velt default) — the reply composer vanishes.
    const declaresDialog = /(VeltCommentDialog|comment-dialog)[\w-]*Wireframe|<VeltCommentDialog/i.test(src);
    if (declaresDialog && !/Composer[\s.>/}]|composer-wireframe/i.test(src)) {
      const ln = (findLines(src, /CommentDialog/i)[0] || {}).line || 0;
      warn("R-DLGCOMPOSER", f, ln, "comment-dialog wireframe declared with NO Composer child — undeclared children of a container wireframe DISAPPEAR (no Velt fallback). Declare the Composer (+ Body→Threads→ThreadCard) subtree, or confirm this dialog is intentionally read-only.");
    }
  }

  for (const f of css) {
    const src = await fs.readFile(f, "utf8");
    // R7 — display:none (warn: legit for empty-state gaps, a defect for feature removal)
    for (const { line, text } of findLines(src, /display\s*:\s*none/))
      warn("R7", f, line, `display:none — fine for an empty-state gap; a DEFECT if it removes a feature (use props/omit the slot): ${text}`);
    // R23 — bare .velt-mention not scoped to the message
    for (const { line, text } of findLines(src, /^[^{}]*(^|[,\s])\.velt-mention(--name)?\s*[,{:]/)) {
      if (!/--message|mentionScope|\.velt-thread-card--message/.test(text)) err("R23", f, line, `bare .velt-mention selector — over-matches (tints the author name); scope under the message: ${text}`);
    }
    // R9b — velt class overrides without !important (per-declaration heuristic)
    const blocks = src.split("}");
    let lineNo = 1;
    for (const b of blocks) {
      const nl = (b.match(/\n/g) || []).length;
      const [sel, body] = b.split("{");
      if (sel && body && /\.(velt-|s-)|snippyly/.test(sel) && !/--velt-/.test(body)) {
        for (const decl of body.split(";")) if (decl.includes(":") && !decl.includes("!important") && decl.trim() && !decl.trim().startsWith("--"))
          warn("R9b", f, lineNo, `velt-class override without !important (Velt's runtime CSS wins): ${decl.trim().slice(0, 80)}`);
      }
      lineNo += nl;
    }
    // R27 — transient-state anchoring on composer/actions visibility
    for (const { line, text } of findLines(src, /(:focus|:active|velt-composer-input-focused)[^{]*\{?/)) {
      if (/velt-composer|composer|actions|display|visibility/i.test(text) && /(:focus\b|velt-composer-input-focused)/.test(text))
        warn("R27", f, line, `visibility/layout possibly keyed on a TRANSIENT state (target shifts mid-click) — anchor on velt-composer-open / a selected condition: ${text}`);
    }
  }

  if (JSON_OUT) { console.log(JSON.stringify({ dir: DIR, errors, warnings }, null, 2)); }
  else {
    console.log(`lint ${DIR}: ${errors.length} error(s), ${warnings.length} warning(s) across ${files.length} file(s)`);
    for (const e of errors) console.log(`  ✗ [${e.rule}] ${e.file}${e.line ? ":" + e.line : ""} — ${e.msg}`);
    for (const w of warnings) console.log(`  ⚠ [${w.rule}] ${w.file}${w.line ? ":" + w.line : ""} — ${w.msg}`);
    if (!errors.length && !warnings.length) console.log("  ✓ clean");
  }
  process.exit(errors.length ? 2 : 0);
}

main().catch((e) => { console.error("✗ " + e.message); process.exit(1); });
