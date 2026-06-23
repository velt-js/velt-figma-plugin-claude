---
name: velt-operating-brief
description: The operating rules for a velt-customize run — the flow, the strict guardrails, and the verified facts. Read at the start of any Velt UI customization run (invoked by /velt-customize and the velt-orchestrator).
---

# velt-customize — operating brief

Turning a Figma design into clean Velt UI customization (comments + notifications, React) via Planner → Builder → Judge.

## The one rule that governs everything
**`guide/` is the single source of truth. You carry no customization knowledge of your own.** For any decision — which component, which layer, which identifier, how to verify, how to handle a blocker — READ the relevant `guide/` file and apply it. Never invent a slot/prop/variable/class/hook (R10). Never hack (R0): if a goal has no clean supported path, report an SDK gap — never a DOM/timing workaround.

## Flow (do not skip preflight or the gate)
0. **Preflight (before anything) — fail fast, fail clear.** Check + print a ✓/⚠/✗ readiness summary with a plain-language fix per item: guide bundled · **Figma reachable + node resolves (Dev Mode)** · **Velt installed in the repo** · **app runs + Velt renders** (capture the default-UI baseline) · **`claude-in-chrome` connected** · **auth** (never enter creds — manual login → pause and ask). Hard items (guide/Figma/Velt-installed/app) must pass to plan → any ✗ **HALTS with the fix and changes nothing**; translate tool errors into plain language, never dump a raw stack. Chrome + auth are **deferred** → warn now, enforced at the coverage gate. Idempotent — fix and re-run.
1. **Plan (read-only):** recognize design → component via `guide/reference/component-definitions.md`; pick the layer per surface via `guide/02-decision-tree.md` (Q1–Q4 + S1–S6); resolve identifiers from `guide/reference/*`; synthesize goals from `guide/verifying-a-customization.md`.
2. **Coverage gate:** present the per-surface coverage matrix + recommendation and **STOP — wait for the user to confirm/adjust** before writing any code.
3. **Build → Judge loop, ONE surface at a time (R16):**
   - **Builder** (maker, scoped to one surface): follow `guide/approaches/<layer>.md`; files under `components/velt/ui-customization/` (R11); one stylesheet (R8); one `<VeltWireframe>` (R1).
   - **Judge** (checker, independent, **fresh context**): given only goals + Figma + code + running app, never the build's reasoning. Prompted to **disprove** "met"; a goal passes only on **captured browser evidence**. Verify in Chrome.
   - Climb only as needed: **retry** (≤3/layer) → **escalate layer** (≤1/surface) → **SDK gap**. Stuck-detection aborts no-progress/oscillating retries early.
4. **Report:** coverage estimated-vs-actual, `sdk-gap-report.md`, screenshots, code.

## Hard guardrails
- Verify each surface before the next (R15/R16). A goal is never "met" without evidence.
- Never enter credentials; use the app's existing auth/test harness — if manual login is needed, pause and ask.
- Touch only `components/velt/ui-customization/` + the report dir. No deletes, no config/build changes, no commits unless asked.
- Only two blocking questions: the Figma node, and the coverage-gate choice. (Plus pausing for manual auth.)

## Verified facts (don't relitigate — full detail in the guide)
One `<VeltWireframe>` per app · container slots drop undeclared children → declare the full tree · `ThreadCard` MUST nest in `Body → Threads` · root wireframe auto-removes shadow, nested-only needs `shadowDom={false}` · CSS variables cross shadow, class CSS doesn't · pin index/number slots are empty → fill via `velt-data` · use `VeltCommentDialog`, never the deprecated `VeltCommentThread`.

## When unsure
Read the guide file. If the guide doesn't cover it and the SDK can't do it cleanly → it's an SDK gap (`guide/sdk-gaps-and-blockers.md`), not a hack.
