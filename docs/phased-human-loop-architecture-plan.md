# Phased, human-checkpointed re-architecture of velt-customize

Date: 2026-07-01
Status: research + validated plan. Do not build until approved.

> A separate `docs/phased-architecture-plan.md` (a Codex run on the same prompt) exists and is preserved; this deliverable is reconciled against it. Items cross-adopted from that review are tagged **[xr]** below.

## Context — why this change

`velt-customize` reaches ~95% fidelity but a single run takes 12–24+ hours, making it unusable. The stated hypotheses were: (1) one Figma URL = the whole design and the MCP degrades on many frames, (2) a fully autonomous loop with no human checkpoint lets early errors compound silently, (3) greenfield-only regeneration wastes cycles.

**Evidence-backed bottleneck analysis** (from reading the live code — `scripts/`, `agents/`, `guide/`, `BLOCK-BY-BLOCK-REDESIGN-PLAN.md`):

- **Hypothesis 1 — mostly already solved.** Extraction is *already node-scoped*, not file-level. `scripts/figma-extract.mjs` and `scripts/enumerate-blocks.mjs` take `<fileKey> <nodeId>` pointing at one *section* (a row of state-frames), with per-frame coord normalization. Extraction is deterministic REST (chunked 30 ids) and is **not** the dominant cost.
- **Hypothesis 3 — wrong.** The Builder already edits surgically: patch element-by-element, "supply the slot, don't paint over it," touch only the Judge's named diffs, repeat-hash detection (`agents/velt-builder.md`, `guide/build-methodology.md`). It fixes, it does not regenerate.
- **Hypothesis 2 — correct, and it is the real problem.** The loop is **completely unbounded**: `scripts/verdict-gate-blocks.mjs` (the sole terminator) has no iteration or wall-clock parameter — it just returns PASS(0)/FAIL(2)/INCOMPLETE(3) over artifacts, and FAIL/INCOMPLETE both mean "keep looping." The orchestrator iterates "generously while the diff count keeps dropping by any amount" (`agents/velt-orchestrator.md`). The one expensive step — `scripts/capture-block.mjs` (launch headless Chromium → seed Velt state → drive state → DPR-2 screenshot) — runs **once per block per iteration**. Every oracle's *decision logic* is cheap pure-node; the *capture + app seeding* is what's slow.

**Root cause of 12–24h = N blocks × many unbounded iterations × an expensive per-iteration capture, with no cap and no human off-ramp.**

**Honest validation of the proposal (Part B):** phasing *alone* relocates the cost, it does not remove it — a phase that "loops until the goal is achieved" with no bound runs for hours just like today. Phasing's genuine wins are indirect (smaller context per invocation, human catches wrong decisions early, memory avoids re-derivation). The three changes that actually cut runtime are: **(A) hard loop bounds + escalation to the human on plateau**, **(B) a cheaper inner-loop verify (defer the expensive screenshot)**, and **(C) explicit human checkpoints per phase.** This plan centers those, with phasing + memory + fix-mode as the enabling structure.

