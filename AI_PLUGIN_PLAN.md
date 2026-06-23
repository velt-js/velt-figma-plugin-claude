# Velt UI Customization AI Plugin — Detailed Plan (Figma → Velt, Claude Code)

> A Claude Code plugin that turns a **Figma design** into **clean, rule-compliant Velt UI customization** (comments + notifications) on a client's **existing React app**, iterating Planner → Builder → Judge until each component visually matches or is honestly reported as an SDK gap. Always uses the **latest** customization guide.

---

## 0. Context & why

The `customization-guide/` (37 files, self-sufficient, zero SDK/external paths) is the verified knowledge base for customizing Velt. This plugin operationalizes it: an AI loop that reads a Figma design, picks the right layer per piece (CSS / wireframe / primitive), implements it strictly (R0 — no hacks), verifies it in a real browser against the design, and emits an **SDK-gap report** for anything that can't be done cleanly. The guide keeps evolving, so the plugin must always consume its **latest** state with zero drift.

**Locked decisions:** standalone plugin repo · thin pointer skills + bundled live guide · Planner/Builder/Judge subagents with shared context + bounded retry · Judge runs the client app + Figma↔Chrome match, with our playground as the golden regression test.

---

## 1. Scope, assumptions, non-goals

**In scope (v1):**
- **Features:** comments (all surfaces: pin, bubble, dialog, sidebar V1/V2, sidebar button, comment tool, inline/text/multi-thread) and **notifications** (panel, tool, history panel).
- **Framework:** React. **Host:** Claude Code only.
- **Layers:** CSS, Wireframes, Primitives, and mix-and-match. Headless is *available* but flagged heavy and not the default (used only when nothing else fits; often becomes an SDK-gap note instead).

**Assumptions about the target project (the plugin does NOT build these):**
- Velt is installed, the user is authenticated (auth provider), documents are set, and comments/sidebar already render.
- The app runs locally with a dev server the Judge can drive in Chrome.
- Customization code goes under `components/velt/ui-customization/` (R11) with one stylesheet (R8) and one `<VeltWireframe>` (R1).

**Non-goals (v1):** SDK install/auth/setup, other features (presence/reactions/recorder/mentions/activity/tags/arrows), other frameworks (Vue/Angular/vanilla), Cursor host, pixel-perfect matching, modifying Velt's runtime behavior.

**Hard guarantees:** never hack (R0); never enter credentials; only touch customization files + the scoped surfaces; every unmet design need is reported, not faked.

---

## 2. Mental model the plugin enforces (recap of the guide)

- **Velt owns behavior + data + real-time sync; you own presentation.**
- **Effort order:** CSS → Wireframes → Primitives → Headless. Pick the **cheapest** layer that achieves the design.
- **Mix-and-match per piece** is allowed (e.g., wireframe layout + CSS theme; primitive dialog + CSS). One `<VeltWireframe>` root and one stylesheet per app.
- **The asymmetry:** primitives compose with any UI library + interactivity; wireframes keep only **static** markup + CSS classes (cloned), behavior comes from Velt slot components.
- **R0 is the prime directive:** clean or reported — never patched.

---

## 3. Plugin package architecture

Standalone repo, installable as a Claude Code plugin.

```
velt-customize-plugin/
├── .claude-plugin/plugin.json     # manifest: name, version, description, dirs
├── .mcp.json                      # MCP servers: figma-desktop, claude-in-chrome (velt-docs optional/later)
├── guide/                         # BUNDLED customization-guide, VERBATIM (synced). The knowledge base.
│   ├── …all 37 guide files…
│   └── guide.version              # { sha, isoTime, fileCount, bytes }
├── skills/                        # thin pointer skills (SKILL.md per skill)
├── agents/                        # velt-orchestrator, velt-planner, velt-builder, velt-judge
├── commands/
│   └── velt-customize.md          # /velt-customize entry command
├── scripts/
│   ├── sync-guide.mjs             # copy customization-guide/ → guide/ + stamp guide.version
│   └── validate.mjs               # plugin completeness + guide freshness gate
├── golden/                        # playground.html + Designs #1/#2 fixtures + expected outcomes
├── templates/                     # boilerplate (VeltCustomization.tsx, styles.css, report templates)
├── README.md
└── CLAUDE.md                      # plugin operating instructions (loaded when plugin active)
```

