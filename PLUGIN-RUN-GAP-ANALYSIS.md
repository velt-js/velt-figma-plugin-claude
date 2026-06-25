# Plugin run — gap analysis (why the autonomous run missed 16+ items)

**Date:** 2026-06-25
**Run:** autonomous `velt-customize` on `harvey-playground` (clean slate, Figma `WYAWuEm8DrIkAyx03e8fG9`)
**Benchmark:** `velt-harvey-demo` (the correct, hand-built implementation — a 1:1 port of the `harvey-wireframes` reference)
**Status:** analysis only — **no plugin changes made.**

---

## 0. The headline (read this first)

The run produced a result and I reported the main surface as **"pixel-matched."** The user's manual audit then found **16+ nameable, visible differences** in exactly that surface. 

**So the single most important finding is not any one of the 16 items. It is that the Judge passed a result that was not a match — the same failure the entire improvement effort was built to prevent.** Everything below is downstream of that. A Judge that had compared at the glyph/pixel level would have caught all 16 itself and the loop would have kept going.

The build was also an **order of magnitude shallower** than the work the design actually required:

| | This run | Reference (`velt-harvey-demo`) |
|---|---|---|
| Stylesheet | **248 lines** | **1396 lines** |
| Wireframe components | 2 (Dialog, Sidebar) | **3** (Dialog, Sidebar, **ThreadCard**) |
| Custom icon components | 0 (used Velt defaults + 1 data-URI) | **10** exact SVGs (filter, check, resolve, reopen, kebab, pencil, link, trash, reply-arrow, empty-illustration) |
| `VeltComments` props set | **0** (`<VeltComments/>`) | **7** (incl. `collapsedComments`, `collapsedRepliesPreview`, `shadowDom={false}`) |
| `VeltCommentsSidebar` props | 2 (`embedMode`, `pageMode`) | **5** (+`shadowDom={false}`, `defaultMinimalFilter`, `sortBy`, `sortOrder`) |
| Explicit slot content (labels, menu items, icons) | almost none — left Velt defaults | every slot supplied with the design's own markup |
| States driven & verified | ~1 (default list) | all (skeleton, empty, collapsed/overflow, resolved, expanded composer, toast, mention) |

I was ~6 patches in and called the primary surface "matched." The primary surface alone needed roughly what the reference has.

---

## 1. Per-item mapping (your 16 + what the reference does)

| # | Item | What I shipped | What the reference does | Root cause |
|---|---|---|---|---|
| 1 | Sidebar header filter icon | Left `MinimalFilterDropdown.Trigger` **empty** → Velt's default glyph | Supplies `<FilterLinesIcon/>` (3-line SVG) in the Trigger | **RC-A** (left default content) |
| 2 | Filter dropdown | Default Velt labels ("Resolved"/"Assigned to me"), loose spacing | Custom `<FilterRow label="Show resolved comments"/>` / `"Only your mentions"`, tight 14px rows, check gutter | **RC-A** + **RC-D** (lenient visual) |
| 3 | Composer submit button | Styled Velt's default paper-plane | SDK submit button restyled to up-arrow, **idle-disabled → dark-enabled** logic | **RC-A** + **RC-D** |
| 4 | Composer **expanded** state | **Never built** | `.hw-composer-actions` row with **Cancel** (`VeltButtonWireframe`) + submit; host wires Cancel via `veltButtonClick` | **RC-C** (states) |
| 5 | Dialog squeezed | Cramped card, wrong padding/rail | `.hw-card` chrome + `.hw-comment-rail` (avatar + vertical rail line) + correct padding | **RC-D** (pixel) |
| 6 | Thread-card avatar | Plain dark 20px | 20px **+ 1px border-strong ring** | **RC-D** |
| 7 | Card action icons | Velt default bare ✓ and ⋯ | `<ResolveIcon/>` (circled check) + `<KebabIcon/>`, gated `VeltIf {i}===0` (root only) | **RC-A** |
| 8 | Options dropdown | Left `Options.Content` **empty** → Velt's 4 items (Assign/Mark-unread/Edit/Delete) | Explicit `Options.Content.Edit` + `CopyLink` + `Options.Content.Delete` sub-slots with icons → exactly **Edit / Copy link / Delete (red)** | **RC-A** (the sub-slots exist; I didn't know/use them) |
| 9 | Toggle-reply structure | Used `ToggleReply` alone, no overflow structure | **Host sets `collapsedComments` + `collapsedRepliesPreview`** → SDK produces collapsed replies → styled via the **`MoreReply`** wireframe ("Show N replies…") | **RC-B** (prop layer skipped) |
| 10 | Resolved toast | Missing | Velt resolve toast (styled) | **RC-C** (never resolved a comment) |
| 11 | Tooltip | Missing | hover tooltip handling | **RC-C** |
| 12 | User/mention dropdown | Velt default rows | `.velt-autocomplete-panel` styled (185px, r12, 14px rows) | **RC-A**/**RC-D** |
| 13 | Input expanded + enabled submit | Missing / wrong | expanded composer + send `:not([disabled])` dark state | **RC-A** + **RC-C** |
| 14 | Empty placeholder | Left default ("No comments to display / Clear filters") | Custom `<EmptyIllustration/>` + `VeltIf {noCommentsFound}` → "Be the first to comment" vs "No comments match your filters" | **RC-A** + **RC-C** |
| 15 | Resolved dialog UI | Missing | resolved state: `#f7f6f4` bg, muted text, no reply, reopen icon | **RC-C** |
| 16 | Mention chip | Velt default purple chip | `.velt-mention` / `mark.velt-autocomplete--contact-chip` → teal `#227277` text | **RC-A**/**RC-D** |