## Decisions (confirmed with user)
- **Evolve the existing block engine in place** (keep `enumerate-blocks`, `capture-block`, `visual-diff`, `delta-compare`, `verdict-gate-blocks`, the `velt-*` agents).
- **Runs in the source project directly — no `target repo path` argument.** The plugin operates on the current working directory (the user runs it inside their project). `.velt-customize/`, `memory.json`, and output under `components/velt/ui-customization/` all resolve against cwd. Drop the `[target repo path]` arg from the command.
- **Manual phase split; a phase = one `Loop`.** The user passes one `Loop` node URL per invocation (see the **Expected Figma template** below). The plugin enumerates that Loop's frames as blocks and works only within them.
- **Approach is MANDATORY and STRICT — never skipped.** The user must explicitly state the approach (`strictly wireframe` | `strictly primitives` | `wireframes + primitives` | `freeform`). If none is given, the plugin **HALTS and asks** which approach to use, presenting its own per-surface recommendation — it must never auto-pick or proceed without an explicit choice. This is a hard gate, enforced every run.
- **NOTHING is hardwired to any reference design (no Harvey/`354px`/comments-only assumptions).** The enumerator currently hardcodes `width = 354` and a comments-surface state taxonomy in `enumerate-blocks.mjs` — both must be **removed**. Frame dimensions are **derived from each Figma frame's own geometry** (every client's sidebar/dialog can be any width), and a block's state identity comes from **the frame's own label**, not a fixed taxonomy. The pipeline is **surface-agnostic**: whatever the phase node contains — comments sidebar, pin/comment dialog, or notifications — each labeled frame becomes a block. No "sidebar-first" ordering rule.
- **Phase time budget = soft cap + grace, then list remaining.** At **60 min** the phase stops *starting new blocks*; the in-flight (half-styled) block is allowed to **finish within a ~15–20 min grace buffer**; then the run stops and the handoff **lists every block not covered / left remaining** due to the time bound. Per-block bounds still apply (≤12 iters or ≤8 min; plateau = 2 no-progress retries → escalate layer once → else STUCK).
- **Cross-phase memory carries** design tokens, component mappings, naming conventions, learned corrections + gaps — stored **per-target-repo** (`<target-repo>/.velt-customize/memory.json`), not globally.
- **Automated gate is always authoritative for "done."** A block/phase is only "done" when the mechanical gate (visual-diff + delta-compare + contract + stability) passes — including in `freeform` mode. The single override is the user **explicitly** saying "I've checked, it's good for now."
- **Icon verification = exact file-match + vision fallback.** When Figma exports a clean glyph, compare the supplied SVG to it at the file/shape level (deterministic); fall back to AI vision only when no clean export exists.
- **`strictly primitives` is strict.** If a piece can only be built with a Velt wireframe, mark it `mode_blocked` and report it — never silently mix in a leaf wireframe.
- **Figma token is optional** (best fidelity via REST when present) with **MCP fallback** (never halts, never scrapes the repo `.env`) — per the token-security decision.

---

## Expected Figma template (the "Loop" convention)

The plugin expects designs authored in a fixed structure, which we document and ask users to follow (this is the default template):

```
Loop 1                         ← a PHASE (user passes this node URL; one Loop per invocation)
  State                        ← component-level states (the building blocks)
    Composer States            ← a component + its variant frames (write / typing / with-attachment …)
    Sidebar Component
    Comment Thread
  Flows                        ← assembled full-surface screens, in sequence (the acceptance views)
    default sidebar
    default sidebar (populated)
    empty state
Loop 2
  State  ( Comment Thread, Sidebar Component … )
  Flows  ( sidebar-with-thread → double-click → adding comment → submitted comment )
Loop 3 … Loop N                ← may be any surface: sidebar, comment/pin dialog, notifications, confirm dialogs
```

**How the enumerator reads it (surface-agnostic, design-derived):**
- The **phase** = the passed `Loop` node. Within it, locate the two groups by their labels **`State`** and **`Flows`** (case-insensitive; tolerate `State / <Component>` naming as seen in Loops 3–4).
- **`Flows` frames → primary acceptance blocks** (`role: "flow"`): each is a full-surface screen at a specific state → drive the live app to it, capture, visual-diff + delta-compare. These are what the user actually sees, so they anchor the visual gate.
- **`State` frames → component blocks** (`role: "state"`, tagged with their `component`): they define a component's per-state appearance/variants → feed the Connect Map (component/slot/variant + CSS state) and are verified at the component level. Achieving the States is typically the sub-goal that makes the Flows pass.
- Every frame's **geometry comes from its own box** and its **state identity from its own label** — no hardcoded width, no fixed taxonomy. A Loop of dialog or notification frames enumerates exactly the same way.
- The **completeness oracle** for the phase = all `Flows` blocks **and** all `State` blocks in the Loop resolved (PASS / verified-gap / BLOCKED). `blocks.json` records `loopId`, `role`, `component?`, `flowStep?`, `figmaNodeId`, `frameBox`, `state`.

If a passed node doesn't contain recognizable `State` / `Flows` groups, the plugin warns and asks the user to confirm the node is a `Loop` (or to point at one) rather than guessing.

## Target architecture — phase lifecycle state machine

One user invocation = one phase. The orchestrator drives this per invocation:

