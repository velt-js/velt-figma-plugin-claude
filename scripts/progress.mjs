#!/usr/bin/env node
// progress.mjs — a LIVE HEARTBEAT log for a velt-customize phase, so a long run is watchable and you
// can tell "working vs stuck" at a glance. Every velt-* agent (orchestrator/planner/builder/judge)
// appends a one-line event at each sub-step; you watch it live in a second terminal.
//
// It exists because subagents are opaque — their output never streams to the main view, so a long
// background plan looks stuck. A file, unlike streamed output, crosses the subagent boundary: the
// agents append here, you tail it. (There is no "every N seconds" timer — an agent emits when it acts;
// this instead emits one line per real sub-step, which is the honest "is it progressing?" signal.)
//
// Usage:
//   node scripts/progress.mjs <phaseDir> "<message>"   # append a timestamped line + echo it
//   node scripts/progress.mjs --watch <phaseDir>       # follow the log live (tail -f)

import { appendFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const a = process.argv.slice(2);

// resolve the NEWEST phase dir under <root>/.velt-customize/phases/ so --watch needs no phase-id
function newestPhaseDir(root = ".") {
  try {
    const base = path.resolve(root, ".velt-customize/phases");
    const subs = readdirSync(base).map((n) => path.join(base, n)).filter((p) => { try { return statSync(p).isDirectory(); } catch { return false; } });
    subs.sort((x, y) => statSync(y).mtimeMs - statSync(x).mtimeMs);
    return subs[0] || null;
  } catch { return null; }
}

if (a[0] === "--watch") {
  const dir = a[1] || newestPhaseDir();
  if (!dir) { console.error("no phase dir found under ./.velt-customize/phases/ — start a run first, or pass the dir explicitly"); process.exit(1); }
  const f = path.join(dir, "progress.log");
  console.log(`▶ watching ${f} (Ctrl-C to stop)`);
  spawn("tail", ["-n", "80", "-F", f], { stdio: "inherit" });   // -F: follow even before the file exists / on rotation
} else {
  const [dir, ...rest] = a;
  const msg = rest.join(" ").trim();
  if (!dir || !msg) { console.error('usage: progress.mjs <phaseDir> "<message>"  |  --watch <phaseDir>'); process.exit(1); }
  const t = new Date().toTimeString().slice(0, 8);          // HH:MM:SS (node has Date via the shell)
  const line = `[${t}] ${msg}`;
  try { mkdirSync(dir, { recursive: true }); appendFileSync(path.join(dir, "progress.log"), line + "\n"); } catch { /* best-effort; never block the run on logging */ }
  console.log(line);
}
