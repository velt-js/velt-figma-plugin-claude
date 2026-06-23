# Velt UI Customization Guide

> Everything you need to make Velt's collaboration UI (comments, sidebar, notifications, reactions, presence, …) match **your** design — from changing a color to building a 100% custom UI.

This guide is written so that **someone who has never heard of Velt** can read it top‑to‑bottom and confidently customize Velt in their app, and so that an **AI tool can follow it step‑by‑step** to turn a design (e.g. a Figma file) into a working Velt implementation.

It covers **UI customization only**. It does *not* cover auth, permissions, data providers, or self‑hosting — except the one setup flag (`shadowDom`) that customization depends on.

---

## The one idea to remember

**Velt owns the behavior, data, and real‑time sync. You own the presentation.**

Every customization approach in this guide is just a different amount of "you own the presentation" — from *recolor it* to *rebuild it from scratch*.

---

## The four layers (in 10 seconds)

Ordered by how you should reach for them — **CSS → Wireframes → Primitives → Headless**:

| Layer | What you do | Design control | Effort |
|---|---|---|---|
| **CSS** | Change colors/spacing/fonts via CSS variables (+ class overrides with `!important`) | Theme only | Lowest |
| **Wireframes** | Keep Velt's behavior/data‑wiring but supply your own HTML layout for each slot | High (layout/structure) | Low |
| **Primitives** | Compose Velt's building‑block components yourself (you do the looping, conditionals, prop‑passing) — full control + works with any UI library | Highest (short of headless) | Medium–High |
| **Headless** | Velt gives you data + actions via hooks; you build 100% of the UI | Total | Highest |

**Default preference: wireframes.** Use CSS for pure theming, **wireframes** for custom structure (the usual choice), **primitives** when you need full control / your own UI component library / your own interactivity (or to customize a *leaf* piece), and **headless** only as a last resort.

You can **mix them — even on the same surface** (e.g. drop in a `VeltCommentDialog` primitive *and* wireframe parts of it; or wireframe the dialog, primitive sidebar, CSS on both). See [`approaches/combining-approaches.md`](./approaches/combining-approaches.md).

---

## How to use this guide

Read in this order. Don't skip the first three — they prevent 90% of mistakes.

1. **[`01-overview.md`](./01-overview.md)** — the mental model + how the layers relate. *(5 min)*
2. **[`02-decision-tree.md`](./02-decision-tree.md)** — **start here for any new design.** Pick the right layer(s) for what you're building. *(the spine of this guide)*
3. **[`03-getting-started.md`](./03-getting-started.md)** — prerequisites, the `shadowDom` rule, and the folder structure to put your code in.
4. **The approach you picked** — open the matching file in [`approaches/`](./approaches).
5. **The feature you're customizing** — comments are covered throughout; for any other feature (notifications, reactions, recorder, mentions, presence/cursors, activity log, …) open its deep guide in [`features/`](./features) (index: [`other-features.md`](./other-features.md)).
6. **Does the design need a component that isn't showing?** Check [`reference/feature-flags.md`](./reference/feature-flags.md) — many features (reply avatars, priority, minimap, @here, …) are **off by default** and just need a prop.
7. **[`reference/`](./reference)** — look up exact CSS variables, wireframe tokens/variables, component/slot names, and hooks while you build.
8. **[`rules.md`](./rules.md)** — the non‑negotiables. Read once; re‑check before you ship.

When stuck: **[`debugging.md`](./debugging.md)** (symptom → fix), **[`patterns-and-tips.md`](./patterns-and-tips.md)** (proven recipes), **[`context.md`](./context.md)** (attach/read your own data on comments), **[`cross-cutting.md`](./cross-cutting.md)** (a11y/i18n/RTL/responsive/testing), and **[`edge-cases-and-limitations.md`](./edge-cases-and-limitations.md)**.

---

## File map