```
INVOKE  /velt-customize:run <loop-node-url> [--mode=<approach>] [instructions]   (runs in cwd; no repo-path arg)
  │
  ▼
SETUP   preflight (Figma+Chrome MCP) → APPROACH GATE (mandatory: if --mode absent,
        HALT and ask, with recommendation — never auto-pick) → load memory.json (advisory) →
        figma-extract (designSpec) → enumerate-blocks (Loop → State+Flows blocks.json) →
        plan (Connect Map, layer per element, seeded by memory) →
        coverage gate (present per-surface plan for the chosen approach) → init phase journal.jsonl
  │
  ▼
BOUNDED LOOP   for each block, until DONE / STUCK / phase-cap:
        build (surgical patch)
        → verify-cheap: delta-compare + contract + stability probes  (every iter, no screenshot)
        → if delta clean → verify-full: capture-block + visual-diff + icon-identity  (PASS-candidate only)
        → verdict-gate-blocks over this block
        accept retry only if failingDiffCount strictly drops
        enforce: ≤12 iters / ≤8 min per block; plateau(2)→escalate→STUCK
        phase budget: at 60 min stop STARTING new blocks; let the in-flight
        block finish within a ~15–20 min grace; then STOP + list remaining
  │
  ▼
STOP    when every block is DONE, or BLOCKED/GAP, or a bound is hit
  │
  ▼
HANDOFF present: git diff of ui-customization/ + per-block disposition table +
        what's uncertain (icon vision, false-cleans) + what could NOT be verified
        (BLOCKED states) + how to instruct a fix
  │
  ├──► FIX   /velt-customize:fix "<mismatch>" [--block <id>]  (surgical, re-verify ONLY that block)
  │          loops back to HANDOFF
  │
  └──► COMPLETE  user says "phase N complete" →
                 snapshot (git tag/sha) → promote verified learnings into memory.json (freeze) →
                 next invocation uses phase N+1 URL
```

Key behavioral changes vs today:
- The invocation **STOPS and hands off** instead of running to full-PASS-or-nothing.
- Bounds are **harness-owned** (a small bound-check in the gate/orchestrator scripts), not an LLM aspiration.
- The inner loop uses **cheap DOM/getComputedStyle probes**; the **expensive DPR-2 capture is deferred** to iteration 1 (gross-structure sanity) and PASS-candidate (final structural gate).

**SETUP guards [xr]:** if the phase URL has no `node-id`, HALT before planning and ask for a node-specific URL (file-level URLs are rejected — discovery only). After `enumerate-blocks`, if the block count exceeds a `maxBlocksPerPhase` default (~8), warn the user to split the phase further before building. **Enumeration is design-derived and surface-agnostic:** each block's width/geometry comes from its own Figma frame box (no hardcoded width), and its state label comes from the frame's own name (no fixed comments taxonomy) — so a phase node of sidebar, dialog, or notification frames all enumerate correctly.

---

## Latency fix detail (the core of the win)

Restructure the per-block loop in `capture-block.mjs` + `velt-judge.md` + `velt-orchestrator.md`:

1. **Defer the screenshot.** `delta-compare` (getComputedStyle, exact style/box/gap, ΔE + ±1px) is what the Builder actually acts on and is cheap. Run it every iteration. Run the expensive `capture-block` + `visual-diff` (structure/missing/extra) only at **iteration 1** (catch gross structural misses early) and at **PASS-candidate** (delta already clean). Reserve the icon-identity vision check for PASS-candidate.
   - *Risk:* `delta-compare` can't see icons/structure — that's why `visual-diff` exists. Mitigation = the iter-1 + PASS-candidate bookends, so structure is checked early and at the end, not on every intermediate paint.
2. **Reuse one browser/page across a block's iterations.** Fast Refresh re-renders on edit; relaunching Chromium + re-navigating + re-seeding every iteration is wasteful. Keep the browser alive, reset+re-assert state each iteration (the existing Escape/clear/blur recipe), re-seed only if the doc changed. `capture-block.mjs --connect <endpoint>` attaches to an existing browser (CDP or a Playwright server) instead of relaunching.
3. **Bound enforcement (harness-owned).** Add `iterationCount` + `startedAt` timestamps to `block-report.json` / `journal.jsonl` (node `Date.now()` is available). Orchestrator checks before each iteration: block ≤12 iters / ≤8 min. **Phase budget is soft-cap + grace:** at `phaseSoftCapMinutes` (60) stop *dequeuing new blocks*; allow the in-flight block up to `phaseGraceMinutes` (~15–20) to reach PASS/STUCK; then STOP and record every not-yet-started block as `REMAINING` in the handoff. `verdict-gate-blocks.mjs` gains awareness of terminal-for-phase dispositions (`STUCK`, `BLOCKED`, `GAP`, `REMAINING`) so it reports status instead of demanding an impossible PASS.

