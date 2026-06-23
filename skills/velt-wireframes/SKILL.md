---
name: velt-wireframes
description: Build custom layout/structure for a Velt surface while keeping Velt's behavior. The default for structural customization. Use when the design changes structure but needs no custom interactivity inside.
---

Wireframe customization.

- Procedure: `guide/approaches/wireframes.md` (step-ordered). Identifiers: `guide/reference/wireframe-components.md` (slots + trees), `guide/reference/wireframe-variables.md` (the `{variable}` catalog), `guide/reference/wireframe-tokens.md` (`velt-if` / `velt-class` / `velt-data` syntax). Verify every name (R10).
- Key facts: one `<VeltWireframe>` (R1); container slots need their full child tree (undeclared children vanish); `ThreadCard` nests in `Body → Threads`; root wireframe auto-removes shadow (nested-only → `shadowDom={false}`); inline styles always work; fill pin index/number via `velt-data`. No interactive React in wireframe markup (R4) — use Velt slot components or `VeltButtonWireframe` + `useVeltEventCallback`.
