# Fresh Plugin Review — Speed, Determinism, Agent Structure

Date: 2026-07-02
Scope: `velt-figma-plugin-claude` (runtime layer: agents, command, operating brief, rules, scripts) + parity check against `velt-figma-plugin-cursor`.

Everything below was verified by reading the actual files, not carried over from the 2026-07-01 token-optimization review. Where that review is confirmed or contradicted, it says so.

---

## 1. Why a run takes 5–6 hours

The design already contains the right bounds on paper (≤12 iterations or ≤8 min per block, 60-min phase soft-cap, plateau → STUCK). The problem is **none of them exist in code**. Ranked by impact:

### 1.1 Every bound is prose, not code (P0 — confirmed still unfixed from the 07-01 review)

- `grep` across `scripts/` finds **zero** tracking of `iterationCount`, `startedAt`, or wall-clock anywhere.
- `verdict-gate-blocks.mjs` has no notion of time or iteration count. It only classifies dispositions that agents *choose* to write. If the orchestrator never writes `STUCK`, the gate happily returns `FAIL` forever and the loop continues.
- An LLM cannot keep wall-clock time. A "60-minute soft cap" in a prompt fires never or randomly. This is the single biggest reason a phase that should stop at ~75–80 min runs for hours.

### 1.2 A fresh subagent pair per iteration

Per the orchestrator's owned-loop, **every block iteration spawns a fresh Builder and a fresh Judge**:

- Builder: `claude-opus-4-8`, `effort: max`, ~2.5k-word prompt, told to read `build-methodology.md` + `build-gotchas.md` + the approach doc + reference files — every spawn.
- Judge: fresh context by mandate, ~3k-word prompt + designSpec + manifest entry + produced code + browser reconnect — every spawn.

Worst case per phase: 8 blocks × 12 iterations × 2 agents ≈ **~200 cold agent starts**, each re-reading the same guide material and re-establishing browser state. The two-tier verify saves *screenshots*, but not the far larger cold-start cost. This is where most of the time and tokens actually go.

### 1.3 Opus + max effort on the most-frequently-spawned agent

The Builder's own spec says it "executes the Planner's Connect Map **verbatim** … does not redesign, re-pick, or eyeball values." That is mechanical work, and it runs dozens of times per phase on the most expensive model at the highest effort setting — long thinking on every 10-line CSS patch.

### 1.4 No mechanical stop on oversized phases

`enumerate-blocks.mjs` contains **no block-count guard at all** — the ">~8 blocks" warning lives only in the orchestrator/operating-brief prose. An 16-block Loop sails straight into the build loop.

### 1.5 Guide over-reading

The guide corpus is ~16.8k lines. The work-item schema already has `guideRefs` (the Planner resolves exactly which files each item needs), but nothing *enforces* that the Builder reads only those — and the reference pages it's pointed at are 800–1,100 lines each.

---

## 2. The key reframe: the 5–6 hours is not buying quality

Quality in this architecture comes from the **gates** — exact `designSpec` numbers, `visual-diff.mjs`, `delta-compare` ΔE/±1px, `CONTRACT_PROBE`, `mustSupply` enforcement. It does not come from the Builder's model size or from unbounded retry time. A retry chain that plateaus at iteration 9 produces nothing iteration 12 wouldn't; a fresh 3k-word Judge spawn on iteration 5 measures the same numbers a persistent probe run would. So the speed fixes below cost **zero** fidelity — several actively increase it.

---

## 3. Speed fixes (in priority order, quality preserved or improved)

### 3.1 P0 — A real loop controller (`scripts/block-iter.mjs`)

One small script owns loop state, so bounds fire even when the model forgets:

