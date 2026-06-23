# Feature · Page annotations (Tags, Arrows, Areas)

The three on‑page annotation features. **Be honest up front: these have a *thin* customization surface** — they have **not** been migrated to the wireframe‑slot system, so there are **no wireframe slots** and **no `velt-if`/`velt-class`/`velt-data` tokens** for them. Customize with **CSS + props** (and, for Tags, a `[template]` input + headless hooks).

## What you can and can't do

| | Wireframe slots | `{…}` tokens | Headless hooks | React primitive | Customize with |
|---|---|---|---|---|---|
| **Tags** | ❌ none | ❌ | ✅ `useTagAnnotations`, `useTagUtils` | `VeltTags`, `VeltTagTool` | CSS, props, `[template]`, hooks |
| **Arrows** | ❌ none | ❌ | ❌ none | `VeltArrows`, `VeltArrowTool` | CSS, `darkMode` prop |
| **Areas** | ❌ none (one internal stub) | ❌ | ❌ none | *(no `Velt*` React wrapper — `velt-areas` / `velt-area-tool` elements only)* | CSS, area color |

## Tags

- **Components:** `VeltTags` (prop `pinHighlighterClass`), `VeltTagTool` (prop `targetTagElementId`). Internal elements `<velt-tag-pin>` / `<velt-tag-dialog>` accept a **`[template]`** input for custom rendering.
- **Hooks (the main lever):** `useTagAnnotations(documentId?, location?)` → `TagAnnotation[] | null`; `useTagUtils()` → the tag element. With these you can render tags entirely your own way (headless).
- **CSS:** target the tag host elements; theme via `--velt-*`.

## Arrows

- **Components:** `VeltArrows` (untyped props), `VeltArrowTool` (prop `darkMode`).
- **No hooks, no wireframes.** Customize via **CSS only** (host elements) + the `darkMode` prop. (A flat `componentConfig.arrowPinAnnotation`/`user`/… exists internally but is **not** interpolation‑live, so you can't read it in markup yet.)

## Areas

- **No dedicated React component** — areas are driven by config + the `velt-areas` / `velt-area-tool` custom elements.
- **No hooks, no usable wireframe** (only an internal portal stub).
- Customize via **CSS** on the area host/pin elements; the default area color is `#625DF5`.

## If you need more than CSS for these

Because there are no slots or hooks (beyond Tags), the right move when a design needs deep customization of arrows/areas is usually a **headless‑style approach for Tags** (render from `useTagAnnotations`), or accept the default UI + CSS for arrows/areas. Per **R0**, don't hack Velt's internal arrow/area DOM to force a layout it doesn't support — use CSS for what's reachable and leave a comment for the rest.
