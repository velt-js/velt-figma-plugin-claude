# Velt customization — phase handoff (PREFLIGHT HALT)

> ⚠ **NOT VERIFIED — no build was attempted.** This run HALTED in **preflight**, before design intake,
> before any planner/builder/judge stage. `scripts/write-handoff.mjs` could not generate its
> machine-authored section: it requires `<phaseDir>/blocks.json`, which only exists after
> `enumerate-blocks.mjs`, which is itself blocked (see B1). No block was measured, so no block has a
> disposition, and **the fidelity gate never ran**. Nothing here may be read as matched / correct / done.

**Phase:** `WYAWuEm8DrIk-351-15578` (Loop `351:15578`, file `WYAWuEm8DrIkAyx03e8fG9` — "Figma Plugin Playground")
**Approach:** `strictly wireframe` (normalized, canonical) · **Budget:** `balanced` · **Flags:** `--auto` (unattended, fail-fast)
**Stop reason:** `HALTED — 2 hard preflight failures` · **Gate exit:** `N/A (never reached)`
**Plugin:** `velt-figma-plugin-claude` @ `7046d13` (`Merge pull request #2 from velt-js/mayank/styler` — includes Judge-2: `agents/velt-judge-2.md`, `scripts/judge2-chromatic.mjs`)
**Project (cwd):** `/workspace` — **this is the plugin repo, not a target app** (see B2)
**appUrl:** never pinned (no app to verify) · **browserWs:** never pinned
**Intended documentId:** `velt-run-20260728-open-envoy-351` (unused)

## Preflight results (verbatim, reproducible)

| # | Item | Verdict | Evidence |
|---|---|---|---|
| B1 | `FIGMA_TOKEN` | ✗ **HARD FAIL** | `node scripts/figma-extract.mjs token status` → `✗ no token — REST extraction (the only design-intake path) is unavailable.` `$FIGMA_TOKEN` is unset in the run env. |
| B2 | Target app in cwd | ✗ **HARD FAIL** | `/workspace` has no `package.json` and no `components/`; it is the plugin repo (`origin` = `velt-js/velt-figma-plugin-claude`). No harvey / `velt-customization-cloud-demo` checkout exists anywhere on the box. |
| — | Figma API egress | ✓ reachable | `curl api.figma.com/v1/files/WYAWuEm8DrIkAyx03e8fG9/nodes?ids=351-15578` → **HTTP 403** unauthenticated. 403 (not a timeout/DNS failure) proves egress is open and **only the credential is missing**. |
| — | Machine hygiene | ✓ clean | `node scripts/preflight-env.mjs` → exit 0; `/etc/hosts` has no `velt.dev` pin; clock is UTC. |
| — | Dev server | ✗ none | No listener in 3000–9999 (only `5901 Xtigervnc`). Nothing to start: no app repo. |
| — | Browser CDP endpoint | ✗ not pinned | `node scripts/browser-endpoint.mjs` → exit 3. Solvable on its own (Chrome is installed and `--auto` launches its own server browser), but moot with no app to measure. |

## Why this is a HALT and not a workaround

Both failures are on the **critical path**, and the plugin is designed to fail loud rather than fake a pass:

