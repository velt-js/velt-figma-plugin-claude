# 02 · Decision Tree — Which approach for your design?

**This is the spine of the guide. Run it for every design, feature by feature.**

There is no single "best" layer, but there **is** a default order to reach for them. Cheaper layers (CSS, wireframes) are faster and upgrade‑safe; richer layers (primitives, headless) give more control but you do more work and maintain more.

> **Golden principles**
> 1. **Use the cheapest layer that can express the design.** Reach in this order: **CSS → Wireframes → Primitives → Headless.**
> 2. **Wireframes are the default for structural customization.** Prefer them. Drop to CSS if you only need theming; escalate to **primitives** only when you need full control / your own UI component library / your own interactivity (or to customize a *leaf* piece); use **headless** only as a last resort.
> 3. **CSS is always available** and layers on top of every other approach (override with `!important`).
> 4. **You can mix layers — even on the same surface** (e.g. a `VeltCommentDialog` primitive *and* a wireframe for parts of it).

---

## How to use this

1. Split the design into **features/surfaces** (comment dialog, comments sidebar, comment pin/bubble, notifications panel, reaction tool, …). Velt is customized **per feature**, so decide per feature.
2. For each feature, walk the **questions** below in order. Stop at the first "yes".
3. Record the chosen layer **and the reason**. Different features can land on different layers, and one feature can use more than one layer — that's expected (see [`approaches/combining-approaches.md`](./approaches/combining-approaches.md)).

> **Before customizing:** if the design needs a piece that isn't showing by default (reply avatars, priority, minimap, @here, device badge, …), check [`reference/feature-flags.md`](./reference/feature-flags.md) — it's likely an existing feature behind a prop. And if the design surfaces *your app's data* in the comment UI, that's [context](./context.md).

---

## The questions (per feature)

