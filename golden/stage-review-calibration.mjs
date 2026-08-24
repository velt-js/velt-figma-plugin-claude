// stage-review-calibration.mjs — locks the per-stage review layer.
//
// The layer's whole value is that it SPEAKS UP. A review that silently reports "clean" because its
// input moved, a script got renamed, or a detector stopped matching is worse than no review: it
// converts an unknown into a false assurance. Everything here is aimed at that failure mode.
//
// Offline, no browser, no target app. Temp trees live under os.tmpdir().

import { spawnSync } from "node:child_process";
import { promises as fs, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const ok = (label, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`); }
};
// Every child gets a hard timeout. A suite that can hang is a suite that blocks CI and gets
// disabled; a gate that stops responding should FAIL loudly instead.
const run = (script, args, opts = {}) => {
  const r = spawnSync("node", [path.join(ROOT, "scripts", script), ...args],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 30_000, ...opts });
  if (r.error?.code === "ETIMEDOUT" || r.signal) return { code: 124, out: r.stdout || "", err: `TIMED OUT after 30s: ${script} ${args.join(" ")}` };
  return { code: r.status, out: r.stdout || "", err: r.stderr || "" };
};

export async function calibrateStageReview() {
  console.log("\nstage-review calibration");

  // --- 1. the manifest is the spine — it must not drift from the scripts it names ---------------
  const M = JSON.parse(await fs.readFile(path.join(ROOT, "manifest/stages.json"), "utf8"));
  ok("stages.json parses and declares stages", Array.isArray(M.stages) && M.stages.length >= 10, `${M.stages?.length} stage(s)`);
  ok("every stage has id, seq, title, owner", M.stages.every((s) => s.id && s.seq && s.title && s.owner));
  ok("stage ids are unique", new Set(M.stages.map((s) => s.id)).size === M.stages.length);

  // A gate naming a script that no longer exists is the classic silent-drift failure: run-gate would
  // report a spawn error as a gate FAILURE and nobody would know the manifest was stale.
  const missing = [];
  for (const s of M.stages) for (const g of s.gates || []) {
    const tok = g.cmd.find((t) => typeof t === "string" && t.startsWith("scripts/"));
    if (tok && !existsSync(path.join(ROOT, tok))) missing.push(`${s.id}/${g.id} -> ${tok}`);
  }
  ok("every gate command names a script that exists", missing.length === 0, missing.join(", "));

  // Every gate must declare its own pass set, because the exit contracts are NOT uniform in this
  // codebase (lint-primitives fails with 1, most gates with 2, console-health with 3, block-iter 4/5).
  ok("every gate declares a pass set", M.stages.every((s) => (s.gates || []).every((g) => Array.isArray(g.pass) && g.pass.length)));
  ok("every gate declares a lens", M.stages.every((s) => (s.gates || []).every((g) => ["ui", "functional", "code"].includes(g.lens))));

  // The stage ids that overlap stage-timer's ledger must match exactly, or the player's rail and
  // stage-state.json will never join to the review.
  const timer = await fs.readFile(path.join(ROOT, "scripts/stage-timer.mjs"), "utf8");
  const caps = [...timer.matchAll(/"?([a-z-]+)"?\s*:\s*\d+/g)].map((m) => m[1]);
  for (const id of ["plan-structure", "build-structure", "plan-style", "build-style"])
    ok(`stage id '${id}' matches stage-timer's ledger`, M.stages.some((s) => s.id === id) && caps.includes(id));

  // --- 2. run-gate: the exit code is sacred -----------------------------------------------------
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "velt-sr-"));
  const phase = path.join(tmp, "phase");
  await fs.mkdir(phase, { recursive: true });

  const passthru = run("run-gate.mjs", [phase, "build-primitives", "probe", "--", "node", "-e", "process.exit(7)"]);
  ok("run-gate exits with the CHILD's code, not its own", passthru.code === 7, `got ${passthru.code}`);
  ok("run-gate writes a record for an ad-hoc gate", existsSync(path.join(phase, "gates/build-primitives/probe.json")));

  const rec = JSON.parse(await fs.readFile(path.join(phase, "gates/build-primitives/probe.json"), "utf8"));
  ok("the record carries the exit code and a status", rec.exitCode === 7 && rec.status === "fail");

  const evts = (await fs.readFile(path.join(phase, "obs/events.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
  ok("run-gate emits a stage-labelled obs event", evts.some((e) => e.type === "gate" && e.stage === "build-primitives" && e.ok === false));

  // A gate whose exit code IS in its declared contract must still be reported with that contract's
  // reason rather than a bare number — that reason is the whole point of the manifest.
  const linted = run("run-gate.mjs", [phase, "build-primitives", "lint-primitives", "--app-dir", path.join(ROOT, "golden/primitives/bad")]);
  ok("a manifest gate resolves its own command", linted.code === 1, `got ${linted.code}`);
  const lrec = JSON.parse(await fs.readFile(path.join(phase, "gates/build-primitives/lint-primitives.json"), "utf8"));
  ok("a declared failure code is explained, not just numbered", /errors/.test(lrec.reason || ""), lrec.reason || "(no reason)");
  ok("the gate's own JSON output is captured for the reviewer", lrec.json && lrec.json.errors > 0);

  // Recording must never be able to fail a build. Asserted STATICALLY rather than by pointing the
  // wrapper at an unwritable directory: that spawn is a reproducible 37ms standalone but stalls
  // inside this suite in at least one sandbox, and a check that times out for environmental reasons
  // gets disabled — which is the exact false-assurance failure this suite exists to prevent. The
  // source-level invariant is also the stronger claim: it covers every write, not one instance.
  const rg = await fs.readFile(path.join(ROOT, "scripts/run-gate.mjs"), "utf8");
  ok("run-gate captures the child's code BEFORE any recording runs",
    rg.indexOf("const code = res.status") < rg.indexOf("await fs.mkdir"));
  ok("run-gate exits with that captured code", /process\.exit\(code\);\s*$/.test(rg.trim()));
  const guarded = (needle) => {
    const i = rg.indexOf(needle);
    if (i === -1) return false;
    const before = rg.slice(0, i);
    return before.lastIndexOf("try {") > before.lastIndexOf("} catch");
  };
  ok("the phaseDir write is inside try/catch", guarded("await fs.writeFile(path.join(outDir"));
  ok("the obs event is inside try/catch", guarded("obsEvent(phaseDir, {"));

  // --- 3. code-review discriminates ------------------------------------------------------------
  // Via --files, deliberately: `git init` does not complete in every sandbox this suite runs in, and
  // a calibration that needs a git repo is a calibration that silently stops running.
  const CR = path.join(ROOT, "golden/code-review");
  const review = (file, stage = "build-primitives") =>
    JSON.parse(run("code-review.mjs", [phase, "--stage", stage, "--app-dir", CR, "--files", file, "--json"]).out);

  const bad = review("bad.tsx");
  const rules = new Set(bad.findings.map((f) => f.rule));
  ok("code-review reviews exactly the named file", bad.filesReviewed.join(",") === "bad.tsx", bad.filesReviewed.join(","));
  ok("C2 catches a capability frozen into a constant", rules.has("C2"));
  ok("C3 catches state encoded as a className ternary", rules.has("C3"));
  ok("C4 catches an authored data-velt-* attribute", rules.has("C4"));
  ok("C4 is BLOCKING — the SDK namespace is not the customer's to write", bad.findings.some((f) => f.rule === "C4" && f.severity === "blocking"));
  ok("C5 catches console.log residue", rules.has("C5"));
  ok("C6 catches an unresolved marker", rules.has("C6"));
  ok("C7 catches a design value inlined in a style object", rules.has("C7"));
  ok("a dead-end claim is COLLECTED for review, never reported as a finding",
    bad.counts.claimsUnevidenced === 1 && !rules.has("C1"), `${bad.counts.claims} claim(s), rules ${[...rules].join(",")}`);

  const good = review("good.tsx");
  ok("the corrected form produces NO findings", good.counts.total === 0, JSON.stringify(good.findings.map((f) => f.rule)));
  ok("an EVIDENCED dead end is recorded but not flagged for re-checking",
    good.counts.claims === 1 && good.counts.claimsUnevidenced === 0, JSON.stringify(good.counts));

  // The false positive that made the first cut unusable: a CSS selector READING data-velt-hidden is
  // the SDK-documented way to consume that signal — the opposite of authoring one.
  const cssFile = path.join(os.tmpdir(), `velt-cr-${process.pid}.css`);
  await fs.writeFile(cssFile, `.vc-row:has(> velt-x[data-velt-hidden="true"]) { display: none !important; }\n`);
  const css = JSON.parse(run("code-review.mjs", [phase, "--stage", "build-style", "--app-dir", CR, "--files", cssFile, "--json"]).out);
  ok("reading data-velt-* from a stylesheet is NOT flagged", !css.findings.some((f) => f.rule === "C4"));
  await fs.rm(cssFile, { force: true });

  // --- 4. stage-review's verdict ladder ---------------------------------------------------------
  const sr = (dir, extra = []) => run("stage-review.mjs", [dir, "--stage", "build-primitives", "--app-dir", path.join(ROOT, "golden/primitives/bad"), "--json", ...extra]);
  const blocked = JSON.parse(sr(phase).out);
  ok("a failing BLOCKING gate makes the stage BLOCKED", blocked.verdict === "blocked", blocked.verdict);
  ok("the review says what to do next", blocked.nextActions.some((a) => /FIX then re-run/.test(a)));

  const clean = path.join(tmp, "clean");
  await fs.mkdir(clean, { recursive: true });
  run("run-gate.mjs", [clean, "build-primitives", "lint-primitives", "--app-dir", path.join(ROOT, "golden/primitives/good")]);
  run("run-gate.mjs", [clean, "build-primitives", "verify-host-wiring", "--", "node", "-e", "process.exit(0)"]);
  const cleanRes = JSON.parse(run("stage-review.mjs", [clean, "--stage", "build-primitives", "--app-dir", path.join(ROOT, "golden/primitives/good"), "--json"]).out);
  ok("all gates passing and nothing flagged reads CLEAN", cleanRes.verdict === "clean", `${cleanRes.verdict}: ${JSON.stringify(cleanRes.nextActions)}`);

  // An unrecorded gate must never look like a passing one.
  const partial = path.join(tmp, "partial");
  await fs.mkdir(partial, { recursive: true });
  run("run-gate.mjs", [partial, "build-primitives", "verify-host-wiring", "--", "node", "-e", "process.exit(0)"]);
  const part = JSON.parse(run("stage-review.mjs", [partial, "--stage", "build-primitives", "--app-dir", path.join(ROOT, "golden/primitives/good"), "--json"]).out);
  ok("a declared-but-unrecorded gate is called out", part.unrecordedGates.includes("lint-primitives"));
  ok("an unrecorded gate is NOT reported as clean", part.verdict !== "clean", part.verdict);

  // The five live gates whose JSON nothing has ever read must reach the right lens.
  await fs.writeFile(path.join(clean, "console-health.json"), JSON.stringify({ ok: false, storm: true, signature: "TypeError x142" }));
  await fs.writeFile(path.join(clean, "mock-gate.json"), JSON.stringify({ ok: true, failed: [] }));
  const lensed = JSON.parse(run("stage-review.mjs", [clean, "--stage", "build-primitives", "--app-dir", path.join(ROOT, "golden/primitives/good"), "--json"]).out);
  ok("console-health lands on the FUNCTIONAL lens", lensed.lenses.functional.some((l) => l.label === "console-health.json" && l.ok === false));
  ok("mock-gate lands on the UI lens", lensed.lenses.ui.some((l) => l.label === "mock-gate.json"));
  ok("previously-unread evidence changes the verdict", lensed.verdict !== "clean", lensed.verdict);

  await fs.rm(tmp, { recursive: true, force: true });
  console.log(fail ? `  ✗ ${fail} stage-review check(s) FAILED` : `  ✓ ${pass} stage-review checks green`);
  return fail === 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const okAll = await calibrateStageReview();
  process.exit(okAll ? 0 : 1);
}