- **B1 kills design intake outright.** REST is the *only* intake path — there is no Figma MCP fallback
  (`commands/run.md`: *"Design intake is REST … In `--auto` the token comes from `FIGMA_TOKEN` in the env
  (no keychain); … No token ⇒ fail-fast."*). Without it there is no `designSpec`, so
  `enumerate-blocks.mjs` cannot produce `blocks.json` — and `blocks.json` is the completeness oracle the
  whole loop and the terminator (`verdict-gate-blocks.mjs`) are defined over. `figma-extract.mjs`'s
  secure-store fallback is also unavailable here: on Linux it shells out to `secret-tool`, which is not
  installed on this VM (`which secret-tool` → not found), so `resolveToken()` has no source at all.
  - The repo-root `designSpec.json` is **not** a usable substitute: it is the same file
    (`WYAWuEm8DrIkAyx03e8fG9`) but a **different node** (`369:29362`, not `351:15578`).
- **B2 leaves nothing to customize or measure.** The flow customizes **cwd**; there is no target-repo
  argument. With no Velt-hosting React app there is no `components/velt/ui-customization/` to write, no
  page for `verify-app.mjs` to verify, and no surface for Judge-2's chromatic/chrome probes.

Fabricating either input would violate R0 (never hack) and R10 (never invent identifiers) — and measuring
a surface that does not exist is precisely the false-pass that `--require-connect` and the artifact audit
exist to prevent.

## What changed

Nothing. `git diff --stat components/velt/ui-customization/` is empty — the directory does not exist,
because no target app is present. The only files this run produced are its own phase artifacts
(`progress.log`, `obs/`, this handoff).

## Per-block dispositions

None. Enumeration never ran (B1), so no block was ever defined, let alone measured or judged.

## Blockers list

| Blocker | Kind | Why it could not be fixed in-run | Fix (human, one-time) |
|---|---|---|---|
| B1 `FIGMA_TOKEN` missing | env / credential | A secret cannot be self-provisioned by the agent. | Add `FIGMA_TOKEN` (a `figd_…` PAT with read access to file `WYAWuEm8DrIkAyx03e8fG9`) in **Cursor Dashboard → Cloud Agents → Secrets**, scoped to this repo or the team. It is then injected into new Cloud Agent VMs. |
| B2 no target app | env / missing repo | The harvey demo is not in this run's repo set and is not resolvable — `velt-js` lists 52 repos and none match `velt-customization-cloud-demo` / `harvey` / `customization-cloud`; `gh repo view velt-js/velt-customization-cloud-demo` → `Could not resolve to a Repository`. Cloning blind would be inventing a source. | Give the agent the demo app: either add it as a second repo in the Cloud Agent **environment** (`environment.json` repos) so both trees are checked out, or supply its exact clone URL/owner. Its install + start command should be in the environment's start script so a dev server is already listening. |
| B3 environment not the expected one | env / provisioning | This run has **no saved environment** (`cursor-cloud environment-info` → `"environment": null`), so it booted just-in-time with only the plugin repo — not the "Customization Cloud" image the task assumed. | Launch the run from the saved Customization Cloud environment (or record one via `cursor.com/onboard`) so the demo app, its deps, the dev server, and `FIGMA_TOKEN` are all present at second zero. |

## Uncertain / could NOT verify

- **Could not verify anything about the design.** The Loop's frame count, its `Flows`/`State` split, whether
  it exceeds the ~8-block warn threshold (and would auto-split by family under `--auto`), and whether
  `strictly wireframe` is even expressible for it (any `mode_blocked` pieces) are all **unknown** — every
  one of those answers comes from extraction + enumeration, which never ran.
- **Could not verify the app side:** whether Velt renders on the intended page, and whether the harvey
  demo's surfaces correspond to the Open Envoy design at all.
- **Not a blocker, untested:** the design-vs-app mismatch (Open Envoy design on the harvey app) was
  explicitly accepted by the user, with isolation via a unique `documentId`. That decision stands and was
  never exercised.

## Required host changes (R18)

None determined — the run never reached the planner.

## Recommendation

**RECOMMEND: do not re-run until B1 and B2 are both resolved.** They are one-time environment fixes, not
code defects, and neither is agent-fixable. Once the demo app is checked out with a dev server listening
and `FIGMA_TOKEN` is in the env, this exact phase resumes cleanly and re-enters this same phase dir
(`phaseId` is derived deterministically from fileKey + nodeId):

```
cd <harvey-app-root>
node <plugin>/scripts/phase-init.mjs "https://www.figma.com/design/WYAWuEm8DrIkAyx03e8fG9/Figma-Plugin-Playground?node-id=351-15578"
# then, from the app cwd:
/velt-customize:run \
  "https://www.figma.com/design/WYAWuEm8DrIkAyx03e8fG9/Figma-Plugin-Playground?node-id=351-15578" \
  "http://localhost:3000/<velt-page>?documentId=velt-run-20260728-open-envoy-351" \
  --mode "strictly wireframe" --auto --budget balanced
```

Re-verify with `node <plugin>/scripts/figma-extract.mjs token status` (expect a masked token, not `✗ no token`)
and `node <plugin>/scripts/preflight-env.mjs` (expect the app's port in `listening dev ports`) **before**
dispatching, so a second run cannot burn time on the same two blockers.
