> **⚠ SUPERSEDED — the model-tiering recommendations below (Sonnet for builder/planner/etc.) are OBSOLETE. Per the standing directive, ALL velt-customize agents run on Opus at max effort. Do not apply the model downgrades in this doc.**

# Token Optimization Review

Date: 2026-07-01

This note captures the plugin review, token-optimization research, and the practical decisions discussed for `velt-customize`.

## Sources Reviewed

- Claude Code costs and usage guidance: https://code.claude.com/docs/en/costs
- Claude Code prompt caching: https://code.claude.com/docs/en/prompt-caching
- Claude Code subagents: https://code.claude.com/docs/en/sub-agents
- Medium article shared by Mayank: https://medium.com/@habib23me/10-tip-to-stop-burning-your-tokens-in-claude-code-4776d4ac8956
- Reddit thread shared by Mayank: https://www.reddit.com/r/ClaudeAI/comments/1r6buxo/how_do_you_guys_keep_token_consumption_down_in/
- Agentic coding token usage study: https://arxiv.org/abs/2604.22750

## Simple Plugin Flow

When the user calls:

```bash
/velt-customize:run <figma-loop-node-url> --mode "<approach>"
```

the intended flow is:

1. Create a phase folder under `.velt-customize/phases/<phase-id>/`.
2. Create a heartbeat/progress log so the run can be watched live.
3. Run preflight checks:
   - Figma token exists.
   - Figma node resolves through the Figma REST API.
   - `guide/` exists and passes self-check.
   - Target app has `@veltdev/react`.
   - App runs and Velt renders.
   - Chrome or headless verification is available.
   - Auth/test harness is ready.
4. Confirm the approach mode:
   - `strictly wireframe`
   - `strictly primitives`
   - `wireframes + primitives`
   - `freeform`
5. Load previous project memory from `.velt-customize/memory.json`.
6. Extract the Figma design:
   - `enumerate-blocks.mjs` creates `blocks.json`.
   - `figma-extract.mjs` creates exact design data: spacing, color, typography, radius, icons, boxes.
7. Break the Figma Loop into blocks:
   - `Flows` frames become full-surface acceptance blocks.
   - `State` frames become component/state blocks.
8. Planner creates the Connect Map:
   - Which Velt component/slot maps to each Figma element.
   - Which props are justified by the design.
   - Which CSS/classes/variables are needed.
   - Which icons/text must be supplied.
   - Which states the Judge must drive.
9. Builder writes customization code, normally only under:

```text
components/velt/ui-customization/
```

10. Judge verifies one block at a time in the running app.
11. `verdict-gate-blocks.mjs` reads `blocks.json` and `block-report.json` and decides:
   - `PASS`
   - `FAIL`
   - `INCOMPLETE`
   - `STOPPED`
12. The loop continues block by block until all blocks pass or the phase stops with a handoff.
13. On phase completion, verified learnings can be promoted into memory for future phases.

## Token And Time Findings

### 1. The guide should not be fully read every run

The intended behavior is to read only the required guide sections for the current design, surface, approach, and block.

Current risk: prompts are broad, so Claude may over-read large files such as:

- `guide/reference/component-definitions.md`
- `guide/reference/props.md`
- `guide/reference/data-models.md`
- `guide/reference/apis.md`
- `guide/rules.md`
- approach docs like `wireframes.md`, `css.md`, `primitives.md`

The guide corpus is about 167k words. It is useful as documentation, but expensive if large sections are repeatedly pulled into agent context.

Recommendation: add a deterministic guide router or lookup script that returns only the required files/sections for:

```text
surface + feature + approach + block role
```

### 2. Current agents are too long

Hot prompts are large and repeat many of the same rules:

- `agents/velt-orchestrator.md`: about 3,146 words
- `agents/velt-judge.md`: about 3,027 words
- `agents/velt-builder.md`: about 2,469 words
- `skills/velt-operating-brief/SKILL.md`: about 2,298 words
- `commands/run.md`: about 1,382 words

This repetition is expensive because subagents have their own context. Each fresh subagent can pay again for long instructions and repeated rule text.

Recommendation:

- Keep the main roles: orchestrator, planner, builder, judge.
- Shorten their prompts heavily.
- Move detailed knowledge into targeted guide/rule files.
- Use scripts for deterministic lookup and validation.
- Add new agents only when they have a tiny prompt, narrow responsibility, and structured output.

Do not blindly create many agents. More agents can increase token usage if each agent carries a long prompt/context.

Good responsibility split:

```text
orchestrator = controls phase and loop only
planner = creates Connect Map only
builder = writes code only
judge = verifies only
guide-lookup script = returns exact docs/rules needed
```

Possible future small agents:

- `icon-resolver`
- `block-annotator`
- `css-selector-inspector`

Only add them if their prompts stay small and their outputs are strict JSON or small reports.

### 3. Rules should be split by context

Keep one global rule file for universal rules:

```text
rules/global.md
```

Examples:

- Never hack.
- Never invent identifiers.
- Do not touch host app outside allowed customization files.
- Preserve Velt mount-map behavior.
- Verify before declaring done.

Then add smaller rule files by approach and feature:

```text
rules/wireframes.md
rules/css.md
rules/primitives.md
rules/comments.md
rules/notifications.md
rules/dialog.md
rules/sidebar.md
rules/verification.md
```

Important: avoid duplicating the same rule everywhere. Instead, use a rule index that says which rule sets apply to the current block.

Example:

```text
comments sidebar + wireframes requires:
global + comments + sidebar + wireframes + verification
```

### 4. Time estimate and phase bounds

The earlier estimate was:

```text
Full design total: about 3-6 hours
One Loop phase: about 1-1.5 hours
```

These do not conflict.

