# Velt UI Customization AI Plugin — Architecture & Design (Figma → Velt, Claude Code)

> **Status: implemented.** This was the build plan; the plugin now exists (manifest, agents, skills, command, scripts, guide bundle, golden test). It's kept as the **architecture/design reference** — the *why* behind the structure. For the *how-to-use*, see `README.md`; for the runtime brief, see `skills/velt-operating-brief/`.

> A Claude Code plugin that turns a **Figma design** into **clean, rule-compliant Velt UI customization** (comments + notifications) on a client's **existing React app**. **Plan once** (structure + style values), then converge on **Builder DEMO-POLISH ↔ Judge** (vision→live DOM→mechanism CSS for composed appearance; planner only on bounded `plan-error`). Always uses the **latest** customization guide + `knowledge/mechanism-polish.json`.

---

## 0. Context & why

The `guide/` (self-sufficient, zero SDK/external paths) is the verified knowledge base for customizing Velt. This plugin operationalizes it: an AI loop that reads a Figma design, picks the right layer per piece (CSS / wireframe / primitive), implements it strictly (R0 — no hacks), verifies it in a real browser against the design, and emits an **SDK-gap report** for anything that can't be done cleanly. The guide is edited and read in place — it is the single source of truth, with zero drift by construction.

**Locked decisions:** standalone plugin repo · thin pointer skills + single in-place guide · Planner/Builder/Judge subagents with shared context + bounded retry · Judge runs the client app + Figma↔Chrome match, with our playground as the golden regression test.

---

## 1. Scope, assumptions, non-goals

**In scope (v1):**
- **Features:** comments (all surfaces: pin, bubble, dialog, sidebar V1/V2, sidebar button, comment tool, inline/text/multi-thread) and **notifications** (panel, tool, history panel).
- **Framework:** React. **Host:** Claude Code only.
- **Layers:** CSS, Wireframes, Primitives, and mix-and-match. Headless is *available* but flagged heavy and not the default (used only when nothing else fits; often becomes an SDK-gap note instead).

**Assumptions about the target project (the plugin does NOT build these — but it now *verifies* them at run start via the §10 preflight, failing fast with a clear fix rather than assuming silently):**
- Velt is installed, the user is authenticated (auth provider), documents are set, and comments/sidebar already render.
- The app runs locally with a dev server the Judge can drive in Chrome.
- Customization code goes under `components/velt/ui-customization/` (R11) with one stylesheet (R8) and one `<VeltWireframe>` (R1).

**Non-goals (v1):** SDK install/auth/setup, other features (presence/reactions/recorder/mentions/activity/tags/arrows), other frameworks (Vue/Angular/vanilla), Cursor host, pixel-perfect matching, modifying Velt's runtime behavior.

**Hard guarantees:** never hack (R0); never enter credentials; only touch customization files + the scoped surfaces; every unmet design need is reported, not faked.

---

## 2. Mental model the plugin enforces

The plugin **carries no model of its own** — it enforces the guide's. The mental model (Velt owns behavior/data/sync, you own presentation; effort order CSS → Wireframes → Primitives → Headless; mix-and-match per piece; R0 as prime directive) is stated once, canonically, in `guide/01-overview.md` and `guide/02-decision-tree.md`. Agents read it there; this plan never restates it.

> **Separation of concerns (the rule for this whole document):** the **guide** holds all *knowledge* — rules, patterns, decisions, flows, identifiers, the verification flow, the gap-handling flow. The **plugin** holds only *mechanics* — the loop, agent roles & sequencing, tool wiring, the inter-agent contract, budgets, report artifacts, persistence. Wherever a section below would describe *how to customize Velt*, it instead **points to the guide file** that owns it. This is what keeps the plugin a strict follower with zero drift.

---

## 3. Plugin package architecture

Standalone repo, installable as a Claude Code plugin.

```
velt-customize-plugin/
├── .claude-plugin/plugin.json     # manifest: name, version, description, dirs
├── .mcp.json                      # MCP servers: claude-in-chrome (design intake is REST — no Figma MCP)
├── guide/                         # the knowledge base — single source of truth (edited + read directly)
│   └── …all guide files…
├── skills/                        # thin pointer skills (SKILL.md per skill)
├── agents/                        # velt-orchestrator, velt-planner, velt-builder, velt-judge
├── commands/
│   └── velt-customize.md          # /velt-customize entry command
├── scripts/
│   ├── check-guide.mjs            # guide integrity gate (required files, no external paths, links)
│   └── validate.mjs               # plugin completeness + guide self-check gate
├── golden/                        # playground.html + Designs #1/#2 fixtures + expected outcomes
├── templates/                     # boilerplate (VeltCustomization.tsx, styles.css, report templates)
├── README.md
├── CLAUDE.md                      # dev-facing repo doc (NOT auto-loaded — plugins don't load root CLAUDE.md)
└── skills/velt-operating-brief/   # the runtime operating brief, shipped as a skill (discoverable when active)
```

**`plugin.json`** (minimal — verified against `claude plugin validate`): `{ name, version, description, author: {name}, homepage }`. The `skills/`, `agents/`, `commands/` dirs and `.mcp.json` are **auto-discovered** — do NOT list them as manifest path keys (that fails validation).

**`.mcp.json`** (shape): registers only `claude-in-chrome` (verification, `type: "stdio"`). Design intake is the **Figma REST API** (`figma-extract.mjs` / `enumerate-blocks.mjs`, token-authed) — **no Figma MCP**. Velt MCP intentionally omitted v1.

