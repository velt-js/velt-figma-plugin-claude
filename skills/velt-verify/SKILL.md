---
name: velt-verify
description: Verify a finished Velt surface against the design — drive states, confirm behavior, run the rules scan, emit a verdict. Use after building each surface (R15/R16).
---

Verification flow → verdict. **Measure, don't eyeball.**

- Follow `guide/verifying-a-customization.md` step for step: drive **every** state → **measured** delta check (inject `BROWSER_PROBE` from `scripts/delta-compare.mjs` with the spec list from the Connect Map / `designSpec`; diff live `getComputedStyle` vs spec — colour CIEDE2000 ΔE<2, lengths ±1px) → behavior check → static rules scan against `guide/rules.md`. Cross-cutting (a11y/dark/RTL/responsive): `guide/cross-cutting.md`. Stuck? `guide/debugging.md`.
- **Hard gates:** console error / unbuilt / `width===0` ⇒ BLOCKED/FAIL; every `mustSupply` slot ([`guide/reference/manifest.md`](../../guide/reference/manifest.md)) must be present and carry the design's SVG/content (R17). **No aggregate score** — a goal is `met` only when the delta table is empty for that state, with evidence; "looks close" is a FAIL. Verdict: `PASS | PARTIAL | FAIL | BLOCKED`. Unmet-but-no-clean-path → `velt-gap`.
