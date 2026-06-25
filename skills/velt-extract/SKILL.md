---
name: velt-extract
description: Produce the deterministic designSpec from a Figma design — exact spacing/sizing/radius/typography/colours + exported icon SVGs. Use at intake, before mapping or building. Measure, never eyeball.
---

Deterministic Figma extraction → `designSpec`.

- Run `scripts/figma-extract.mjs` per [`guide/extraction.md`](../../guide/extraction.md): with a Figma token configured, `rest <fileKey> <nodeId> --svg`; otherwise save the Figma-MCP outputs (`get_variable_defs` + a node tree) to a dump and run `from-mcp`. Emits `designSpec.json` (CSS-ready exact `cssDecls` per element, mapped by the FigmaToCode rules — gap suppressed on SPACE_BETWEEN, padding concise, **fill is axis-dependent**) + exported icon SVGs under `assets/`.
- **The designSpec is the source of truth for numbers — never approximate spacing/colour/type from a screenshot.** Export the design's icon SVGs and hand them to the build for the `mustSupply` icon slots (R17).
- **Token handling (secure, §G):** `figma-extract.mjs token status|set|remove` — `FIGMA_TOKEN` env → OS keychain, never the repo `.env`; `set` reads from STDIN; token is optional (no token → MCP fallback, never a halt).
