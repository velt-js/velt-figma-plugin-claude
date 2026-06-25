# Build methodology — how to actually build a customization

This is the **process** (the decision tree picks the *layer*; this says *how to build*). It is proven: built by hand against a real Figma design, it took a broken <5% shell to a pixel match. Follow it exactly.

## The one principle

**Build in small patches, each made pixel-perfect before the next. Never build the whole design in one pass.** A run that registers every wireframe + writes all the CSS at once and then "judges the surface at 90%" is the failure mode. Instead: one element → match it to the pixel → next element. Small, verified, compounding.

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

**b. Style element by element — the inspect→override→compare loop (this is the core).** For each element, in a small patch:
   1. **Render** the surface in the live app (shadow off so class CSS reaches), with seeded data so the element actually shows.
   2. **Inspect the LIVE rendered element** (not the hidden registry template — those `*-wireframe` tags are 0-size copies). Find its real Velt class (`.velt-thread-card--name/--time/--message`, `.s-user-avatar-container`, `.velt-composer--submit-button`, …).
   3. There IS default Velt styling that won't match the design — find the exact class and **override it with `!important`** (R9b). Don't guess values; measure the Figma frame.
   4. **Compare the live render to the Figma frame, side by side, pixel to pixel** — border, radius, background, color, spacing, alignment, position, typography, icon. Iterate until it matches. *Then* move to the next element.

**c. Interactivity & states.** Then handle hover/active states: e.g. resolve + kebab hidden by default, revealed on card hover; keep them visible while the options dropdown is open (the "active" case — hover OR a button under action). Fix empty-control gaps (`display:none` on an empty unresolve button). Composer collapsed→expanded→max-height→scroll. Hidden scrollbars (`scrollbar-width:none`).

**d. Test every feature functionally, as a real user.** Edit, delete, copy link, add reply, delete main/reply, resolve/unresolve, draft, edited badge, tagging one/many users. Keep fixing until it's 100% right functionally *and* visually. (Draft/edited badges may not be in the design — keep them, themed to match.)

**e. Next surface.** Repeat a–d for the sidebar (header title + filter, page-mode composer, list).

**f. The unsupported items, last.** Implement the event-driven ones (toast, tooltip) cleanly; confirm the hacky ones with the user; document the genuine gaps with their suggested alternatives.

---

## The build↔judge loop is PER PATCH, not per surface

After each small patch (an element styled, a state handled), the [Judge](./verifying-a-customization.md) checks **that piece** by **visual side-by-side vs the Figma frame** — pixel to pixel. A piece isn't done until a designer couldn't tell it apart. Then the next patch. (See the gotchas you'll hit in [`build-gotchas.md`](./build-gotchas.md).)
