# velt-customize — Figma → Velt UI customization (Claude Code plugin)

Turns a **Figma design** into **clean, rule-compliant Velt UI customization** (comments + notifications) on a client's existing React app, via a **Planner → Builder → Judge** loop that verifies each surface against the design in a real browser, or honestly reports an **SDK gap**. It always reads the latest **customization guide** (`guide/`) and never hacks (R0).

## Install

```
/plugin marketplace add velt-js/velt-figma-plugin-claude
/plugin install velt-customize@velt-customize
```
Then restart Claude Code (or `/reload-plugins`). Run a customization with `/velt-customize:run <figma-node-url> [target repo path]`.

## Prerequisites (the run preflights all of these and HALTs with a fix if any is missing)

- **A Figma token** (`FIGMA_TOKEN` env var or the OS keychain) — design intake is **REST-only** (`api.figma.com`); there is no Figma desktop/MCP dependency. See the token section below.
- **Chrome** — the `claude-in-chrome` MCP drives the live app for verification.
- **A target React app** with `@veltdev/react` installed, authed, and rendering Velt's default UI.
- **Node** ≥ 18. The block scripts (`enumerate-blocks` / `visual-diff` / `verdict-gate-blocks`) are zero-dependency; the optional device-res capture (`capture-block.mjs`) needs **`playwright-core`** + a Chromium (`npm i -g playwright-core`).

## Figma token (REQUIRED — secure, keychain-based, never committed)

Design intake is **REST-only** (the **Figma REST API**), which needs a personal access token (`figd_…`, create at *figma.com → Settings → Security → Personal access tokens*). **A token is required — there is no Figma-desktop/MCP fallback; preflight HALTs without one.** The token is resolved in this order — **the repo `.env` is never read**:

1. the `FIGMA_TOKEN` environment variable, else
2. your **OS keychain** (macOS Keychain / Linux `secret-tool`), under service `velt-customize` / account `figma-token`.

Store it once in the keychain via the plugin's helper (it reads the token from **stdin**, never argv/history):

```bash
node "$CLAUDE_PLUGIN_ROOT/scripts/figma-extract.mjs" token set      # paste the token when prompted
node "$CLAUDE_PLUGIN_ROOT/scripts/figma-extract.mjs" token status   # verify (prints a masked value)
node "$CLAUDE_PLUGIN_ROOT/scripts/figma-extract.mjs" token remove    # delete it
```

If no token is configured, preflight HALTs with the fix — design intake cannot proceed without it (there is no MCP fallback). In `--cloud`/CI, provide the token via the `FIGMA_TOKEN` env var (the keychain isn't used headlessly).

## The flow

1. You provide: the **Figma file/node** + the **target repo** (Velt is assumed already installed/authed/rendering).
2. **Plan** (read-only, parallel): recognize which Velt component each design element is (`guide/reference/component-definitions.md`), pick the cheapest viable layer per surface (`guide/02-decision-tree.md`), synthesize goals.
3. **Coverage gate:** the plugin shows a **per-surface coverage matrix** (surface × approach, with a recommendation) and **waits for you to confirm or adjust** before building anything.
4. **Build → Judge loop** (sequential, one surface at a time — R16): the Builder implements one surface; an independent, fresh-context Judge verifies it against the design in Chrome (evidence required). Retry → escalate layer → SDK gap, with stuck-detection.
5. **Report:** coverage (estimated vs actual), the SDK-gap report, screenshots, and the code under `components/velt/ui-customization/`.

## Layout

```
.claude-plugin/plugin.json   manifest
.mcp.json                    claude-in-chrome (verification). Design intake is REST (Figma API) — no Figma MCP.
guide/                       the knowledge base — single source of truth (edit here; the plugin reads it directly)
skills/  agents/  commands/   thin orchestration over the guide (no embedded knowledge)
scripts/check-guide.mjs      guide integrity gate (required files, no external paths, links resolve)
scripts/validate.mjs         completeness + guide self-check gate
templates/                   VeltCustomization.tsx, styles.css, report templates
ARCHITECTURE.md              the full design / architecture (read this to understand how the plugin works)
```

## Scripts

```bash
node scripts/check-guide.mjs   # gate: guide integrity (required files, self-sufficiency, links)
node scripts/validate.mjs      # gate: manifest + .mcp.json + guide self-check
```

The guide is the single source of truth: skills/agents carry **zero** customization knowledge — they read `guide/` and apply it, so behavior changes when the guide changes, with no drift. There is no bundle and no sync step — `guide/` is edited and read directly.

## Note on MCP endpoints

`.mcp.json` registers only `claude-in-chrome` (verification). Design intake is the **Figma REST API** (no MCP). The exact transport/URL/command for `claude-in-chrome` is environment-specific — confirm it matches your setup before a run.

## Scope (v1)

Comments + notifications · React · Claude Code host. CSS / Wireframes / Primitives (+ mix); Headless flagged heavy. Out of scope: SDK install/auth, other features/frameworks, pixel-perfect matching, changing Velt's runtime behavior.
