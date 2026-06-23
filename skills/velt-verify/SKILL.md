---
name: velt-verify
description: Verify a finished Velt surface against the design — drive states, confirm behavior, run the rules scan, emit a verdict. Use after building each surface (R15/R16).
---

Verification flow → verdict.

- Follow `guide/verifying-a-customization.md` step for step: drive each goal's states → qualitative compare vs the design (intent, not pixels; colors trace to a `--velt-*` token) → behavior check → static rules scan against `guide/rules.md`. Cross-cutting checks (a11y/dark/RTL/responsive): `guide/cross-cutting.md`. Stuck? `guide/debugging.md`.
- A goal is `met` only with captured evidence. Verdict: `PASS | PARTIAL | FAIL | BLOCKED`. Unmet-but-no-clean-path → run `velt-gap`.