```
customization-guide/
├── README.md                       ← you are here
├── 01-overview.md                  Mental model + the 4 layers + shadow DOM
├── 02-decision-tree.md             HOW TO CHOOSE a layer (or mix) — the spine
├── 03-getting-started.md           Prerequisites, shadowDom, folder structure
├── approaches/
│   ├── css.md                      Theme with variables; class overrides with !important
│   ├── wireframes.md               Your layout, Velt's behavior (deepest section)
│   ├── primitives.md               Compose building blocks (+ any UI library)
│   ├── headless.md                 Hooks only — build everything yourself
│   └── combining-approaches.md     Mix-and-match per feature (and per piece)
├── reference/
│   ├── css-variables.md            All --velt-* variables (+ font-family)
│   ├── css-classes.md              Structural + STATEFUL classes (unread, resolved…)
│   ├── wireframe-tokens.md         velt-if / velt-class / velt-data syntax
│   ├── wireframe-variables.md      The complete {variable} catalog
│   ├── wireframe-components.md     82 wireframe components + ALL 770 slot elements + slot props
│   ├── primitives.md               All 421 primitive components (grouped)
│   ├── props.md                    ALL props for EVERY component (VeltComments + 38 others)
│   ├── apis.md                     All feature element API methods (getCommentElement()…)
│   ├── events.md                   All subscribable events per feature (.on('…'))
│   ├── component-config.md         Layout/mode props (filter layout, embed, …) + custom data
│   ├── feature-flags.md            Hidden-by-default features → the prop/method to enable
│   ├── component-catalog.md        Components ↔ primitives ↔ wireframe slots (map)
│   └── hooks.md                    Headless hooks (read / mutate / control)
├── features/                       Deep per-feature guides (non-comments)
│   ├── notifications.md
│   ├── reactions.md
│   ├── recorder-and-transcription.md
│   ├── mentions-and-autocomplete.md
│   ├── presence-and-cursors.md
│   ├── activity-log.md
│   ├── comment-surfaces.md         Text / Inline / Multi-thread comments
│   └── annotations-tags-arrows-areas.md
├── rules.md                        STRICT rules (must follow)
├── patterns-and-tips.md            Recipes + proven patterns + tips
├── debugging.md                    Blocked? Symptom → cause → fix
├── edge-cases-and-limitations.md   Gotchas + what each layer can't do
├── context.md                      Attach your own data to comments + read it in the UI
├── cross-cutting.md                a11y · i18n · RTL · responsive · testing
└── other-features.md               Index → the per-feature guides in features/
```

---

## For the AI plugin (how to consume this deterministically)

1. **Always run the decision tree first** ([`02-decision-tree.md`](./02-decision-tree.md)) against the target design. It outputs a layer (or a per‑feature mix) plus a reason.
2. **Honor [`rules.md`](./rules.md) as hard constraints.** They are non‑negotiable (e.g. one `<VeltWireframe>` per app; `shadowDom={false}` when styling; no interactive React inside a wireframe). Above all, **R0 — no hacky/patchy fixes**: if a goal isn't achievable cleanly within the supported APIs, switch layers or leave a clear code comment about the blocker; never fake it with brittle DOM/timing hacks. Clean, correct code only.
3. **Only use real identifiers — never invent one.** The [`reference/`](./reference) pages are **exhaustive, generated from source**: all **170** modern `--velt-*` (+83 legacy) variables ([`css-variables`](./reference/css-variables.md)), all **357** stateful classes with their conditions, per component ([`css-classes`](./reference/css-classes.md)), all **82** wireframes + slot trees ([`wireframe-components`](./reference/wireframe-components.md)), all **421** primitives ([`primitives`](./reference/primitives.md)), the full `{variable}` catalog ([`wireframe-variables`](./reference/wireframe-variables.md)), every `<VeltComments>` **prop** ([`props`](./reference/props.md)) + layout/mode props ([`component-config`](./reference/component-config.md)), and hooks ([`hooks`](./reference/hooks.md)). If a name isn't in these, it doesn't exist. (To confirm a class on a specific rendered element, inspect it with `shadowDom={false}` — see [`debugging.md`](./debugging.md).)
4. **Each approach file is self‑contained and step‑ordered** — follow it without cross‑guessing.
5. **Match the folder structure in [`03-getting-started.md`](./03-getting-started.md)** so output stays consistent across designs.