Expected win: on a 16-block phase where convergence takes many iterations against ~1400 lines of reference CSS, cutting the browser-launch + screenshot out of the *majority* of iterations is the multiplier that turns hours into ≤1 hour, and the hard cap guarantees an upper bound regardless.

---

## Data schemas

### Cross-phase memory — `<target-repo>/.velt-customize/memory.json` (persistent, gitignored, sibling to `run-<id>/`)
```jsonc
{
  "version": 1, "updatedAt": "<iso>",
  "tokens":   { "<figmaVar|role>": { "velt": "--velt-...", "value": "#..", "source": "figma-extract", "verifiedAgainst": "<blockId>" } },
  "mappings": { "<designElement>": { "veltComponent": "..", "rootWireframe": "..", "slot": "..", "layer": "wireframe", "variant": ".." } },
  "naming":   { "wireframeFileSuffix": "Wf.tsx", "iconDir": "icons/", "cssFile": "styles.css", "classPrefix": ".." },
  "corrections": [ { "fact": "resolve glyph != reopen glyph", "evidence": "..", "phase": "N", "addedAt": "<iso>" } ],
  "gaps":        [ { "gap": "no per-edit editor identity", "evidence": "..", "phase": "N", "addedAt": "<iso>" } ],
  "phases":      [ { "node": "1:3398", "mode": "wireframes+primitives", "status": "complete", "snapshotSha": "..", "completedAt": "<iso>" } ]
}
```
- **Read** at SETUP (Planner) as an **advisory prior** — seeds tokens/mappings/naming, injects corrections/gaps into Builder/Judge context.
- **Write** only at "phase N complete" (freeze/promote verified within-phase learnings — tokens actually used, mappings that passed, accepted naming, fix-cycle corrections, verified gaps) and on fix-mode (append a `tentative` correction). **Never promote [xr]:** failed attempts, `tentative` assumptions, or env-specific workarounds (unless the user explicitly approves). The HANDOFF also states a recommendation — "say `phase N complete`" vs "instruct a fix" — so the user knows the plugin's own confidence.
- **Staleness guard (advisory + fingerprinted) [xr]:** memory is advisory, never authoritative — any token/mapping actually *used* is re-verified against the current phase's fresh `designSpec`, and on disagreement the fresh extraction wins. On top of that, each entry carries a **confidence tier** (`confirmed` | `tentative` | `deprecated`) and an `invalidatesWhen` clause; the loader **loads only `confirmed` by default** and marks an entry stale when any of these change: a `guideHash` (over the loaded guide files), the `manifestHash` (`manifest/velt-codeconnect.json`), or the **Velt package version** in the target repo's `package.json` (an SDK bump can rename slots and silently stale every mapping). Entries also carry `source`/`phase`/`addedAt`/`verifiedAgainst`. Only `phase N complete` promotes to `confirmed`; a machine-PASS alone does not. SDK-truth corrections are promoted to `guide/` (existing "write it back" convention); memory holds per-design ones. A `velt-customize:memory` command views/prunes; corrections/gaps are deduped and capped.

### Within-phase state — keyed by a STABLE `phaseId`, not a fresh run id [xr]
Path: `<target-repo>/.velt-customize/phases/<phaseId>/` (e.g. `phase-03-comments-sidebar/`). Holds `designSpec.json`, `blocks.json`, `connect-map.json`, `frames/`, `shots/`, `diffs/`, `block-report.json` (+ new `iterationCount`, `startedAt`, `disposition`), `journal.jsonl` (+ timestamps), `verdict.json`. **Keying by `phaseId` (not the old `run-<id>/`) is required so `/velt-customize:fix` and a re-invocation of the same phase re-enter the same artifacts** — a fresh random id per invocation would orphan them. A top-level `<target-repo>/.velt-customize/index.json` tracks phase status + next recommended phase + the current memory hash. Enables resume + fix within the phase.

### Phase manifest (lightweight, derived — not a new heavy file)
The node URL + `--mode` + instructions passed to `run`, recorded in the journal header and, on completion, appended to `memory.json.phases[]`. No separate manifest file needed; `blocks.json` already is the completeness oracle for the phase.

