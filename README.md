# velt-customize — Figma → Velt UI customization (Claude Code plugin)

Turns a **Figma design** into **clean, rule-compliant Velt UI customization** (comments + notifications) on a client's existing React app, via a **Planner → Builder → Judge** loop that verifies each surface against the design in a real browser, or honestly reports an **SDK gap**. It always reads the latest **customization guide** (`guide/`) and never hacks (R0).

## Quick setup (plain language)

What you need before starting: **your React app with Velt already working** (comments show up when you run it), **a Figma design** of how you want Velt to look, and **Chrome**.

**1. Install the plugin** — inside Claude Code, run:
```
/plugin marketplace add velt-js/velt-figma-plugin-claude
/plugin install velt-customize@velt-customize
```
Then restart Claude Code. *(Developing the plugin itself? Skip the install and launch with `claude --plugin-dir /path/to/velt-figma-plugin-claude` instead — it reads your working copy live.)*

**2. Give it your Figma token** — the plugin reads your design straight from Figma's API, so it needs a personal access token. Create one at figma.com → Settings → Security → Personal access tokens, then store it once (you'll paste it when prompted; it goes in your OS keychain, never in a file):
```bash
node "$CLAUDE_PLUGIN_ROOT/scripts/figma-extract.mjs" token set
```

**3. Connect Chrome** — make sure the `claude-in-chrome` extension/MCP is connected. The plugin uses Chrome to look at your running app and check the result against the design.

**4. Start a run** — open your app's folder in a terminal, start Claude Code, make sure your dev server can run, then:
```
/velt-customize:run <figma-loop-node-url> --mode "wireframes + primitives" --budget balanced
```
- The URL must point at one **Loop** node in your Figma file (right-click the Loop → Copy link), not the whole file. Keep a Loop to 8 frames or fewer — bigger designs are split into several Loops, run one at a time.
- `--mode` is how it's allowed to build: `strictly wireframe`, `strictly primitives`, `wireframes + primitives`, or `freeform`. Leave it out and the plugin will ask you, with a recommendation.
- `--budget` controls how long it may spend per block: `strict`, `balanced`, or `thorough`.

**5. Watch it work** — in a second terminal:
```bash
node "$CLAUDE_PLUGIN_ROOT/scripts/progress.mjs" --watch
```
New lines appearing = it's working. First it checks everything is ready (and tells you exactly what to fix if not), shows you the list of design frames it found, plans, then builds and verifies one frame at a time. At the end you get a handoff report: what matched, what got stuck, and anything the Velt SDK genuinely can't do yet.

**6. Finish or fix** — happy? Say **"phase N complete"** (it saves what it learned for the next Loop). See a mismatch? Run `/velt-customize:fix "<describe what's wrong>"`. Start over? `/velt-customize:clear`.

---

## Install (reference)

```
/plugin marketplace add velt-js/velt-figma-plugin-claude
/plugin install velt-customize@velt-customize
```
Then restart Claude Code (or `/reload-plugins`). Run a customization with `/velt-customize:run <figma-loop-node-url> [--mode <approach>] [--budget strict|balanced|thorough] [--cloud]` — it runs **in the current project** (cwd).

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