**Conventions (verified):** skills = `skills/<name>/SKILL.md` with frontmatter `name`/`description`; agents = `agents/<name>.md` with `name`/`description`/`model`/`disallowedTools` (**no `color`** — not a valid plugin-agent field; `hooks`/`mcpServers`/`permissionMode` are forbidden); commands = `commands/<name>.md`. The runtime operating brief ships as a **skill** (`skills/velt-operating-brief/`), not root `CLAUDE.md` (which plugins don't auto-load). Orchestration mirrors the sequential-chain + shared-context + stop/branch pattern.

---

## 4. Guide as single source of truth (no bundle, no sync)

`guide/` **is** the knowledge base — it is edited and read in place. There is no separate source dir, no copy step, and no `guide.version` stamp. Editing the guide changes plugin behavior directly, with zero drift by construction (there is nothing to drift from).

**Integrity gate (`scripts/check-guide.mjs`):** runs against `guide/` directly and hard-fails on:
1. a missing required entry file (README, decision tree, rules, verifying, sdk-gaps, the core reference pages),
2. any external/SDK path leak — the **self-sufficiency invariant** (the guide must be usable with zero repo-internal paths),
3. a broken internal relative link.

**Validation gate (`validate.mjs`):** fails if `guide/` is missing or `check-guide.mjs` fails; also validates the manifest, `.mcp.json`, and the Code Connect overlay manifest against the guide.

**Strict per-folder templates:** `guide/approaches/`, `guide/features/`, and `guide/reference/behaviors/` each carry a `_template.md` that every file in that folder must follow. This keeps the knowledge base uniform and makes gaps obvious (an empty template section = a known absence, stated explicitly).

---

## 5. Skills catalog (thin pointers — the guide carries the knowledge)

Each skill is small: it tells Claude **which guide files to read and how to apply them** for a sub-task. Skills never embed guide content (no drift). All read from `guide/`.

| Skill | Trigger / purpose | Reads (from `guide/`) | Output |
|---|---|---|---|
| `velt-customize-router` | Map a task to the right guide files; always run the decision tree first | `README.md`, `02-decision-tree.md` | Ordered reading list + chosen layer hint |
| `velt-decision` | Pick layer(s) per component | `02-decision-tree.md`, `01-overview.md` | Layer decision + reason |
| `velt-css` | Theme via variables / class overrides | `approaches/css.md`, `reference/css-variables.md`, `reference/css-classes.md` | CSS edits |
| `velt-wireframes` | Custom layout, Velt behavior | `approaches/wireframes.md`, `reference/wireframe-components.md`, `reference/wireframe-variables.md`, `reference/wireframe-tokens.md` | Wireframe tsx/markup |
| `velt-primitives` | Compose components / UI library / fetch+loop | `approaches/primitives.md`, `reference/props.md`, `reference/component-config.md`, `reference/hooks.md`, `reference/component-catalog.md` | Primitive composition |
| `velt-comments` | Comments specifics | `features/comment-surfaces.md`, `context.md`, comment refs | Surface-specific guidance |
| `velt-notifications` | Notifications specifics | `features/notifications.md`, notif props/events | Surface-specific guidance |
| `velt-rules` | Enforce strict rules | `rules.md`, `edge-cases-and-limitations.md` | Rule checklist (R0–R16) |
| `velt-reference` | Look up exact identifiers (never invent) | `reference/component-catalog.md` (Surface lookup), `reference/*` | Verified identifiers |
| `velt-verify` | Verification flow → verdict | `verifying-a-customization.md` (+ `cross-cutting.md`, `debugging.md`) | Per-surface verdict (PASS/PARTIAL/FAIL/BLOCKED) |
| `velt-gap` | Blocked? fixable vs real SDK gap | `sdk-gaps-and-blockers.md` | Diagnosis + gap entry (if real) |

Each skill's "Reads" column is a **routing hint, not a re-encoding** — the canonical reading order lives in `guide/README.md` ("How to use this guide"), which the router defers to. The **decision tree always runs first** (router). Skills compose: a single component often uses `velt-decision` → (`velt-wireframes`|`velt-primitives`|`velt-css`) → `velt-reference` → `velt-rules` → `velt-verify` → (`velt-gap` only if a goal can't be met cleanly).

---

## 6. Agents (roles) — full specs

All four mirror the migration-orchestrator pattern: sequential, shared JSON context, explicit status, stop/branch on failure.

### 6.1 `velt-orchestrator` (model: opus)
- **Role:** own the run. Run the **preflight (§10)** first, build the work-list order, **run the approach-proposal gate (§11) — present the per-surface coverage matrix and wait for the user to confirm/adjust the per-surface plan before any build**, drive the sequential per-surface loop, hold the shared context, enforce **R16 (one component at a time)**, run the **escalation ladder + stuck-detection** (§12), append to the **run journal** (§12), write incremental + final reports, manage retry/escalation budgets, pin `guideVersion`.
- **Inputs:** Figma node/URL, target repo path, feature scope (comments/notifications), optional design-token overrides.
- **Tools:** subagent invocation, file read/write (reports only), run-journal persistence.
- **Outputs:** progress log, `velt-coverage-report.md` (§11), `velt-customization-report.md`, `sdk-gap-report.md`, per-component screenshots index.

### 6.2 `velt-planner` (model: opus)
- **Role:** turn the design into an executable, per-component plan with goals.
- **Steps** (the *how-to* for each lives in the guide; the Planner just runs it):
  1. **Intake (Figma REST — the only path):** `enumerate-blocks.mjs rest <fileKey> <nodeId>` (structure + per-frame recognition PNGs) → `figma-extract.mjs rest <fileKey> <nodeId> --svg` (deterministic `designSpec`: exact `cssDecls`, design tokens, exported icon SVGs). A Figma token is required — there is no Figma MCP.
  2. **Recognition (design → component):** for each design region, fuse the **screenshot + Figma layer names + structure/position** and match against the recognition catalog `guide/reference/component-definitions.md` (design intent / visual+positional cue → Velt component, with disambiguation for look-alikes and off-by-default flags). **When two components match → ask the user to confirm** (the only other allowed blocking question besides the Figma node). **When nothing matches → it's host UI (ignore + list) or an SDK gap** (`guide/sdk-gaps-and-blockers.md`) — never force a mapping. Resolve each recognized surface's identifiers via the Surface lookup in `guide/reference/component-catalog.md`.
  3. **Layer + sub-decisions** per surface by running `guide/02-decision-tree.md` (Q1–Q4 then S1–S6: feature-flag, custom-data, UI-library, mix, escape-hatch, shadow-DOM). Its output *is* the buildable spec.
  4. **Identifier resolution:** look up exact slots/props/variables/flags/hooks from `guide/reference/*` (never invent — R10). The decision tree's S1/S2 already name the feature-flag and custom-data refs.
  5. **Token mapping:** map Figma vars → `--velt-*` (`guide/reference/css-variables.md`); unmapped tokens flagged.
  6. **Goal synthesis:** per component, write the goals defined in `guide/verifying-a-customization.md` (visual/behavior/rules/scope, with states).
  7. **Order:** sequence components (independent first; shared registries last). One at a time downstream (R16).
  8. **Coverage analysis (for the §11 gate):** score each **surface × approach** cell — coverage % over *that surface's* goals, weighting + achievable/not per `guide/02-decision-tree.md` + `guide/edge-cases-and-limitations.md` (see §11) — and pick the recommended layer per surface. Produce the coverage matrix the orchestrator presents.
