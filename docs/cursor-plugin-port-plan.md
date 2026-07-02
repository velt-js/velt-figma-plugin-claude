# Plan — port `velt-customize` to a native Cursor plugin

**Goal:** run the exact same Figma → Velt UI customization flow **natively inside Cursor** (editor **and** Cursor Cloud / Background Agents), so `/velt-customize:run` is a real command with real subagents and the mechanical verdict gate — not a Cursor agent "improvising" off markdown.

**Why:** Cursor Cloud agents do **not** load Claude Code plugins (no slash commands, no plugin subagents, no plugin MCP). Today a Cloud run only reads our markdown as plain text and reproduces the flow loosely. A native Cursor plugin fixes that, and — the big win — **Cursor's built-in browser tool + Cloud computer-use replaces `claude-in-chrome`**, removing the headless-browser fragility that blocks verification in the cloud.

---

## 1. Guiding principles

- **Reuse the brain, re-skin the wrappers.** `guide/` (knowledge) and `scripts/*.mjs` (extraction, enumerate, visual-diff, verdict gate) are runtime-agnostic and transfer **verbatim**. Only the thin orchestration wrappers (commands / agents / operating brief) get Cursor-flavored rewrites. This matches the plugin's existing rule: skills/agents carry zero knowledge — they point at `guide/`.
- **One source of truth stays one.** Do not fork `guide/` or `scripts/`. Both plugin front-ends read the same files.
- **Design intake stays REST-only.** The recent Figma-MCP removal already made intake `figma-extract.mjs` / `enumerate-blocks.mjs` over `api.figma.com` — no change needed; it's already cloud-friendly.
- **Verification goes native.** Replace every `claude-in-chrome` reference in the verification path with **Cursor's native browser tool** (Cloud agents get a full desktop + computer-use + PR artifact screenshots).

---

## 2. Port map (Claude Code → native Cursor)

| Claude Code plugin | Native Cursor equivalent | Action |
|---|---|---|
| `.claude-plugin/plugin.json` | `.cursor-plugin/plugin.json` (+ optional `.plugin/plugin.json` for Open Plugins); **declare `skills`/`rules`/`agents`/`mcpServers` paths explicitly** (see §2b) | **add** |
| `commands/run.md`, `fix.md`, … (`/velt-customize:run`) | bundle `commands/*.md` (filename = command name) | **adapt** (no `$ARGUMENTS` templating) |
| `agents/velt-orchestrator|planner|builder|judge.md` | `agents/*.md` — `name`/`description`/`model`, fresh isolated context, Task-style dispatch | **adapt** (drop `effort`; add `readonly` to planner/judge) |
| `skills/*/SKILL.md` | identical `SKILL.md` standard | **reuse** (Cursor also reads `.claude/skills/`) |
| `.mcp.json` (`claude-in-chrome`) | native **browser tool** (no MCP needed) | **remove / replace** |
| `guide/**` | same files | **reuse verbatim** |
| `scripts/*.mjs` | same files (terminal tool runs Node) | **reuse verbatim** |
| always-on `CLAUDE.md`-style guidance | `.cursor/rules/*.mdc` (`alwaysApply: true`) or `AGENTS.md` | **add if needed** |

### Known gaps to design around
- **No `$ARGUMENTS` / `argument-hint`** in Cursor commands — the Figma URL + `--mode` arrive as trailing text the command body parses. Reword `run.md` to read "the text after the command."
- **No `effort` frontmatter** on subagents — encode reasoning depth in the prompt or the `model` choice.
- **Cloud MCP** (if any is ever added) is configured at `cursor.com/agents`, HTTP/stdio only (no SSE / `mcp-remote`). We aim for **zero MCP** by using the native browser.
- **Rules must be `.mdc`** (plain `.md` in `.cursor/rules/` is ignored); `AGENTS.md` is the simplest always-on home.

---

## 2b. Reference implementation — `velt-js/velt-plugin-cursor` (steal these patterns)

