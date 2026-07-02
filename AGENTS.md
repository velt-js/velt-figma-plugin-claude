# AGENTS.md

## Cursor Cloud specific instructions

This repo is a **Claude Code plugin** (`velt-customize`): zero-dependency Node scripts plus a Markdown knowledge base under `guide/`. There is **no server, no build, and no `package.json` / install step** — just run Node scripts directly (Node ≥ 18; the VM has Node 22).

Gates and offline tests (all pass, exit 0):

- `node scripts/check-guide.mjs` — guide integrity gate.
- `node scripts/validate.mjs` — manifest + `.mcp.json` + guide self-check (a "no version" warning is expected and non-fatal).
- `node golden/run-golden.mjs` — offline golden/calibration suite.

Non-obvious notes:

- The **live end-to-end run** (`/velt-customize` in Claude Code) is out of scope for automated setup here: it requires a `FIGMA_TOKEN` (REST-only design intake, no MCP fallback), the `claude-in-chrome` MCP, and a target React app. See `README.md` / `ARCHITECTURE.md`.
- The optional device-resolution capture (`scripts/capture-block.mjs`) is the only script needing extra deps (`playwright-core` + Chromium); the gate/golden scripts above do not.
- `guide/` is the single source of truth — skills/agents carry no knowledge and read it directly (see `CLAUDE.md`).
