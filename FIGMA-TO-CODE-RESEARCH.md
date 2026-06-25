# Figma-to-code landscape — research & what we're missing

**Date:** 2026-06-25
**Question:** what do the tools that work well do differently, and what is our plugin missing?
**Method:** researched Builder.io Visual Copilot, Locofy (LDM), Anima, TeleportHQ, Quest; Figma Dev Mode MCP + Code Connect; the visual-verification / design-QA literature (ReLook, Design2Code, VISTA, Applitools, Playwright+MCP); design-system-driven codegen. Sources at the end.

---

## The 3 patterns EVERY serious tool shares (and we have none of them)

### Pattern 1 — A deterministic bridge between design and code. They never go "LLM → final code."
- Builder.io compiles through **Mitosis** (an IR); Locofy's models emit **instructions** consumed by a **deterministic engine**; TeleportHQ flows everything through **UIDL** (typed JSON) and emits from syntax trees, not string templates.
- The reason is always **reproducibility**: *same design → same code.* Locofy's paper is explicit that pure LLM/LMM output "fails on visual fidelity, responsiveness, and reproducibility."
- **Us:** Figma → LLM (me) → freeform CSS, directly. No IR, no determinism. Two runs would diverge; nothing pins the output.

### Pattern 2 — They MAP each design element to a real library component and configure it via PROPS. They do not style raw output.
- This is the universal mechanism and it's the heart of **Figma Code Connect**: `figma.connect(Component, …, { props })` maps Figma **variants → real `variant` props** (`figma.enum`), booleans → props, **text → real content/slots** (`figma.string`/`textContent`), and **icons/children → real slots** (`figma.instance`/`figma.children`). The MCP then hands the agent a `CodeConnectSnippet` with the real **import, prop mappings, and a usage example** — so it emits `<YourButton variant="primary"/>`, not a styled `<div>`.
- Practitioner data: **~85–90% styling inaccuracy WITHOUT Code Connect.** Builder.io: "they don't know the button in your mockup is the same Button in your codebase → div soup, arbitrary CSS." Anima discovers your components and learns "whether overrides use **props, children, or named slots**." Storybook-MCP's framing nails our failure: left alone, "agents default to patterns from their training data… generating new code instead of reusing what you've built."
- **Us:** we left Velt's slots **empty** (filter trigger, `Options.Content`, filter labels) → Velt's defaults rendered, and we CSS-skinned them. We never mapped "this element IS the Velt MinimalFilter / Options menu, supply these icons/labels/variants." **This is our RC-A/RC-B, and it's the #1 thing the whole industry engineers against.**