**`plugin.json`** (shape): `{ name, version, description, author, skills: "./skills", agents: "./agents", commands: "./commands", mcpServers: "./.mcp.json" }`.

**`.mcp.json`** (shape): registers `figma-desktop` (design intake) and `claude-in-chrome` (verification). Velt MCP intentionally omitted v1.

**Conventions mirrored from this repo:** skills = `skills/<name>/SKILL.md` with YAML frontmatter (`name`, `description`, `metadata`); agents = `agents/<name>.md` with `name`/`description`/`model`/`color`; orchestration mirrors `.claude/agents/migration-orchestrator.md` (sequential chain, shared JSON context, stop/branch, status report).

---

## 4. Guide bundling & "always latest" (zero-drift)

**`scripts/sync-guide.mjs` algorithm:**
1. Resolve source `customization-guide/` (config: local path, git submodule, or a pinned ref).
2. **Clean-copy** every file verbatim into `guide/` (no transformation → zero drift). Remove orphaned files.
3. Stamp `guide/guide.version` = `{ sha: <git SHA of guide source>, isoTime, fileCount, bytes }`.
4. Run a self-check: links/anchors resolve, **zero external/SDK paths** (the self-sufficiency invariant), expected entry files present.

**Freshness gate (`validate.mjs` + orchestrator):**
- `validate.mjs` fails CI if `guide/` is missing files, the self-check fails, or `guide.version` is absent.
- **At run start**, the orchestrator records `guideVersion` into the shared context and **pins it for the whole run** (consistency). If it can detect a newer guide source, it warns but does not switch mid-run.

**Keeping it current (SDK repo CI):** a workflow triggers on `customization-guide/**` changes → runs `sync-guide.mjs` → opens a plugin PR / publishes. (Alternative: `guide/` is a git submodule pinned to the guide directory; `sync` = submodule update.)

**Edge:** if the guide source is unreachable at runtime, the plugin uses the **bundled** `guide/` and reports its `guideVersion` (still functional, just not freshest).

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
| `velt-reference` | Look up exact identifiers (never invent) | `reference/*` (props, apis, events, feature-flags, css-vars, wireframe-*) | Verified identifiers |
| `velt-verify` | Browser verification procedure | `debugging.md`, `cross-cutting.md` | Verify steps |

The **decision tree always runs first** (router). Skills compose: a single component often uses `velt-decision` → (`velt-wireframes`|`velt-primitives`|`velt-css`) → `velt-reference` → `velt-rules` → `velt-verify`.

---

## 6. Agents (roles) — full specs

All four mirror the migration-orchestrator pattern: sequential, shared JSON context, explicit status, stop/branch on failure.

### 6.1 `velt-orchestrator` (model: opus)
- **Role:** own the run. Build the work-list order, drive the per-component loop, hold the shared context, enforce **R16 (one component at a time)**, write incremental + final reports, manage retry/escalation budgets, pin `guideVersion`.
- **Inputs:** Figma node/URL, target repo path, feature scope (comments/notifications), optional design-token overrides.
- **Tools:** subagent invocation, file read/write (reports only), shared-context persistence.
- **Outputs:** progress log, `velt-customization-report.md`, `sdk-gap-report.md`, per-component screenshots index.

### 6.2 `velt-planner` (model: opus)
- **Role:** turn the design into an executable, per-component plan with goals.
- **Steps:**
  1. **Intake:** `get_metadata` (structure) → `get_design_context` (code + screenshot + context) → `get_screenshot` (reference image per surface) → `get_variable_defs` (design tokens).
  2. **Surface mapping:** map each Figma frame/component to a **Velt surface** (§10 taxonomy). Non-Velt UI (host app chrome) is ignored and listed. Surfaces with no Velt equivalent → out-of-scope note.
  3. **Layer selection** per surface via the decision algorithm (§9).
  4. **Feature-flag + custom-data detection:** if the design shows an off-by-default feature or custom statuses/priorities/reactions, record the enabling prop / custom-data config (`reference/feature-flags.md`, `reference/component-config.md`).
  5. **Identifier resolution:** look up exact slots/props/variables/hooks from `reference/` (never invent).
  6. **Token mapping:** map Figma vars → `--velt-*` (`reference/css-variables.md`); unmapped tokens flagged.
  7. **Goal synthesis:** per component, write visual/behavior/rules/scope goals (§8).
  8. **Order:** sequence components (independent first; shared registries last). One at a time downstream.
