# velt-customize — developer notes

> This file is **developer documentation for the repo**. Claude Code does **not** auto-load a plugin's root `CLAUDE.md`, so the runtime operating brief is shipped as a **skill** instead: [`skills/velt-operating-brief/SKILL.md`](skills/velt-operating-brief/SKILL.md) (loaded by `/velt-customize` and the `velt-orchestrator` agent).

## What this is
A Claude Code plugin that turns a Figma design into clean Velt UI customization (comments + notifications, React) via a Planner → Builder → Judge loop. See `README.md` for the overview and `ARCHITECTURE.md` for the full design / architecture.

## Local development & testing (no push required)
Don't test by pushing to `main` and letting the GitHub marketplace auto-update — that forces untested code onto the release channel. Two local paths, tested:

- **Tight iteration → `--plugin-dir` (reads the working tree LIVE).** From the target app's directory:
  ```
  claude --plugin-dir /ABS/PATH/TO/velt-figma-plugin
  ```
  Edit a `scripts/*.mjs` → just re-run it (Node reads the file fresh each call; `${CLAUDE_PLUGIN_ROOT}` points at this repo). Edit a command/skill/agent `.md` → run `/reload-plugins` in-session (no restart). This local copy takes precedence over any installed version for that session.

- **"Installed everywhere" → a local *directory* marketplace, user scope.** One-time:
  ```
  claude plugin marketplace add /ABS/PATH/TO/velt-figma-plugin
  claude plugin install velt-customize@velt-customize --scope user
  ```
  **Caveat (tested): this install is a one-time SNAPSHOT copied into `~/.claude/plugins/cache/…` — including uncommitted working-tree files, but frozen at install time.** Editing the repo does NOT update it. `claude plugin update` does NOT work for a directory source, and a plain re-`install` is a no-op ("already installed"). The ONLY refresh is uninstall + install:
  ```
  claude plugin uninstall velt-customize --scope user -y && claude plugin install velt-customize@velt-customize --scope user
  ```
  So use the snapshot install for stable "it's available in every project" use, and `--plugin-dir` while actively editing.

`main` = released (GitHub-marketplace users get it via `autoUpdate`); commit + push only once it's verified locally.

## Two knowledge tiers — `guide/` (SDK docs) vs `knowledge/` (empirical learnings)
There are **two** distinct knowledge stores, and where a fact goes depends on what KIND of fact it is:
- **`guide/` = Velt SDK documentation.** The stable reference of what the SDK exposes — slots, props, CSS classes/variables, wireframe components, behaviors, data models. Treat it as **read-only reference** (it ideally mirrors Velt's own docs). It is the source of truth for *Velt facts*, and skills/agents carry zero SDK knowledge of their own — they point at `guide/`.
- **`knowledge/` = empirical learnings.** Facts the pipeline discovered by RUNNING — SDK gotchas + fixes, component difficulty, intent→component mappings, mock-fidelity render rules, **mechanism-polish (demo vision→DOM→CSS playbook)**, model reliability. These grow via the learning loop (run journals a `scope:"general"` candidate → `learnings-push.mjs` → the central [velt-figma-plugin-learnings](https://github.com/velt-js/velt-figma-plugin-learnings) repo, one inbox for both harnesses → human review → merge into `knowledge/` here, synced to Cursor). See `knowledge/README.md`.
- **The rule:** a run-derived finding is a **`knowledge/` candidate, never a `guide/` edit**. Do not write empirical/operational lore into `guide/` (it would pollute the SDK docs); do not put SDK reference facts in `knowledge/`. A learning is promoted to `knowledge/` only after it holds across **multiple different designs** (the `seenOn` corroboration test) — e.g. `mock-fidelity.json` was validated on 3 designs before landing.

## Working on the plugin
- **Edit SDK knowledge** directly in `guide/`. **Add empirical learnings** to `knowledge/` (per the tiers above). The plugin reads both at runtime; there is no separate bundle and no sync step.
- **Gate before shipping:** `node scripts/check-guide.mjs` (guide integrity), `node scripts/validate.mjs`, and `claude plugin validate .`.
- **Golden test:** `node golden/run-golden.mjs` (offline probe/gate/judge calibration suites) + the E2E checklist in `golden/README.md`.
- **Separation of concerns:** skills/agents carry zero customization knowledge — they point at `guide/` (SDK facts) and read `knowledge/` (learnings). Keep it that way.
- **Strict templates:** every file under `guide/approaches/`, `guide/features/`, and `guide/reference/behaviors/` follows the per-folder template defined in that folder's `_template.md`. New/edited files must conform.
