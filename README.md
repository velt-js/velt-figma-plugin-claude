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

## Running headless / in claude.ai/code cloud (the recipe a live run spent ~2h rediscovering)

Plugin commands **don't register in an already-running session** — a CLI `plugin install` mid-conversation is always "too late" (the process's command table is fixed at its own boot). In a cloud container, install the plugin from a local directory marketplace, then launch the run as a **fresh headless process**:

```bash
claude plugin marketplace add /path/to/velt-figma-plugin-claude
claude plugin install velt-customize@velt-customize --scope user

CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 IS_SANDBOX=1 \
claude -p --permission-mode bypassPermissions \
  --add-dir /path/to/velt-figma-plugin-claude \
  <<'EOF'
/velt-customize:run <figma-loop-node-url> --mode "strictly wireframe" --auto --budget balanced
EOF
```

Every piece is load-bearing (each one cost a live run real time when missing):
- **Prompt via stdin (heredoc), never as a CLI argument** — a resumed orchestrator once saw its own `/velt-customize:run` string in `ps` output and stood down as a "duplicate". stdin keeps the string out of every process listing (the run lock in `resume-check.mjs` is the real duplicate guard).
- **`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`** — `-p` mode otherwise kills the process at its 600s background-wait ceiling while the orchestrator waits on a subagent.
- **`--permission-mode bypassPermissions` + `IS_SANDBOX=1`** — headless has nobody to click Allow; `IS_SANDBOX=1` is required when the container runs as root. Only for isolated, ephemeral containers.
- **`--add-dir <plugin repo>`** — the nested process can otherwise touch only the app repo, not the plugin's scripts. Flag order matters: the prompt/stdin follows `-p`; flags after.
- **On any interruption** (container restart, silent death): relaunch the same command. `resume-check.mjs` reads the phase artifacts and resumes mechanically — do not hand-write resume instructions.

## Sandboxes with no browser egress (`VELT_EGRESS_RELAY`)

Some sandboxes (claude.ai/code web sessions, hardened CI runners) send all egress through a
MITM proxy **and** give the browser no way to trust that proxy's CA — no `certutil`, no NSS db.
There, `curl https://cdn.velt.dev` succeeds while the identical fetch from Chromium dies with
`ERR_CONNECTION_RESET`. The visible symptom is `verify-app.mjs` reporting
`veltPresent:true, veltBooted:false` — React rendered the `<velt-*>` tags, the SDK bundle never
loaded, so nothing was ever `customElements.define`d.

Fix: `export VELT_EGRESS_RELAY=1`. Every browser-driving script then routes the page's
cross-origin requests through Node's `fetch` (which does reach the sanctioned proxy) and fulfills
the page with the response — the network I/O moves from the blocked client to an allowed one.
No TLS verification is disabled: Node still validates the chain and the proxy still enforces
egress policy. The flag is **off by default**, so ordinary machines keep the browser's own
(faster) networking. Implementation + caveats: `scripts/_egress-relay.mjs`, `guide/debugging.md`.

Full sandbox preamble:

```bash
export VELT_EGRESS_RELAY=1
export PLAYWRIGHT_CORE=/path/to/playwright-core/index.js   # only if it is not resolvable
export FIGMA_TOKEN=figd_...
# a real browser for --connect/--require-connect measurement:
chromium --headless --remote-debugging-port=9222 &
export VELT_CDP_WS=$(node scripts/browser-endpoint.mjs --quiet | tail -1)
```

Two known residues, neither of which blocks measurement:
- Firestore's `Listen/channel` is a long-lived stream and `route.fulfill()` cannot stream, so it
  is capped and re-polled.
- WebSockets bypass request interception entirely, so `firebaseio.com` presence/realtime stays
  down and logs connection errors.

A note on load time, since an earlier version of this section got it wrong: the relay itself does
NOT make the sidebar slow. The ~35-40s waits measured on the Harvey demo were a symptom of pointing
that app at the wrong SDK environment, where the realtime transport never connected. With the app
on the SDK it is actually configured for, the sidebar renders **immediately** once a user is
identified — the gate is AUTH, not time. If a surface is 0x0, check that a user is signed in before
reaching for a longer timeout.

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

## Observability — replay any run like a session recording

Every run records itself automatically (no agent compliance needed — the pipeline **scripts** emit the events): one structured event per stage / measurement / fix-loop iteration in `<phaseDir>/obs/events.jsonl`, and a **snapshot of each iteration's screenshot + judge artifacts** in `obs/snapshots/<blockId>/<seq>-iterN/` — preserved *before* the next measurement overwrites `results/<blockId>/shot.png`, so the history survives.

```bash
node scripts/obs.mjs build <phaseDir>    # generate obs/player.html (self-contained; also auto-built at handoff)
node scripts/obs.mjs serve <runsRoot>    # ONE server, ALL runs — toggle between them in the header dropdown (http://127.0.0.1:4173/)
node scripts/obs.mjs serve <phaseDir>    # …or a single run: http://127.0.0.1:4173/obs/player.html
node scripts/obs.mjs status <phaseDir>   # event/snapshot counts
```

Or just `/velt-customize:replay` in the target project. The player is a session-replay UI over the run: a timeline scrubber with stage bands + color-coded event ticks (red = failure, amber = plateau/timeout/pause), per-loop lanes with diff-count sparklines, Live / Figma-reference / Diff / **Compare** (split-slider) screenshot views, and the judge's structured output (delta diffs, contract violations, stability) per event — so "which stage of which iteration did it break in?" is one scrub, not an afternoon of folder spelunking. It auto-opens on the first failing event. `VELT_OBS=0` disables recording; recording is fail-safe (it can never break or slow a run).

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
