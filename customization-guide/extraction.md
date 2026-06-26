# Deterministic extraction — read the numbers, don't eyeball them

The fidelity-critical inputs (spacing, padding, sizing, radius, typography, colours, **and the design's own icon SVGs**) are a **data-extraction problem, not a judgment one**. Never approximate them from a screenshot. Produce a `designSpec` first (via `scripts/figma-extract.mjs`), then the Builder applies those EXACT numbers and the Judge asserts against them.

## Producing the `designSpec`

- **REST path (preferred — fully deterministic).** With a Figma token resolved (see token handling below), `node scripts/figma-extract.mjs rest <fileKey> <nodeId> --out <dir> --svg` fetches the node JSON from `api.figma.com` and emits `designSpec.json` + exported icon SVGs under `assets/`.
- **MCP fallback (no token).** The Planner saves its Figma‑MCP outputs (`get_variable_defs`, and a node tree from `get_metadata`/`get_design_context`) to a dump, then `node scripts/figma-extract.mjs from-mcp <dump.json>` parses it into the **same** `designSpec` schema. Lower fidelity (limited to what the MCP exposes) — prefer REST.

Each `designSpec` node carries `cssDecls` — CSS‑ready, exact declarations — and a `box` (`x/y/w/h`). The Builder applies the `cssDecls` to the real classes from [`reference/manifest.md`](./reference/manifest.md); the Judge diffs rendered computed styles **and** layout boxes against them. **Boxes are emitted `surface-relative`** (`boxSpace: "surface-relative"`) — `figma-extract` subtracts the extracted root frame's origin from every node, so `box.x/y` are relative to the surface's top‑left and directly comparable to the probe's `getBoundingClientRect − surface-root` measurement (no absolute‑vs‑relative mismatch, and the Judge does no coordinate math by hand).

## The mapping rules (auto‑layout → CSS, from FigmaToCode)

- `layoutMode` `HORIZONTAL`/`VERTICAL` → `display:flex` + `flex-direction:row|column`.
- `primaryAxisAlignItems` → `justify-content` (`MIN`→flex-start, `CENTER`→center, `MAX`→flex-end, `SPACE_BETWEEN`→space-between).
- `counterAxisAlignItems` → `align-items` (`MIN`/`CENTER`/`MAX`/`BASELINE`).
- `itemSpacing` → `gap` — **suppressed when `SPACE_BETWEEN`** (the browser distributes the space; an explicit gap would be wrong).
- `paddingT/R/B/L` → `padding`, collapsed to the concise form (`14px 16px`).
- **Sizing is axis‑dependent — the rule most converters get wrong (and we did):** for a child of an auto‑layout parent, `FILL` on the parent's **primary** axis → `flex:1 1 0`; `FILL` on the **counter** axis → `align-self:stretch`; `HUG` → emit nothing (content‑driven); `FIXED` → literal `px`. Getting this wrong is what squeezed the dialog.
- `cornerRadius` → `border-radius`; `strokes`+`strokeWeight` → `border`; first solid `fills` → `background` (or `color` on a `TEXT` node); `style` → `font-family/size/weight/line-height/letter-spacing`.

## Icons — export the design's real SVGs (R17) + assign them to slots

`figma-extract` flags **likely‑icon** nodes (vectors, or small ≤64px vector‑only subtrees), exports each as an SVG (id‑suffixed filename so generic names like "Icon"/"Vector" don't collide), and **assigns each to a slot** using the manifest's `iconHint`, in **confidence layers** (stop at the first that matches; never guess):

1. **`nearText` (reliable):** the icon's adjacent label — a menu row is `[icon, "Edit"]`, the reply affordance is `[icon, "Reply"]`. Auto‑assign (de‑duped: one SVG → one slot). Output: `designSpec.iconAssignments[reactPath] = { file, by, glyph }`.
2. **name / component‑signal (S3):** an icon‑only control is frequently a **named Figma icon component** (an `iconButton`/`Icon` instance) or a node named for its glyph (`filterIcon`, `more`, `checkCircle`). The resolver matches the slot's `glyph` (+ synonyms — `filter-lines`→filter/funnel, `kebab`→more/ellipsis/dots, `check-circle`→check/resolve/tick, …) against the icon's own name + ancestry, preferring a single name hit or a single named component. **This is the layer that fixes the M2a filter + kebab misses** (named components with no adjacent label).
3. **`ancestryKeyword` (weak):** only accepted when it resolves to **exactly one** free icon; a broad keyword (e.g. "comment") matches many → left unassigned, never guessed.
4. **`unassignedIcons` → render‑and‑recognize:** anything still unmatched is reported here with `{ slot, hint:{glyph}, renderRecognize:true, candidates:[{file,name,isComponent,box}] }` — a **shortlist of the free exported SVGs** (name‑hits first, else the icon components). The Builder/Planner **rasterizes each candidate SVG and identifies the glyph by vision** (open the `assets/*.svg` in the browser / view it), then wires the one matching the `glyph` into the slot. Explicit recognition — never a Velt default, never hand‑drawn, never a blind guess.

**Wire the assigned + recognized SVGs into the `mustSupply` icon slots** as a small `icons/` file of React SVG components. Never leave a Velt default icon and never hand‑draw one.

## Token handling (secure — see the plan's §G)

The REST path needs a Figma personal‑access token; it is **optional** (no token → MCP fallback, never a halt). Resolution: `FIGMA_TOKEN` env var first, then the OS secure store — **never the target repo's `.env`**.
- `node scripts/figma-extract.mjs token status` → presence, masked.
- `node scripts/figma-extract.mjs token set` → reads the token from **STDIN** (never argv/history) into the OS keychain. The most secure path is the user storing it themselves (`security add-generic-password -U -s velt-customize -a figma-token -w`).
- `node scripts/figma-extract.mjs token remove` → deletes it.
The token is sent only to `api.figma.com` over HTTPS, never logged in full, never written to a tracked file. A read‑only / file‑content‑scoped PAT is recommended.
