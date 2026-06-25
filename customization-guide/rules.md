# Rules (must follow)

These are **non‑negotiable**. Each is a rule + the failure it prevents. An AI tool should treat them as hard constraints; a human should re‑check them before shipping.

---

## R0 — No hacky fixes. Ever. (the prime directive)

**Never implement a hacky, patchy, or hidden workaround to force something a layer doesn't support.** If a design goal isn't achievable cleanly with wireframes or primitives (within the supported APIs, slots, props, variables, classes, and hooks in this guide), **do not fake it** — no brittle DOM scraping, no `setTimeout`/`MutationObserver` to mutate Velt's internals, no fragile DOM surgery, no copy‑pasted internal markup, no "it works for now" shims.

- Implementation must be **clean, correct, and idiomatic** — the same quality you'd ship to production. **No compromise on code quality** for the sake of "getting it to look right."
- If the cleanest path is a different layer, **switch layers** (escalate per the [decision tree](./02-decision-tree.md)) rather than hacking the current one.
- The "inspect → find class → `!important` override" workflow is **not** a hack — it's the supported way to restyle (R9b). A hack is something that depends on Velt's *unsupported internals* or *timing* and will break on the next render or SDK update.
- **If a goal is genuinely unachievable cleanly (a real blocker), stop and leave a clear code comment** stating: what was wanted, why it can't be done cleanly with the available APIs, and what was done instead (or that it's intentionally left out). Surface the blocker — never bury it under a fragile fix.

```tsx
// BLOCKER: design wants X on the comment dialog, but no slot/prop/variable supports it
// (see customization-guide/reference). Implementing this cleanly isn't possible today.
// Left as default rather than hacking Velt's internals. Revisit if the SDK adds support.
```

A patchy fix that "looks right" today is worse than an honest gap — it breaks silently, misleads the next person, and violates every other rule here. When in doubt, choose the clean partial result + a comment over a complete hacky one.

**When you think a goal is impossible, don't guess — run the flow.** [`sdk-gaps-and-blockers.md`](./sdk-gaps-and-blockers.md) walks you through ruling out the fixable causes (shadow DOM, specificity, wrong layer, off‑by‑default feature, custom data) and, only if none apply, recording it as a real SDK gap (the code comment above + a structured gap entry). That is the supported way to honor R0.

---

## Structural

**R1 — Use exactly one `<VeltWireframe>` in the whole app.**
This is a strong operational rule, not a runtime‑enforced singleton. Each `<VeltWireframe>` registers its children into **one global template map**, merged with **first‑with‑content‑wins** semantics — so multiple registries are technically possible but become **order‑dependent and conflict‑prone** (whichever registers a given slot first wins; later ones are silently ignored). Keep a single registry in `VeltCustomization.tsx`, rendered once near the root, and you avoid the whole class of "why did my wireframe not apply?" bugs.

**R2 — Mount the live feature component, not just the wireframe.**
A `Velt…Wireframe` only *registers* a template. The UI appears only when the real component (`VeltComments`, `VeltCommentsSidebar`, `VeltCommentDialog`, …) is also mounted. Wireframe but no mounted feature ⇒ nothing renders.

**R3 — Choose the cheapest layer per piece; mixing on one surface is allowed.**
Reach in order **CSS → Wireframes → Primitives → Headless**, per feature *and* per piece. You **may** combine layers on the same surface (e.g. a `VeltCommentDialog` primitive + a wireframe for one leaf piece) — that's fine and sometimes necessary (leaf primitives have no sub‑components, so their wireframe is the only way to restructure them). The rule is *don't pick a more expensive layer than the design needs*, not "one approach per surface." See [`approaches/combining-approaches.md`](./approaches/combining-approaches.md).

---

## Interactivity