- **Output:** the **work-list** (array of work-list items, §7) + global `designTokens` map + an out-of-scope/ignored list + the **coverage report** (§7) for the approach gate.

### 6.3 `velt-builder` (model: opus) — the *maker*
- **Role:** implement **exactly one** component's customization per the plan, strictly.
- **Scoped context (deliberately tight):** ONLY this work-list item + its guide refs + the global token map + the chosen layer + prior Judge feedback (if a retry). **Not** the whole design or other surfaces — context isolation keeps the maker focused and the run's context from bloating.
- **Steps:** follow the per-layer procedure in the item's guide refs (`guide/approaches/<layer>.md`), place files under `ui-customization/`, use only verified identifiers (R10), obey all applicable rules (`guide/rules.md`); on a retry, address **each** unmet goal in the Judge's structured feedback; on any unmet need → run `guide/sdk-gaps-and-blockers.md`, and if it's a real gap write the gap entry (§7) + an R0 code comment, then finish the rest.
- **Output:** code edits (file list + diffs), updated item status `built`, any new gap entries.

### 6.4 `velt-judge` (model: opus) — the *checker* (adversarial, fresh context)
- **Role:** independently verify one built component against its goals — prompted to **disprove** "met," not confirm it. The maker never grades itself.
- **Fresh-context mandate (anti-rubber-stamp):** the Judge receives ONLY `{the surface's goals, the Figma reference, the produced code, the running app}` — **never the Builder's reasoning or self-justification**. A separate role in fresh context with no stake in the build passing.
- **Evidence rule:** a goal flips to `met` **only** with observable evidence (a screenshot of the rendered state, or a performed behavior) — never on assertion. Colors must trace to a `--velt-*` token; states must be driven and captured.
- **Steps:** the *bring-up mechanics* are §9.1 (start app, open Chrome, auth, seed); the *what-to-verify* follows `guide/verifying-a-customization.md` (drive states → qualitative compare vs Figma → behavior check → static rules scan against `guide/rules.md`) → verdict.
- **Output:** verdict `PASS | FAIL | PARTIAL | BLOCKED` (per `guide/verifying-a-customization.md`) + **per-goal results, each `{met, evidence, why, hypothesis}`** (the actionable push-back the Builder must address) + screenshots + any gap entries the Judge newly identifies.

---

## 7. Data schemas (the contract between agents)

These JSON shapes are the **plugin's** inter-agent contract (mechanics). Their *vocabulary* is the guide's: `surface` names come from `guide/reference/component-catalog.md`; `layer`/`mix` and the work-list fields from `guide/02-decision-tree.md`; `goals` from `guide/verifying-a-customization.md`; the gap entry from `guide/sdk-gaps-and-blockers.md`. The schema serializes those definitions — it never redefines them.

