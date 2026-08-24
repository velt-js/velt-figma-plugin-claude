#!/usr/bin/env node
// code-review.mjs — review the code a stage actually EMITTED, not the pixels it produced.
//
// WHY THIS EXISTS
// Every existing check is either a lint with a fixed rule set (lint-customization, lint-primitives,
// icon-lint) or a measurement of rendered output (delta-compare, judge2-chromatic). Neither can see
// the defect class that cost the harvey run the most hours: code that lints clean, renders
// pixel-perfect, and is wrong in a way only a reader notices. Four load-bearing comments asserting a
// MECHANISM nobody had traced sent an audit down the wrong path for hours; a `const
// SORT_ROWS_HAVE_NO_PUBLIC_SETTER = true` froze a control that had a perfectly good public API.
//
// SCOPED TO ADDED LINES. Findings are reported only on lines this run ADDED (parsed from `git diff
// -U0`, plus whole untracked files). Reviewing the whole file every stage produces a wall of
// pre-existing noise that trains you to ignore the report.
//
// ADVISORY BY DEFAULT (exit 0). These are heuristics over prose and syntax; a false positive that
// blocks a build is worse than a missed finding. `--strict` makes findings exit 2 once you trust a
// detector enough to gate on it — the same path lint-primitives P10/P12 took.
//
// USAGE
//   node scripts/code-review.mjs <phaseDir> --stage <id> --app-dir <path> [--base HEAD] [--json] [--strict]
//
// EXIT: 0 advisory (default) · 2 findings with --strict · 1 usage/environment.

import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const has = (n) => argv.includes(n);
const phaseDirArg = argv.find((a) => !a.startsWith("--") && argv.indexOf(a) === 0);
if (!phaseDirArg) { console.error("usage: code-review.mjs <phaseDir> --stage <id> --app-dir <path> [--base HEAD] [--json] [--strict]"); process.exit(1); }

const phaseDir = path.resolve(phaseDirArg);
const stageId = flag("--stage", "unknown");
const appDir = path.resolve(flag("--app-dir", process.cwd()));
const base = flag("--base", "HEAD");
// Optional second ref. Omitted, the comparison is base -> WORKING TREE, which is what "what this
// stage just emitted" means during a run. Supplying it lets the same reviewer be pointed at a past
// range (e.g. --base 390e548 --head b632bf2 to review what a previous run produced).
const headRef = flag("--head", null);

