#!/usr/bin/env node
// stage-review.mjs — what happened in ONE stage, across all three lenses.
//
// WHY THIS EXISTS
// The evidence for "did this stage go right" is already on disk and nobody reads it. Five live gates
// write structured JSON that literally nothing downstream consumes (console-health.json,
// mock-gate.json, golden-path.json, regression-report.json, audit/*.json); the judge writes a rich
// report.json that only a human ever opens; and about half the gates leave no artifact at all, which
// is what run-gate.mjs fixes. This script is the READING layer over all of it.
//
// THREE LENSES, because "is it correct" is three different questions:
//   ui         — rendered pixels: captures, diffs, mock scores, skeleton presence
//   functional — does it behave: driven interactions, asserted states, console health
//   code       — what was actually emitted: the lints, plus code-review.mjs for what lints cannot see
// A stage can be pixel-perfect and dead (a composed control with no handler), or behave correctly
// and be unreadable. Collapsing the three into one score is how those get missed.
//
// ADVISORY BY DEFAULT. Exits 0 unless --strict. This reads evidence; it does not re-run gates, so it
// is safe to run at any time, including long after a run, and it never changes a verdict.
//
// USAGE
//   node scripts/stage-review.mjs <phaseDir> --stage <id> [--app-dir <p>] [--base <ref>] [--head <ref>] [--json] [--strict]
//   node scripts/stage-review.mjs <phaseDir> --all [--app-dir <p>]
//
// EXIT: 0 · 2 when --strict and the verdict is `blocked` · 1 usage.

import { spawnSync } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const has = (n) => argv.includes(n);
const phaseDirArg = argv[0];
if (!phaseDirArg || phaseDirArg.startsWith("--")) { console.error("usage: stage-review.mjs <phaseDir> --stage <id> | --all [--app-dir <p>] [--json] [--strict]"); process.exit(1); }
const phaseDir = path.resolve(phaseDirArg);
const appDir = path.resolve(flag("--app-dir", process.cwd()));

const manifest = JSON.parse(await fs.readFile(path.join(ROOT, "manifest/stages.json"), "utf8"));
const readJson = async (rel) => fs.readFile(path.join(phaseDir, rel), "utf8").then(JSON.parse).catch(() => null);
const glob = async (dir, re) => (await fs.readdir(path.join(phaseDir, dir)).catch(() => [])).filter((f) => re.test(f));

// --- evidence collectors --------------------------------------------------------------------

async function gateRecords(stage) {
  const files = await glob(path.join("gates", stage.id), /\.json$/);
  const out = [];
  for (const f of files) {
    const r = await readJson(path.join("gates", stage.id, f));
    if (r) out.push(r);
  }
  // A gate declared in the manifest with no record on disk was never run through run-gate.mjs.
  // That is worth saying out loud: an unrecorded gate is indistinguishable from a skipped one.
  const seen = new Set(out.map((r) => r.gate));
  const unrecorded = (stage.gates || []).filter((g) => !seen.has(g.id)).map((g) => g.id);
  return { records: out, unrecorded };
}

async function artifactCheck(stage) {
  const rows = [];
  for (const p of stage.produces || []) {
    if (p.path.startsWith("<")) { rows.push({ ...p, present: null, note: "not a phaseDir artifact" }); continue; }
    if (p.path.includes("*")) {
      const dir = path.dirname(p.path);
      const pat = new RegExp("^" + path.basename(p.path).replace(/[.]/g, "\\.").replace(/\*/g, ".*") + "$");
      const hits = await glob(dir, pat);
      rows.push({ ...p, present: hits.length > 0, count: hits.length });
    } else {
      rows.push({ ...p, present: existsSync(path.join(phaseDir, p.path)) });
    }
  }
  return rows;
}

async function events(stage) {
  const raw = await fs.readFile(path.join(phaseDir, "obs/events.jsonl"), "utf8").catch(() => "");
  const all = raw.split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  return all.filter((e) => e.stage === stage.id);
}