**Q1 — Is the only difference colors, spacing, fonts, radius, or shadows?**
(The layout and which elements appear are basically Velt's default.)
→ **CSS.** Theme with `--velt-*` variables; override classes with `!important`. See [`approaches/css.md`](./approaches/css.md).

**Q2 — Does the design change the *structure/layout* (custom header, reordered/added/removed parts, custom thread‑card, custom empty state) while keeping the same features — AND you don't need your own interactive components or UI‑library widgets *inside* the comment UI?**
→ **Wireframes** (+ CSS). **This is the default for structural customization — prefer it.** Velt fetches the data, loops the threads/comments, and wires each slot's behavior; you just supply layout markup. See [`approaches/wireframes.md`](./approaches/wireframes.md).

**Q3 — Do you need full control: your own **UI component library**, your own **interactivity/state**, to **compose Velt's building blocks yourself** (fetch data, loop, conditionals, pass props), to place Velt pieces **anywhere** in your tree, or to customize a piece **more deeply than its wireframe allows**?**
→ **Primitives** (+ CSS, + a leaf's wireframe where needed). You write the React (loop annotations, pass `annotation-id`, loop comments, pass each `comment`); you compose the building‑block components and their sub‑components into any layout; you wrap them in any UI library. More effort, most control. See [`approaches/primitives.md`](./approaches/primitives.md).

**Q4 — Does nothing Velt renders fit — you must own 100% of the UI, or render on a surface Velt can't draw into (PDF, canvas, video timeline)?**
→ **Headless** (last resort). Data + actions via hooks; you build everything. See [`approaches/headless.md`](./approaches/headless.md).

**Still unsure between wireframes and primitives?** Default to **wireframes** and only switch to primitives when you hit one of the Q3 triggers (UI library, custom interactivity, leaf‑deep changes, arbitrary placement).

---

## Flowchart

```
                    ┌─────────────────────────────────────────────┐
                    │  For ONE feature/surface of the design       │
                    └──────────────────────┬──────────────────────┘
                                           ▼
              Only colors / spacing / fonts / radius differ?
                          │ yes ──────────────► CSS
                          │ no
                          ▼
        Custom STRUCTURE/LAYOUT, same features, no need for your
        own interactive/UI-library components inside?
                          │ yes ──────────────► WIREFRAMES (+ CSS)   ◄── default
                          │ no
                          ▼
        Need full control — own UI library, own interactivity,
        compose building blocks yourself, place anywhere, or
        change a piece deeper than its wireframe allows?
                          │ yes ──────────────► PRIMITIVES (+ CSS, + leaf wireframes)
                          │ no
                          ▼
        Must own 100% of the UI, or render where Velt can't draw?
                          │ yes ──────────────► HEADLESS (last resort)
                          │ no  ──────────────► re-check Q1–Q4
```

---

## The UI‑component‑library question (don't miss this)

If your design is built from **your own component library** (MUI, shadcn/ui, Ant, Radix, Chakra, Tailwind UI…), where those components live changes everything:

| Where your library components sit | Allowed? | Why |
|---|---|---|
| **Around / next to** a Velt **primitive** (`<MuiCard><VeltCommentDialog/></MuiCard>`) | ✅ Yes | Primitives are real React components; your library renders normally beside them. |
| **As interactive components composed with primitives** | ✅ Yes | You own the React tree — full interactivity. |
| **As the visual shell** inside a **wireframe** slot (static components + classes, no behavior) | ⚠️ Static only | Velt clones the markup — your library's **static rendered output + CSS classes** survive, but `onClick`/state/hooks **do not run**. |
| **As interactive components** inside a **wireframe** slot (needing their own click/state) | ❌ No | Cloning strips React interactivity. Use **primitives** instead. |
| **Anywhere**, in a **headless** build | ✅ Yes | You render everything yourself; Velt only supplies data/actions. |

**Rule of thumb:** *want to reuse your interactive design‑system components inside the collaboration UI?* → **Primitives** (or Headless). Not wireframes.

---

## Comparison matrix

| | **CSS** | **Wireframes** | **Primitives** | **Headless** |
|---|---|---|---|---|
| **Reach order** | 1st (theming) | 2nd (default structural) | 3rd (full control) | 4th (last resort) |
| **Design control** | Theme only | High (any layout/structure) | Highest short of headless | Total |
| **Effort** | Lowest | Low | Medium–High | Highest |
| **Who does data/looping/wiring** | Velt | **Velt** (you just lay out slots) | **You** (fetch, loop, pass props) | You (from hooks) |
| **Velt‑managed behavior** | All | All (via slots) | All (you compose it) | None — you wire actions |
| **Custom layout/structure** | ❌ | ✅ (slots) | ✅ (sub‑components; leaf via wireframe) | ✅ |
| **Use your UI library** | n/a | ⚠️ static components & classes only (no behavior) | ✅ fully | ✅ fully |
| **Your own interactivity inside** | n/a | ❌ (cloned markup) | ✅ | ✅ |
| **Upgrade safety** | Highest | High | Medium | Lowest |
| **Maintenance burden** | Lowest | Low | Medium–High | Highest |
| **Reference page** | [`css-variables`](./reference/css-variables.md) · [`css-classes`](./reference/css-classes.md) | [`wireframe-components`](./reference/wireframe-components.md) · [`wireframe-variables`](./reference/wireframe-variables.md) | [`component-catalog`](./reference/component-catalog.md) · [`component-config`](./reference/component-config.md) | [`hooks`](./reference/hooks.md) |

---

## When a layer "breaks down" → escalate

Signs you've outgrown your current layer:

- **CSS → Wireframes:** you're writing `display:none` to hide parts, or you need to reorder/add/remove parts or restructure the header/composer/thread‑card layout.
- **Wireframes → Primitives:** you need your **own interactive component** inside the UI, your **own UI component library** there, to **place Velt pieces arbitrarily** in your tree, custom data composition/conditionals beyond `velt-if`, or to customize a **leaf** piece more than its slot allows. (For a single leaf you can stay in wireframes and use that leaf's wireframe; switch to primitives when the *whole surface* needs that level of control.)
- **Primitives → Headless:** Velt can't render where you need it (PDF/canvas), or you want to own 100% of the data→view pipeline.

And the reverse — **don't over‑escalate**:

- Went **primitives** just to restructure layout that wireframe slots already expose? Wireframes are less work.
- Went **headless** just to recolor or reflow? CSS or wireframes would do it.

---

## Worked examples

| Design intent | Chosen layer(s) | Why |
|---|---|---|
| Velt sidebar, brand colors + tighter spacing | **CSS** | Only theme differs. |
| Custom dialog with a custom header, thread card, and empty state | **Wireframes + CSS** | Structure changes, features stay the same. |
| App‑native page‑mode sidebar (custom cards, attachments, assign rows) anchored to page elements | **Wireframes** | Deep slot customization; Velt keeps behavior, data, and looping. |
| Comment UI rendered inside an app built on a component library, composed with that library | **Primitives + CSS** | Needs the UI library + custom composition. |
| A fully bespoke, interactive comment panel built from your own components | **Primitives** | Full control + own interactivity. |
| Unread‑count badge in your own app header, no Velt UI | **Headless** | Data only — `useUnreadCommentAnnotationCountOnCurrentDocument`. |
| Comments rendered as overlays on a PDF / canvas / video timeline | **Headless** | No Velt UI fits; render from `useCommentAnnotations`. |

➡️ Picked your layer(s)? Go to [`03-getting-started.md`](./03-getting-started.md) to set up, then open the matching file in [`approaches/`](./approaches).
