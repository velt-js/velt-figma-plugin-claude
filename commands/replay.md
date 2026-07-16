---
description: Open the session-replay player for a velt-customize run — every stage and fix-loop iteration with its screenshot, judge output, and timings, so you can pinpoint exactly where a run went wrong.
argument-hint: "[<phaseId>] [--port 4173] [--build-only]"
---

# /velt-customize:replay

Build (and serve) the **run replay player** for a phase in the **current project** (cwd). The player is a self-contained page — timeline scrubber, per-loop iteration lanes with diff-count sparklines, Live / Reference / Diff / Compare screenshot views, and the judge's structured output per event — generated from the run's automatic observability record under `<phaseDir>/obs/` (`events.jsonl` + per-iteration snapshots; recorded by the pipeline scripts themselves, no agent compliance needed).

## What to do
1. **Resolve the phaseDir.** If `$ARGUMENTS` names a `<phaseId>`, it is `.velt-customize/phases/<phaseId>/`; otherwise pick the NEWEST dir under `.velt-customize/phases/` (same rule as `progress.mjs --watch`). If none exists, say so — there is nothing to replay until a run has started.
2. **Build the player** (always rebuild — it inlines the data at build time, so a stale build misses new events):
   ```
   node <plugin>/scripts/obs.mjs build <phaseDir>
   ```
3. **Serve it** (unless `--build-only`): run in the background and print the URL for the user —
   ```
   node <plugin>/scripts/obs.mjs serve <phaseDir> [--port 4173]
   ```
   The page also opens directly via `file://<phaseDir>/obs/player.html` (data is inlined; images are relative), so if serving is inconvenient just print that path.
4. **Orient the user in one line each**: red ticks = failures, amber = warnings (plateau / timeouts / env pauses); the player auto-selects the FIRST failing event; "issues only" + the per-loop filter jump straight to where the run drifted; `obs.mjs status <phaseDir>` summarizes the record.

Mid-run is fine — events append live; rebuild (step 2) and reload to pick up the latest. `VELT_OBS=0` in the run's env disables recording entirely (then there is nothing to replay — say so rather than serving an empty page).

This is a mechanical file op — no agent, no guide needed.