// The five live gates whose JSON nothing has ever read, plus the judge's own report.
async function lensEvidence(stage) {
  const ui = [], functional = [], code = [];
  const push = (arr, label, val, ok, detail) => { if (val !== null) arr.push({ label, ok, detail }); };

  const console_ = await readJson("console-health.json");
  if (console_) push(functional, "console-health.json", console_, console_.ok !== false && !console_.storm,
    console_.storm ? `storm: ${console_.signature || "repeating error signature"}` : `${console_.errorCount ?? 0} error(s)`);

  const mock = await readJson("mock-gate.json");
  if (mock) push(ui, "mock-gate.json", mock, mock.ok !== false, mock.failed?.length ? `${mock.failed.length} mock(s) too far from the frame` : "mocks within threshold");

  const golden = await readJson("golden-path.json");
  if (golden) push(code, "golden-path.json", golden, golden.ok !== false, (golden.failing || []).join(", ") || "host wiring / style authorship / checklist all ok");

  const regression = await readJson("regression-report.json");
  if (regression) push(ui, "regression-report.json", regression, regression.ok !== false, regression.regressions?.length ? `${regression.regressions.length} regression(s)` : "no regression");

  for (const f of await glob("audit", /\.json$/)) {
    const a = await readJson(path.join("audit", f));
    if (a) push(ui, `audit/${f}`, a, a.ok !== false, a.reason || a.disposition || "");
  }

  const report = await readJson("judge2/report.json");
  if (report) push(ui, "judge2/report.json", report, !(report.findings || []).length,
    `${(report.findings || []).length} finding(s), ${(report.namedFindings || []).length} named`);

  const probes = await readJson("judge2/chrome-probes.json");
  if (probes) push(functional, "judge2/chrome-probes.json", probes, probes.ok !== false,
    (probes.failed || []).map((p) => p.id || p).join(", ") || "all probes clean");

  const defects = await readJson("judge-defects.json");
  if (defects) push(code, "judge-defects.json", defects, !(defects.workOrderP0 || []).length, `${(defects.workOrderP0 || []).length} P0 in the work order`);

  const shots = [
    ...(await glob("judge2/blocks", /.*/)).map((b) => `judge2/blocks/${b}/diff.png`),
    ...(await glob("obs/shots", /\.png$/)).slice(-8).map((f) => `obs/shots/${f}`),
  ].filter((p) => existsSync(path.join(phaseDir, p)));

  return { ui, functional, code, shots };
}