**R4 — Never put interactive React inside wireframe markup.**
No `onClick`, `useState`, hooks, or stateful UI‑library components inside a wireframe slot — they're **cloned to inert DOM and silently do nothing**. Interactivity must come from `Velt…Wireframe.X` slot components; your markup is the visual shell only. If you need custom interactivity, use [primitives](./approaches/primitives.md) or go [headless](./approaches/headless.md). (Proof: [`edge-cases-and-limitations.md`](./edge-cases-and-limitations.md).)

**R5 — Wrap UI‑library components *around* primitives, not *inside* wireframes.**
`<MuiCard><VeltCommentDialog/></MuiCard>` ✅. A live MUI button inside a wireframe slot ❌ (behavior stripped). See the UI‑library table in [`02-decision-tree.md`](./02-decision-tree.md).

---

## Styling

**R6 — Selector CSS needs shadow DOM off *or* `injectCustomCss`.**
Variable‑only theming (overriding `--velt-*`) works through the shadow DOM and needs nothing. But **class/element selectors and wireframe styles can't reach inside** it — so either set `shadowDom={false}` on those components, **or** keep shadow DOM on and inject your styles into the shadow root via `client.injectCustomCss({ type, value })`. Doing neither looks like "my CSS does nothing." Don't do both for the same surface.

**R7 — Don't `display:none` to remove features.**
Toggle features with **props** on the primitive (`reactions={false}`, `status={false}`, …) or omit the slot in a wireframe. Hiding with CSS leaves dead behavior and breaks on layout changes.

**R8 — Put all Velt CSS in one stylesheet.**
Don't scatter `--velt-*` overrides across components. One `styles.css` (or `velt.css`) keeps theming coherent and dark‑mode correct.

**R9 — Dark values go under `:root[data-velt-theme="dark"]`.**
Don't hard‑code colors that ignore mode — it breaks dark mode.

**R9b — Override Velt's class‑based CSS with `!important`.**
Velt injects styles at runtime with high specificity. Class/element overrides (not `--velt-*` variables) **must** use `!important` to take effect — this is expected, not a hack. Workflow: inspect the element → find its `velt-*` class → override with `!important`. See [`approaches/css.md`](./approaches/css.md) §5 and [`reference/css-classes.md`](./reference/css-classes.md).

---

## Identifiers

**R10 — Never invent — verify instead.**
CSS variables, CSS classes, wireframe slots, `{…}` variables, component props, hook names, **data fields, prop behaviors, and component intent** must come from the reference pages:
- CSS vars → [`reference/css-variables.md`](./reference/css-variables.md)
- CSS classes → [`reference/css-classes.md`](./reference/css-classes.md)
- Wireframe components & slots (+ slot props) → [`reference/wireframe-components.md`](./reference/wireframe-components.md)
- `{…}` variables → [`reference/wireframe-tokens.md`](./reference/wireframe-tokens.md) (syntax) + [`reference/wireframe-variables.md`](./reference/wireframe-variables.md) (catalog)
- Component / layout props → [`reference/component-config.md`](./reference/component-config.md) · prop **behavior & interactions** → [`reference/behaviors.md`](./reference/behaviors.md)
- Hooks → [`reference/hooks.md`](./reference/hooks.md) · **data fields / events / custom‑data storage** → [`reference/data-models.md`](./reference/data-models.md)
- What a component is **for** (right/wrong tool) → [`reference/component-definitions.md`](./reference/component-definitions.md)

If a name isn't there, it doesn't exist (a wrong `{…}` resolves to `undefined`; a wrong prop/hook is a no‑op or error). To confirm a class on a specific rendered element, inspect it in DevTools (`shadowDom={false}`).

**The guide is the first source of truth — but its *silence* is not a verdict.** If the guide doesn't cover something or you're uncertain, **don't guess, don't hedge, and don't declare it impossible** — *verify against ground truth* in this order: the Velt Docs MCP / official Velt docs → the live SDK's actual behavior/types → an empirical test in the running app. Then state the verified fact with certainty (and ideally feed it back into the guide). Inventing a name and treating "not in the guide" as "not possible" are the two opposite failures this rule prevents.

