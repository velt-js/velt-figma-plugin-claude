#!/usr/bin/env node
// run-gate.mjs — run any pipeline gate so its outcome survives the shell.
//
// WHY THIS EXISTS
// Roughly half the gates in this pipeline leave NO trace. `skeleton-check`, `contract-check`, every
// lint, `brief-scaffold --lint-*`, `scaffold-primitives --lint`, `check-primitive-reachability` and
// `preflight-env` write no file at all; `judge2-*`, `verify-host-wiring`, `mock-gate`,
// `golden-path-check`, `regression-guard` and `builder-self-audit` write a file but emit no obs
// event. Either way the verdict exists only as an exit code in a shell that has already exited, so
// "what did stage 5a2's skeleton gate actually say" is unanswerable ten minutes later.
//
// This wrapper runs the gate unchanged, records what happened, and EXITS WITH THE CHILD'S CODE. That
// last part is the whole contract: every orchestrator rule of the form "must exit 0" keeps working
// with the wrapper in front of it, so adopting it is a text substitution and never a behaviour change.
//
// Recording is FAIL-SAFE by construction. Every write is inside try/catch and the exit code is taken
// from the child before any of it runs — an observability layer that can fail a build is worse than
// no observability layer.
//
// USAGE
//   node scripts/run-gate.mjs <phaseDir> <stageId> <gateId>            # command resolved from manifest/stages.json
//   node scripts/run-gate.mjs <phaseDir> <stageId> <gateId> -- <cmd…>  # explicit command
//   ... --app-dir <p> --app-url <u> --file-key <k> --node-id <n> --surfaces <a,b> --marker <m>
//   ... --browser-ws <ws>   (or $VELT_CDP_WS) for the gates that require a real browser
//   ... --json          # print the gate record instead of the child's own stdout
//
// EXIT: the child's exit code, verbatim. 64 = usage error in this wrapper itself.

import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { obsEvent } from "./obs.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const dashdash = argv.indexOf("--");
const head = dashdash === -1 ? argv : argv.slice(0, dashdash);
const explicitCmd = dashdash === -1 ? null : argv.slice(dashdash + 1);
const flag = (n, d = null) => { const i = head.indexOf(n); return i >= 0 && head[i + 1] ? head[i + 1] : d; };
const positional = head.filter((a, i) => !a.startsWith("--") && !(i > 0 && head[i - 1].startsWith("--")));

const [phaseDirArg, stageId, gateId] = positional;
if (!phaseDirArg || !stageId || !gateId) {
  console.error("usage: run-gate.mjs <phaseDir> <stageId> <gateId> [--app-dir p] [--app-url u] [-- <cmd…>]");
  process.exit(64);
}
const phaseDir = path.resolve(phaseDirArg);

// Placeholders the manifest's `cmd` arrays carry. Anything unresolved is reported rather than passed
// through as a literal "<appDir>", which would fail deep inside the gate with a confusing message.
const SUBS = {
  "<phaseDir>": phaseDir,
  "<appDir>": flag("--app-dir", process.cwd()),
  "<appUrl>": flag("--app-url", process.env.VELT_APP_URL || ""),
  "<fileKey>": flag("--file-key", ""),
  "<nodeId>": flag("--node-id", ""),
  "<surfaces>": flag("--surfaces", ""),
  "<marker>": flag("--marker", ""),
  // The measurement gates need a REAL browser endpoint. Without a placeholder for it the manifest
  // could not express the dependency, so run-gate invoked them with no --connect and they failed as
  // "environment" — which reads like a broken machine rather than a missing argument.
  "<browserWs>": flag("--browser-ws", process.env.VELT_CDP_WS || ""),
};

const manifest = await fs.readFile(path.join(ROOT, "manifest/stages.json"), "utf8").then(JSON.parse).catch(() => null);
const stage = manifest?.stages?.find((s) => s.id === stageId) || null;
const gate = stage?.gates?.find((g) => g.id === gateId) || null;

let cmd = explicitCmd;
if (!cmd) {
  if (!gate) {
    console.error(`✗ run-gate: no gate '${gateId}' on stage '${stageId}' in manifest/stages.json, and no explicit -- <cmd>`);
    process.exit(64);
  }
  cmd = gate.cmd.map((tok) => (tok in SUBS ? SUBS[tok] : tok));
  // A manifest token that resolves to "" would silently become an empty argv slot.
  const unresolved = gate.cmd.filter((tok) => tok in SUBS && !SUBS[tok]);
  if (unresolved.length) {
    console.error(`✗ run-gate: unresolved placeholder(s) ${unresolved.join(", ")} — pass them as flags (e.g. --app-dir, --app-url).`);
    process.exit(64);
  }
}
// `node scripts/x.mjs` in the manifest is repo-relative; resolve it so the gate runs from any cwd.
cmd = cmd.map((tok) => (typeof tok === "string" && tok.startsWith("scripts/") ? path.join(ROOT, tok) : tok));

const startedAt = new Date().toISOString();
const t0 = Date.now();
const res = spawnSync(cmd[0], cmd.slice(1), { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const durationMs = Date.now() - t0;

// The child's code is captured FIRST and is what we exit with, whatever happens below.
// A signal (null code) is reported as 1 rather than 0 — a killed gate is not a passing gate.
const code = res.status === null ? 1 : res.status;
const stdout = res.stdout || "";
const stderr = res.stderr || "";

// --- interpret the code against the gate's own contract -------------------------------------
// Exit contracts are NOT uniform here: lint-primitives fails with 1, most gates with 2,
// console-health and browser-endpoint with 3, block-iter with 4/5. Each gate declares its own.
const pass = gate?.pass || [0];
const failMap = gate?.fail || {};
const status = pass.includes(code) ? "pass" : (String(code) in failMap ? "fail" : (code === 0 ? "pass" : "fail"));
const reason = String(code) in failMap ? failMap[String(code)] : (status === "pass" ? null : `exit ${code} (not in this gate's declared contract)`);

const tail = (s, n = 4000) => (s.length > n ? "…\n" + s.slice(-n) : s);
let parsed = null;
try { const t = stdout.trim(); if (t.startsWith("{") || t.startsWith("[")) parsed = JSON.parse(t); } catch { /* not JSON — fine */ }

const record = {
  stage: stageId,
  gate: gateId,
  lens: gate?.lens || null,
  blocking: gate?.blocking ?? true,
  why: gate?.why || null,
  cmd,
  startedAt,
  durationMs,
  exitCode: code,
  signal: res.signal || null,
  status,
  reason,
  stdoutTail: tail(stdout),
  stderrTail: tail(stderr),
  json: parsed,
};

try {
  const outDir = path.join(phaseDir, "gates", stageId);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, `${gateId}.json`), JSON.stringify(record, null, 2) + "\n");
} catch { /* Silent — recording must never change the outcome. */ }

try {
  obsEvent(phaseDir, {
    type: "gate",
    src: "run-gate",
    stage: stageId,
    ok: status === "pass",
    summary: `${stageId}/${gateId} — ${status.toUpperCase()}${reason ? `: ${reason}` : ""} (${(durationMs / 1000).toFixed(1)}s)`,
    data: { gate: gateId, lens: gate?.lens || null, blocking: gate?.blocking ?? true, exitCode: code, reason },
    artifacts: { record: path.posix.join("gates", stageId, `${gateId}.json`) },
  });
} catch { /* Silent. */ }

if (head.includes("--json")) console.log(JSON.stringify(record, null, 2));
else { if (stdout) process.stdout.write(stdout); if (stderr) process.stderr.write(stderr); }

process.exit(code);
