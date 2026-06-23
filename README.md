# velt-customize — Figma → Velt UI customization (Claude Code plugin)

Turns a **Figma design** into **clean, rule-compliant Velt UI customization** (comments + notifications) on a client's existing React app, via a **Planner → Builder → Judge** loop that verifies each surface against the design in a real browser, or honestly reports an **SDK gap**. It always reads the latest bundled **customization guide** and never hacks (R0).

## The flow

1. You provide: the **Figma file/node** + the **target repo** (Velt is assumed already installed/authed/rendering).
2. **Plan** (read-only, parallel): recognize which Velt component each design element is (`guide/reference/component-definitions.md`), pick the cheapest viable layer per surface (`guide/02-decision-tree.md`), synthesize goals.
3. **Coverage gate:** the plugin shows a **per-surface coverage matrix** (surface × approach, with a recommendation) and **waits for you to confirm or adjust** before building anything.
4. **Build → Judge loop** (sequential, one surface at a time — R16): the Builder implements one surface; an independent, fresh-context Judge verifies it against the design in Chrome (evidence required). Retry → escalate layer → SDK gap, with stuck-detection.
5. **Report:** coverage (estimated vs actual), the SDK-gap report, screenshots, and the code under `components/velt/ui-customization/`.

## Layout

```
.claude-plugin/plugin.json   manifest
.mcp.json                    figma-desktop (design intake) + claude-in-chrome (verification)
guide/                       BUNDLED customization-guide, verbatim (synced) + guide.version  ← the knowledge base
customization-guide/         canonical guide source (edit here, then sync)
skills/  agents/  commands/   thin orchestration over the guide (no embedded knowledge)
scripts/sync-guide.mjs       copy customization-guide/ → guide/ + stamp version + self-check
scripts/validate.mjs         completeness + guide-freshness gate
templates/                   VeltCustomization.tsx, styles.css, report templates
ARCHITECTURE.md              the full design / architecture (read this to understand how the plugin works)
```

## Scripts

```bash
node scripts/sync-guide.mjs    # re-bundle the guide (run after editing customization-guide/)
node scripts/validate.mjs      # gate: manifest + .mcp.json + guide freshness/self-check
```

The guide is the single source of truth: skills/agents carry **zero** customization knowledge — they read `guide/` and apply it, so behavior changes when the guide changes, with no drift.

## Note on MCP endpoints

`.mcp.json` registers `figma-desktop` (Figma Dev Mode MCP) and `claude-in-chrome`. The exact transport/URL/command is environment-specific — confirm they match your local setup before a run.

## Scope (v1)

Comments + notifications · React · Claude Code host. CSS / Wireframes / Primitives (+ mix); Headless flagged heavy. Out of scope: SDK install/auth, other features/frameworks, pixel-perfect matching, changing Velt's runtime behavior.