There is already a **native Cursor plugin from the same org**: [`velt-js/velt-plugin-cursor`](https://github.com/velt-js/velt-plugin-cursor). It's a **different product** — the Velt **SDK-install** plugin (comments/presence/CRDT scaffolding via an MCP-orchestrated flow, no verification loop) — so it is NOT a competing implementation of our Figma flow. But it is the canonical example of how Velt packages a Cursor plugin, and it surfaces gotchas we'd otherwise hit blind.

**Concrete patterns confirmed from its source:**

- **Manifest declares component paths explicitly** (don't rely on auto-discovery). Its `.cursor-plugin/plugin.json`:
  ```json
  {
    "name": "velt",
    "version": "1.0.0",
    "description": "…",
    "author": { "name": "Velt", "email": "support@velt.dev", "url": "https://velt.dev" },
    "homepage": "https://docs.velt.dev",
    "license": "MIT",
    "logo": "assets/velt.svg",
    "keywords": ["velt", "…"],
    "skills": "./skills/",
    "rules": "./rules/",
    "agents": "./agents/",
    "mcpServers": ".mcp.json"
  }
  ```
- **Multi-manifest from one repo:** ships BOTH `.cursor-plugin/plugin.json` (Cursor) and `.plugin/plugin.json` (Open Plugins), plus a root `.mcp.json` referenced by the manifest. Consider mirroring for marketplace + broad compatibility.
- **Build/deploy pipeline in `package.json`:** `sync → build → deploy → validate`, with `all` = all four.
- **⚠️ THE BIG GOTCHA — Cursor loads skills/rules from `~/.cursor/`, not the plugin dir.** Its `scripts/deploy-skills.mjs` exists solely to copy `skills/<name>/SKILL.md` → `~/.cursor/skills/<name>/SKILL.md` and `rules/*.mdc` → `~/.cursor/rules/`. Comment from the script: *"Cursor reads skills from `~/.cursor/skills/` and rules from `~/.cursor/rules/`, NOT from the plugin directory."* → **Our port MUST include a deploy step**; a symlink/local-install alone won't reliably load skills (updates Phase 0 below).
- **Single orchestrator, thin wrappers** (their issue #3): skills that tried to orchestrate *competed* with the MCP orchestrator; they collapsed skills into thin wrappers so exactly one thing orchestrates. We already do this (`velt-orchestrator` owns the loop) — keep it.
- **Reference SPECIFIC rule/guide file paths, never an index** (their issues #4/#5): pointing Cursor at an `AGENTS.md` index made it grab the *majority* pattern from the wrong sibling rules (cross-contamination). Our `guide/` already points at specific files — keep that discipline, and add explicit "do NOT read other X" directives where look-alikes exist.
- **npx caches MCP:** if we ever publish an MCP, document `rm -rf ~/.npm/_npx` after publish.

**What it does NOT help with:** it has **no browser/verification loop**, so it gives zero precedent for our Judge's live-app driving + screenshot diff (still risk **R1**).

---

## 3. Repository layout decision

**Recommended: same repo, dual front-end.** Add a Cursor bundle alongside the Claude plugin so both share `guide/` + `scripts/`.

```
velt-figma-plugin/
├── .claude-plugin/plugin.json      # existing Claude front-end
├── .cursor-plugin/plugin.json      # NEW Cursor front-end (manifest)
├── commands/                       # shared dir? or cursor-commands/ (see note)
├── agents/                         # Claude subagents (Cursor can also read these)
├── cursor/agents/                  # NEW Cursor-flavored subagents (browser-tool verification)
├── skills/                         # shared SKILL.md (both runtimes read these)
├── guide/                          # SHARED — single source of truth (unchanged)
├── scripts/                        # SHARED — unchanged
└── .mcp.json                       # Claude only (Cursor bundle omits claude-in-chrome)
```

- **Pro:** one `guide/`, one `scripts/`, no drift; parity is easy to keep.
- **Con:** two sets of thin wrappers to maintain (acceptable — they're small and point at `guide/`).
- **Alternative:** a separate `velt-customize-cursor` repo that git-submodules or copies `guide/`+`scripts/`. Cleaner separation, but reintroduces a sync step. **Not recommended** unless the two must ship independently.

> Open decision **D1**: same-repo dual front-end (recommended) vs separate repo.

---

## 4. The one substantive rewrite — verification via Cursor's browser tool

Everything else is re-skinning; this is the real engineering. In the Claude plugin the **Judge** and operating brief drive `claude-in-chrome` to seed/drive a state, then `capture-block.mjs` takes a device-res PNG for `visual-diff.mjs`.

For Cursor, rewrite the verification path to:
1. **Seed + drive** the block's live state using Cursor's **browser tool** (navigate to `localhost:3000`, pierce shadow DOM, type into the composer's `[contenteditable]`, click send, hover/open per state) — the same steps, different driver.
2. **Capture** the device-res screenshot via the browser tool (Cloud) or keep `capture-block.mjs` with a CDP `--connect` to the Cursor-driven Chromium (it already supports both). Prefer the native tool in Cloud.
3. **Diff + probes unchanged** — `visual-diff.mjs`, `delta-compare.mjs`, the LAYER/CONTRACT/STABILITY probes, and `verdict-gate-blocks.mjs` are pure Node and stay exactly as-is.

Net: the mechanical fidelity gate is untouched; only the "how we drive/screenshot the browser" layer changes.

> Open decision **D2**: confirm native browser tool is the verification driver (recommended), with `capture-block.mjs --connect` as the fallback capture path.

---

## 5. Phased task list

### Phase 0 — Scaffold (fast)
- [ ] Add `.cursor-plugin/plugin.json` with **explicit** `skills`/`rules`/`agents`/`mcpServers` paths (§2b shape), plus `name`/`description`/`version`/`author`/`homepage`/`license`/`logo`/`keywords`. Optionally add `.plugin/plugin.json` (Open Plugins).
- [ ] Decide command dir (D1) and add a Cursor `commands/velt-customize-run.md` (`/velt-customize-run`).
- [ ] Add a `package.json` with `sync`/`build`/`deploy`/`validate`/`all` scripts (mirror the sibling plugin).
- [ ] **Add `scripts/deploy-skills.mjs`** — copy `skills/<name>/SKILL.md` → `~/.cursor/skills/<name>/` and `rules/*.mdc` → `~/.cursor/rules/` (REQUIRED: Cursor loads from `~/.cursor/`, not the plugin dir — see §2b).
- [ ] Local install test: run `npm run deploy`, reload the Cursor window, confirm the command + skills + subagents appear.

### Phase 1 — Port the subagents
- [ ] Copy `agents/velt-orchestrator|planner|builder|judge.md` → Cursor `agents/`, converting frontmatter (`name`, `description`, `model`; drop `effort`; set `readonly: true` on planner + judge).
- [ ] Verify fresh-context dispatch works (orchestrator → planner/builder/judge as subagents) and one-level nesting is sufficient (Cursor limits nesting depth to 1).

### Phase 2 — Rewrite the verification path (the real work)
- [ ] Fork the operating brief + `velt-judge` verification steps to use the **native browser tool** instead of `claude-in-chrome`.
- [ ] Wire capture: native screenshot in Cloud, else `capture-block.mjs --connect`.
- [ ] Confirm `visual-diff` / `delta-compare` / probes / `verdict-gate-blocks` run unchanged over the produced artifacts.

### Phase 3 — Commands + always-on guidance
- [ ] Adapt `run.md` (and `fix.md`) to Cursor: parse the Figma URL + `--mode` from trailing text; keep the `--cloud` autonomy semantics (they still apply — no interactive approach gate when mode is supplied).
- [ ] Add `AGENTS.md` (or `.cursor/rules/*.mdc` with `alwaysApply: true`) for the always-on guardrails (R0 no-hack, R10 no-invented-identifiers, point at `guide/`).

### Phase 4 — Cloud enablement
- [ ] Author `.cursor/environment.json` for the demo app: `install` (frontend `npm install` + Python backend venv/pip) and `start`/`terminals` (boot backend :8000 + frontend :3000, wait for ready).
- [ ] Confirm secrets flow (already set at the environment level): REST `FIGMA_TOKEN`, Velt/Mongo/Django/AWS env for the app.
- [ ] Dry-run in Cursor Cloud on `velt-customization-cloud-demo`: does the native browser tool drive + screenshot the live app end-to-end?

### Phase 5 — Gates, parity, docs
- [ ] Re-run `check-guide.mjs` + `validate.mjs` (shared) and the golden offline checks — all must stay green.
- [ ] Parity check: run the same Figma Loop through both front-ends (Claude local + Cursor) and diff the produced `components/velt/ui-customization/`.
- [ ] Update `README.md` / `ARCHITECTURE.md` with the dual-runtime story; note that design intake is REST for both.
- [ ] (Optional) Submit to a team/enterprise Cursor marketplace for install-everywhere.

---

## 6. What is explicitly REUSED (no changes)
- `guide/**` — all knowledge, rules, reference, behaviors.
- `scripts/*.mjs` — `phase-init`, `enumerate-blocks`, `figma-extract`, `capture-block`, `visual-diff`, `delta-compare`, `verdict-gate-blocks`, `verdict-gate`, `memory`, `progress`, `check-guide`, `validate`.
- The `--cloud` autonomy semantics + REST-only intake (both added recently).

## 7. Risks / open questions
- **R1 — Browser-driving fidelity.** The Judge's per-iteration DOM probes (shadow-DOM piercing, computed-style reads) must run through Cursor's browser tool/computer-use. This is the main unknown; validate early in Phase 2/4. *Mitigation:* `capture-block.mjs --connect` fallback + keep probes as injected JS.
- **R2 — Subagent nesting depth.** Cursor allows only one level of subagent nesting. Our orchestrator → {planner, builder, judge} is one level → OK, but confirm no deeper nesting is assumed.
- **R3 — Command argument ergonomics.** No `$ARGUMENTS`; ensure the command reliably extracts the Figma URL + `--mode` from free text.
- **R4 — Maintenance drift.** Two thin wrappers; keep a parity checklist (Phase 5) so behavior stays identical.
- **R5 — Skills/rules load from `~/.cursor/`, not the plugin dir** (confirmed via the sibling plugin). *Mitigation:* the `deploy-skills.mjs` step (Phase 0) + document "restart/reload Cursor after deploy."
- **R6 — Index-driven cross-contamination.** Referencing a broad index (e.g. `AGENTS.md`) can make Cursor apply look-alike rules from the wrong sibling. *Mitigation:* reference specific `guide/` file paths + explicit "do NOT read other X" directives (already our style).
- **R7 — MCP npx caching.** If we ship an MCP, stale versions persist. *Mitigation:* `rm -rf ~/.npm/_npx` after publish.

## 8. Decisions needed before build
- **D1:** same-repo dual front-end (recommended) vs separate Cursor repo.
- **D2:** native browser tool as the verification driver (recommended) + `capture-block.mjs --connect` fallback.
- **D3:** command name — keep `/velt-customize:run` style (Cursor uses filename → `/velt-customize-run`) or a shorter `/velt-customize`.
- **D4:** ship target — local/team marketplace vs just committed `.cursor-plugin/` in the repo.

---

### One-line summary
Reuse `guide/` + `scripts/` verbatim, wrap them in a native `.cursor-plugin/` (commands + subagents + skills), and rewrite only the verification path to use Cursor's built-in browser tool — which makes the flow run genuinely, and autonomously, in Cursor Cloud.