### Pattern 3 — They verify with MEASUREMENT, not with "does it look right?"
- The strongest finding (Vadim's Playwright+Figma loop, ReLook, Design2Code, VISTA): **stop asking the model to judge similarity; make the browser a measurement instrument.** Use `page.evaluate()` to extract computed styles + bounding boxes, compare to the spec, and emit a **per-element delta table** (Element | Spec | Rendered | Delta). Gate on numbers.
- LLM judges have a **measured leniency bias** (up to +0.8); they over-pass. The fixes: **reference-grounded** (anchor on the Figma frame), **bounded rubric** (pass/fail or 0–4, never "rate 0–100"), **per-element decomposition** with **no aggregate score** (Design2Code refuses to combine metrics so a model can't hide failures), **force "name the difference"** (enumerate every discrepancy with observed vs expected before any verdict), **hard renderability gate** (ReLook: invalid render → score 0), **forced improvement** (only accept a refinement that strictly beats the prior best), and **calibrate against a labeled gold set.**
- **Us:** our Judge compared by eye at low fidelity and passed on rough similarity — the exact leniency bias the literature documents. **This is RC-D — and it's why the run reported 16 visible diffs as "matched."**

---

## The crucial thing we're missing (one sentence)

**We let the LLM freely "look at the design and style whatever Velt renders," with (a) no explicit mapping that binds each design element to the SDK's real slot/prop/variant/icon, and (b) no measurement-based check — whereas every tool that works does exactly those two things.** Everything in the gap analysis (wrong icons, default labels, default menu items, missing props, "looks close") is a symptom of missing those two layers.

---

## Them vs. us — capability by capability

| Capability | Good tools | Our plugin | Missing? |
|---|---|---|---|
| Design → code path | IR / deterministic engine (Mitosis, UIDL, Locofy) | LLM → freeform CSS | **Yes** — no determinism/reproducibility |
| Design-element → component mapping | Code Connect / mapper files (variant→prop, text→content, icon→slot) | none — inspect DOM, style defaults | **Yes — the big one** |
| Library API surfaced to the agent | curated **component manifest** (Storybook-MCP), repo scan (Anima/Builder), Code Connect snippet | a prose guide (`reference/`) that the build didn't use to *supply* slots | **Partly** — we have knowledge, no per-build manifest/mapping |
| Real content/icons into slots | `figma.string`/`instance`/`children` → real slots; "assets are in the Figma payload, don't import new icon packages" | left Velt defaults; used 0 of the design's SVGs (R17 violated) | **Yes** |
| Props-first (variants/config before CSS) | variant→prop mapping is the primary lever | skipped — bare `<VeltComments/>`, treated structure as CSS | **Yes** (our RC-B: `collapsedComments` etc.) |
| Design pre-processing | Locofy "Design Optimizer" regroups junk layers | none | minor |
| Verification | measured delta tables, per-element, hard gates, forced-improvement, gold-set calibration | holistic eyeball, passes on similarity | **Yes — critical** |
| Scope discipline | node-id scoped, one component per prompt, rules file | partial | partly |

---

## Concrete techniques to adopt (for later — not applied here)

1. **A "Velt Code Connect" / mapping step.** Before styling, the planner decides per design element: *which Velt component/wireframe slot it is, which props/variants set its structure, which icons/labels/content fill its slots.* Output is an explicit slot→content map the builder executes — the deterministic-instructions pattern. This directly kills RC-A/RC-B.
2. **A curated Velt component manifest** handed to builder+judge: the real customizable components, their **wireframe slots**, **props/variants**, and **icon/content slots**, with one usage snippet each (the Storybook-MCP "Component Manifest" move) — not the whole guide, not training priors. We have the knowledge in `reference/`; we need the per-surface *actionable* extract that says "supply these slots."
3. **Props-first rule.** Enforce the feasibility ladder mechanically: set every implied prop/variant (`collapsedComments`, `collapsedRepliesPreview`, placeholders, `defaultMinimalFilter`, `sortBy/Order`, `visibilityOptions`, `shadowDom={false}`) **before** any CSS. Structure that a prop produces must never be attempted in CSS.
4. **Supply every slot from the design's own SVGs (enforce R17).** Fill icon/label/menu-item slots with the design's exported assets; never leave a Velt default.
5. **Measurement-based Judge:**
   - Playwright `page.evaluate()` → computed styles + bounding boxes → **delta table** (Element | Spec | Rendered | Delta), gate on numeric deltas; colors via **CIEDE2000**, not RGB.
   - **Per-element decomposition, no aggregate score** (Design2Code); **bounded** verdicts; **reference-grounded** on the Figma frame at equal scale + overlay/onion-skin.
   - **Force "name every difference"** (element + observed + expected) before any pass; explicit **anti-pattern penalties**.
   - **Hard gates:** invalid render → automatic fail (ReLook); DOM presence + computed-style assertions as deterministic backstops (VISTA).
   - **Forced improvement:** accept a refinement only if it strictly beats the prior best.
   - **Calibrate** against a labeled gold set (e.g. our run's screenshots vs `velt-harvey-demo`).
6. **Cheap pre-flight smell test.** "248 lines / 0 icons / 2 components" vs a design this rich cannot be a full match — flag gross-undershoot before claiming done.
7. **Use Code Connect via the Figma MCP** (`get_code_connect_map` / `get_code_connect_suggestions`) if/when Velt components are connected — we never touched it.

---

## Sources
**Tools:** Builder.io Visual Copilot ([intro](https://www.builder.io/blog/figma-to-code-visual-copilot), [CLI](https://www.builder.io/blog/visual-copilot-cli), [component mapping](https://www.builder.io/blog/figma-design-system-component-mapping)); Locofy LDM ([arXiv 2507.16208](https://arxiv.org/abs/2507.16208)); Anima ([pluggable design system](https://www.animaapp.com/blog/genai/pluggable-design-system-figma-to-your-design-system-code/)); TeleportHQ ([UIDL](https://docs.teleporthq.io/uidl/), [code generators](https://github.com/teleporthq/teleport-code-generators)).
**Figma MCP / Code Connect:** [Dev Mode MCP](https://www.figma.com/blog/introducing-figma-mcp-server/), [mcp-server-guide](https://github.com/figma/mcp-server-guide/), [Code Connect](https://developers.figma.com/docs/code-connect/), [Code Connect + MCP](https://developers.figma.com/docs/figma-mcp-server/code-connect-integration/), [Design systems & AI](https://www.figma.com/blog/design-systems-ai-mcp/), [Storybook MCP](https://tympanus.net/codrops/2025/12/09/supercharge-your-design-system-with-llms-and-storybook-mcp/).
**Verification:** [ReLook](https://arxiv.org/html/2510.11498v1), [Design2Code](https://salt-nlp.github.io/Design2Code/) ([paper](https://arxiv.org/pdf/2403.03163)), [VISTA](https://arxiv.org/html/2605.26144), [Vadim: Playwright+Figma measurement loop](https://vadim.blog/pixel-perfect-playwright-figma-mcp/), [Applitools: image comparison right](https://applitools.com/blog/how-to-do-image-comparison-right/), [Playwright snapshots](https://playwright.dev/docs/test-snapshots), [LLM-judge bias](https://www.adaline.ai/blog/llm-as-a-judge-reliability-bias).
