---
description: Turn a Figma design into clean Velt UI customization (comments + notifications) on this React app, via Plan → coverage gate → Build → Judge.
argument-hint: "<figma-node-url> [target repo path]"
---

# /velt-customize

Run the velt-customize flow on the Figma design at **$ARGUMENTS**.

You are the entry point. Delegate to the **velt-orchestrator** agent, which owns the run. Pass it:
- the Figma node/URL (from `$ARGUMENTS`; if absent, ask the user — this is an allowed blocking question),
- the target repo path (default: the current working directory),
- the feature scope (default: comments + notifications).

The orchestrator will: plan (recognize surfaces, pick layers, synthesize goals) → present the **per-surface coverage matrix and STOP for the user's choice** → then run the sequential Build → Judge loop, one surface at a time → write the reports.

**Before doing anything, load the `velt-operating-brief` skill** (the flow + guardrails + verified facts) and treat `guide/` as the single source of truth. Carry no customization knowledge of your own; never hack (R0); never invent identifiers (R10).