---

## 2. The systemic root causes (the actual answer)

These five explain all 16. They are general, not per-item.

### RC-D — The Judge accepted "looks close" as "matched." *(the core failure)*
I compared layout/shape at low fidelity and passed on coarse similarity. A real glyph/pixel comparison would have flagged: wrong filter icon (1), wrong send glyph (3), missing avatar ring (6), bare vs circled resolve icon (7), purple vs teal mention (16), wrong menu items (8), wrong filter labels (2). **Every one of these is visible at a glance when you put the two images side by side — which means the Judge never actually did that at the required fidelity.** This is the same "90% match when nothing matched" failure from the first run. The visual-first Judge rewrite was not enough: "screenshot-or-BLOCKED" still passed on *similarity* instead of failing on any *nameable difference*.

### RC-A — I styled Velt's defaults instead of *supplying the design's content.*
The wireframe contract is "you provide the markup; Velt provides behavior/data." I treated it as "CSS over whatever Velt renders." So I left empty: the filter Trigger (→ default icon), the filter labels (→ default text), `Options.Content` (→ default 4 items), and used zero custom icons. **The reference supplies a child into almost every slot** — custom icons, custom labels, explicit menu sub-slots (`Options.Content.Edit`/`.Delete`, `CopyLink`). I didn't even discover that those item sub-slots exist. This is also a straight **R17 violation** (use the design's exported SVGs; I used Velt defaults).

### RC-B — I skipped the prop/config layer entirely (the feasibility ladder).
The methodology is **default → prop → wireframe → primitive → headless**, and the planner is supposed to *read the host's Velt props as design intent*. I jumped straight to wireframe+CSS. The threaded/overflow structure (item 9) is **produced by `collapsedComments` + `collapsedRepliesPreview` on `VeltComments`** — a prop decision — and only then styled via `MoreReply`. No amount of CSS on `ToggleReply` could ever produce it. I also never set `commentPlaceholder`/`replyPlaceholder`/`defaultMinimalFilter`/`sortBy`/`visibilityOptions`/`shadowDom={false}`. **I treated a prop-and-wireframe problem as a CSS problem.**

### RC-C — I declared "matched" without driving the states.
Empty, resolved, toast, tooltip, collapsed-overflow, expanded composer, rendered mention — none were driven. I listed them as "remaining" while simultaneously calling the surface matched. **"The happy-path screenshot looks similar" is not "the surface matches."** A surface isn't done until every state in the Step-1 overview has been driven and judged.

### RC-E — I never looked for / used the reference, and stopped early.
The design is a 1:1 port of an existing `harvey-wireframes` reference; a known-good `velt-harvey-demo` exists. My run rebuilt by inspect-and-guess and stopped at ~6 patches, framing a small fraction as near-done — against the user's explicit "full pixel-perfect, all states." There was no step to detect "this design corresponds to a canonical implementation," and no internal bar that said "248 lines / 2 components / 0 icons cannot possibly be a full match of this design."

---

## 3. Where the gap lives in the plugin (identification only — not fixed here)

- **Judge (biggest):** still passes on visual *similarity*. It needs to (a) place live render and Figma frame at the same scale **side by side**, (b) compare **per element: exact glyph, color hex, size, ring/border, label text, menu item set**, and (c) **default to FAIL on any nameable difference** — "I can name a difference" must equal "not matched." Numbers/structure-present must never produce a pass.
- **Planner / feasibility ladder:** must force the **prop pass first** — enumerate and set the `VeltComments`/`VeltCommentsSidebar` props the design implies (`collapsedComments`, `collapsedRepliesPreview`, placeholders, `defaultMinimalFilter`, `sortBy/Order`, `visibilityOptions`, `shadowDom={false}`) **before** writing CSS. Structure that comes from a prop must never be attempted in CSS.
- **Builder / wireframe principle:** must **supply a child into every slot** (icon, label, menu item) from the design's own SVGs (R17) rather than leaving Velt defaults; and must know the slot sub-children exist (`Options.Content.Edit/.Delete`, `CopyLink`, `MoreReply`, `Skeleton`, `EmptyPlaceholder` + `VeltIf`).
- **Completion bar:** "matched" must require **every state driven** (skeleton, empty, collapsed/overflow, resolved, expanded composer, toast, mention, tooltip), not the default list only. A coarse size check ("248 vs ~1400 lines; 0 vs 10 icons") is a cheap pre-flight smell that the build is nowhere near done.
- **Reference awareness:** no mechanism to recognize a design maps to a canonical Velt implementation and lean on it.

---

## 4. One-line conclusion

The plugin's *flow* worked (preflight → plan → gate → build), and the *guide knowledge* it used was correct as far as it went — but it **stopped at "looks close" because the Judge let it**, **never set the props that produce the right structure**, and **styled Velt's defaults instead of supplying the design's own icons/labels/menu items**. The fix is not 16 patches; it is a Judge that fails on any nameable difference, a mandatory prop-first pass, and a "supply every slot" builder rule — then the loop produces the reference, not a coarse approximation.