The full Figma design should be split into multiple Loop phases. Each Loop phase should be bounded to about 60-90 minutes.

Example:

```text
Phase 1: sidebar default/empty/composer states = 60-90 min
Phase 2: thread/replies/options/hover states = 60-90 min
Phase 3: dialog/pin/other flows = 60-90 min
Phase 4: fixes and polish = 30-60 min
```

The current plugin says it has bounds, but those bounds are mostly instructions to Claude. They should be enforced by scripts/harness code, not just prompts.

Target behavior:

- One normal Loop phase: 45-75 minutes.
- One large Loop phase: 75-100 minutes, then stop and hand off.
- No single phase should run 12-16 hours.

## Main Problems To Fix

### P0: Bounds are not mechanically enforced

`agents/velt-orchestrator.md` says the harness enforces:

- max 12 iterations per block
- max 8 minutes per block
- phase soft-cap 60 minutes plus grace

But currently the actual gate mostly accepts `STUCK` or `remaining` only if an agent writes those states. If Claude forgets, the run can continue.

Recommendation: add a real controller script that records attempts and enforces:

- phase started time
- block started time
- iteration count
- failing diff count
- normalized diff hash
- plateau count
- remaining blocks

Then it should write `STUCK` or `remaining` itself.

### P0: Opus/max effort is overused

Current config:

- Planner: Opus + max effort
- Builder: Opus + max effort
- Orchestrator: Sonnet + max effort
- Judge: Sonnet + medium effort

Recommendation:

- Default Planner to Sonnet/medium.
- Default Builder to Sonnet/medium.
- Keep Judge on Sonnet/medium.
- Use Opus only for escalation, hard planning review, or repeated failed phases.

### P1: Verification instructions contradict themselves

The intended latency optimization is:

- Cheap checks every iteration.
- Expensive screenshot and visual diff only at iteration 1 and pass-candidate.

But some Judge text still describes capture/visual-diff as part of every block pipeline. This can lead to unnecessary browser launches and screenshots.

Recommendation:

- Separate cheap attempt reports from full block reports.
- Only require visual-diff artifact when the block is in iteration 1 or pass-candidate.
- Make the prompt unambiguous.

### P1: Too much repeated instruction text

Same concepts are repeated across:

- command
- operating brief
- orchestrator
- planner
- builder
- judge
- verification skill

Recommendation:

- Keep detailed explanation in docs.
- Keep runtime prompts short.
- Use IDs/checklists instead of repeating paragraphs.
- Let scripts enforce mechanical rules.

### P1: Guide lookup is too broad

Recommendation:

- Build `scripts/guide-lookup.mjs`.
- Input: `{surface, feature, approach, blockRole}`.
- Output: a small ordered list of required docs/sections.
- Agents should not read large reference files unless lookup says they are needed.

### P2: Large phases warn but do not stop

Current behavior warns when enumeration yields more than about 8 blocks.

Recommendation:

- Make more than 8 blocks a hard halt by default.
- Allow override with `--allow-large`.
- This prevents accidental 16-block phases from consuming many hours/tokens.

## Recommended Implementation Plan

### Step 1: Add hard budget modes

Add `--budget`:

```text
strict
balanced
thorough
```

Suggested defaults:

```text
strict:
  maxBlocks = 8
  maxBlockMinutes = 6
  maxBlockIterations = 6
  maxPhaseMinutes = 60

balanced:
  maxBlocks = 8
  maxBlockMinutes = 8
  maxBlockIterations = 8
  maxPhaseMinutes = 75

thorough:
  maxBlocks = 12
  maxBlockMinutes = 10
  maxBlockIterations = 12
  maxPhaseMinutes = 90
```

### Step 2: Add a real phase controller

Create a controller script that owns:

- next block selection
- attempt counting
- timing
- plateau detection
- `STUCK` writing
- phase soft-cap writing
- remaining block list

The model should not be trusted to enforce time limits from memory.

### Step 3: Slim the runtime prompts

Reduce each agent prompt to:

- role
- inputs
- outputs
- tools allowed
- hard constraints
- pointer to lookup script

Move long explanations into docs and rules.

### Step 4: Split rules into indexed rule packs

Add:

```text
rules/global.md
rules/wireframes.md
rules/css.md
rules/primitives.md
rules/comments.md
rules/notifications.md
rules/dialog.md
rules/sidebar.md
rules/verification.md
```

Add a rule index that maps surface/approach/block to required rule packs.

### Step 5: Make guide reads targeted

Add a generated or hand-maintained index for:

- surface to component docs
- approach to approach docs
- feature to feature docs
- identifier type to reference file

The agent should read summaries or exact sections first, not entire large reference pages.

### Step 6: Change model defaults

Recommended defaults:

```text
orchestrator: sonnet, medium
planner: sonnet, medium
builder: sonnet, medium
judge: sonnet, medium
```

Escalate to Opus only when:

- repeated failures happen with the same block
- a phase gets stuck due to architectural ambiguity
- planning finds a complex multi-surface mapping

## Target Outcome

After optimization:

- The plugin should not read the whole guide each run.
- Agent prompts should be shorter and less repetitive.
- Large phases should stop early instead of drifting.
- One Loop phase should finish or hand off in about 60-90 minutes.
- A full multi-phase design should be possible in about 3-6 hours, not 12-16 hours.
- Token usage should be controlled by script-enforced budgets, targeted guide reads, and cheaper model defaults.

## Validation Run During Review

These checks passed during the review:

```bash
node scripts/validate.mjs
node scripts/check-guide.mjs
node golden/run-golden.mjs
```

Notes:

- `validate.mjs` passed with one warning: plugin has no semver version and uses the git-SHA channel.
- Golden tests passed for guide identifiers, style/layout calibration, visual-diff gating, contract oracle, verdict gate, and stability gate.
