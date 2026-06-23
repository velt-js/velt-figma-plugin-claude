# Context Handoff — Velt Figma Plugin

> Paste/read this FIRST in any new chat that continues this work. It carries the decisions, the **verified-in-browser facts**, the **correct syntax**, the **real identifiers**, and **hard anti-hallucination rules** so a fresh session builds the plugin without inventing APIs.

---

## 0. What this project is

Build a **Claude Code plugin** that turns a **Figma design** into **clean, rule-compliant Velt UI customization** (comments + notifications) on a client's **existing React app**, using a **Planner → Builder → Judge** loop that iterates until each component visually matches the design or is reported as an SDK gap. It must always read the **latest** customization guide and **never hack** (R0).

Two artifacts already exist and are the foundation:
- **The customization guide** — a verified, self-sufficient knowledge base for customizing Velt's UI (37 files).
- **AI_PLUGIN_PLAN.md** — the detailed, execution-ready plan (19 sections). **Read it in full before building.**

---

## 1. File locations (current, after the move)

```
/Users/mayankpagar/Documents/Velt/
├── velt-figma-plugin/                 ← THIS plugin project (new)
│   ├── customization-guide/           ← the guide (37 files; the knowledge base to bundle)
│   ├── AI_PLUGIN_PLAN.md              ← the detailed plan (build from this)
│   └── context-handoff.md            ← this file
├── sdk/                               ← the Velt SDK (Angular → web components). Source of truth for identifiers.
│   ├── src/playground.html           ← the test harness / golden fixtures (Designs #1 & #2)
│   └── src/app/utils/components-map.ts ← registry of 770 wireframe slot elements (verify slot names here)
└── sdk-react/                         ← the React SDK (@veltdev/react). Source for component props/interfaces.
```

- The **guide is self-sufficient** (zero SDK/external paths) so it bundles cleanly into the plugin.
- **Project memory** (persists context across sessions) lives at:
  `/Users/mayankpagar/.claude/projects/-Users-mayankpagar-Documents-Velt-sdk/memory/` (see `MEMORY.md`).

---

## 2. Locked decisions (do not re-litigate)