```jsonc
// Shared context (persisted across the whole run)
{
  "runId": "string",
  "guideVersion": { "sha": "…", "isoTime": "…" },   // pinned at run start
  "figmaNode": "fileKey#nodeId",
  "targetRepo": "/abs/path",
  "featureScope": ["comments", "notifications"],
  "designTokens": { "--velt-primary-color": "#…", "--velt-default-font-family": "…", "…": "…",
                    "unmapped": [ { "figmaToken": "…", "value": "…", "reason": "no --velt-* equivalent" } ] },
  "components": [ /* work-list items */ ],
  "gapLog": [ /* gap entries (guide/sdk-gaps-and-blockers.md shape) */ ],
  "ignored": [ { "figmaNode": "…", "reason": "non-Velt host UI | no Velt surface" } ]
}

// Work-list item (one Velt surface)
// NB: every identifier value below is a <placeholder> the Planner RESOLVES from the guide
// at run time — none is authoritative here. The plan defines the field, the guide defines
// the vocabulary. (No real surface/flag/prop/slot/hook names are hard-coded in this plan.)
{
  "id": "<slug>",
  "surface": "<surface name — from guide/reference/component-catalog.md Surface lookup>",
  "figmaRef": "nodeId",
  "figmaScreenshot": "path.png",
  "layer": "css|wireframe|primitive|mixed",   // chosen by guide/02-decision-tree.md
  "mix": ["<layer>", "<layer>"],              // when layer = mixed
  "featureFlags": [ { "prop": "<flag prop — guide/reference/feature-flags.md>", "value": true } ],
  "customData": [ { "kind": "<customStatus|customPriority|…>", "value": [ … ] } ],
  "targets": { "slots":     ["<slot — guide/reference/wireframe-components.md>"],
               "props":     ["<prop — guide/reference/component-catalog.md>"],
               "variables": ["<{variable} — guide/reference/wireframe-variables.md>"],
               "hooks":     ["<hook — guide/reference/hooks.md>"] },
  "guideRefs": ["<the guide files this item was resolved from>"],
  "goals": [ /* goal objects */ ],
  "status": "planned|building|built|judging|matched|retry|escalate|partial|blocked",
  "attempts": 0, "escalations": 0, "goalsMet": 0,   // goalsMet drives stuck-detection (§12)
  "files": ["components/velt/ui-customization/<Surface>Wf.tsx", …],
  "gaps": [ /* gap entries scoped to this component */ ]
}

// Goal (acceptance criterion) — kinds + states defined in guide/verifying-a-customization.md;
// `criterion` is RUNTIME data the Planner authors from the user's design (not guide knowledge).
{ "kind": "visual|behavior|rules|scope",
  "id": "<goal-id>",
  "criterion": "<one design attribute, in plain language — authored from the Figma design>",
  "states": ["<state>", …],                   // for visual goals; state vocabulary is guide-owned
  "met": null }                                // null|true|false set by Judge

// Gap entry (becomes the SDK-gap report) — fields = the gap-entry table in
// guide/sdk-gaps-and-blockers.md ("Recording a real gap"); this is its serialization.
// Values are RUNTIME findings for a specific design, not guide facts.
{ "surface": "<surface>",
  "requirement": "<what the design needed>",
  "why": "<the specific limitation hit, citing the guide rule/page that confirms it>",
  "attemptedLayer": "css|wireframe|primitive|headless",
  "cleanAlternative": "<what shipped instead>",
  "suggestedSdkAddition": "<smallest capability that would make it possible cleanly>",
  "guideRef": "<the guide page documenting the limit>" }

// Judge verdict — verdict set defined in guide/verifying-a-customization.md
// Goals default to met:false; flip to true ONLY with evidence (§9.3). "unverified" = couldn't drive the state.
{ "componentId": "comment-dialog", "verdict": "PASS|FAIL|PARTIAL|BLOCKED",
  "goals": [ { "id": "…", "met": "true|false|unverified",
               "evidence": "screenshot.png | behavior-result",   // required for met:true
               "disprovedBy": "tried X; couldn't because <evidence>",  // earned-pass note (§9.3)
               "why": "for met:false — the specific miss", "hypothesis": "suggested fix direction" } ],
  "ruleViolations": [ { "rule": "R4", "detail": "onClick found in wireframe slot", "file": "…", "line": 42 } ],
  "normalizedDiffHash": "…",     // recorded by orchestrator for stuck-detection (§12)
  "screenshots": ["default.png", "resolved.png"] }

// Coverage report — drives the §11 approach gate. A surface × approach matrix.
// each cell % = achievable goal-weight ÷ total goal-weight FOR THAT SURFACE
// (achievability per guide decision-tree + edge-cases).
{ "surfaces": [
    { "surface": "VeltCommentDialog",
      "coverage": { "css": 40, "wireframes": 92, "primitives": 98, "headless": 100 },
      "effort":   { "css": "low", "wireframes": "low", "primitives": "med", "headless": "high" },
      "ceilingPct": 100,               // <100 when this surface has goals no layer can meet (SDK gaps)
      "keyGaps": ["per-surface notes on low cells"],
      "recommended": "wireframes",     // cheapest layer meeting this surface's must-have goals (R12)
      "rationale": "why this layer for this surface",
      "chosen": null } ],              // user's per-surface pick at the gate; null until decided
  "overallEstimatePct": 0,             // roll-up across the recommended/chosen per-surface layers
  "recommendationSummary": "the recommended column = the per-piece Mix; where stepping up buys more" }
```

---

## 8. Goals, decisions, taxonomy, build procedures → owned by the guide

These four were the plan's largest knowledge-duplication. They now live, canonically, in the guide; the plugin's agents read them live. The plan keeps only the **pointer + which agent consumes it**:

| What | Guide owner (single source of truth) | Consumed by |
|---|---|---|
| **Goals = acceptance criteria** (visual/behavior/rules/scope, per-state, "intent not pixels", done-when-met-or-gap) | `verifying-a-customization.md` | Planner synthesizes · Judge sets `met` |
| **Layer-decision algorithm** (Q1–Q4 + sub-decisions S1–S6: feature-flag, custom-data, UI-library, mix, escape-hatch/`defaultCondition`, shadow-DOM) | `02-decision-tree.md` | Planner (step 3) |
| **Surface → identifier map** (root wireframe · primitive · key slots · props · flags · variables · refs) | `reference/component-catalog.md` (Surface lookup) | Planner (mapping + identifier resolution) · Builder (re-confirm) |
| **Per-layer build procedures** (CSS / Wireframe / Primitive / Headless, step-ordered) | `approaches/css.md`, `wireframes.md`, `primitives.md`, `headless.md` | Builder |
| **Verified gotchas** (one `<VeltWireframe>`; container slots; ThreadCard in Body→Threads; shadow root-vs-nested; pin number via `velt-data`; `VeltCommentDialog` not `VeltCommentThread`) | `reference/wireframe-components.md` + `rules.md` | Builder + Judge |
| **When-blocked / SDK-gap flow** (fixable vs real gap → gap entry) | `sdk-gaps-and-blockers.md` | Builder + Judge |

> **Why this isn't restated here:** a copy drifts. (Concretely: the plan's old §10 taxonomy had already diverged from the verified guide — e.g. it listed `VeltCommentText` where the guide's verified name is `VeltTextComment`.) The agents resolve every identifier and procedure from `guide/` at run time, so the plugin can't go stale and the guide stays the one place to change behavior.

---

## 9. Judge — verification harness (the mechanics)

The *what-to-verify* is the guide's (`verifying-a-customization.md`, consumed in §8). This section is only the **plugin mechanics** of running it — the tool-driving the guide deliberately omits. Run **adversarially and in a fresh context** (§6.4): the Judge sees only goals + Figma reference + produced code + running app, is prompted to *disprove* "met," and flips a goal to `met` **only on observable evidence** (captured screenshot / performed behavior) — never on the Builder's say-so.

### 9.1 Bring-up (plugin mechanics)
1. Detect/start the target app dev server (config or inferred). If build fails → verdict `BLOCKED` with logs; deliver Builder code + static rules scan only.
2. Open Chrome (Chrome MCP), navigate to the page rendering the surface.
3. **Auth:** use the app's existing auth/test harness. **Never enter credentials** — if manual login is required, pause and ask the user (safety).
4. **Data:** seed the surface (create a comment / trigger a notification via the app UI or a provided hook). If seeding is impossible → fall back to the empty/loading verification path defined in `guide/verifying-a-customization.md` (the *what-to-verify-with-no-data* is the guide's; the seeding attempt is the plugin's).

