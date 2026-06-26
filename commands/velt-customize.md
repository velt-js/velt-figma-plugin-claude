---
description: Turn a Figma design into clean Velt UI customization (comments + notifications) on this React app, via Plan → coverage gate → Build → Judge.
argument-hint: "<figma-node-url> [target repo path]"
---

# /velt-customize

Run the velt-customize flow on the Figma design at **$ARGUMENTS**.

You are the entry point. The run is **block by block**: the design's Figma frames are enumerated into `blocks.json` (the completeness oracle), and the loop perfects one block before the next, terminating **mechanically** on `verdict-gate-blocks.mjs`'s exit code — not on `/goal` (an LLM judgment over the transcript that let prior runs stop early). The `velt-orchestrator` owns the loop in **owned-loop mode**; `/loop` is optional cadence only. The flow is:

### 1. Setup (once) — invoke `velt-orchestrator` in **setup mode**
Pass it: the Figma node/URL (from `$ARGUMENTS`; if absent, ask the user — an allowed blocking question), the target repo path (default: cwd), the feature scope (default: comments + notifications). In setup mode it: runs **preflight** (HALT on any hard ✗), pins the manifest version, runs the **planner** (recognize surfaces, pick layers, synthesize goals + the Connect Map), presents the **per-surface coverage matrix and STOPS for your one user choice**, records the chosen layers, and **initializes the run journal**. It returns the work-list + "ready to loop" (or `HALTED`/`BLOCKED`).

### 2. Run the block-by-block loop — `velt-orchestrator` in **owned-loop mode** (it owns the loop)
**After the coverage gate is answered**, invoke `velt-orchestrator` in **owned-loop mode**. It drives the whole loop internally and terminates **mechanically**, so the unreliable `/goal` terminator is gone:

- It iterates the **block queue** from `blocks.json` (every Figma frame/state). For each block: `velt-builder` patches it → `velt-judge` (fresh context) seeds + drives the state in-app, captures device-res, runs `visual-diff.mjs --mask-text-from` + `delta-compare` + the reconciliation/contract probes, and writes `block-report.json`.
- After each block it runs **`scripts/verdict-gate-blocks.mjs --blocks blocks.json --report block-report.json`**. The run ends **only** when that script exits 0 (every block built + driven + clean). A block may instead be BLOCKED (environment) or a VERIFIED gap (F3 exhaustion). **Termination is the gate's exit code over persisted artifacts — never an agent's "looks matched" claim, never `/goal`.**

### 3. (Optional) `/loop` for cadence + transcript visibility
If you want each block-iteration to land as its own main-session turn, you MAY wrap the loop with `/loop` invoking `velt-orchestrator` in **step mode** (one block-iteration per turn). This is cosmetic — the fidelity gate is always `verdict-gate-blocks.mjs`, never `/loop`'s "Claude decides done". When the gate exits 0 (or all remaining blocks are BLOCKED/gap), invoke the orchestrator once more to **write the reports**.

**Before doing anything, load the `velt-operating-brief` skill** (the flow + guardrails + verified facts) and treat `guide/` as the single source of truth. Carry no customization knowledge of your own; never hack (R0); never invent identifiers (R10).
