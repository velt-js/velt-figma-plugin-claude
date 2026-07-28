# Master Fix Plan — rollout runbook & exit criteria (Phase 9)
Implemented 2026-07-24. Phases 1–8 landed as machine-checkable gates (R-A: a rule that is only prose is NOT implemented). This file is the runbook for extending the prototype family to all 8 blocks and the exit criteria for the Harvey demo.

## What landed where (the enforcement map)

| Rule | Enforcement (exit 2 somewhere) |
|---|---|
| R-B no hand-authored expectations | `compile-assertions.mjs` validateAssertion (designPath+specNodeId+design expectedSource required); `judge-probe-expectations.mjs` rejects `live-dom` |
| R-C no soft statuses | compiled results vocabulary is pass\|fail\|blocked; executor throws on anything else; "na" string banned in the compiled doc |
| R-D PASS semantics | `judge-verify-verdict.mjs` HARD_FAIL: structuralContractViolations, structuralContractUnvalidated, stateCoverageIncomplete, unresolvedContradictions (+ prior integrity flags) |
| R-E tolerances | gapTolerance/sizeTolerance capped at ±4, atomic ±1, wider requires a `justification` row |
| R-F rect over property | gap→rect-gap, padding→rect-inset, sibling boxes→rect-rel-gap (row-banded); margin explicitly unsupported per-element |
| R-G walk to painted node | `EXEC` walkToPainted (shared by mutation drill) |
| Phase 1 compiler | `compile-assertions.mjs` → `compiled-assertions.json` (+ coverage diff planHoles) → `run-compiled-assertions.mjs` → fails merge into appearance (source `compiled-assertion`) → emit forwards |
| Phase 2 states | `state-bindings.json` + `state-capture.mjs` (real input + guard) → emit state-coverage gate; per-state glance target + per-state pixel diff in composed-audit; per-control hover checks (any-action assertion deleted) |
| Phase 3 structure | `structural-contract.json` + `structural-contract-validate.mjs` (containment/order/cardinality/pointer-ownership/substitution re-justification on the LIVE DOM) |
| Phase 4 contradictions | `contradiction-resolver.mjs` ladder + `contradiction-ledger.json`; forced choice recorded in `contradiction-verdicts.json`; residuals need crops+pixel-hash expiry |
| Phase 5 planner | `plan-coverage.mjs` (completeness report, gate input via compile `--require-coverage`), `plan-drift.mjs` (silent decl drops exit 2); hover/selected bg holes closed with designSpec provenance |
| Phase 6 drills | `mutations/manifest.json` (M1–M12) + `scripts/mutation-drill.mjs` (control-run stability, per-category recall/precision targets, `--random N` non-memorizable drills) |
| Phase 7 ledger | emit union carry-forward (`ledger-union.json`): leaving the open set needs a passing compiled assertion or `resolved-issues.json` evidence, else `regression-lost-coverage`; vision↔probe corroboration (`corroboratedBy[]`) |
| Phase 8 agents | velt-judge.md / velt-builder.md / velt-orchestrator.md describe the gates (added last, minimal) |

Golden CI: `golden/compiled-oracle.mjs` calibrates every pure invariant above (wired into `run-golden.mjs`).

## Full-run sequence (per phase dir; all live steps need `--connect <ws>`)

```
node scripts/mutation-drill.mjs        <phaseDir> --connect <ws>        # precondition after judge-script changes
node scripts/composed-audit.mjs        <phaseDir> --url <u> --connect <ws>
node scripts/plan-coverage.mjs         <phaseDir> --write               # planner ships this
node scripts/plan-drift.mjs            <phaseDir> check && node scripts/plan-drift.mjs <phaseDir> snapshot
node scripts/compile-assertions.mjs    <phaseDir> --write --require-coverage
node scripts/run-compiled-assertions.mjs <phaseDir> --connect <ws> --write
node scripts/state-capture.mjs         <phaseDir> --connect <ws>
node scripts/structural-contract-validate.mjs <phaseDir> --connect <ws> --write
#   Judge glance: per block, Read frames/<b>.png vs its capture (state blocks use live-<state>.png)
node scripts/composed-vision-record.mjs check <phaseDir>
node scripts/emit-judge-defects.mjs    <phaseDir> --write
node scripts/judge-evidence.mjs        <phaseDir> --write --top 8 --connect <ws>
node scripts/composed-vision-record.mjs check <phaseDir>                # orphan gate
node scripts/contradiction-resolver.mjs <phaseDir> --connect <ws> --write
#   forced-choice verdicts → contradiction-verdicts.json; re-run resolver until drained
node scripts/judge-verify-report.mjs   <phaseDir> --write               # R-D verdict
```
Builder fix pass consumes workOrder by `route.mode`/`requiredMode`; every touched region gets a post-fix re-glance (blast-radius vision) and compiled re-verification.

## Extending to all 8 blocks
1. Planner emits `state-bindings.json` + `structural-contract.json` per family (schemas = the Phase 2/3 stubs in the harvey phase dir) and `plan-coverage.json` per plan revision.
2. `compile-assertions.mjs --family` widens per family; `--blocks` scopes rules. The default already covers sidebar chrome + the thread-card family.
3. `mutations/manifest.json` extends to 25–40 via `--random N --seed <runSeed>` (drawn from compiled decls; never shown to the Judge).

## Exit criteria (Harvey demo) — ALL of:
a. The 10 open issues + card-ring tint resolved and verified by compiled assertions / state captures (not screenshot claims): focus outline (caret treatment per corrected plan — planner ticket open for node 369:29637), avatar artifact (reproduce under captured states or demonstrate absent), resolve-on-hover present (`vc-resolvebutton.hover.*` passing under confirmed hover), card rhythm 112±4, avatar/name 8, name/ts 7, thread line 49 connected (`.vc-thread-rail` mounted — currently fails as element-missing), panel border #f1efec (verified passing 2026-07-24), filter icon per design union, hover bg per plan (`.vc-body[hover].background #f7f6f4` — decl added with designSpec provenance).
b. Mutation drill meets every category target (style ≥90/95, layout ≥85/90, typography ≥95/95, structure ≥80/90, state ≥85/90, vision-only ≥60/80).
c. Zero unresolved contradiction regions; zero blocked assertions without an owner (blocked reasons name the owner: state guard, missing landmark, or planner ticket).
d. Cold-recall E1 re-run ≥85% vs the ground-truth list (baseline 45%).

**Definition of done:** a run whose verdict is PASS under R-D, the mutation curve at targets, and a fresh external audit finding nothing the pipeline didn't already know.

## Honest state / residuals (2026-07-24)
- Live-executed this session: compiled suite against the running demo (88 pass · 53 fail · 48 blocked — resolve-on-hover machine-named for the first time; ring tint, avatar/name 8vs4, name/ts 7vs4, header→body 4vs10, card height, filter icon, thread-rail missing all fired). Contradiction ladder ran offline: 24 unique regions, 4 auto-named, 20 queued for forced choice with ×3 crops.
- NOT yet live-executed (browser-driving steps deferred): `state-capture.mjs` drive/guard loop, the mutation drill against the live app, the selected-state guard (click did not confirm — binding may need a better guard selector; it is blocked-with-reason, not passing).
- The 190-assertion suite covers the prototype family + sidebar chrome; other families compile but their contracts/bindings are not yet authored (planner deliverables).
- `plan-coverage.json` reports 155 open property holes — the planner's queue, not a gate failure.
