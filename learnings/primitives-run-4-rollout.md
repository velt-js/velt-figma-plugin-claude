# Primitives run 4 — what the plugin got wrong, and where each lesson now lives

**Source.** `ai-harvey-implementation`, branch `cursor/harvey-primitives-run-4-98f8`. The plugin produced
`c4fef0f..b632bf2` (18 commits, mode `strictly primitives`). A human then corrected it in `39edf95` and
`68214b6` (+2763 / −315 across 13 files). This file records the rollout of the **general** corrections.

**Scope.** PRIMITIVES FLOW ONLY. Nothing here changes the wireframe path: no edit to `velt-builder.md`,
`velt-planner-structure.md`, `velt-planner-style.md`, `velt-operating-brief`, `mechanism-polish.json`,
`host-wiring.json`, `mock-fidelity.json`, or `lint-customization.mjs`. The new `sdk-gotchas.json`
entries are all `kind: "behavior"`, so the shared `--css` auto-apply path is untouched.

## What landed where (the enforcement map)

Per `master-fix-rollout.md`'s R-A — *a rule that is only prose is NOT implemented* — every lesson that
could be made mechanical was, and the prose was added last and kept minimal.

| Lesson | Enforcement | Prose |
|---|---|---|
| A conditional DIRECT child of a primitive crashes React (`removeChild` on a relocated node) | **lint P9 (error)** | capabilities hazard table · builder rule 9 · planner Step 2 |
| `defaultCondition` is declared on the bases and read by only 225 of 441 tags | **manifest `readsDefaultCondition`** (derived from SDK sources by `sync-primitives.mjs`) + **lint P10 (warn)** | capabilities hazard table · builder rule 12 · planner Step 2 |
| `"OPEN"/"IN_PROGRESS"/"RESOLVED"` are fallbacks, not a workspace's catalog | **lint P11 (error)** | builder rule 13 · planner Step 4 |
| `commentId` anchored without `commentIndex`; index taken from a collapsed slice | **lint P12 (warn)** | builder exemplar + gate section |
| An SDK mutation inside a `setState` updater (React runs updaters twice in StrictMode) | **lint P13 (error)** | builder rule 15 |
| P3 false-positived on a conditional child spanning tags | **scanner fix** in `consumeText` + calibration assertion | — |
| 10 ms `@angular/elements` destroy window; never unmount a primitive you will remount | golden prose only — not mechanically detectable from source | capabilities *Lifecycle* · builder rule 10 |
| Two "declined to render" signals (`data-velt-hidden` + inline style vs `:not(:has(*))`) | — | capabilities *The two declined-to-render signals* · builder rule 11 |
| Don't re-implement a gate the primitive computes | — | builder rule 14 · planner Step 2 |
| `setCommentSidebarFilters` merges by key | — | builder rule 15 · gotcha |
| A primitive's own inputs are public API | — | planner Step 4 |
| React wrappers drop `className`/`style` | — | capabilities hazard table · builder rule 16 |
| The two pre-boot / loading windows | — | capabilities *Lifecycle* · planner Step 4 |

**Golden.** `golden/primitives/bad/StaleFilterRow.tsx` → `good/LiveFilterRow.tsx` pins P9–P13, and
`good/LiveChip.tsx` was corrected to publish `commentIndex` so the exemplar no longer teaches the
defect. `primitives-calibration.mjs` gained 14 assertions; the suite is 78 checks green.

**Knowledge.** 9 entries added to `sdk-gotchas.json` (`component: "primitives"`, `kind: "behavior"`,
`confidence: "confirmed"`, single `seenOn` — they are corroborated by a hand audit of one design, so
treat them as advisory until a second design reproduces them). 7 observations added to
`model-reliability.json`, keyed by agent.

## Deliberately NOT rolled out

- **Everything SDK-dependent.** Roughly a third of the diff is the plugin's emission being *correct
  against a published SDK* and the correction only being valid against `mayank/primitives-r3-data`:
  the `addEventListener`→`onClick` migration (Velt's `stopPropagation` now spares customer children),
  dropping `useDeleteCommentAnnotation` (the SDK's own confirmation path was being skipped because of
  a registry bug), and the R2 context-fallback repairs. Teaching these as corrections would break every
  run against a released SDK.
- **The single biggest CSS lesson: LAYOUT is unconditional, STATE only changes paint.** A Figma state
  frame contributes a whole box, so the emitted rule put `display / flex-direction / gap / flex /
  position` behind the state selector and left the unconditional rule without them — measured, the
  action cluster had no `gap` at rest and 6px on hover, so the resolve button jumped 6px when the
  pointer entered; selecting a card moved its inter-comment gap 16→12px. This belongs to
  `velt-planner-style`, which is **shared with the wireframe flow**, so it is recorded as a `tentative`
  observation in `model-reliability.json` and left for a maintainer to act on. It would improve the
  wireframe path too — that is a decision, not a side effect to take unilaterally.
- **Design-specific values** — skeleton geometry, panel widths, confirm-dialog palette, margins. Per
  `CLAUDE.md`: a hex or a px is never knowledge; only the mechanism generalizes.

## Verify

```
node scripts/sync-primitives.mjs --check     # manifest in sync with the vendored snapshot
node scripts/lint-primitives.mjs golden/primitives/bad    # must exit 1
node scripts/lint-primitives.mjs golden/primitives/good   # must exit 0
node golden/run-golden.mjs                   # must pass before any of this merges
```