const git = (args, cwd) => spawnSync("git", ["--no-optional-locks", ...args], { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

// --- the changed surface --------------------------------------------------------------------
// Added lines from the working tree against `base`, plus every line of an untracked file (all of it
// is new). A repo with nothing committed for this run is the normal case here, so `HEAD` is the
// right default base rather than a tag.
const REVIEWABLE = /\.(tsx?|jsx?|css)$/;

async function changedLines() {
  // --files is the no-git path: review exactly these files, every line treated as new. Two uses —
  // reviewing one file the judge named without re-deriving a range, and running the calibration
  // offline (git is not always usable in a sandbox, and a suite that needs a git repo is a suite
  // that silently stops running).
  const explicit = flag("--files");
  if (explicit) {
    const files = new Map();
    for (const rel of explicit.split(",").map((x) => x.trim()).filter(Boolean)) {
      if (!REVIEWABLE.test(rel)) continue;
      const src = await fs.readFile(path.isAbsolute(rel) ? rel : path.join(appDir, rel), "utf8").catch(() => null);
      if (src == null) continue;
      files.set(rel, src.split("\n").map((text, i) => ({ line: i + 1, text })));
    }
    return { error: null, files };
  }

  const probe = git(["rev-parse", "--is-inside-work-tree"], appDir);
  if (probe.status !== 0) return { error: `not a git work tree: ${appDir}`, files: new Map() };

  const files = new Map();          // relPath -> [{ line, text }]
  const diff = git(["diff", "-U0", "--no-color", base, ...(headRef ? [headRef] : []), "--", "."], appDir);
  if (diff.status === 0) {
    let cur = null, lineNo = 0;
    for (const raw of (diff.stdout || "").split("\n")) {
      const f = raw.match(/^\+\+\+ b\/(.+)$/);
      if (f) { cur = REVIEWABLE.test(f[1]) ? f[1] : null; continue; }
      const h = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
      if (h) { lineNo = +h[1]; continue; }
      if (!cur) continue;
      if (raw.startsWith("+") && !raw.startsWith("+++")) {
        if (!files.has(cur)) files.set(cur, []);
        files.get(cur).push({ line: lineNo, text: raw.slice(1) });
        lineNo++;
      }
    }
  }

  // Untracked files are only "new work" when the comparison ends at the working tree.
  const untracked = headRef ? { stdout: "" } : git(["ls-files", "--others", "--exclude-standard", "--", "."], appDir);
  for (const rel of (untracked.stdout || "").split("\n").filter(Boolean)) {
    if (!REVIEWABLE.test(rel)) continue;
    const src = await fs.readFile(path.join(appDir, rel), "utf8").catch(() => null);
    if (src == null) continue;
    files.set(rel, src.split("\n").map((text, i) => ({ line: i + 1, text })));
  }
  return { error: null, files };
}

// --- the checks -----------------------------------------------------------------------------
// Each one is a class the lints structurally cannot catch, drawn from a defect that actually shipped.
const findings = [];
const claims = [];
const add = (rule, severity, file, line, message, why) => findings.push({ rule, severity, file, line, message, why });

// C1 is not reported as a FINDING — it is a bounded REVIEW LIST, and that reframing is the point. The first cut fired on every explanatory "because" and produced 14
// findings on one well-commented file — a wall of noise trains you to ignore the report, which is
// worse than not having it. Narrowing it to claims of ABSENCE or IMPOSSIBILITY still leaves ~15 per
// stage, and most of those are correct, honestly-recorded gaps — no static check can tell a correct
// dead end from a wrong one.
//
// So it does not try. Every such claim is collected into `claims[]`: the avenues this stage declared
// closed. That is a bounded list a human can actually read, and it is exactly where the two most
// expensive defects of the previous run were hiding ("carries no dialogInstanceId" — wrong;
// "CommentElement has no sort setter at all" — wrong, the primitive took group-id/item-id). An
// evidenced claim is marked `evidenced:true` and sorts last; the unevidenced ones are what to read.
const CLOSES_AN_AVENUE = /\b(carries no|has no|have no|there is no|does not exist|do not exist|never resolves?|cannot be|can't be|is not possible|not possible|unreachable|is not supported|not supported|no public (api|setter|method|getter)|no way to)\b/i;
// The words that mark a claim someone actually traced, plus any concrete measurement or a file:line.
const EVIDENCE = /\b(measured|verified|probed|reproduced|traced|observed|confirmed|grepped|A\/B)\b|\b\d+(px|ms|bytes|%)\b|\.(ts|tsx|mjs|json|html):\d+/i;
const COMMENT = /^\s*(\/\/|\*|\/\*)/;

function checkLine(file, line, text, ctx, isComment) {
  // Several checks are about AUTHORED JSX and are meaningless in a stylesheet. C4 in particular
  // fired on `[data-velt-hidden="true"]` in a CSS selector — which is the SDK-documented way to READ
  // that signal, i.e. the opposite of the defect. Scope by file type rather than by regex cleverness.
  const isStyle = /\.css$/.test(file);
  // C1 — an avenue this stage declared closed. Collected, not judged.
  if (isComment && CLOSES_AN_AVENUE.test(text)) {
    claims.push({ file, line, claim: text.trim().replace(/^\s*(\/\/|\*|\/\*)\s?/, "").slice(0, 140), evidenced: EVIDENCE.test(text) });
  }
  // C2 — a hardcoded boolean constant used as a capability claim.
  if (!isStyle && /^\s*const\s+[A-Z0-9_]{6,}\s*=\s*(true|false)\s*;/.test(text)) {
    add("C2", "advisory", file, line, `capability frozen into a constant: "${text.trim().slice(0, 80)}"`,
      "A constant cannot be wrong at runtime, so it never gets re-checked. `SORT_ROWS_HAVE_NO_PUBLIC_SETTER = true` froze a control whose primitive accepted group-id/item-id and drove the real setter.");
  }
  // C3 — state expressed as a class-name ternary rather than a data attribute.
  if (!isStyle && /className=\{[^}]*\?[^}]*:[^}]*\}/.test(text)) {
    add("C3", "advisory", file, line, `state encoded as a className ternary: "${text.trim().slice(0, 80)}"`,
      "Publish the state as a data-vc-* attribute and let CSS read it. A ternary hides the state from the stylesheet and from anything inspecting the DOM.");
  }
  // C4 — the customer inventing a data-velt-* attribute. Those belong to the SDK; a stylesheet keyed
  // to one the SDK does not set silently never matches.
  if (!isStyle && !isComment && /\bdata-velt-[a-z-]+\s*=\s*[{"']/.test(text)) {
    add("C4", "blocking", file, line, `emits a data-velt-* attribute: "${text.trim().slice(0, 80)}"`,
      "data-velt-* is the SDK's namespace. Read them; never write them. Use data-vc-* for your own state.");
  }
  // C5 — debug residue.
  if (/\bconsole\.(log|debug)\s*\(/.test(text) && !isComment) {
    add("C5", "advisory", file, line, "console.log left in emitted code", "Ships to the demo console and pollutes console-health's storm detection.");
  }
  // C6 — an unresolved marker.
  if (/\b(TODO|FIXME|XXX|HACK)\b/.test(text)) {
    add("C6", "advisory", file, line, `unresolved marker: "${text.trim().slice(0, 80)}"`, "Either resolve it or record it as a declared gap in the handoff.");
  }
  // C7 — design values in an inline style object. CSS is where the style plan can measure them.
  if (!isStyle && /style=\{\{[^}]*(#[0-9a-fA-F]{3,8}|\d+px)/.test(text)) {
    add("C7", "advisory", file, line, `design value in an inline style object: "${text.trim().slice(0, 80)}"`,
      "The style plan and the delta-compare engine both read CSS. A value inlined in JSX is invisible to every measurement in this pipeline.");
  }
  ctx.scanned++;
}

const { error, files } = await changedLines();
const ctx = { scanned: 0 };
// Block-comment state has to be tracked across lines: a continuation line inside /* … */ carries no
// marker of its own, and the first cut mis-read one as code and fired C4 on prose describing an
// SDK attribute. Untracked files give every line; a diff gives only added ones, so the state is
// seeded per file and is best-effort on a sparse diff.
if (!error) for (const [file, lines] of files) {
  let inBlock = false;
  for (const { line, text } of lines) {
    const startedInBlock = inBlock;
    const opens = (text.match(/\/\*/g) || []).length;
    const closes = (text.match(/\*\//g) || []).length;
    if (opens > closes) inBlock = true;
    else if (closes > opens) inBlock = false;
    const isComment = startedInBlock || inBlock || COMMENT.test(text);
    checkLine(file, line, text, ctx, isComment);
  }
}

const blocking = findings.filter((f) => f.severity === "blocking");
const report = {
  stage: stageId,
  appDir,
  base,
  head: headRef || "(working tree)",
  generatedAt: new Date().toISOString(),
  error,
  filesReviewed: [...files.keys()],
  addedLinesScanned: ctx.scanned,
  counts: {
    total: findings.length,
    blocking: blocking.length,
    advisory: findings.length - blocking.length,
    claims: claims.length,
    claimsUnevidenced: claims.filter((c) => !c.evidenced).length,
  },
  findings,
  // The avenues this stage declared closed, unevidenced first — the list to actually read.
  claims: claims.sort((a, b) => Number(a.evidenced) - Number(b.evidenced)),
};

try {
  const out = path.join(phaseDir, "stage-review");
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(path.join(out, `${stageId}.code.json`), JSON.stringify(report, null, 2) + "\n");
} catch { /* Silent — advisory tooling never breaks a build. */ }

if (has("--json")) console.log(JSON.stringify(report, null, 2));
else {
  if (error) console.warn(`⚠ ${error}`);
  console.log(`code review · stage '${stageId}' · ${report.filesReviewed.length} file(s), ${ctx.scanned} added line(s)`);
  for (const f of findings) {
    console.log(`  ${f.severity === "blocking" ? "✗" : "⚠"} ${f.rule} ${f.file}:${f.line} — ${f.message}`);
    console.log(`      ${f.why}`);
  }
  if (!findings.length) console.log("  ✓ nothing flagged on the added lines");
  if (claims.length) {
    const un = claims.filter((c) => !c.evidenced);
    console.log(`\n  ${claims.length} avenue(s) declared closed by this stage — ${un.length} with no evidence cited:`);
    for (const c of un.slice(0, 25)) console.log(`    ? ${c.file}:${c.line} — ${c.claim}`);
    if (un.length > 25) console.log(`    … and ${un.length - 25} more (see stage-review/${stageId}.code.json)`);
    console.log("    Each is a place this build gave up. Re-check one before trusting it.");
  }
}

process.exit(has("--strict") && findings.length ? 2 : 0);