async function codeReview(stage) {
  const existing = await readJson(path.join("stage-review", `${stage.id}.code.json`));
  if (existing && !has("--refresh-code")) return existing;
  // --base/--head pass through so the same reviewer can be pointed at a past range when replaying a
  // finished run; during a live run the default (base HEAD -> working tree) is what "just emitted" means.
  const range = [];
  if (flag("--base")) range.push("--base", flag("--base"));
  if (flag("--head")) range.push("--head", flag("--head"));
  const res = spawnSync("node", [path.join(ROOT, "scripts/code-review.mjs"), phaseDir, "--stage", stage.id, "--app-dir", appDir, ...range, "--json"],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  try { return JSON.parse(res.stdout); } catch { return null; }
}

// --- the review -------------------------------------------------------------------------------

async function reviewStage(stage) {
  const { records, unrecorded } = await gateRecords(stage);
  const artifacts = await artifactCheck(stage);
  const lenses = await lensEvidence(stage);
  const evts = await events(stage);
  const code = await codeReview(stage);

  const failedBlocking = records.filter((r) => r.status === "fail" && r.blocking !== false);
  const failedAdvisory = records.filter((r) => r.status === "fail" && r.blocking === false);
  const missingRequired = artifacts.filter((a) => a.required && a.present === false);
  const lensFails = [...lenses.ui, ...lenses.functional, ...lenses.code].filter((l) => l.ok === false);
  const blockingCode = (code?.findings || []).filter((f) => f.severity === "blocking");

  const verdict =
    failedBlocking.length || missingRequired.length || blockingCode.length ? "blocked"
      : failedAdvisory.length || lensFails.length || (code?.findings || []).length || unrecorded.length ? "advisory"
        : "clean";

  const nextActions = [];
  for (const r of failedBlocking) nextActions.push(`FIX then re-run: ${r.cmd.join(" ")}   — ${r.reason || `exit ${r.exitCode}`}`);
  for (const a of missingRequired) nextActions.push(`MISSING required artifact ${a.path} — the stage did not finish`);
  for (const f of blockingCode) nextActions.push(`CODE ${f.rule} ${f.file}:${f.line} — ${f.message}`);
  if (unrecorded.length) nextActions.push(`UNRECORDED gate(s): ${unrecorded.join(", ")} — run them through scripts/run-gate.mjs so the verdict survives`);

  return {
    stage: stage.id, seq: stage.seq, title: stage.title, owner: stage.owner, modes: stage.modes,
    generatedAt: new Date().toISOString(),
    verdict,
    gates: records.map((r) => ({ gate: r.gate, lens: r.lens, blocking: r.blocking, status: r.status, exitCode: r.exitCode, reason: r.reason, durationMs: r.durationMs })),
    unrecordedGates: unrecorded,
    artifacts,
    lenses: { ui: lenses.ui, functional: lenses.functional, code: lenses.code },
    shots: lenses.shots,
    codeReview: code ? { counts: code.counts, findings: code.findings, claims: code.claims } : null,
    events: evts.map((e) => ({ t: e.t, type: e.type, ok: e.ok, summary: e.summary })),
    nextActions,
    knownGap: stage.knownGap || null,
  };
}

function md(r) {
  const L = [];
  const badge = { clean: "CLEAN", advisory: "ADVISORY", blocked: "BLOCKED" }[r.verdict];
  L.push(`# Stage ${r.seq} · ${r.title} — ${badge}`, "", `Owner: \`${r.owner}\`${r.modes ? ` · modes: ${r.modes.join(", ")}` : ""}  `, `Reviewed ${r.generatedAt}`, "");
  if (r.nextActions.length) { L.push("## Do this next", ""); for (const a of r.nextActions) L.push(`- ${a}`); L.push(""); }
  L.push("## Gates", "");
  if (!r.gates.length) L.push("_No gate records. Nothing was run through `run-gate.mjs`, so no gate verdict survived this stage._", "");
  else {
    L.push("| gate | lens | result | why |", "|---|---|---|---|");
    for (const g of r.gates) L.push(`| \`${g.gate}\` | ${g.lens || "—"} | ${g.status === "pass" ? "pass" : `**FAIL** (exit ${g.exitCode})`} | ${g.reason || ""} |`);
    L.push("");
  }
  if (r.unrecordedGates.length) L.push(`> Declared but unrecorded: ${r.unrecordedGates.map((g) => `\`${g}\``).join(", ")}. An unrecorded gate is indistinguishable from a skipped one.`, "");
  L.push("## Artifacts", "");
  for (const a of r.artifacts) L.push(`- ${a.present === null ? "—" : a.present ? "✓" : "✗"} \`${a.path}\`${a.required ? " (required)" : ""}${a.count ? ` — ${a.count}` : ""}${a.note ? ` — ${a.note}` : ""}`);
  L.push("");
  for (const [name, rows] of [["UI", r.lenses.ui], ["Functional", r.lenses.functional], ["Code", r.lenses.code]]) {
    L.push(`## ${name}`, "");
    if (!rows.length) L.push("_no evidence for this lens at this stage_", "");
    else { for (const x of rows) L.push(`- ${x.ok === false ? "✗" : "✓"} \`${x.label}\` — ${x.detail}`); L.push(""); }
  }
  if (r.codeReview) {
    const c = r.codeReview.counts;
    L.push("## Emitted code", "", `${c.total} finding(s) · ${c.claims} avenue(s) declared closed (${c.claimsUnevidenced} unevidenced)`, "");
    for (const f of r.codeReview.findings) L.push(`- ${f.severity === "blocking" ? "✗" : "⚠"} **${f.rule}** \`${f.file}:${f.line}\` — ${f.message}`);
    if (r.codeReview.claims?.length) {
      L.push("", "<details><summary>Avenues this stage declared closed — re-check before trusting</summary>", "");
      for (const c2 of r.codeReview.claims.filter((x) => !x.evidenced)) L.push(`- \`${c2.file}:${c2.line}\` — ${c2.claim}`);
      L.push("", "</details>", "");
    }
  }
  if (r.shots.length) { L.push("## Frames", ""); for (const s of r.shots) L.push(`- \`${s}\``); L.push(""); }
  if (r.knownGap) L.push(`> Known gap: ${r.knownGap}`, "");
  return L.join("\n");
}

const wanted = has("--all")
  ? manifest.stages.filter((s) => existsSync(path.join(phaseDir, "gates", s.id)) || (s.produces || []).some((p) => !p.path.startsWith("<") && !p.path.includes("*") && existsSync(path.join(phaseDir, p.path))))
  : manifest.stages.filter((s) => s.id === flag("--stage"));

if (!wanted.length) { console.error(`✗ no matching stage. Known: ${manifest.stages.map((s) => s.id).join(", ")}`); process.exit(1); }

const out = [];
for (const stage of wanted) {
  const r = await reviewStage(stage);
  out.push(r);
  try {
    await fs.mkdir(path.join(phaseDir, "stage-review"), { recursive: true });
    await fs.writeFile(path.join(phaseDir, "stage-review", `${r.stage}.json`), JSON.stringify(r, null, 2) + "\n");
    await fs.writeFile(path.join(phaseDir, "stage-review", `${r.stage}.md`), md(r) + "\n");
  } catch { /* Silent — a review that breaks the run is worse than no review. */ }
}

if (has("--json")) console.log(JSON.stringify(out.length === 1 ? out[0] : out, null, 2));
else for (const r of out) {
  console.log(`\n${"═".repeat(72)}`);
  console.log(md(r).replace(/^#+ /gm, "").replace(/\*\*/g, "").replace(/`/g, ""));
}

process.exit(has("--strict") && out.some((r) => r.verdict === "blocked") ? 2 : 0);