- **Output:** the **work-list** (array of work-list items, §7) + global `designTokens` map + an out-of-scope/ignored list.

### 6.3 `velt-builder` (model: sonnet)
- **Role:** implement **exactly one** component's customization per the plan, strictly.
- **Inputs:** one work-list item, the global token map, prior Judge feedback (if retry), shared context.
- **Steps:** follow the per-layer procedure (§11), read the exact guide refs from the item, place files under `ui-customization/`, use only verified identifiers, obey all applicable rules, and on any unmet need → write an **Unsupported entry** (§7) + an R0 code comment, then finish the rest.
- **Output:** code edits (file list + diffs), updated item status `built`, any new unsupported entries.

### 6.4 `velt-judge` (model: opus)
- **Role:** verify one built component against its goals.
- **Steps (the harness, §12):** ensure app runs → open Chrome → authenticate (existing harness; never enter secrets) → seed/select data so the surface renders → drive states → screenshot each → **qualitative compare vs Figma** → **rules-compliance scan** (static, §12.3) → **behavior check** → verdict.
- **Output:** verdict `PASS | FAIL | PARTIAL_UNSUPPORTED` + per-goal results + structured feedback + screenshots + any unsupported entries the Judge newly identifies.

---

## 7. Data schemas (the contract between agents)

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
  "unsupportedLog": [ /* unsupported entries */ ],
  "ignored": [ { "figmaNode": "…", "reason": "non-Velt host UI | no Velt surface" } ]
}

// Work-list item (one Velt surface)
{
  "id": "comment-dialog",
  "surface": "VeltCommentDialog",            // from §10 taxonomy
  "figmaRef": "nodeId",
  "figmaScreenshot": "path.png",
  "layer": "wireframe",                       // css | wireframe | primitive | mixed
  "mix": ["wireframe", "css"],                // when layer = mixed
  "featureFlags": [ { "prop": "replyAvatars", "value": true, "ref": "feature-flags.md" } ],
  "customData": [ { "kind": "customStatus", "value": [ … ] } ],
  "targets": { "slots": ["velt-comment-dialog-header-wireframe", …],
               "props": ["fullExpanded", "defaultCondition"],
               "variables": ["{annotation.status.id}", "{annotation.annotationIndex}"],
               "hooks": ["useCommentAnnotations"] },
  "guideRefs": ["approaches/wireframes.md", "reference/wireframe-components.md#2-…"],
  "goals": [ /* goal objects */ ],
  "status": "planned|building|built|judging|matched|retry|replan|partial_unsupported|blocked",
  "attempts": 0, "replans": 0,
  "files": ["components/velt/ui-customization/VeltCommentDialogWf.tsx", …],
  "unsupported": [ /* unsupported entries scoped to this component */ ]
}

// Goal (acceptance criterion)
{ "kind": "visual|behavior|rules|scope",
  "id": "header-status-pill",
  "criterion": "indigo status pill top-left of dialog header, label uppercase",
  "states": ["default", "resolved"],          // for visual goals
  "met": null }                                // null|true|false set by Judge

// Unsupported entry (becomes the SDK-gap report)
{ "surface": "VeltCommentDialog",
  "requirement": "editable structured side-panel (owner/due-date) inside the dialog",
  "why": "no wireframe slot hosts live inputs; would require interactive React in a wireframe (R4)",
  "attemptedLayer": "wireframe",
  "cleanAlternative": "primitive + headless side-panel",
  "suggestedSdkAddition": "a dialog side-panel slot that accepts host-rendered content",
  "guideRef": "edge-cases-and-limitations.md" }

// Judge verdict
{ "componentId": "comment-dialog", "verdict": "PASS|FAIL|PARTIAL_UNSUPPORTED",
  "goals": [ { "id": "…", "met": true, "evidence": "screenshot.png", "note": "…" } ],
  "ruleViolations": [ { "rule": "R4", "detail": "onClick found in wireframe slot", "file": "…", "line": 42 } ],
  "feedback": "actionable text for Builder",
  "screenshots": ["default.png", "resolved.png"] }
