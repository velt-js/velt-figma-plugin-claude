# Build methodology — how to actually build a customization

This is the **process** (the decision tree picks the *layer*; this says *how to build*). It is proven: built by hand against a real Figma design, it took a broken <5% shell to a pixel match. Follow it exactly.

## The one principle

**Build in small patches, each made pixel-perfect before the next. Never build the whole design in one pass.** A run that registers every wireframe + writes all the CSS at once and then "judges the surface at 90%" is the failure mode. Instead: one element → match it to the pixel → next element. Small, verified, compounding.

## The pipeline: extract → map → build → measure

Fidelity is a **data** problem, not a judgment one. Don't look-and-style; run this pipeline:

1. **Extract** (deterministic) — produce the `designSpec`: exact spacing/sizing/radius/typography/colours + the design's exported icon SVGs ([`extraction.md`](./extraction.md)). Numbers are read, never eyeballed.
2. **Map** (Velt Code Connect) — for each element, decide the real slot/prop/variant/icon from the manifest ([`reference/manifest.md`](./reference/manifest.md)): **props-first** (structure a prop produces is never CSS) and **supply every `mustSupply` slot** (the design's SVG/text, never a Velt default).
3. **Build** — execute that map: wireframe files + an `icons/` file from the exported SVGs, host props set, the `designSpec`'s exact `cssDecls` applied to the real classes.
4. **Measure** — the Judge diffs rendered computed styles against the `designSpec`, per element, per property ([`verifying-a-customization.md`](./verifying-a-customization.md)); "looks close" is a FAIL.

Step 1 below is the design overview that feeds extract+map; Step 2 is build; the measured loop closes it.

---

## Step 1 — Design overview (read EVERY frame before building anything)

Go through the Figma **frame by frame** and write down, exhaustively:

1. **Which features/surfaces exist** — e.g. a comments **sidebar** AND a **pin dialog** are two different surfaces; don't miss one. List each.
2. **Per surface, every element** — for a dialog: header (or none), thread card (avatar, name, time, message, mentions, reply/toggle), composer, etc. For a sidebar: header (title + filter), composer, list.
3. **Every state shown** — collapsed-by-default vs expanded, empty placeholder, composer focused, composer expanded (long message → grows to a max-height then scrolls), autocomplete/@mention dropdown, hover (reveals resolve + kebab), selected, resolved (greyed + unresolve), filter dropdown open, options dropdown, toasts/tooltips, selected-filter tick. Note which state the user wants as the **default**.
4. **Exact tokens** — colors (incl. mention/link color), type sizes/weights/line-height, spacing, radius, shadows, icon set.
5. **What is NOT supported by default** — explicitly list every piece the SDK can't do out of the box, and the plan for each:
   - achievable via a **prop/config/wireframe slot** → note which,
   - needs **primitives/headless + custom logic** → confirm the **data model** actually supports it ([`reference/data-models.md`](./reference/data-models.md)) before claiming feasible; if a field/event doesn't exist, it's a real gap → **document it + suggest the closest supported alternative** (e.g. a "mentions" filter isn't in the minimal filter → suggest *assigned-to-me* / *involved*),
   - needs an **event-driven addition** (e.g. a resolved **toast**, a link-copied **tooltip**) → clean; subscribe to the event ([`reference/events.md`](./reference/events.md)),
   - might feel **hacky** (e.g. a "Cancel" button the SDK has no slot for → clear the composer via JS) → **document the approach and confirm with the user before shipping it** — never ship a brittle hack silently (R0).

The output is a complete, per-surface, per-state checklist + the unsupported-items list. This is what the build and the Judge work against.

---

## Step 2 — Implementation (one small patch at a time, to pixel-perfection)

Pick **one surface** (dialog or sidebar — dialog first is usually easiest). Then, within it:

**a. Build the structure, slot by slot.** Declare the wireframe tree for that surface (full container trees — containers drop undeclared children). Get it *rendering* before styling.

**a2. Supply every slot + set props first.** Before styling, fill every `mustSupply` slot from the Connect Map (the design's exported SVG icon, the exact label, the explicit menu items — never a Velt default), and set the host props that produce structure (`collapsedComments`+`collapsedRepliesPreview`, `defaultMinimalFilter`, placeholders, `shadowDom:false`, …). Structure from a prop is never built in CSS.

**b. Style element by element — apply the EXACT numbers (this is the core).** For each element, in a small patch:
   1. **Render** the surface in the live app (shadow off so class CSS reaches), with seeded data so the element actually shows.
   2. **Inspect the LIVE rendered element** (not the hidden registry template — those `*-wireframe` tags are 0-size copies) to find its real Velt class (`.velt-thread-card--name/--time/--message`, `.s-user-avatar-container`, `.velt-composer--submit-button`, …).
   3. **Apply the Connect Map's `cssDecls` for that element** (the exact numbers from the `designSpec`) to that class, overriding Velt's default with `!important` (R9b). **Don't re-measure or eyeball — the numbers are already exact in the `designSpec`.**
   4. The Judge then **measures** the rendered computed style against the `designSpec` (ΔE<2, ±1px) and returns a delta table; close any failing rows. *Then* the next element.

**c. Interactivity & states.** Then handle hover/active states: e.g. resolve + kebab hidden by default, revealed on card hover; keep them visible while the options dropdown is open (the "active" case — hover OR a button under action). Fix empty-control gaps (`display:none` on an empty unresolve button). Composer collapsed→expanded→max-height→scroll. Hidden scrollbars (`scrollbar-width:none`).

**d. Test every feature functionally, as a real user.** Edit, delete, copy link, add reply, delete main/reply, resolve/unresolve, draft, edited badge, tagging one/many users. Keep fixing until it's 100% right functionally *and* visually. (Draft/edited badges may not be in the design — keep them, themed to match.)

**e. Next surface.** Repeat a–d for the sidebar (header title + filter, page-mode composer, list).

**f. The unsupported items, last.** Implement the event-driven ones (toast, tooltip) cleanly; confirm the hacky ones with the user; document the genuine gaps with their suggested alternatives.

---

## The build↔judge loop is PER PATCH, not per surface

After each small patch (an element styled, a state handled), the [Judge](./verifying-a-customization.md) checks **that piece** by **measurement** — the delta table diffing rendered computed styles against the `designSpec` (colour ΔE<2, lengths ±1px), plus the `mustSupply`/icon-identity gate. No aggregate score; a piece isn't done until its delta table is empty across its states. Then the next patch. (See the gotchas you'll hit in [`build-gotchas.md`](./build-gotchas.md).)