---

## Architecture & code quality

**R11 — Keep Velt code under `components/velt/`, customization under `components/velt/ui-customization/`.**
App UI stays separate from Velt UI. One file per customized surface (`VeltCommentDialogWf.tsx`, `VeltCommentSidebarWf.tsx`, …). See [`03-getting-started.md`](./03-getting-started.md).

**R12 — Cheapest viable layer per feature (CSS → Wireframes → Primitives → Headless).**
Run the [decision tree](./02-decision-tree.md) per feature. **Wireframes are the default for structural customization** (Velt does the data/looping for you — less work than primitives). Use primitives only when you need full control / your own UI library / your own interactivity / a leaf override; headless only as a last resort. Don't go primitives for layout a wireframe slot already exposes, or headless for what a wireframe can do — over‑building is a maintenance liability.

**R13 — Headless objects must match `@veltdev/types`.**
When you hand‑build a `Comment`/`CommentAnnotation`, fill every field the action requires. Missing fields are the most common headless failure.

**R14 — `min-height: 0` on scrollable flex parents.**
A flex column that should scroll needs `min-height: 0` (and `flex: 1 1 auto`) or it collapses/overflows. Common in wireframe sidebars/panels.

**R15 — Verify after each surface.**
Don't customize five surfaces half‑way. Finish one, confirm it renders and behaves (compare against Velt's default by temporarily removing your customization), then move on. Use the step‑ordered flow in [`verifying-a-customization.md`](./verifying-a-customization.md) — drive the surface's states, confirm Velt's behavior is intact, run the static rules scan, then reach a verdict.

**R16 — One component at a time. Never all at once.**
Customize **step by step, a single component per step** — register one wireframe (or compose one primitive), get it rendering correctly, verify it, *then* start the next. Do **not** write a big batch of wireframes/primitives across many surfaces in one pass and debug them together: when something doesn't render you won't know which piece broke, and wireframe gotchas (wrong nesting, container slots dropping children, shadow‑DOM) compound. Build → verify → next. (This pairs with R15.)

**R17 — Icons/assets come from the design, never hand‑drawn.**
If the design has an icon, glyph, or illustration, **use the design's own exported asset** (the SVG from Figma). Do **not** approximate it with hand‑written CSS shapes, Unicode glyphs, or a different icon from the app — a CSS‑drawn arrow that "looks close" is not a match and is a defect. Extract the asset during recognition and reference it; only fall back to an existing app icon when the design genuinely reuses that exact one.

**R18 — Touch only the Velt customization; never change default project behavior.**
Confine changes to `components/velt/ui-customization/` and its assets. **Do not** fix the host app's own (non‑Velt) UI even if it diverges from the design, and **do not** alter any default project behavior, config, or files outside the customization. If a host change is genuinely *required* for the customization to work (e.g. a mount point, a prop on the host component), apply it **temporarily**, verify it works, **then revert it**, and **report it to the user** as a required manual change ("add X to get this running") — never bake it into the project silently.

---

## Quick gate before shipping

- [ ] **No hacky/patchy fixes** — clean code only; unresolvable blockers are commented, not faked (R0).
- [ ] One `<VeltWireframe>`; live features mounted (R1, R2).
- [ ] No interactive React inside wireframes (R4).
- [ ] `shadowDom={false}` where styled; no `display:none` feature‑hiding (R6, R7).
- [ ] One stylesheet; dark values scoped (R8, R9).
- [ ] Every identifier/behavior/data fact verified against [`reference/`](./reference); unknowns verified against ground truth, never guessed (R10).
- [ ] Folder structure matches the reference (R11).
- [ ] Each surface uses the cheapest viable layer (R12).
- [ ] Icons/assets use the design's exported SVGs, not hand‑drawn shapes (R17).
- [ ] Only the Velt customization changed; any required host change is reverted + reported, not baked in (R18).
