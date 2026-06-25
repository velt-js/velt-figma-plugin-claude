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

---

## Deep dive: two open-source converters (bernaferrari/FigmaToCode, the-dataface/figma2html)

Both are **fully deterministic (no LLM)**. They're the clearest proof of a point the commercial blogs only imply: **the layout/spacing/asset parts of Figma→code are not a judgment problem — they're a data-extraction problem.** They read exact numbers from the Figma API and map them by fixed rules. This is the direct antidote to our "looks close but the spacing/sizing is off" symptom.

### FigmaToCode (bernaferrari) — deterministic layout fidelity
- **Normalized IR first ("AltNodes").** It never emits from the raw Figma tree — it builds a virtual tree with explicit parent pointers, promotes GROUP→FRAME, inlines pointless nesting, drops invisibles, collapses empty frames to boxes. Most "wrong layout" comes from emitting against the messy raw tree.
- **Spacing/sizing are read as EXACT numbers, never eyeballed:** `itemSpacing`→`gap`, the four `padding*` (collapsed to the concise `8px 16px` form), and resolved `layoutSizing` (FILL/HUG/FIXED). **This is precisely our bug** — I approximated px values *by eye from screenshots* instead of reading the design's real numbers (which the Figma MCP can give us).
- **Auto Layout → flex via a fixed enum table**, with two non-obvious rules: suppress `gap` when `SPACE_BETWEEN`; and **"fill" is axis-dependent** — `flex: 1 1 0` on the parent's primary axis vs `align-self: stretch` on the counter axis. Getting fill wrong is the #1 cause of subtly-off widths.
- **Absolute vs flow decided by the parent's `layoutMode`** (auto-layout parent → flex child, no left/top; plain frame → absolute).
- **Icon detection:** small vector-only subtrees are flattened to a single SVG/asset rather than reconstructed as nested boxes.
- **The architectural lesson — go hybrid:** use *deterministic code* for layout/spacing/sizing (Figma gives exact numbers; flex has exact equivalents), and reserve the *LLM* for what's genuinely semantic — mapping nodes to Velt components, prop wiring, intent. Don't make the model do flexbox arithmetic it will approximate.
- Honest limits: no component/semantic mapping (a button is a `<div>`), no synthesized responsiveness. (Sources: [repo](https://github.com/bernaferrari/FigmaToCode), `packages/backend/src/{altNodes,common,html}`.)

### figma2html (the-dataface) — asset & text fidelity (the icon fix)
- A deterministic exporter (Figma-native reimplementation of NYT's ai2html). Core primitive: **text-vs-art split** — real DOM text overlaid on a rasterized base, so text stays crisp/selectable.
- **The reusable mechanism for our R17 icon gap: per-node `node.exportAsync({ format: 'SVG' })`.** figma2html flattens art into one image, but the *same primitive applied per icon/vector node* is exactly how you pull the **design's real SVGs**. The research is explicit: **don't flatten — iterate the icon/vector nodes individually, export each as SVG (strip width/height for a responsive `viewBox`), and wire them into Velt's icon slots** instead of using Velt's defaults. This is the concrete recipe for the thing the run skipped (`download_assets` exists; the run never used the exports to fill slots).
- **Text-style extraction:** "most-frequent style as the base, inline only the deltas" + a ready Figma-text-prop → CSS table (rgba fills, line-height/letter-spacing units, italic detection, `textCase`→`text-transform`). Lift wholesale for exact type.
- **Frame-relative % coordinates** + `transform: translate()` for alignment, avoiding text-measurement rounding drift.
- Limits: targets static graphics, requires strict frame naming; individual icons aren't extracted (it flattens) — so we adopt its *export primitive* but invert its flatten heuristic. (Sources: [repo](https://github.com/the-dataface/figma2html), [exportAsync docs](https://www.figma.com/plugin-docs/api/properties/nodes-exportasync).)

### What these two add to "what we're missing" (two more concrete gaps)
- **GAP — we eyeballed numbers instead of reading them.** Our spacing/sizing/radius came from looking at screenshots. The deterministic converters prove these should be **read as exact values from the Figma node** and treated as ground truth the model must honor — not approximated. The Planner should extract the real `itemSpacing`/padding/sizing/radius/typography per surface and hand them to the Builder as numbers; the Judge should assert against them (the measurement approach).
- **GAP — we never exported and used the design's real SVG assets (R17).** `download_assets` was in the plan but the build used Velt's default icons and one hand-rolled data-URI. The recipe: export every icon/glyph node as SVG and **fill the Velt icon slots with them** — the exact thing `velt-harvey-demo` does with its 10 hand-ported icon components.
- **Refined architecture takeaway:** the plugin should be **hybrid** — *deterministic* extraction (exact tokens/spacing/sizing + per-node SVG export) feeding an *LLM* mapping step (design element → Velt slot/prop/variant/icon) feeding a *measurement* judge. We currently do an all-LLM, all-eyeball pipeline; the fidelity parts should be mechanical.

---

## Sources
**Open-source converters:** [bernaferrari/FigmaToCode](https://github.com/bernaferrari/FigmaToCode), [the-dataface/figma2html](https://github.com/the-dataface/figma2html), [Figma exportAsync](https://www.figma.com/plugin-docs/api/properties/nodes-exportasync).
**Tools:** Builder.io Visual Copilot ([intro](https://www.builder.io/blog/figma-to-code-visual-copilot), [CLI](https://www.builder.io/blog/visual-copilot-cli), [component mapping](https://www.builder.io/blog/figma-design-system-component-mapping)); Locofy LDM ([arXiv 2507.16208](https://arxiv.org/abs/2507.16208)); Anima ([pluggable design system](https://www.animaapp.com/blog/genai/pluggable-design-system-figma-to-your-design-system-code/)); TeleportHQ ([UIDL](https://docs.teleporthq.io/uidl/), [code generators](https://github.com/teleporthq/teleport-code-generators)).
**Figma MCP / Code Connect:** [Dev Mode MCP](https://www.figma.com/blog/introducing-figma-mcp-server/), [mcp-server-guide](https://github.com/figma/mcp-server-guide/), [Code Connect](https://developers.figma.com/docs/code-connect/), [Code Connect + MCP](https://developers.figma.com/docs/figma-mcp-server/code-connect-integration/), [Design systems & AI](https://www.figma.com/blog/design-systems-ai-mcp/), [Storybook MCP](https://tympanus.net/codrops/2025/12/09/supercharge-your-design-system-with-llms-and-storybook-mcp/).
**Verification:** [ReLook](https://arxiv.org/html/2510.11498v1), [Design2Code](https://salt-nlp.github.io/Design2Code/) ([paper](https://arxiv.org/pdf/2403.03163)), [VISTA](https://arxiv.org/html/2605.26144), [Vadim: Playwright+Figma measurement loop](https://vadim.blog/pixel-perfect-playwright-figma-mcp/), [Applitools: image comparison right](https://applitools.com/blog/how-to-do-image-comparison-right/), [Playwright snapshots](https://playwright.dev/docs/test-snapshots), [LLM-judge bias](https://www.adaline.ai/blog/llm-as-a-judge-reliability-bias).
