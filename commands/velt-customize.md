---
description: Turn a Figma design into clean Velt UI customization (comments + notifications) on this React app, via Plan → coverage gate → Build → Judge.
argument-hint: "<figma-node-url> [target repo path]"
---

# /velt-customize

Run the velt-customize flow on the Figma design at **$ARGUMENTS**.

You are the entry point, and — because **only you can type slash commands** — **you own the loop and its terminator** via Claude Code's native **`/loop`** and **`/goal`**. The orchestrator no longer owns the run; it runs **setup** once and then **advances one patch per loop turn**. The flow is:

### 1. Setup (once) — invoke `velt-orchestrator` in **setup mode**
Pass it: the Figma node/URL (from `$ARGUMENTS`; if absent, ask the user — an allowed blocking question), the target repo path (default: cwd), the feature scope (default: comments + notifications). In setup mode it: runs **preflight** (HALT on any hard ✗), pins the manifest version, runs the **planner** (recognize surfaces, pick layers, synthesize goals + the Connect Map), presents the **per-surface coverage matrix and STOPS for your one user choice**, records the chosen layers, and **initializes the run journal**. It returns the work-list + "ready to loop" (or `HALTED`/`BLOCKED`).

### 2. Set the terminator — native `/goal`
**After the coverage gate is answered**, set:

```
/goal Every in-scope surface is matched per the MECHANICAL verdict-gate, not an agent's say-so. Each loop the velt-judge emits judge-report.json over the GENERATED checklist.json and runs scripts/verdict-gate.mjs; its output is surfaced in the transcript. Done requires verdict-gate VERDICT: PASS for every surface — which requires 100% checklist coverage (every distinct styled appearance + every mustSupply + every required state has a disposition), the visual side-by-side artifact present per state with NO nameable difference, and gross/style/layout/reconciliation clean + mount-map contract ok. A verdict of INCOMPLETE (coverage < 100%, a state not driven, or the visual artifact missing) is NOT done — keep looping. A surface may instead be BLOCKED (environment) or a VERIFIED gap (F3 exhaustion). Do NOT conclude done from any "looks matched" claim — only from a surfaced verdict-gate PASS. Stop only if BLOCKED/gap, or after the run's turn budget — and then report the remaining INCOMPLETE/FAIL items honestly rather than claiming a match.
```

### 3. Drive the iteration — native `/loop`
Then set `/loop` so **each turn advances exactly one Build→Judge patch in the main session** (this is why the loop is native: each Judge turn is a main-session turn `/goal` can read):

```
/loop Advance the velt-customize Build→Judge loop by ONE patch. Invoke velt-orchestrator in STEP mode (it reads the journal, picks the next surface/patch per R16, invokes velt-builder for that one patch, then velt-judge in fresh context, appends the verdict to the journal, and applies the escalation ladder + stuck-detection). Its final message — the velt-judge's FULL surfaced evidence (gross check + style + layout delta tables + named visual diffs + verdict) plus the per-surface status — is your turn output, so it lands in the transcript for /goal to evaluate. Do not declare anything matched yourself; only surface the Judge's evidence. If the orchestrator reports BLOCKED, surface the fix and keep the loop paused.
```

`/goal` evaluates that surfaced evidence each turn and stops the loop when every surface is matched/blocked/verified-gap. When it stops, invoke the orchestrator once more to **write the reports**.

### Availability + fallback
**Preflight checks `/goal` and `/loop` availability** (Claude Code version + hooks/trust). If **either** is unavailable, fall back: invoke `velt-orchestrator` in **owned-loop mode** (it drives the Build→Judge loop internally as before) — it **still uses the fresh-context velt-judge as the separate verifier**, the builder never self-judges, and `/loop`'s native "Claude decides done" is never the fidelity gate (only `/goal`'s condition, or the Judge in fallback, is).

**Before doing anything, load the `velt-operating-brief` skill** (the flow + guardrails + verified facts) and treat `guide/` as the single source of truth. Carry no customization knowledge of your own; never hack (R0); never invent identifiers (R10).
