---
description: Review one stage of a run — gates, artifacts, UI, behaviour and emitted code — and say what to fix.
argument-hint: "[stage-id | --all] [--phase <phaseId>]"
---

# /velt-customize:review

Answers **"did that stage go right, and if not, what exactly is wrong"** for one stage of a run,
without re-running anything. Safe at any time, including long after the run finished.

## Run it

```bash
# the phase dir for the current run
PHASE=$(node scripts/phase-init.mjs --id <phaseId>)

# one stage
node scripts/stage-review.mjs "$PHASE" --stage build-primitives --app-dir <appDir>

# every stage that has left evidence
node scripts/stage-review.mjs "$PHASE" --all --app-dir <appDir>
```

Stage ids come from `manifest/stages.json`: `preflight · enumerate · plan-structure · plan-primitives ·
build-structure · build-primitives · dom-snapshot · plan-style · build-style · judge · fix · wrapup`.

## What you get

`<phaseDir>/stage-review/<stage>.md` (readable) and `.json` (machine), plus the same thing on stdout:

- **Verdict** — `clean` / `advisory` / `blocked`, and a **Do this next** list with the exact command to re-run.
- **Gates** — every gate that ran, its exit code, and what that code MEANS for that gate (the contracts
  are not uniform: `lint-primitives` fails with 1, most gates with 2, `console-health` with 3).
- **Artifacts** — what the stage was supposed to produce and whether it did.
- **Three lenses** — `ui` (captures, diffs, mock scores), `functional` (driven interactions, console
  health, drive contract), `code` (the lints plus `code-review.mjs`). A stage can be pixel-perfect and
  dead, so these never collapse into one score.
- **Emitted code** — findings on the lines this run ADDED, plus every *avenue the stage declared
  closed*. That last list is not a defect list; it is the set of places the build gave up, and it is
  where the two most expensive defects of the previous run were hiding.

## Reading it

A gate declared in the manifest with no record on disk is reported as **unrecorded**, never as passing —
an unrecorded gate is indistinguishable from a skipped one. If you see that, the stage's gates were not
run through `scripts/run-gate.mjs`.

## Fixing and re-running

The review names the failing gate's exact command. Fix, re-run that command through the wrapper so the
new outcome is recorded, then re-review:

```bash
node scripts/run-gate.mjs "$PHASE" <stage> <gate> --app-dir <appDir>
node scripts/stage-review.mjs "$PHASE" --stage <stage> --app-dir <appDir>
```

There is no stage RUNNER yet — re-running a whole stage (re-dispatching its agent and invalidating
downstream artifacts) is not yet mechanised. Today that still goes through the orchestrator.