- **Standalone plugin repo** (its own `.claude-plugin/plugin.json` + `.mcp.json` + `skills/` + `agents/` + bundled `guide/`).
- **Thin pointer skills + bundled live guide** — skills don't embed guide content; they say "read `guide/<file>`, apply it." Always-latest by re-syncing the guide verbatim (zero transformation = zero drift).
- **Planner / Builder / Judge subagents + shared JSON context + bounded retry** — mirrors this repo's `.claude/agents/migration-orchestrator.md` (sequential, shared context, stop/branch).
- **Judge runs the client app** (Chrome MCP) + **Figma↔Chrome qualitative match**; our **playground + Designs #1/#2 = the golden regression test**.
- **Scope v1:** features = **comments + notifications**; framework = **React**; host = **Claude Code only** (no Cursor). Customization only — target project already has Velt installed/authed/running.
- **Strict R0** everywhere; anything unsupported → **SDK-gap report** (don't fake it).

---

## 3. The guide — structure & entry points

Reading order: `README.md` → `02-decision-tree.md` (THE spine, pick the layer) → `03-getting-started.md` → `approaches/<layer>.md` → `features/<feature>.md` → `reference/*` (look up exact identifiers).

- **approaches/**: `css.md`, `wireframes.md` (deepest), `primitives.md`, `headless.md`, `combining-approaches.md`.
- **reference/** (exhaustive, source-derived — the identifier source of truth): `css-variables.md`, `css-classes.md`, `wireframe-components.md` (82 React wireframe components + **770 slot elements** + slot trees), `wireframe-variables.md`, `wireframe-tokens.md`, `primitives.md` (421), `props.md` (ALL props: VeltComments 129 + 38 other components, Part 1/Part 2 in one file), `component-config.md`, `feature-flags.md`, `hooks.md`, `apis.md` (all `getXElement()` methods), `events.md` (all `.on('…')` events), `component-catalog.md`.
- **features/**: `notifications.md`, `comment-surfaces.md` (+ others not in v1 scope).
- **rules.md** (R0–R16), `debugging.md`, `edge-cases-and-limitations.md`, `context.md`, `patterns-and-tips.md`, `cross-cutting.md`.

**Counts (for sanity):** 170 modern `--velt-*` + 83 legacy CSS vars (~253) · 357 stateful classes · 82 wireframe components / 770 slot elements · 421 primitives · 129 VeltComments props (+38 other components) · default statuses `OPEN`/`IN_PROGRESS`/`RESOLVED`.

---

## 4. ✅ VERIFIED-IN-BROWSER FACTS (the anti-hallucination core)

These were proven live in the playground (not guessed). Trust them; they're already baked into the guide. **Do NOT contradict these.**

1. **CSS variable theming pierces shadow DOM.** `:root { --velt-… }` / `--legacy-velt-…` overrides resolve **inside** Velt's shadow root (verified: font changed to serif via `--velt-default-font-family`). 344 `--velt`/`--legacy-velt` vars live inside the shadow root. **Only class/selector CSS needs `shadowDom={false}`** (or `injectCustomCss`) — variables don't. Real var names include `--legacy-velt-primary-color`, `--legacy-velt-bg-color`, `--velt-default-font-family`.

2. **Wireframe HTML requires ONE `<velt-wireframe>` registry root.** Without it, your slot markup **renders inline on the page** and the live component **falls back to defaults** (verified). In React the root is `<VeltWireframe>`.

3. **Container/root wireframe slots: undeclared children VANISH.** Declaring a container (e.g. `velt-comments-sidebar-v2-wireframe`) with only some children **drops the rest** (search/filter/list disappeared — verified). You must declare the **full structural tree** you want. *Leaf* slots fall back to default; **containers do not.**

4. **Comment dialog: `ThreadCard` MUST be nested inside `Body → Threads`** or it renders an **empty card** (header shows, body blank — verified). HTML nesting:
   `velt-comment-dialog-body-wireframe > velt-comment-dialog-threads-wireframe > velt-comment-dialog-thread-card-wireframe`.

5. **Shadow-DOM root-vs-nested rule:** registering a **ROOT** wireframe (e.g. `velt-comment-dialog-wireframe`) **auto-removes that component's own shadow DOM** → it renders in **light DOM** → class CSS reaches it (no `shadowDom={false}` needed). Registering only a **nested/leaf** wireframe does **not** remove shadow → set `shadowDom={false}` for class CSS. **Inline `style=""` always works.** Caveat: a root-wireframed component rendered *inside another* shadow component (e.g. the sidebar with shadow on) still sits in that outer shadow.

6. **Comment pin index/number:** the pin root `velt-comment-pin-wireframe` **exists** (registered via the React component, **NOT** in `components-map.ts` — that file only holds nested slots; don't use it to check for ROOT wireframe tags). The `…-index`/`…-number` slot elements are **empty containers** — they do **NOT** auto-print the number (verified across 3 configs). Fill them with `<velt-data field="annotation.annotationIndex">` (placement order) or `annotation.annotationNumber`. **Page-mode comments have NO index/number; normal comments do.** The `commentIndex` prop renders Velt's **separate** default `#N` badge (independent of the slots).

7. **Multi-branch `velt-if` works:** `velt-if condition="{annotation.status.id} === 'OPEN'"` (and `'IN_PROGRESS'`, `'RESOLVED'`). Status IDs are `OPEN` / `IN_PROGRESS` / `RESOLVED`.

8. **`VeltCommentThread` is DEPRECATED → use `VeltCommentDialog`** (same `annotationId` API) as the per-thread primitive.

9. **`defaultCondition` (primitives only):** `defaultCondition={false}` skips a primitive's internal show/hide gate so YOU control visibility (essential in fetch→loop→render). **Wireframes have NO equivalent** — they always depend on Velt's internal condition.

10. **Sidebar custom rows/groups (real elements):** `velt-comments-sidebar-list-item-v2-wireframe`, `velt-comments-sidebar-list-v2-wireframe`, `velt-comments-sidebar-list-group-header-v2-{label,count,chevron,separator}-wireframe`. Filter panel tree: `velt-comments-sidebar-filter-container-v2-section-*` / `…-option-*`.

11. **Normal flow confirmed working** in the playground: create comment → pin → dialog → sidebar sync → status change (pin recolors) → filter panel (Pages/Involved/Author/Assigned/Tagged/Comment Type/Group by + Apply/Reset).

---

## 5. Correct syntax cheat-sheet

**Wireframe — plain HTML (custom elements):**
```html
<velt-wireframe>                                   <!-- ONE per app -->
  <velt-comment-dialog-wireframe>                  <!-- ROOT → shadow auto-off -->
    <velt-comment-dialog-header-wireframe>
      <div style="…inline styles always work…">
        <velt-comment-dialog-status-wireframe></velt-comment-dialog-status-wireframe>
      </div>
    </velt-comment-dialog-header-wireframe>
    <velt-comment-dialog-body-wireframe>           <!-- ThreadCard MUST nest here -->
      <velt-comment-dialog-threads-wireframe>
        <velt-comment-dialog-thread-card-wireframe>
          <velt-comment-dialog-thread-card-avatar-wireframe></…>
          <velt-comment-dialog-thread-card-name-wireframe></…>
          <velt-comment-dialog-thread-card-message-wireframe></…>
        </velt-comment-dialog-thread-card-wireframe>
      </velt-comment-dialog-threads-wireframe>
    </velt-comment-dialog-body-wireframe>
    <velt-comment-dialog-composer-wireframe>
      <velt-comment-dialog-composer-input-wireframe></…>
      <velt-comment-dialog-composer-action-button-wireframe type="submit"></…>
    </velt-comment-dialog-composer-wireframe>
  </velt-comment-dialog-wireframe>
</velt-wireframe>
```
Tokens inside wireframes: `<velt-if condition="{annotation.status.id} === 'RESOLVED'">…</velt-if>` · `<velt-data field="annotation.annotationIndex"></velt-data>` · `velt-class="'is-done': {annotation.status.id} === 'RESOLVED'"`.

**Wireframe — React:** `<VeltWireframe>` root; dotted slots `VeltCommentDialogWireframe.Body`, `.Threads`, `.ThreadCard.Avatar`, `.Composer.ActionButton type="submit"`; `<VeltIf condition="{…}">`, `<VeltData field="…">`. Per-context look: `variant="dialog"|"sidebar"`.

**Primitive — fetch→loop→render (React):**
```tsx
import { VeltCommentDialog, useCommentAnnotations } from '@veltdev/react';
const annotations = useCommentAnnotations() ?? [];
annotations.map(a => (
  <VeltCommentDialog key={a.annotationId} annotationId={a.annotationId} fullExpanded defaultCondition={false} />
));
```

**CSS:** `:root { --velt-… }` for theming (crosses shadow). For class overrides set `shadowDom={false}` (or `client.injectCustomCss({type:'styles', value})`) + `!important`. Dark: `:root[data-velt-theme="dark"] { --velt-dark-… }`.

---

## 6. Real APIs / engines (always re-verify in `reference/` before use)

- **Element accessors:** `client.getCommentElement()`, `getNotificationElement()`, etc. (`Velt`/`Snippyly` global). Full method list → `reference/apis.md`.
- **Events:** `commentElement.on('<eventName>').subscribe(cb)`; React `useCommentEventCallback('<eventName>')`. Full list → `reference/events.md`. Key: `addCommentAnnotation`, `updateStatus`, `commentSidebarDataInit`, `commentSidebarDataUpdate`.
- **Sidebar custom grouping / swimlanes:** subscribe `commentSidebarDataInit`/`commentSidebarDataUpdate` → `commentElement.setCommentSidebarData([{groupId,groupName,isExpanded,annotations}], {grouping:true})`.
- **Sidebar filters:** `filters`/`miniFilters`/`minimalFilters` config (`{field,label?,valuePath?}`, `valuePath` can target `context.*`).
- **Custom data props:** `customStatus` / `customPriority` / `customCategory` / `customReactions` (shapes in `reference/component-config.md`).
- **Hooks:** `useCommentAnnotations()`, `useNotificationsData()`, `useNotificationUtils()`, `selectCommentByAnnotationId`, `updateContactList`, etc. → `reference/hooks.md`.
- **Notifications props:** `tabConfig` (`forYou`/`documents`/`all`/`people`), `panelOpenMode` (`popover`/`sidebar`), `settings`, `settingsLayout`.

---

## 7. The playground (test harness + golden fixtures)

- **Location:** `/Users/mayankpagar/Documents/Velt/sdk/src/playground.html` (in the SDK repo — it needs `ng serve` to run; cannot move).
- **Run it:** in `sdk/`, `npx ng serve --port 4200` → http://localhost:4200. (Modeled on `src/sidebar-v2.html`.)
- **Bootstrap:** `<velt-root>` fires a `getSnippyly` event → `Snippyly.initConfig(API_KEY)` → `setDocumentId('playground-doc-2026-06-21')`. Login uses a **token auth provider** via the CF `https://generateveltauthtoken-4mfhcuyw2q-uc.a.run.app`.
- **Test credentials (test-only, already in the repo's sidebar-v2.html):** `API_KEY = yj72PvMewZzL1tJLxZcv`, `CONSOLE_AUTH_TOKEN = e2e4c113814458a9d6c93750a2d7f71d`. Users: Vivek `1.1`, Rakesh `2.2`, Solene `3`, Mayank `5` (org `org1`).
- **Verified designs (the golden test):**
  - **Design #1 — review-card comment dialog:** indigo "REVIEW" header + status pill; thread card with indigo left-accent, avatar/name/time/message/reactions; composer. Renders in BOTH the floating dialog and sidebar rows. Built with the dialog root wireframe + inline styles.
  - **Design #2 — map-marker numbered pins:** rounded-square badges colored by status via multi-branch `velt-if` on `{annotation.status.id}`; number via `<velt-data field="annotation.annotationIndex">`.
- **⚠️ Caveat:** `sdk/angular.json` `index` is currently pointed at `src/playground.html` (was `src/index.html`). **Restore it to `src/index.html` before any production SDK build.** It's left as-is so the playground keeps serving for plugin golden-test work.

---

## 8. Plugin conventions & available tooling

- **Skills:** `skills/<name>/SKILL.md` with YAML frontmatter (`name`, `description`, `metadata`). Invoked by name.
- **Agents:** `agents/<name>.md` with frontmatter `name` / `description` / `model` (haiku|sonnet|opus) / `color`. Orchestrator chains them sequentially with a **shared JSON context** + stop/branch (see `.claude/agents/migration-orchestrator.md` for the proven pattern; `.claude/AGENT_SYSTEM_SUMMARY.md` describes the 18-agent chain).
- **Manifest:** `.claude-plugin/plugin.json` + `.mcp.json` (pattern from `github.com/velt-js/velt-plugin-claude` — that repo is **install**-focused, useful only for packaging conventions, NOT customization).
- **MCPs available now:** `figma-desktop` (`get_design_context` = code+screenshot+metadata, `get_screenshot`, `get_variable_defs`, `get_metadata`) and `claude-in-chrome` (full browser automation: navigate, screenshot, DOM inspect, console). **No Velt MCP** is connected — not needed v1 (the guide is the knowledge base).

---

## 9. Strict rules (rules.md) — must enforce in Builder + Judge

R0 no hacks (prime directive) · R1 one `<VeltWireframe>` · R2 mount the live feature component · R4 no interactive React inside wireframe markup (cloned → dead; use Velt slot components or `VeltButtonWireframe`+`useVeltEventCallback('veltButtonClick')`) · R5 wrap UI-library components AROUND primitives, not inside wireframes · R6 selector CSS needs `shadowDom={false}` or `injectCustomCss` · R7 never `display:none` to remove features (use props) · R8 one stylesheet · R9/R9b dark-mode cascade + `!important` · R10 never invent identifiers (verify against `reference/`) · R11 customization under `components/velt/ui-customization/` · R16 **one component at a time** (build → verify → next). Full text: `customization-guide/rules.md`.

---

## 10. 🚫 ANTI-HALLUCINATION DIRECTIVES (hard rules for the new chat)

1. **Never invent** a slot name, prop, CSS variable, class, hook, event, or API method. If you can't find it in `customization-guide/reference/*`, it does not exist — say so and treat it as an SDK gap (R0/R10).
2. **Verify ROOT wireframe tags via the React SDK** (`sdk-react/src/components/<Name>Wireframe/`), NOT `components-map.ts` (which only lists nested slots). Verify nested slot elements + the 770 list via `components-map.ts` / `reference/wireframe-components.md`.
3. **Use `VeltCommentDialog`, never `VeltCommentThread`** (deprecated).
4. **Respect the verified facts in §4** — especially: one `<velt-wireframe>` root; container slots need full child trees; ThreadCard nests in Body→Threads; root-wireframe auto-removes shadow (nested-only needs `shadowDom={false}`); pin index/number slots are empty containers filled with `velt-data`; variables cross shadow but class CSS doesn't.
5. **Page-mode vs normal:** page-mode comments have no index/number/pin location; don't assume they do.
6. **The guide is the single source of truth.** When unsure, read the guide file, then verify the identifier in source (`sdk-react/` for props/components, `sdk/src/app/utils/components-map.ts` for slots, `sdk/src/app/utils/enums.ts` for events). Don't guess from training data.
7. **R0 is absolute:** if a design need has no clean supported path, write an SDK-gap entry + a code comment — never a timing/DOM/internal hack.

---

## 11. Open loose ends / next steps

- **Start building from `AI_PLUGIN_PLAN.md` §18** (build phases): scaffold the standalone repo (`plugin.json`, `.mcp.json`, `scripts/sync-guide.mjs` → bundle `customization-guide/` verbatim into `guide/` + stamp `guide.version`, `scripts/validate.mjs`), then skills (§5), then agents (§6), then MCP wiring, then the golden test.
- **`guide/` bundling:** the plan assumes a `guide/` copy inside the plugin. The guide currently sits at `velt-figma-plugin/customization-guide/`. Decide: keep it as `customization-guide/` and point skills there, or have `sync-guide.mjs` copy it to `guide/`. (Either works; keep ONE canonical copy + a sync step for "always latest.")
- **angular.json caveat** (see §7) — restore before a real SDK build.
- **Guide source-of-truth question:** the guide was moved OUT of the `sdk` repo into `velt-figma-plugin/`. If the SDK repo's CI or other tooling expected it under `sdk/customization-guide/`, reconcile (the sdk repo will now show those files as deleted). The plan's "always-latest via sync" still holds — just point the sync at the new canonical location.

---

*Provenance: built and verified over a long session — guide authored from SDK source + ~27 demos + storybook, then dogfooded live in the playground (Chrome MCP) where the §4 facts were proven. Memory index: `/Users/mayankpagar/.claude/projects/-Users-mayankpagar-Documents-Velt-sdk/memory/MEMORY.md`.*
