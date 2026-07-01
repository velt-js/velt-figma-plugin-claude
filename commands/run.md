---
description: Turn a Figma design into clean Velt UI customization (comments + notifications) on this app, via Plan → approach gate → Build → Judge, one Loop (phase) at a time.
argument-hint: "<figma-loop-node-url> [--mode <approach>]"
---

# /velt-customize:run

Run the velt-customize flow on the Figma **Loop** at **$ARGUMENTS**, **in the current project** (cwd — there is no separate target-repo argument).

You are the entry point. The run is **phase by phase, block by block**. A **phase = one `Loop` node** (the user passes one at a time; see the Loop template in [`velt-operating-brief`](../skills/velt-operating-brief/SKILL.md) + `guide/`). Its frames are enumerated into `blocks.json` (the completeness oracle) — `Flows` frames become full-surface acceptance blocks, `State` frames become component blocks — and the loop perfects one block before the next, terminating **mechanically** on `verdict-gate-blocks.mjs`'s exit code, never on `/goal`. The `velt-orchestrator` owns the loop in **owned-loop mode**; `/loop` is optional cadence only. The flow is:

### Watch it live (recommended)
The heavy work runs in subagents whose output doesn't stream here, so the orchestrator writes a **heartbeat log**. It prints a watch command as its first line — run it in a **second terminal** to see every sub-step in real time (so you always know working-vs-stuck):
```
node scripts/progress.mjs --watch <the phase dir it prints>    # or: tail -f <phaseDir>/progress.log
```

### 1. Setup (once) — invoke `velt-orchestrator` in **setup mode**
Pass it: the Figma Loop node/URL (from `$ARGUMENTS`; if absent, ask — an allowed blocking question), the target = **cwd**, the feature scope (default: comments + notifications), and the **approach** (see the gate below). In setup mode it: runs **preflight** (HALT on any hard ✗); **enforces the Approach Gate** (below); **loads cross-phase memory** (`node scripts/memory.mjs load` — advisory tokens/mappings/naming/corrections, re-verified against fresh extraction, stale entries flagged); pins the manifest; runs the **planner** (recognize surfaces, pick layers within the chosen approach, synthesize goals + the Connect Map); enumerates the Loop (`enumerate-blocks.mjs` → `Loop → State/Flows` blocks — **rejecting a URL with no `node-id`** and **warning if it yields more than ~8 blocks**); presents the **per-surface coverage matrix**; and **initializes the phase journal**. It returns the work-list + "ready to loop" (or `HALTED`/`BLOCKED`).

### Approach Gate (MANDATORY — never skipped)
The approach is a required input every run: **`strictly wireframe` | `strictly primitives` | `wireframes + primitives` | `freeform`**. It is supplied via `--mode` or stated in the instruction. **If none is given, HALT and ask the user which approach to use, presenting your own per-surface recommendation with the reasoning from `guide/02-decision-tree.md`.** Never auto-pick, never infer silently, never proceed without an explicit answer. Record the chosen mode in the journal + `memory.json`. (`strictly primitives` marks a piece `mode_blocked` rather than silently inserting a wireframe.)

### 2. Run the block-by-block loop — `velt-orchestrator` in **owned-loop mode** (it owns the loop)
**After the approach is set and the coverage matrix is shown**, invoke `velt-orchestrator` in **owned-loop mode**. It drives the whole loop internally and terminates **mechanically**:

- It iterates the **block queue** from `blocks.json` (every `Flows` + `State` frame). For each block: `velt-builder` patches it → `velt-judge` (fresh context) seeds + drives the state in-app, runs the **cheap inner verify** (`delta-compare` + reconciliation/contract/stability probes) each iteration, and only at a PASS-candidate takes the device-res capture + `visual-diff.mjs --mask-frame` + icon identity, then writes `block-report.json`.
- **Bounds are enforced (harness-owned):** ≤12 iterations or ≤8 min per block; a retry is accepted only if the failing-diff count strictly drops; plateau (2 no-progress retries) → escalate the layer once → else mark the block `STUCK`. **Phase soft-cap:** at 60 min stop *starting* new blocks, let the in-flight block finish within a ~15–20 min grace, then stop and record un-started blocks under `report.phase.remaining`.
- After each block it runs **`scripts/verdict-gate-blocks.mjs --blocks blocks.json --report block-report.json`** → `PASS`(0) / `FAIL`(2) / `INCOMPLETE`(3) / `STOPPED`(4). The run ends when the gate exits **0** (every block PASS, or verified `BLOCKED`/`GAP`) **or 4** (`STOPPED` — bounds/soft-cap hit; the remaining/stuck list is handed off). `INCOMPLETE`/`FAIL` mean keep looping. **Termination is the gate's exit code over persisted artifacts — never an agent's "looks matched" claim, never `/goal`.**

### 3. Handoff + phase completion
When the loop stops (gate 0 or 4), the orchestrator writes the **phase handoff** ([`templates/phase-handoff.md`](../templates/phase-handoff.md)): the `git diff` of `components/velt/ui-customization/`, the per-block disposition table (PASS / STUCK / BLOCKED / GAP / REMAINING), what it's uncertain about, what it could NOT verify, exact fix-instruction examples, and a recommendation (say **"phase N complete"** vs instruct a fix). On **"phase N complete"** it snapshots and freezes verified learnings into memory (`node scripts/memory.mjs promote`). To correct a specific mismatch, use `/velt-customize:fix` (surgical edit + re-verify the affected block **and its shared-selector blast radius**).

### (Optional) `/loop` for cadence
You MAY wrap the loop with `/loop` invoking `velt-orchestrator` in **step mode** (one block-iteration per turn) for transcript visibility. Cosmetic only — the fidelity gate is always `verdict-gate-blocks.mjs`.

**Before doing anything, load the `velt-operating-brief` skill** (the flow + guardrails + verified facts) and treat `guide/` as the single source of truth. Carry no customization knowledge of your own; never hack (R0); never invent identifiers (R10).