```

---

## 8. Goals = acceptance criteria (how "done" is defined per component)

The Planner synthesizes goals; the Judge sets `met`.

- **Visual goals** — one per salient design attribute, each with the **states** to verify: layout/order of pieces, colors (must trace to a `--velt-*` token), shape (e.g., square pin), spacing/radius, badges/counts, typography, and per-state looks (default / hover / empty / loading / resolved / unread / selected). The Judge compares **intent**, not pixels.
- **Behavior goals** — the Velt actions that must still work after customization: comments (place pin, open dialog, reply, resolve, status change, filter, sidebar sync); notifications (open panel, switch tab, mark read, click-through). Velt behavior must be intact (R0 — we never disabled it).
- **Rules goals** — the subset of `rules.md` applicable to the chosen layer (see §12.3 checklist).
- **Scope goal** — only the scoped surfaces/files were touched.

A component is **done** when every goal is `met=true`, **or** its unmet goals are all recorded as **unsupported** (clean partial accepted).

---

## 9. Planner decision algorithm (per Velt surface) — replicates `02-decision-tree`

For each mapped surface:

```
1. DIVERGENCE from Velt default?
   - Only colors/spacing/fonts/radius, same structure         → CSS
   - Structure/layout change, content is NON-interactive,
     Velt keeps the behavior                                  → WIREFRAME
   - Needs own UI-library interactivity / own state / compose
     freely / render-anywhere / customize a LEAF piece        → PRIMITIVE
   - Total control / data-only / layout neither wireframes nor
     primitives can express                                   → HEADLESS (flag heavy; often → SDK-gap note)

2. UI-LIBRARY branch:
   - Library components used only as STATIC styling (markup+classes) → WIREFRAME ok
   - Library components must stay INTERACTIVE inside the surface     → PRIMITIVE (wireframes drop behavior)

3. FEATURE-FLAG branch:
   - Design shows an off-by-default feature (replyAvatars, priority,
     minimap, sidebarButtonOnCommentDialog, deviceIndicator, @here,
     commentIndex/pin number, …) → enable via its PROP (feature-flags.md). Not a hack.

4. CUSTOM-DATA branch:
   - Design shows custom statuses/priorities/categories/reactions →
     customStatus / customPriority / customCategory / customReactions (component-config.md).

5. MIX per piece:
   - A surface may combine layers (wireframe layout + CSS theme; primitive + CSS).
     Record `layer="mixed"` + `mix[]`. Keep ONE <VeltWireframe> + ONE stylesheet globally.

6. SHADOW-DOM decision (verified rules):
   - Wireframe of a ROOT surface (e.g. velt-comment-dialog-wireframe) → shadow auto-removed → class CSS works.
   - Wireframe of only a NESTED/leaf slot → must set shadowDom={false} for class CSS.
   - Inline styles always work. Variable theming always crosses shadow.

7. ESCAPE-HATCH decision:
   - If the design needs to force show/hide a piece on YOUR logic → PRIMITIVE (defaultCondition). Wireframes can't.