### Exit-criteria / oracle spec (concrete, mostly deterministic)
A **block is DONE** when all hold: `built` (renders, no invalid-element overlay) · `driven` (drive.assert matched) · `visualDiff` no region `fill ≥ 0.05` (iter-1 + PASS-candidate) · `deltaCompare.ok` (ΔE + ±1px, every iter) · `contract.ok` (mount-map: no MISSING/CONTAINMENT/CARDINALITY/PHANTOM) · `stability.ok` (R27) · icon-identity vision pass (PASS-candidate). Check latencies: all gates/delta/visual-diff/contract = milliseconds (pure node); capture = seconds; icon-identity = one model call.
A **phase is DONE** when every block is DONE **or** resolved as `BLOCKED` (env can't seed the data), `GAP` (SDK can't express, evidence required), or `STUCK` (hit bounds → handed to human). Bounds: 12 iters / 8 min per block, 60 min per phase, plateau=2.

---

## Modes (`--mode`) — selection is MANDATORY
The approach is a required input every run. It is supplied via `--mode` **or** the user stating it in the instruction. **If neither is present, the plugin HALTS at the Approach Gate and asks the user to choose, showing its own recommendation per surface (with the reasoning from `guide/02-decision-tree.md`).** It never defaults, never infers silently, never proceeds without an explicit answer. Once chosen, the mode is recorded in the phase journal + `memory.json.phases[]`.
- **`strictly wireframe`** — decision-tree may assign only default/prop/CSS/wireframe; primitives/headless forbidden → mark the piece `mode_blocked` (distinct from a real SDK GAP) instead of escalating. Oracle set unchanged.
- **`strictly primitives`** — Planner composes primitives/headless (`guide/approaches/primitives.md`); wireframe layer skipped. **Warns/GAPs on anchored surfaces** (pin dialog, pins, cursors) — verified fact: escalating past wireframe forfeits Velt's positioning.
- **`wireframes + primitives`** (default) — cheapest achieving layer per element (current behavior).
- **`freeform`** — no layer constraint; mode instruction may carry extra guidance; exit gate may soften to user-judged when the design isn't a clean state-frame section (open question below).

