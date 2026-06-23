# velt-customize — developer notes

> This file is **developer documentation for the repo**. Claude Code does **not** auto-load a plugin's root `CLAUDE.md`, so the runtime operating brief is shipped as a **skill** instead: [`skills/velt-operating-brief/SKILL.md`](skills/velt-operating-brief/SKILL.md) (loaded by `/velt-customize` and the `velt-orchestrator` agent).

## What this is
A Claude Code plugin that turns a Figma design into clean Velt UI customization (comments + notifications, React) via a Planner → Builder → Judge loop. See `README.md` for the overview and `ARCHITECTURE.md` for the full design / architecture.

## Working on the plugin
- **Edit knowledge** in `customization-guide/` (the canonical source), then re-bundle: `node scripts/sync-guide.mjs`.
- **Gate before shipping:** `node scripts/validate.mjs` and `claude plugin validate .`.
- **Golden test:** `node golden/run-golden.mjs` (offline checks) + the E2E checklist in `golden/README.md`.
- **Separation of concerns:** skills/agents carry zero customization knowledge — they point at `guide/`. Keep it that way.