### 9.2 Run the flow + emit the verdict
Drive the states, screenshot each (Chrome MCP), and apply `guide/verifying-a-customization.md` step-for-step (visual compare → behavior check → static rules scan against `guide/rules.md`). Emit the guide's verdict and map it to loop control (§12):

- **PASS** → orchestrator marks `matched`, advances.
- **FAIL** (fixable) → structured feedback → Builder retry.
- **PARTIAL** (unmet goals are real SDK gaps, confirmed via `guide/sdk-gaps-and-blockers.md`) → accept best clean partial, record gap entries, advance.
- **BLOCKED** (app won't run/auth) → deliver code + static scan, mark `blocked`, advance, surface prominently.

### 9.3 Anti-rubber-stamp protocol (how the checker stays honest)
The single biggest loop failure is the checker agreeing with the maker. The Judge runs under these hard rules:

1. **Context firewall.** The Judge is spawned in a **fresh context** with ONLY `{goals, Figma reference image, produced code, running app}`. It is **never** given the Builder's reasoning, commit message, self-assessment, or "what I did" notes — nothing that suggests a verdict. It re-derives the expected appearance from the **Figma reference**, independently.
2. **Guilty until proven met.** Default every goal to `met:false`. The Judge's job is framed as *"find why each goal is NOT met."* A goal flips to `met` only when the Judge has **captured evidence** for it.
3. **Evidence or it didn't happen.** Each `met:true` carries an artifact: a **screenshot of that goal's specific state** (default/hover/resolved/unread/…) or the **result of the performed behavior** (e.g. clicked Resolve → pin recolored, screenshot). Color goals require an **inspected `--velt-*` token trace**, not "looks right." No artifact → `met:false` with reason `no-evidence`.
4. **Drive every state, adversarially.** Run each goal's full state list (not just the happy default) and actively **try to break** behavior goals (reply, resolve, status-change, filter, sidebar-sync). A behavior that only sometimes works is `met:false`.
5. **`unverified` ≠ `met`.** If a state can't be driven (can't seed data, can't reach it), the goal is `unverified` (treated as unmet for termination), **never** charitably passed.
6. **Earned-pass note.** For each `met:true`, the verdict records a one-line *"tried to disprove by X; couldn't because <evidence>."* If the Judge can't articulate what would have falsified it, it isn't `met`.
7. **Borderline → human.** When a visual match is genuinely ambiguous (engine-rendering differences, edge case #22), the Judge flags it for human review rather than guessing PASS — qualitative threshold, not coin-flip.

This is the "outside voice" pattern applied to every verification: an independent skeptic, grounded in observable reality, that must *work to fail* the build before it's allowed to pass it.

---

## 10. Preflight — prerequisites gate (run start, before any planning)

The run **starts here.** Before any expensive work, the orchestrator checks every external dependency and **fails fast with a clear, actionable explanation** — never a raw error, never silent, and never any file changed if preflight halts.

**Checks** (each → ✓ pass / ⚠ deferred / ✗ fail):

| # | Check | How | On failure |
|---|---|---|---|
| 1 | Guide present | `guide/` present + self-check passes (`check-guide.mjs`) | ✗ **HALT** (dev-time): "run `node scripts/check-guide.mjs`" |
| 2 | **Figma token + REST resolves** | `FIGMA_TOKEN`/keychain present; `figma-extract.mjs rest <fileKey> <nodeId>` (+ `enumerate-blocks.mjs rest`) resolve the node via `api.figma.com` | ✗ **HALT** (can't plan): "Set a Figma token (`export FIGMA_TOKEN=figd_…` or `figma-extract token set`) and pass a node-specific URL, then re-run. Design intake is REST-only — there is no Figma MCP." |
| 3 | **Velt installed** | repo path valid; `package.json` has `@veltdev/react` | ✗ **HALT**: "This plugin customizes an *existing* Velt setup — Velt isn't installed in `<repo>`. Set up Velt first." |
| 4 | **App runs + Velt renders** | start the dev server → open in Chrome → confirm Velt initializes (default comments/sidebar render) | ✗ **HALT / ⚠**: "App won't start / Velt isn't rendering — check API key, `identify`, `setDocuments`." Also captures the **default-UI baseline** for later compare. |
| 5 | **Chrome MCP connected** | `claude-in-chrome` ping | ⚠ **DEFERRED**: warn now; required before the build loop — **enforced at the §11 coverage gate**. |
| 6 | **Auth** | the app's existing test/auth harness logs a user in | manual login needed → **pause and ask** (never enter credentials). |

**Hard vs deferred.** #1–#4 are *hard for planning* → a failure HALTS immediately (with #4 degrading to ⚠ when the app starts but full "renders" can't be confirmed). #5 Chrome, #6 auth, and the live app gate only the **build loop**, not planning — surfaced here but **enforced at the coverage gate (§11)**, so the user can still plan + see the matrix, then wire up the rest before building.

**Graceful-handling rules (this is the point of the gate):**
- **Translate, don't dump.** Catch every tool/MCP error and render a plain *"what's wrong + how to fix"* — never a raw stack trace.
- **Readiness summary.** Print a per-check ✓/⚠/✗ list and a verdict: `READY TO PLAN`, `READY — N item(s) to resolve before building`, or `HALTED: <reason>`.
- **Change nothing on halt.** A failed hard prereq stops the run before any file is touched.
- **Re-checkable & idempotent.** Fix the issue, re-run, it re-checks — no residue.
- **Journal it.** Each check result + the verdict are the run journal's first entries.
- The Judge's `BLOCKED` (§9.1) remains the **safety net** for runtime failures that slip past preflight.

**Readiness summary — what the user sees (ready case):**
```
Velt preflight — checking prerequisites…
  ✓ Guide present (<n> files, self-check passed)
  ✓ Figma token OK — node <id> resolved via REST (api.figma.com)
  ✓ Velt installed — @veltdev/react in <repo>
  ✓ App runs + Velt renders — default UI at <url>
  ⚠ Chrome MCP not connected — needed before building; connect claude-in-chrome (I'll re-check at the coverage gate)
Readiness: READY TO PLAN — 1 item to resolve before building.
```
**Hard-failure case (graceful, nothing changed):**
```
  ✗ Figma design not reachable.
      What's wrong: no Figma token was found, or the node didn't resolve via the REST API.
      Fix: set a token (`export FIGMA_TOKEN=figd_…` or `figma-extract token set`) and pass a node-specific Figma URL. Then re-run /velt-customize.
Preflight HALTED — can't plan without the design. Nothing was changed.
```

---

## 11. Approach proposal & coverage gate (before any build)

After planning and before building, the orchestrator presents a **per-surface coverage matrix** with a recommended layer per surface, and **waits for the user to confirm or adjust the plan.** The plugin does not write any code until the user decides. This is the run's main decision point.

**Inputs the user provides to start a run:** the `guide/` (reference knowledge), the **Figma file/node**, and the **target repo**. The plugin then analyzes everything and produces the matrix below.

**Coverage matrix (the Planner produces it).** For each recognized **surface**, estimate how faithfully each **approach** can reproduce *that surface* — a surface × approach grid of coverage %:

| Surface | CSS | Wireframes (+CSS) | Primitives (+CSS) | Headless | ✅ Recommended | Effort |
|---|---|---|---|---|---|---|
| Comment dialog | 40% | 92% | 98% | 100% | **Wireframes** | low |
| Comments sidebar | 55% | 88% | 96% | 100% | **Wireframes** | low |
| Comment pin | 65% | 95% | 95% | 100% | **Wireframes** | low |
| … | … | … | … | … | … | … |

(Illustrative numbers.) Each cell is a coverage % for that surface under that approach; the recommended column is the **cheapest approach that meets that surface's must-have goals at the highest practical coverage** (the per-piece Mix, made explicit per surface). A per-surface **key gaps** note accompanies low cells.

**How coverage % is computed (knowledge = guide; scoring = plugin).** Per surface, the denominator is *that surface's* **goals** (`guide/verifying-a-customization.md`), weighted by salience (must-have vs nice-to-have). For each approach, mark each goal achievable-or-not using *what that layer can/can't do* — `guide/02-decision-tree.md` + `guide/edge-cases-and-limitations.md` (e.g. CSS can't meet structural/layout goals; wireframes can't host custom interactivity). **Cell % = achievable weight ÷ total weight** for that surface. A surface's goals achievable in **no** layer are SDK gaps that cap even its Headless cell below 100% (the honest ceiling). An overall coverage rolls up the chosen per-surface approaches.

**Recommendation.** The recommended layer **per surface** follows the guide's golden rule (R12: cheapest viable layer). Collectively the recommended column **is** the per-piece Mix. The orchestrator states the recommended set + the reason, and flags any surface where stepping up a layer buys meaningful extra coverage (and at what effort cost).

**The gate (user decides).** Present the matrix, then **ask the user to confirm the recommended per-surface plan or override specific surfaces** (e.g. "use Primitives for the dialog instead of Wireframes"), while stating the recommendation. The confirmed per-surface layer choices set how the build loop runs (each work-list item's `layer`). This is a deliberate stop — the second after the Figma-node question.

**Enforces the deferred preflight items.** Before building starts, the gate re-checks the §10 items deferred to loop-time — the **app running**, **`claude-in-chrome` connected**, and **auth reachable**. If any is still unmet, the gate **stays open with the specific fix** (re-checked when the user says go); building never begins against a broken environment.

**Honesty (R0).** Every cell is a **conservative pre-build estimate** with assumptions stated — not a promise. The Judge verifies *actual* coverage per surface during the loop, and the final report compares **estimated vs actual** per surface (§14) so the matrix stays accountable.

---

## 12. Loop control (the loop-engineering design)

**What kind of loop this is.** A **bounded goal-loop over a finite, user-approved work-list** — not a heartbeat/cron loop. It runs `find-work → act → verify → remember` until every surface's goals are met or honestly capped, then stops. Design principles it enforces:

- **Maker ≠ checker.** Builder (maker, opus) and Judge (checker, opus, fresh context) are separate so the loop never grades its own work (§6.3/§6.4).
- **Verify against reality, not assertion.** A goal is `met` only on observable browser/Figma evidence (§9). The verification gate is what makes an unattended loop trustworthy.
- **Bounded + monitored.** Every escalation has a budget *and* a progress check — no blind spinning.
- **Durable memory.** An append-only journal is the single source of run truth (resume, cost, learnings).
- **Human at the right altitude only.** Three deliberate stops — the coverage gate (§11), an ambiguous recognition (§6.2), and `BLOCKED`. Everything else is autonomous.

**Goal hierarchy (termination is boolean at each level).** run-goal (match the design within the chosen coverage) ⊃ surface-goal ⊃ per-state visual/behavior goal. The loop terminates per *goal*, so "done" is crisp and estimated-vs-actual coverage falls out.

**Per-surface states:** `planned → building → built → judging → {matched | retry | escalate | partial | blocked}`.

**The escalation ladder (knowledge = guide; control = plugin).** On a `FAIL`, climb only as far as needed:
1. **retry** — fixable within the current layer → Builder re-runs against the Judge's per-goal feedback. **Budget: N=3 / layer.**
2. **escalate** — the layer itself can't express a goal (e.g. a wireframe can't host the needed interactivity) → re-pick the layer per `guide/02-decision-tree.md`'s "when a layer breaks down" rule (wireframe→primitive). **Budget: 1 escalation / surface**, which resets the retry budget once.
3. **gap** — no clean path in any layer (confirmed via `guide/sdk-gaps-and-blockers.md`) → record the gap, ship the best clean partial.

**Stuck-detection (the anti-spiral guard).** Don't burn the full retry budget on no progress. After each Judge verdict the orchestrator records a per-attempt fingerprint and aborts the retry budget early (→ escalate, or declare gap) on **any** of these signals:

- **No-progress:** `goalsMet(N) ≤ goalsMet(N−1)` — the met-count didn't rise. *(One no-progress retry is allowed; two consecutive → abort.)*
- **Repeat diff:** the Builder's change is *semantically* the same as a prior attempt. Compute a **normalized diff hash**: take the changed hunks, strip whitespace/comments/import-order/formatting, sort by file+symbol, hash. If a hash equals any earlier attempt's → repeat. (Catches "re-submitted the same fix.")
- **Oscillation:** a normalized-diff hash from attempt N−2 reappears at N (A→B→A) — the Builder is undoing and redoing. Abort immediately; this never converges.
- **Frozen failure set:** the Judge's set of unmet goal-ids is identical two attempts running (same goals failing the same way) — the feedback isn't landing.
- **Regression:** a goal that was `met` flips to unmet — the latest fix broke something already working. Strong stuck signal; abort and escalate.

"Near-identical" is defined by the **normalized diff hash**, not raw text — cosmetic churn (reformatting, comment edits, import reordering) doesn't count as progress *or* as a new attempt. On abort, the journal records which signal fired (a learning).

**Transitions:**
- Judge `PASS` → `matched`, advance.
- Judge `FAIL` → climb the ladder (retry → escalate → gap) under the budgets + stuck-detection above.
- Budgets/ladder exhausted with goals still unmet → **accept best clean partial**, record remaining goals as **gap entries**, advance.
- Judge `BLOCKED` (app won't build/auth) → deliver code + static scan, mark `blocked`, advance, surface prominently.

**Termination:** every surface is `matched`, `partial`, or `blocked` — i.e. every goal is met, capped as a confirmed SDK gap, or blocked. Orchestrator writes the final report.

**Concurrency (R16-aware).** **Read-only phases fan out** — recognition, the coverage matrix across surfaces, and planning are independent and run in parallel. The **build loop is strictly sequential** — one surface at a time (R16), because all surfaces share one `<VeltWireframe>` and one stylesheet and wireframe gotchas compound. (Worktree-per-surface-then-merge is tempting but unsafe under the single-registry/single-stylesheet constraint → future, not v1.)

**Run journal (durable memory).** The orchestrator appends an event per step (`plan` / `build` / `judge` / `verdict` / `escalate` / `gap`) to a journal — not just a snapshot. This gives **exact resume** after interruption, the **estimated-vs-actual coverage** ledger, **per-phase/per-subagent token cost**, and **captured learnings** (a one-line root-cause on each `partial`/`blocked`) to sharpen future runs. The shared context + gap log are reconstructable from it.

---

## 13. Edge cases & decisions

Split by ownership. **A — customization edge cases are the guide's** (the plugin hits them while applying a guide procedure; the guide already documents the handling — the plugin does not re-decide). **B — operational edge cases are the plugin's** (they're about driving the run, not about customizing Velt).

### A. Customization edge cases → handled by the guide (pointer only)
The Planner/Builder encounter these *inside* a guide procedure; resolution comes from the cited guide file, not this plan:

| Situation | Guide owner |
|---|---|
| Off-by-default feature shown; custom statuses/priorities/reactions | `02-decision-tree.md` S1/S2 · `reference/feature-flags.md` · `reference/component-config.md` |
| UI library must stay interactive; onClick/handler needed in a wireframe | `02-decision-tree.md` (UI-library table) · `approaches/wireframes.md` §6 · `rules.md` R4/R5 |
| Container slot drops children; ThreadCard at dialog root → empty; list/repeater layout ignored | `reference/wireframe-components.md` · `approaches/wireframes.md` |
| Class CSS not reaching a surface; selector CSS with shadow on; token has no `--velt-*` | `approaches/css.md` (root-vs-nested) · `rules.md` R6/R9b |
| Pin number not showing; page-mode has no index/number | `reference/wireframe-components.md` (pin) |
| Sidebar swimlanes/custom grouping; sidebar custom filters | `reference/component-config.md` |
| Notification tabs beyond the 4 stock tabs; headless requested (out of v1) | `features/notifications.md` · `approaches/headless.md` |
| Two `<VeltWireframe>` roots; dark-mode; responsive/mobile; primitive leaf can't restructure | `rules.md` R1/R9 · `cross-cutting.md` · `approaches/primitives.md` |
| Design implies a behavior change (not presentation) | `sdk-gaps-and-blockers.md` §5 (Velt owns behavior → out of scope / gap, never fake) |

### B. Operational edge cases → handled by the plugin

| # | Situation | Handling |
|---|---|---|
| 1 | No Figma node / ambiguous selection | Ask the user for the node URL (only blocking question). |
| 2 | Figma frame includes non-Velt host UI / no Velt equivalent | Map only Velt surfaces; list the ignored/out-of-scope nodes. |
| 3 | Target app won't build/run | Judge `BLOCKED`; deliver code + static scan; report. |
| 4 | App needs manual login / secrets | Never enter credentials; ask user or use test harness. |
| 5 | Can't seed data | Verify empty/loading state only; note. |
| 6 | Visual match ambiguous (engine diff) | Qualitative threshold; bounded retries; accept best clean; flag for human review. |
| 7 | Two components touch the same surface | Orchestrator merges into the one registry/stylesheet; sequence them. |
| 8 | Guide updates mid-run | `guideVersion` pinned at run start; warn if newer; don't switch mid-run. |
| 9 | Multiple frames (dialog + sidebar + notifications) | Multiple work-list items; processed one at a time (R16). |

---

## 14. Outputs / artifacts

Written to the target repo under `velt-customization-report/` (and surfaced in chat):
1. **`velt-coverage-report.md`** — the §11 approach proposal: the **per-surface coverage matrix** (surface × approach %, + effort, key gaps, recommended layer per surface), the recommendation + rationale, and the user's confirmed per-surface choices. Written **before** building (the decision gate); the final report references it.
2. **`velt-customization-report.md`** — run summary: `guideVersion`, **chosen per-surface layers + estimated-vs-actual coverage per surface**, token map, per-component table (surface · layer · status · goals met/total · screenshots), ignored/out-of-scope list, blocked items.
3. **`sdk-gap-report.md`** — the collected gap entries (§7) as a table: `surface · requirement · why · attempted layer · clean alternative · suggested SDK addition · guide ref` — the field set defined in `guide/sdk-gaps-and-blockers.md`. This is the artifact the client hands back to Velt.
4. **`screenshots/`** — Figma reference + Chrome actual per component per state.
5. **Code changes** — under `components/velt/ui-customization/` (one stylesheet, one `<VeltWireframe>`, per-surface `*Wf.tsx` / primitive compositions), each with R0 comments where a gap was hit.

### 14b. Observability — the run replay record (`<phaseDir>/obs/`)

Every run additionally records a **session-replay trace of itself**, mechanically (`scripts/obs.mjs`; the pipeline scripts emit — no agent compliance involved, the same trust posture as report-block/verdict-gate):

- **`obs/events.jsonl`** — one structured JSON line per meaningful step, UTC ISO timestamps: `run.start` (phase-init) · `stage.start/end/timeout` (stage-timer) · `block.start`, `iter.record` (with diffCount / normalized-diff hash / plateau signals / verdict), `pause`/`resume`, `phase.softcap` (block-iter) · `measure` / `measure.fail` / `smoke` with the judge's summary payload (measure-block) · `disposition` (report-block account) · `verdict` (verdict-gate CLI) · `handoff` (write-handoff) · `log` (every `progress.mjs` heartbeat line, mirrored).
- **`obs/snapshots/<blockId>/<seq>[-iterN]/`** — a copy of `results/<blockId>/{shot,diff}.png` + every probe JSON taken at each measurement, **before** the next iteration overwrites the fixed filenames — the per-iteration history `results/` itself cannot keep. The Figma reference frame stays referenced (not copied — `frames/` is write-once).
- **`obs/player.html`** — the replay UI, generated by `obs.mjs build` (and automatically by `write-handoff.mjs` at run end) from `templates/obs-player.html` + inlined run data: timeline scrubber with stage bands, stall shading and color-coded event ticks; per-loop lanes with diff-count sparklines; Live / Reference / Diff / Compare(split-slider) screenshot views; per-event judge output. Self-contained — works over `file://` or `obs.mjs serve`. **Multi-run mode:** `obs.mjs serve <runsRoot>` (or bare `obs.mjs serve`, default root `runs/`) serves ONE UI over ALL runs — a header dropdown toggles between them (`/runs.json` summaries: verdict, stage progress, event/screenshot counts; new runs appear live; `?run=<id>` deep-links; assets under `/r/<runId>/…`). Entry point for users: `/velt-customize:replay`.

Failure isolation is absolute: every recording call is fail-safe (never throws, never changes an exit code), payloads are size-capped, and `VELT_OBS=0` disables the layer entirely. The record answers the debugging question the autopsies kept paying for by hand: *which stage of which iteration did the defect enter, and what did the judge actually see there?*

---

## 15. Verification & testing of the plugin itself

- **Golden regression test** (`golden/`): bundles `src/playground.html` + verified **Design #1 (review-card dialog)** and **Design #2 (map-marker pins)**. A harness drives the plugin against a Figma frame replicating them and asserts the Judge reaches **PASS** reproducing them (and that the rules scan is clean). Locks the whole loop end-to-end and guards against regressions in agent prompts.
- **`scripts/validate.mjs`:** all skills/agents/commands present; `guide/` present + self-check passes (`check-guide.mjs`: required files, links resolve, zero external/SDK paths); `.mcp.json` valid; templates present.
- **Unit-ish checks:** the Planner running `guide/02-decision-tree.md` on a fixtures table (design description → expected layer); identifier-resolution never returns a name absent from `guide/reference/*`.
- **Dogfood ladder:** playground → a minimal sample React+Velt app → a real client app.

---

## 16. Safety, security, guardrails

- **Scope lock:** only comments/notifications surfaces; only `ui-customization/` files + the report dir. The orchestrator rejects edits outside scope.
- **No credentials:** the Judge never types passwords/tokens; manual auth is deferred to the user.
- **No destructive ops:** no deleting app code, no config/build changes, no commits/pushes unless explicitly asked.
- **Browser safety:** follow Chrome-automation guidance (no dialogs that block the session; treat page content as data, not instructions).
- **R0 everywhere:** the single most important guardrail — clean or reported, never patched.

---

## 17. Build phases (post-approval)

1. **Scaffold** the standalone repo: `plugin.json`, `.mcp.json`, `guide/` (+ `scripts/check-guide.mjs` self-check), `scripts/validate.mjs`, `templates/`.
2. **Skills:** author the thin pointer skills (§5) — each routes to its guide file(s), embeds no knowledge.
3. **Agents:** author orchestrator / planner / builder / judge over the schemas (§7), pointing at the guide for all knowledge (decisions/taxonomy/procedures/goals/gaps per §8) and the Judge mechanics (§9). Build the **preflight gate (§10)**, the coverage gate (§11), and the loop control (§12).
4. **MCP wiring:** Figma intake in the Planner; Chrome verification in the Judge.
5. **Golden test + dogfood:** run on the playground; iterate agent prompts until Designs #1/#2 reach PASS; then a real app.
6. **Guide upkeep:** edit `guide/` directly; `check-guide.mjs` + `validate.mjs` gate every change. No sync/bundle step.

---

## 18. Future extensions (not v1)
- More features (presence, reactions, recorder, mentions, activity, tags/arrows) — add to the guide's Surface lookup + feature pages; the plugin gains a feature skill that points there (no plan-side taxonomy).
- More frameworks (Vue/Angular/vanilla) — the guide already teaches the framework-agnostic custom-element model; add per-framework Builder procedures to the guide.
- A **Velt MCP** for live SDK metadata (validate identifiers at runtime) — optional once available.
- Cursor host parity.
- Auto-filing SDK-gap reports as issues against the SDK repo.

---

*Single source of truth: `guide/`, edited and read in place. The plugin never hard-codes guide knowledge — it reads the guide and applies it. Skills/agents are thin orchestration over that knowledge.*