Mode changes (a) which layers the decision-tree may pick and (b) which approach guide the Builder follows; it does **not** change the oracle set (except freeform's softer gate).

---

## Fix mode — `/velt-customize:fix "<mismatch>" [--block <id>]`
1. Load the phase's `memory.json` + `run-<id>/block-report.json` + the per-design Connect Map.
2. **Locate** the code: from the block's Connect Map (element → slot → file) or map the user's description to a block/selector.
3. **Apply** a surgical edit (Builder in fix-mode, scoped to that block/region — reuses existing incremental-edit discipline).
4. **Re-verify the affected block AND its shared-contract blast radius [xr].** Re-running only the named block is unsafe — the whole surface shares one stylesheet (R8) and one `<VeltWireframe>` (R1), so a "surgical" edit can regress siblings. Build the blast radius from the Connect Map (block → surface → slot → selector → file) and re-verify accordingly:
   - changed **CSS selector** → every block that uses that selector.
   - changed **shared host prop** → every block on that surface.
   - changed **mount-map / slot tree** → the `contract` probe for the whole phase + the affected visual blocks.
   - changed **icon asset** → every block containing that slot.
   - purely **local layout value** → the affected block plus the nearest adjacent state where the same component appears.
   Each re-verify is a single-block `capture-block` + `visual-diff` + `delta-compare` + `verdict-gate-blocks` (the block model already supports single-block verify).
5. Update `block-report.json` + `journal.jsonl`; append the correction to `memory.json` (as `tentative` until `phase complete`).

---

## Migration steps (evolve in place)

**Prerequisite (blocks everything else): de-hardcode + teach the Loop template.** In `scripts/enumerate-blocks.mjs`: (a) remove the hardcoded `width = 354` and the comments-only `LABEL_MAP`; derive each block's geometry from its own Figma frame box and its state identity from the frame's label; make enumeration surface-agnostic (sidebar / dialog / notifications). (b) Parse the **Loop → `State` / `Flows`** structure: treat the passed node as a `Loop`, split its children into `State` (component blocks, tag `component`) and `Flows` (full-surface acceptance blocks, tag `flowStep`), and emit `blocks.json` with `loopId` / `role` / `component?` / `flowStep?` / `frameBox` / `state`. Warn + ask if the node has no recognizable `State`/`Flows` groups. Until this is done the pipeline only works on the Harvey reference — so it is step 0 of the POC.

1. Write this design record (done — this file).
2. **Memory:** add `scripts/memory.mjs` (read at setup / write at phase-complete / prune) + the `memory.json` schema; wire Planner to load, orchestrator to freeze on complete.
3. **Bounds:** add `iterationCount` + timestamps to `block-report.json`/`journal.jsonl`; teach `verdict-gate-blocks.mjs` the `STUCK`/`BLOCKED`/`GAP` terminal dispositions; add the per-block/per-phase cap + plateau checks to `agents/velt-orchestrator.md` (enforced via a small bound-check the gate script owns, not LLM discretion).
4. **Cheaper verify:** restructure the per-block loop (delta-only inner; visual-diff at iter-1 + PASS-candidate; `capture-block.mjs --reuse` persistent page) in `capture-block.mjs`, `agents/velt-judge.md`, `agents/velt-orchestrator.md`.
5. **Handoff:** add `templates/phase-handoff.md`; wire the orchestrator to STOP-and-present instead of run-to-done.
6. **Fix mode:** add `/commands/fix.md` + fix-mode branch in `agents/velt-builder.md` + the single-block re-verify path.
7. **Modes + command surface:** drop the `[target repo path]` arg from `/commands/run.md` (operate on cwd); add the **mandatory Approach Gate** (halt-and-ask with recommendation when no `--mode`/approach is stated — never auto-pick); add per-mode layer-constraint gating to `agents/velt-planner.md` + `guide/02-decision-tree.md`.
8. **Memory command:** add `velt-customize:memory` (view/prune, masked).
9. **Reconcile the termination doc-drift [xr] (verified real).** The repo currently ships TWO contradictory termination models that agents load simultaneously: the NEW block path (`commands/run.md`, `agents/velt-orchestrator.md`, `agents/velt-judge.md`, `skills/velt-operating-brief/SKILL.md`, `guide/build-methodology.md` — terminate on `verdict-gate-blocks.mjs`, "never `/goal`") and the OLD whole-surface path still in `guide/verifying-a-customization.md`, `guide/rules.md` R20/R26, `skills/velt-verify/SKILL.md`, and `golden/run-golden.mjs` (terminate via a `/goal` evaluator over `checklist.json`→`judge-report.json`→`verdict-gate.mjs`). Make `verdict-gate-blocks.mjs` the single canonical stop everywhere; update the old verification docs/rules/skill to the block model; migrate `golden/run-golden.mjs` off `verdict-gate.mjs`/`build-checklist.mjs` (or clearly scope those as golden-only legacy). Contradictory stop conditions are the exact failure class this project exists to kill.
10. **Gate everything:** `node scripts/check-guide.mjs`, `node scripts/validate.mjs`, `node golden/run-golden.mjs`, `claude plugin validate .`; extend golden to cover bounds + memory read/write + the phaseId re-entry path.
Do the **POC (below) first**, then roll out 6–9.

---

## Risks & mitigations
- **Deferred visual-diff misses structure late** → iter-1 + PASS-candidate bookends; delta-compare inner.
- **Memory drift** → advisory-only, re-verify against fresh extraction, staleness metadata, prune command, promote SDK-truth to `guide/`.
- **`strictly primitives` breaks anchored positioning** → mode-aware warn/GAP on pin dialog/cursors.
- **Hard cap stops a phase mid-block leaving broken UI** → handoff marks partial/STUCK blocks explicitly; `git diff` lets the user revert; STUCK is never recorded as done.
- **Reused browser carries stale state** → explicit reset + re-assert each iteration (existing recipe).
- **LLM ignores the caps** → make the bound check a script the harness owns, not orchestrator prose.
- **Seeding wall (states needing data the env can't produce)** → `BLOCKED` disposition, surfaced in handoff, never a silent pass.
- **Fix touches shared CSS/wireframe and regresses siblings [xr]** → the fix-mode blast-radius rule re-verifies every block sharing the changed selector/prop/icon/slot, not just the named one.
- **Figma REST rate limits (Tier-1) / large phase node [xr]** → scope with `ids`+`depth` to the phase subtree; batch image exports; cache phase artifacts; honor `Retry-After`; `maxBlocksPerPhase` warns the user to split before build.
- **Two termination models drift back in [xr]** → step 9 makes the `/goal`/`verdict-gate.mjs` cleanup a required, gated migration step.
- **Cold-start attempt budget too tight** → `maxAttemptsPerBlock` stays ~12 (not Codex's 4) while a block is built from scratch against ~1400-line reference CSS; tighten only once cross-phase memory + fix-mode reduce cold-start cost.
- **User's Figma not authored in the `Loop / State / Flows` template** → the enumerator warns and asks the user to confirm/point at a `Loop` rather than mis-enumerating; the template is documented and requested up front.
- **Run started with no approach** → the mandatory Approach Gate halts and asks (with recommendation); the run cannot silently proceed on a default.

## Resolved decisions (were open questions)
1. **Surfaces / hardwiring** → NO hardwiring. De-hardcode `enumerate-blocks.mjs`; derive geometry from each frame's box and state from its label; surface-agnostic (sidebar / dialog / notifications); no "sidebar-first" rule.
2. **60-min cap mid-block** → soft cap: stop starting new blocks at 60 min, let the in-flight block finish within a ~15–20 min grace, then STOP and list remaining/uncovered blocks.
3. **Memory scope** → per-target-repo (`<target-repo>/.velt-customize/memory.json`).
4. **Freeform / "done"** → the automated gate is always authoritative, including in freeform; the only override is the user explicitly saying "I've checked, it's good for now."
5. **Icon identity** → exact file/shape-match against the exported SVG when available, AI-vision fallback otherwise.
6. **`strictly primitives`** → strict: mark `mode_blocked` and report; never silently insert a leaf wireframe.
7. **Figma token** → optional (REST when present) with MCP fallback; never required, never scrapes the repo `.env`.
8. **No `target repo path` argument** → the plugin runs in the current working directory (the user's own project); all paths resolve against cwd.
9. **Expected Figma template = the `Loop / State / Flows` convention** → phase = one `Loop`; `State` frames → component states/variants, `Flows` frames → full-surface acceptance blocks; documented and asked of the user as the default authoring template.
10. **Approach is mandatory + strict** → the plugin never proceeds without an explicit approach; if none is given it HALTS and asks (with its recommendation). Never skipped.

---

## Single-phase proof-of-concept (de-risk before rollout)
**Target:** the already-validated harvey-playground comments sidebar (node `1:3398`, 16 state-blocks — fully exercised in prior runs), so improvement is measured against a known baseline.

**Implement the minimum:**
0. **De-hardcode + Loop template in `enumerate-blocks.mjs`** (the prerequisite): frame-derived geometry + label-derived state + surface-agnostic + parse `Loop → State/Flows` into `blocks.json` with `role`/`component`/`flowStep`. Validate on the Harvey sidebar **and** at least one differently-sized frame (prove no `354` assumption remains).
0b. **Command surface:** runs in cwd (no repo-path arg); **mandatory Approach Gate** — halt-and-ask with a recommendation when no approach is stated.
1. `memory.json` read at setup + write at phase-complete (tokens + naming only — prove the lifecycle), per-repo (cwd `.velt-customize/`), keyed by stable `phaseId`.
2. Loop bounds: 12 iter / 8 min per block, plateau→STUCK; phase soft-cap 60 min + ~15–20 min grace to finish the in-flight block, then list remaining. STUCK/REMAINING dispositions in the gate.
3. Deferred-capture inner loop (delta-only inner; visual-diff at iter-1 + PASS-candidate; reused browser).
4. Phase-end handoff (diff + per-block dispositions + remaining list + uncertainty + recommend complete-vs-fix).

**Measure:** wall-clock for the 16-block phase vs the prior unbounded run; number of captures avoided; confirm it soft-caps + finishes the in-flight block + lists remaining; confirm `memory.json` is written and re-read (tokens/naming reused) on a second invocation.

**Defer to rollout:** fix-mode + blast-radius, the four `--mode`s, memory mappings/corrections tiers + confidence/fingerprint staleness, icon file-match, doc-drift reconciliation, prune command.

**Success = the same 16-block phase converges (or cleanly hands off with a remaining-list) within the 60-min soft-cap + grace, with a correct handoff and a populated per-repo `memory.json`, and the enumerator proven de-hardcoded on a non-Harvey width — versus the prior multi-hour unbounded run.**

## Verification (end to end)
- Gates green: `check-guide.mjs`, `validate.mjs`, `run-golden.mjs`, `claude plugin validate .`.
- POC run on node `1:3398`: observe hard stop at cap, inspect the handoff, diff `components/velt/ui-customization/`, confirm `memory.json` written; run a second phase invocation and confirm memory is loaded (tokens/naming reused, not re-derived).
- Fix-mode smoke: point at one known mismatch, confirm only that block re-verifies (single `capture-block` + gate), and the correction lands in `memory.json`.
