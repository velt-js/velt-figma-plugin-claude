# Reference · The Velt Code Connect manifest (the deterministic backbone)

There is a generated, machine-readable manifest — `manifest/velt-codeconnect.json` (built by `scripts/build-manifest.mjs`) — that the Planner, Builder, and Judge consume as the **deterministic source of truth** for *how a Velt component is customized*. It is the "Velt Code Connect" map: design element → real component → typed slot → prop/variant → icon/text slot. Use it; do not re-derive this from prose each run.

## What it carries (per component)

- `rootWireframe` / `reactImport` — the wireframe to register (one `<VeltWireframe>` per app, R1).
- `onComponent` — the host component the **host props** go on (e.g. `VeltComments`, `VeltCommentsSidebar`).
- `hostProps[]` — `{ prop, value, producesStructure }`. **These come FIRST (props-first).** Structure a prop produces (e.g. `collapsedComments` + `collapsedRepliesPreview` → the `MoreReply` "Show N replies" control) **must never be attempted in CSS** — set the prop. `shadowDom: false` is required for class CSS to reach the markup.
- `slots[]` — each with:
  - `reactPath` — the dotted accessor the Builder writes (e.g. `VeltCommentDialogWireframe.ThreadCard.Avatar`).
  - `tag` — the registered `velt-*-wireframe` element (validated against the [770-slot appendix](./wireframe-components.md); a tag not in the appendix doesn't exist — [source-of-truth invariant](./_entry-contract.md)).
  - `slotType` — `icon · text · container · action · input · menu-item`.
  - **`mustSupply`** — when `true`, the design's own content **must be supplied** into this slot (an icon's exported SVG, a label's exact text, explicit menu items). **Leaving a `mustSupply` slot empty renders Velt's default — that is a build error, not "close enough."** (This is the rule that the filter icon, filter labels, options menu, and reply/resolve icons were each missed on.)
  - `defaultContent` — `velt` (Velt renders something if you don't supply) vs `none`.
  - `cssClasses[]` — the real classes to override (curated; Velt's class names drop the component prefix the tags carry, so confirm on the live node with `shadowDom={false}`).
  - `dataField` — the data the slot reads (e.g. `Comment.from.name`), from [`data-models.md`](./data-models.md).
  - `slotProps` — input props the slot accepts (e.g. `Composer.ActionButton type=submit`), from the [slots-that-take-props table](./wireframe-components.md).
- `recognition[]` — design-intent cues → component, for the Planner's recognition step.

## How it's built + kept honest

`build-manifest.mjs` = **auto-extracted catalogs ∪ a curated overlay**. The auto half reads the appendix (completeness universe), the slot-props table, `css-classes.md`, `feature-flags.md`/`props.md` (the host-prop catalog). The curated overlay (`manifest/overlay/*.json`) carries the structural + semantic truth the prose can't express deterministically (nesting, `slotType`, `mustSupply`, `dataField`, which host props produce which structure) — grounded in a proven implementation. The generator **fails** if any overlay slot `tag` isn't in the appendix or a `slotType` is missing, and **reports** which appendix slots aren't yet covered (so coverage is visible). `validate.mjs` gates it. Re-run `build-manifest.mjs` whenever the guide or an overlay changes.