```
block-iter.mjs start <phaseDir> <blockId>
    → stamps startedAt (block + phase), returns iteration 0
block-iter.mjs record <phaseDir> <blockId> --diff-count N --hash <normalizedDiffHash>
    → increments iteration, appends {iter, t, diffCount, hash} to loop-state.json
    → computes: no-progress, repeat-hash, oscillation, plateau
    → WHEN bounds hit (≥12 iters / ≥8 min / plateau after escalation):
        writes disposition:"STUCK" + auto-generated evidence note INTO block-report.json itself
    → WHEN phase ≥60 min: writes report.phase.remaining itself
    → exit code tells the orchestrator: 0 = continue, 4 = bounds hit, stop this block
```

The orchestrator's job shrinks to: call `start`, loop `builder → judge → record`, obey the exit code. The model is no longer trusted to count or to keep time — which is exactly what the plugin already did for termination with `verdict-gate-blocks.mjs`. This finishes that thought.

Also: make >`maxBlocksPerPhase` a **hard halt** inside `enumerate-blocks.mjs` (override `--allow-large`), and accept `--budget strict|balanced|thorough` to set the caps (endorsing the 07-01 review's Step 1, but as controller flags, not prompt text).

### 3.2 P0 — One Builder session per block; Judge only at the boundaries

Restructure the inner loop:

- **One Builder subagent per block**, kept alive across that block's iterations. It runs the *cheap probes itself* between patches (`delta-compare` BROWSER_PROBE / LAYER_PROBE via the browser session) as its own feedback signal.
- **Judge spawns only at**: iteration 1 (gross-structure catch), PASS-candidate (full pipeline: capture + visual-diff + icon identity + contract + stability), and final. Its verdict remains the only one that counts.

This does **not** weaken maker≠checker: the anti-rubber-stamp principle must hold for the *verdict*, not for the inner feedback loop — and the feedback is script output (delta tables), not judgment. The Judge + gate still adjudicate every PASS from a fresh context against artifacts. Agent spawns per block drop from ~24 to ~3–4. This is the largest single wall-clock win available.

### 3.3 P1 — Rebalance models/effort by role, not globally

The 07-01 review said "default everything to sonnet/medium." With quality as P0, that's half right:

| Agent | Current | Recommended | Why |
|---|---|---|---|
| Planner | opus-4-8 / max | **keep opus / max** | Runs once per phase; recognition depth is the quality-critical step (shallow recognition caused the <5% run). Wrong place to save. |
| Builder | opus-4-8 / max | **sonnet-5 / medium**, escalate to opus on plateau | Executes a decided map verbatim; runs ~dozens of times. The gate catches its misses either way. |
| Orchestrator | sonnet-5 / max | **sonnet-5 / medium** | It's a dispatcher; max-effort thinking on "pick next block" is pure latency. |
| Judge | sonnet-5 / medium | keep | Correct already. |

The escalation ladder already exists — plug the model escalation into the plateau signal from 3.1.

### 3.4 P1 — Enforce targeted guide reads

- The Planner already emits `guideRefs` per work item. Make the Builder's prompt say: read **only** the item's `guideRefs` — and have the orchestrator pass the refs' *content* (or section slices) into the Builder invocation rather than trusting it to go browsing.
- For the 800–1,100-line reference files, add section anchors + a tiny `guide-lookup.mjs` (`{surface, approach, blockRole}` → file#section list) so a Builder never ingests `wireframe-components.md` whole to use 4 slots. (Confirms 07-01 review Step 5.)

---

## 4. Determinism & strictness gaps (fresh findings)

### 4.1 P0 — The "mechanical" gate trusts model-transcribed JSON

This is the most important new finding. `verdict-gate-blocks.mjs` validates the *shape* of `block-report.json` but every value in it is **written by the Judge agent by hand**:

- It never checks `capturePng`/`framePng` exist on disk (verified: no `existsSync`/`access` anywhere in the gate).
- It never recomputes the visual diff — it trusts `visualDiff.diffPct` and `regions` as transcribed.
- `deltaCompare.ok` and `stability.ok` are booleans the model writes after reading probe output in-transcript. A hallucinated, typo'd, or optimistic transcription can PASS a phase.

The termination decision is mechanical; **the evidence pipeline feeding it is not.** Fix by making the reports script-written end to end:

1. `capture-block.mjs`, `visual-diff.mjs`, and a small probe-runner wrapper each write their own per-block JSON result files into `<phaseDir>/results/<blockId>/` (visual-diff already writes the diff PNG; add `--json-out`).
2. A `assemble-block-report.mjs` builds `block-report.json` **from those files** — the Judge stops transcribing numbers entirely; it only decides things scripts can't (icon-glyph vision fallback, BLOCKED triage notes).
3. The gate verifies artifacts: files exist, mtimes fall inside the block's `[startedAt, now]` window (from 3.1's loop-state), and — cheapest, strongest — **re-runs `visual-diff.mjs` itself** on the recorded PNG pair and compares to the reported regions.

After this, a PASS is provably backed by on-disk evidence. That's the determinism upgrade you asked for, and it makes the whole system *more* strict while removing LLM work (faster too).

**The sharpest instance of this hole:** `BLOCKED` and `GAP` dispositions are *PASS-compatible* — a phase whose remaining blocks are marked `GAP`/`BLOCKED` exits 0 (PASS), and the only validation on those dispositions is that `note` is a non-empty string. One word qualifies. So the strongest escape hatch from the loop is not "stop early" (R26 blocks that) but "declare gaps." The Builder prompt guards against it rhetorically ("a gap is never a shortcut out of the loop"), but mechanically nothing checks it. Fix: a `GAP` entry must reference an evidence artifact (the F3-exhaustion record — which selectors were inspected, which overrides tried), and the gate should verify that artifact file exists, same as §4.1's PNG checks. `BLOCKED` should similarly require the triage evidence (console/auth state capture).

### 4.2 P1 — The Judge prompt still contradicts the two-tier verify

The "two-tier verify" section says capture + visual-diff run only at iteration 1 and PASS-candidate. But the numbered per-block pipeline (steps b/c: "CAPTURE device-res… VISUAL DIFF…") reads as every-iteration steps. An agent following the checklist literally screenshots every iteration — the exact latency bug the two-tier design was meant to fix. (The 07-01 review's P1 "verification instructions contradict themselves" is confirmed, still present.) Keep exactly one canonical pipeline description.

### 4.3 P1 — The flow is restated in 4+ places

`run.md`, `velt-operating-brief`, `velt-orchestrator.md`, and the Judge/Builder prompts each restate preflight, bounds, the gate, and `--cloud` deltas in slightly different words. That's ~5k words of duplication and a drift factory (they already disagree on the capture cadence, §4.2). Rule: every fact lives in exactly one file; the others reference it by name/ID.

### 4.4 What's already genuinely strict (don't touch)

The mode gate (`mode_blocked`, never silent layer switches), design-cue-gated host props (R24), `mustSupply` + icon identity (R17/R19), the contract veto (R25), stability probe (R27), note-required terminal dispositions, and the INCOMPLETE-cannot-terminate rule (R26) are all well-designed. The gaps are in *bounds* and *transcription*, not in the gate logic itself.

---

## 5. Are the agents too long? Do we need more sub-agents? More rule files?

### 5.1 Agents: yes, too long — fix by subtraction, not by splitting

Orchestrator/Builder/Judge are ~2.5–3k words each of extremely dense prose, much of it inline war stories ("the M1 bug", "the M2b 210px box", "the M5 trap", Harvey-specific selectors). Those lessons are already encoded as rules (R22, R23, R26, R27) and in `build-gotchas.md`. Target ≤800–1,000 words per agent: role, inputs, outputs, hard constraints by rule ID, script calls, pointers. Move every "why" and every postmortem anecdote into the guide/docs where it's read once, not paid for on every spawn.

### 5.2 More sub-agents: **no**

Every additional agent is another cold context paying the prompt + guide-read + browser-reconnect tax — the exact cost driving your 5–6 hours. The four roles (orchestrate / decide / make / check) are the right decomposition. Anything smaller than a role should be a **script** (deterministic, instant, free) or a step inside an existing agent. The 07-01 review's candidates: `icon-resolver` is one vision call inside the Planner (fine as-is); `block-annotator` and `css-selector-inspector` should be scripts if anything. Add agents only if a role needs a *different context boundary*, not a different task.

### 5.3 More per-feature/approach/step rule files: **no prose forks — index + lint instead**

Splitting `rules.md` into `rules/wireframes.md`, `rules/sidebar.md`, etc. (07-01 review Step 4) duplicates rule text across files and guarantees drift. Better:

1. **Keep R0–R27 canonical in one file** (the ID scheme is already good).
2. **Add a machine-readable index** — `rules/index.json`: `{approach, surface, blockRole} → [ruleIds]`. The Planner stamps `ruleIds` onto each work item / Connect-Map entry; Builder and Judge receive only those rules' text (sliced by ID). Same targeting the review wanted, zero duplication.
3. **Push strictness into code, not prose.** Add `scripts/lint-customization.mjs` — a static scan of `components/velt/ui-customization/` for every mechanically checkable rule: exactly one `<VeltWireframe>` (R1), no `onClick`/`useState` inside wireframe markup (R4), no `display:none` feature-hiding (R7), one stylesheet (R8), class overrides carry `!important` (R9b), no bare `.velt-mention` selector (R23), identifiers ∈ the 770-element appendix (R10 — the `tsc`-passes-but-renders-`<undefined/>` trap). Run it in the Builder's handoff gate and as a gate input. Instant, deterministic, zero tokens — this is "more strict rules per approach" done the right way.

---

## 6. Claude ↔ Cursor parity

Verified: the Cursor repo is a faithful port. `guide/`, `manifest/`, `templates/` are byte-identical; agents differ only in model-slug format, browser-tool naming (Chrome MCP → Cursor native browser), and command names; Cursor adds `rules/*.mdc` + dual manifests.

Two actions:

1. **9 scripts have drifted** — mostly a `fileURLToPath` portability fix that exists only in the Cursor repo. Backport it to the Claude repo, then add a parity check (a tiny CI/script diffing the shared dirs) so the two never silently diverge. Every fix from this review must land in both repos — ideally make one repo canonical and generate the other.
2. All prompt/structure recommendations above apply 1:1 to the Cursor repo since the agents are the same files.

---

## 7. Priority list

| # | Pri | Item | Effect |
|---|---|---|---|
| 1 | P0 | `block-iter.mjs` loop controller: script-owned iterations, timestamps, plateau, auto-STUCK, phase soft-cap | Phases become *guaranteed* 60–90 min; no more 5–6 h runs |
| 2 | P0 | Script-written `block-report.json` + gate artifact verification (files exist, mtime window, re-run visual-diff) | PASS becomes provably evidence-backed; removes the LLM-transcription hole |
| 3 | P0 | One Builder per block running cheap probes itself; Judge at iter-1 / PASS-candidate only | ~5–10× fewer agent cold-starts; biggest wall-clock win |
| 4 | P1 | Models: Builder → sonnet-5/medium (opus on plateau), Orchestrator → medium; keep Planner opus/max | Big token/latency cut with zero quality risk (gate unchanged) |
| 5 | P1 | Slim agents to ≤1k words; single-source the flow; fix the Judge two-tier contradiction | Cheaper spawns, no drift, no accidental every-iteration screenshots |
| 6 | P1 | `rules/index.json` + `lint-customization.mjs`; Planner stamps ruleIds per item | Targeted strictness without rule-text duplication |
| 7 | P1 | Hard block-count halt in `enumerate-blocks.mjs` (+ `--budget` caps) | No accidental 16-block marathons |
| 8 | P2 | Backport `fileURLToPath` fix; add cross-repo parity check | Kills silent Claude↔Cursor drift |

Expected outcome: a phase is bounded by code at 60–90 min (hard), token cost drops an estimated 3–5×, and quality *rises* — because the two changes that most affect fidelity (artifact-verified reports, static rule lint) make the gates stronger, not weaker.