Output the work-list item with layer(s), exact targets, flags, custom data, goals, guide refs.
```

If a surface can't be expressed in CSS/wireframe/primitive without violating R0 → mark its goals **unsupported** with a suggested SDK addition (don't escalate to a hack).

---

## 10. Component taxonomy (comments + notifications) — the Planner/Builder map

Each surface → its **root wireframe**, **primitive**, key **slots**, key **props**, and the **guide refs**. (Identifiers are from the verified reference pages; the Builder always re-confirms via `velt-reference`.)

**Comments**
| Surface | Root wireframe | Primitive | Key slots / variables | Key props | Guide refs |
|---|---|---|---|---|---|
| Comment pin | `velt-comment-pin-wireframe` | `VeltCommentPin` | `…-index`/`-number` (empty containers → fill with `velt-data field="annotation.annotationIndex\|annotationNumber"`), `-triangle`; `velt-if {annotation.status.id}` | `commentPinType`, `commentIndex` | wireframe-components §5, wireframe-variables |
| Comment bubble | `velt-comment-bubble-wireframe` | `VeltCommentBubble` | `Avatar`, `CommentsCount`, `UnreadIcon` | `avatar`, `commentCountType`, `bubbleOnPinHover` | wireframe-components §5 |
| Comment dialog (thread) | `velt-comment-dialog-wireframe` | `VeltCommentDialog` *(not VeltCommentThread — deprecated)* | `Header`, `Status`, `Priority`, `AssigneeBanner(+Resolve/Unresolve)`, **`Body→Threads→ThreadCard`** (Avatar/Name/Time/Message/Reactions/Options), `Composer(Input/ActionButton/Attachments/FormatToolbar)`, `ReplyAvatars`; variants `variant="dialog"\|"sidebar"` | `annotationId`, `fullExpanded`, `defaultCondition`, `commentPinType` | wireframe-components §2, props |
| Comments sidebar V1 | `velt-comments-sidebar-wireframe` | `VeltCommentsSidebar` | header/search/filter/list/empty | `filterConfig`, `filterPanelLayout`, `embedMode`, `position`, `variant` | component-config, wireframe-components §3 |
| Comments sidebar V2 | `velt-comments-sidebar-v2-wireframe` | `VeltCommentsSidebarV2` | `panel → header(search,filter) → list → list-item-v2 / list-group-header-v2(label/count/chevron/separator) → empty-placeholder`; **filter container** (`section/option/control…`) | `filters`/`miniFilters`/`minimalFilters`, `filterPanelLayout`, `filterOperator`, `embedMode`(string), `defaultMinimalFilter` | component-config §sidebar, wireframe-components §4 |
| Sidebar button | `velt-sidebar-button-wireframe` | `VeltSidebarButton` | icon / comments-count / unread-icon | `position`, `filterPanelLayout`, `commentCountType` | props |
| Comment tool | `velt-comment-tool-wireframe` | `VeltCommentTool` | tool button | `targetElementId`, `context`, `contextInPageModeComposer` | props, context.md |
| Inline / text / multi-thread | `velt-inline-comments-section-wireframe` / … | `VeltInlineCommentsSection` / `VeltCommentText` / `VeltMultiThreadCommentDialog` | section list/panel/composer | `composerPosition`, `messageTruncation` | features/comment-surfaces |

**Sidebar engines (data/config APIs the Planner/Builder use):**
- **Custom grouping / swimlanes:** subscribe `commentElement.on('commentSidebarDataInit'|'commentSidebarDataUpdate')` → `setCommentSidebarData([{groupId,groupName,isExpanded,annotations}], {grouping:true})`.
- **Declarative filters:** `filters`/`miniFilters`/`minimalFilters` config with `field`/`label`/`valuePath` (incl. `context.*`).
- **Custom data:** `customStatus`/`customPriority`/`customCategory`/`customReactions`.

**Notifications**
| Surface | Root wireframe | Primitive | Key slots / config | Key props | Guide refs |
|---|---|---|---|---|---|
| Notifications panel | `velt-notifications-panel-wireframe` | `VeltNotificationsPanel` | tabs (`forYou`/`documents`/`all`/`people`) list items, settings, empty states | `tabConfig`, `panelOpenMode`, `settings`, `settingsLayout` | features/notifications, props |
| Notifications tool (bell) | `velt-notifications-tool-wireframe` | `VeltNotificationsTool` | bell + panel | `panelOpenMode`, `tabConfig`, `maxDays` | props |
| Notifications history | — | `VeltNotificationsHistoryPanel` | embedded history | `embedMode` | props |
| Data (headless) | — | `useNotificationsData()` / `useNotificationUtils()` | feed + mark-read | — | hooks, apis, events |

---

## 11. Builder — per-layer procedures (exact)

**Common:** read the item's `guideRefs`; confirm every identifier via `velt-reference`; place files under `components/velt/ui-customization/` (R11); keep ONE stylesheet (R8) + ONE `<VeltWireframe>` (R1); mount the live feature component (R2).

**CSS layer:**
1. Map tokens → `:root { --velt-… }` (cross shadow automatically) using the global token map.
2. For class/selector overrides: set `shadowDom={false}` on the surface **or** `client.injectCustomCss(...)` (R6); add `!important` where Velt's specificity wins (R9b); confirm class names via `reference/css-classes.md` (inspect with shadow off — debugging.md).
3. Dark mode under `:root[data-velt-theme="dark"]` with `--velt-dark-*` (R9).

**Wireframe layer:**
1. Register the surface's **root** wireframe inside the single `<VeltWireframe>` (shadow auto-off for that surface). If only customizing a nested/leaf slot, set `shadowDom={false}` explicitly.
2. For **container** slots, declare the **full** structural child tree you want (undeclared children vanish — verified). For the dialog, nest `ThreadCard` inside `Body→Threads` (verified) or it renders empty.
3. Lay out slots with your markup; **inline styles** for shadow-safe styling, class CSS only when shadow is off.
4. Dynamic behavior via `velt-if` / `velt-class` / `velt-data` with **real** variables (`reference/wireframe-variables.md`); slot inputs (e.g., `Composer.ActionButton type="submit"`).
5. **No interactive React** in wireframe markup (R4) — use Velt slot components for actions, or `VeltButtonWireframe` + `useVeltEventCallback('veltButtonClick')` for custom buttons. If real interactivity is required → escalate to primitive (record the decision).
6. Variants: `variant="dialog"|"sidebar"` for per-context looks.

**Primitive layer:**
1. **Fetch → loop → render:** `useCommentAnnotations()` / `useNotificationsData()` → `.map()` → render `VeltCommentDialog annotationId=… defaultCondition={false}` (never `VeltCommentThread`).
2. Wrap in the design's UI library; theme via CSS variables; trim features via props (`reference/props.md`).
3. Customize a **leaf** piece via that leaf's wireframe (mix).
4. `defaultCondition={false}` when the design controls show/hide.

**Unsupported handling (every layer):** if a goal needs a slot/prop/variable/hook absent from `reference/` → **do not hack** → write an Unsupported entry (§7) + an R0 code comment in place → implement the remaining goals.

---

## 12. Judge — verification harness (detailed)

### 12.1 Bring-up
1. Detect/start the target app dev server (config or inferred). If build fails → verdict `BLOCKED` with logs; deliver Builder code + static rules scan only.
2. Open Chrome (Chrome MCP), navigate to the page rendering the surface.
3. **Auth:** use the app's existing auth/test harness. **Never enter credentials** — if manual login is required, pause and ask the user (safety).
4. **Data:** ensure the surface has data (create a comment / trigger a notification via the app UI or a provided seeding hook). If seeding is impossible → verify empty/loading state only and note the limitation.

### 12.2 Visual + behavior
5. Drive each goal's **states** (hover, open, resolved, unread, selected) and screenshot each (Chrome MCP screenshot/zoom).
6. **Qualitative match** vs the Figma screenshot per visual goal: layout/order, token-traced colors, shape, badges, typography, per-state look. Mark each goal `met` with screenshot evidence. (Engines differ — compare intent, not pixels.)
7. **Behavior check:** perform the surface's actions; confirm Velt behavior intact.

### 12.3 Rules-compliance scan (static, on produced code) — checklist
- **R0** no hacks (no `setTimeout`/`MutationObserver` on Velt internals, no scraped internal markup, no timing shims).
- **R1** exactly one `<VeltWireframe>`. **R2** live feature mounted.
- **R4** no `onClick`/hooks/state inside wireframe markup. **R5** UI-library components wrapped around primitives, not inside wireframes.
- **R6** selector CSS only with shadow off / `injectCustomCss`. **R7** no `display:none` to remove features (use props). **R8** one stylesheet. **R9/R9b** dark-mode cascade + `!important`. 
- **R10** only verified identifiers (cross-check against `reference/`). **R11** files under `ui-customization/`.
- **R16** one component touched this step.
- **Verified gotchas:** ThreadCard nested in Body→Threads; container slots declare children; correct shadow root-vs-nested; pin number via `velt-data`; `VeltCommentDialog` not `VeltCommentThread`.

### 12.4 Verdict
- **PASS:** all goals `met`. → orchestrator marks `matched`, advances.
- **FAIL:** ≥1 visual/behavior/rule goal unmet and fixable → structured feedback → Builder retry.
- **PARTIAL_UNSUPPORTED:** unmet goals are due to missing SDK capability (no clean path) → accept best clean partial, record unsupported, advance.

---

## 13. Loop control (state machine, budgets, termination)

**Per-component states:** `planned → building → built → judging → {matched | retry | replan | partial_unsupported | blocked}`.

**Transitions & budgets:**
- Judge `FAIL` (fixable) → `retry`; Builder re-runs with feedback. **Budget: N=3 retries per layer.**
- Judge `FAIL` (wrong approach, e.g., wireframe can't host needed interactivity) → `replan`; Planner re-picks the layer (e.g., wireframe→primitive). **Budget: 1 replan per component**, then resets the retry budget once.
- Retries/replans exhausted with goals still unmet → **accept best clean partial**, mark remaining goals **unsupported**, advance.
- Judge `BLOCKED` (app won't run / can't auth) → deliver code + static scan, mark `blocked`, advance, surface prominently in the report.

**Termination:** every component is `matched`, `partial_unsupported`, or `blocked`. Orchestrator writes the final report. **R16** is enforced — never build/judge two components concurrently.

**Persistence:** the orchestrator writes the shared context + Unsupported Log **incrementally** after each step, so an interrupted run resumes and nothing is lost.

---

## 14. Edge cases & decisions (enumerated)

| # | Situation | Handling |
|---|---|---|
| 1 | No Figma node / ambiguous selection | Ask the user for the node URL (only blocking question). |
| 2 | Figma frame includes non-Velt host UI | Map only Velt surfaces; list the ignored nodes. |
| 3 | Design surface has no Velt equivalent | Out of scope; note; no code. |
| 4 | Design shows an off-by-default feature | Enable via its prop (feature-flags) — not a hack. |
| 5 | Custom statuses/priorities/reactions in design | `customStatus`/`customPriority`/`customCategory`/`customReactions`. |
| 6 | UI library must stay interactive inside the surface | Primitive (wireframes drop behavior). |
| 7 | Wireframe container slot omits children → they vanish | Declare the full structural tree (verified). |
| 8 | ThreadCard placed at dialog root → empty card | Nest inside `Body→Threads` (verified). |
| 9 | Class CSS not reaching a wireframed surface | Root wireframe = auto shadow-off; nested-only = set `shadowDom={false}`; or inline styles. |
| 10 | Pin number not showing | Normal comment: `velt-data field="annotation.annotationIndex"`. Page-mode: no index/number (note). |
| 11 | Figma token has no `--velt-*` equivalent | Map closest; else class CSS (shadow off) or unsupported entry. |
| 12 | Selector CSS with shadow on | Set `shadowDom={false}` or `injectCustomCss`. |
| 13 | Two `<VeltWireframe>` roots | Enforce one (R1); merge registries. |
| 14 | Custom layout around a list/repeater slot ignored | Customize the **item** wireframe (§7b). |
| 15 | onClick/handler needed inside wireframe | Use Velt slot component or `VeltButtonWireframe`+event; else escalate to primitive. |
| 16 | Sidebar swimlanes/custom grouping | `setCommentSidebarData` + `commentSidebarDataInit/Update`. |
| 17 | Sidebar custom filters | `filters` config + `valuePath`; or wireframe filter slots. |
| 18 | Notification tabs beyond the 4 stock tabs | Headless (`useNotificationsData`) — flag heavy or unsupported entry. |
| 19 | Target app won't build/run | Judge `BLOCKED`; deliver code + static scan; report. |
| 20 | App needs manual login / secrets | Never enter credentials; ask user or use test harness. |
| 21 | Can't seed data | Verify empty/loading state only; note. |
| 22 | Visual match ambiguous (engine diff) | Qualitative threshold; bounded retries; accept best clean; flag for human review. |
| 23 | Two components touch the same surface | Orchestrator merges into the one registry/stylesheet; sequence them. |
| 24 | Design implies behavior change (not presentation) | Velt owns behavior → primitive/headless or unsupported; never fake. |
| 25 | Guide updates mid-run | `guideVersion` pinned at run start; warn if newer; don't switch mid-run. |
| 26 | Dark-mode design | `[data-velt-theme="dark"]` + `--velt-dark-*` (R9). |
| 27 | Responsive/mobile variant in Figma | media queries / `filterPanelLayout="bottomSheet"`; note if a variant can't be expressed. |
| 28 | Primitive leaf can't restructure | Use that leaf's wireframe (mix). |
| 29 | Headless requested but out of v1 | Flag; deliver primitive-closest + note; likely SDK-gap. |
| 30 | Multiple frames (dialog + sidebar + notifications) | Multiple work-list items; processed one at a time (R16). |

---

## 15. Outputs / artifacts

Written to the target repo under `velt-customization-report/` (and surfaced in chat):
1. **`velt-customization-report.md`** — run summary: `guideVersion`, token map, per-component table (surface · layer · status · goals met/total · screenshots), ignored/out-of-scope list, blocked items.
2. **`sdk-gap-report.md`** — the Unsupported Log as a table: `surface · requirement · why · attempted layer · clean alternative · suggested SDK addition · guide ref`. This is the artifact the client hands back to Velt.
3. **`screenshots/`** — Figma reference + Chrome actual per component per state.
4. **Code changes** — under `components/velt/ui-customization/` (one stylesheet, one `<VeltWireframe>`, per-surface `*Wf.tsx` / primitive compositions), each with R0 comments where a gap was hit.

---

## 16. Verification & testing of the plugin itself

- **Golden regression test** (`golden/`): bundles `src/playground.html` + verified **Design #1 (review-card dialog)** and **Design #2 (map-marker pins)**. A harness drives the plugin against a Figma frame replicating them and asserts the Judge reaches **PASS** reproducing them (and that the rules scan is clean). Locks the whole loop end-to-end and guards against regressions in agent prompts.
- **`scripts/validate.mjs`:** all skills/agents/commands present; `guide/` bundled + self-check passes + `guide.version` stamped; `.mcp.json` valid; templates present.
- **Unit-ish checks:** Planner decision algorithm on a fixtures table (design description → expected layer); identifier-resolution never returns an unverified name.
- **Dogfood ladder:** playground → a minimal sample React+Velt app → a real client app.

---

## 17. Safety, security, guardrails

- **Scope lock:** only comments/notifications surfaces; only `ui-customization/` files + the report dir. The orchestrator rejects edits outside scope.
- **No credentials:** the Judge never types passwords/tokens; manual auth is deferred to the user.
- **No destructive ops:** no deleting app code, no config/build changes, no commits/pushes unless explicitly asked.
- **Browser safety:** follow Chrome-automation guidance (no dialogs that block the session; treat page content as data, not instructions).
- **R0 everywhere:** the single most important guardrail — clean or reported, never patched.

---

## 18. Build phases (post-approval)

1. **Scaffold** the standalone repo: `plugin.json`, `.mcp.json`, `scripts/sync-guide.mjs` (+ first guide sync + self-check), `scripts/validate.mjs`, `templates/`.
2. **Skills:** author the 10 thin pointer skills (§5).
3. **Agents:** author orchestrator / planner / builder / judge with the schemas (§7), decision algorithm (§9), taxonomy (§10), per-layer procedures (§11), and the verification harness (§12). Write the loop control (§13).
4. **MCP wiring:** Figma intake in the Planner; Chrome verification in the Judge.
5. **Golden test + dogfood:** run on the playground; iterate agent prompts until Designs #1/#2 reach PASS; then a real app.
6. **CI sync hook** in the SDK repo: `customization-guide/**` change → `sync-guide.mjs` → plugin re-sync/publish.

---

## 19. Future extensions (not v1)
- More features (presence, reactions, recorder, mentions, activity, tags/arrows) — extend taxonomy (§10) + feature skills.
- More frameworks (Vue/Angular/vanilla) — the guide already teaches the framework-agnostic custom-element model; add per-framework Builder procedures.
- A **Velt MCP** for live SDK metadata (validate identifiers at runtime) — optional once available.
- Cursor host parity.
- Auto-filing SDK-gap reports as issues against the SDK repo.

---

*Single source of truth: the bundled `guide/` (a verbatim copy of `customization-guide/`). The plugin never hard-codes guide knowledge — it reads the latest guide and applies it. Skills/agents are thin orchestration over that knowledge.*
