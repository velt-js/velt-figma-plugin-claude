# Implementation plan — block-by-block, Figma-complete build loop

**Date:** 2026-06-26
**Supersedes the loop mechanics of:** the Extract→Map→Measure redesign (kept) — this replaces *how the build loop is structured and terminated*.
**Driving evidence:** `PLUGIN-RUN-GAP-ANALYSIS.md` (M1–M5), the 2026-06-26 harvey-playground run forensics (no persisted gate artifacts; `/loop`+`/goal` never set; probe ran but surface still broken), and the golden vs plugin diff (`velt-harvey-demo`: 3 components / 241 selectors / all states vs plugin 2 / 85 / happy-path-only).

---

## 0. The one rule this plan enforces

**The Figma design is the completeness oracle. Every frame, item, and state drawn in Figma must exist in the build and match it. Anything not in Figma is out of scope.**

Two consequences:
1. **Completeness is machine-enumerable** — the Figma frame tree *is* the checklist. "Stopped at the happy path" becomes structurally impossible because the unbuilt frames are unaccounted blocks → the gate returns INCOMPLETE.
2. **The golden's host-behavior extras are explicitly out of scope** (Cancel `veltButtonClick` wiring, the `C` shortcut, the visibility banner) — they are not in the Figma design. We match Figma, not the golden.

## 0a. Confirmed decisions (user, 2026-06-26)

1. **The run may create/resolve test comments** in the target app to reach states for screenshots. ✅
2. **The Figma file has separate state-variant frames** (expanded / hover / resolved / menus) — block enumeration can rely on real frames. ✅
3. **Seeding = programmatic-first, UI-drive fallback.** Default is driving the UI like a user (type, click resolve). But the plugin should **first consult the Velt docs / Velt Docs MCP** (https://velt.dev/docs/get-started/overview, https://velt.dev/docs/get-started/plugins) for a programmatic add/resolve-comment API; if one exists, prefer it (faster, deterministic), else fall back to UI driving.
4. **Scratch artifacts go in a git-ignored `.velt-customize/` folder inside the target repo.** Only `components/velt/ui-customization/` is written as product code.

## 0b. Phase 1 executed (2026-06-26) — block list + alignment de-risked

Ran against the live Figma file (`WYAWuEm8DrIkAyx03e8fG9`, node `1:3398`) and the live app on `:3000`.

**Block list is real — 16 explicit state frames**, each a 354×832 sidebar mockup with a naming TEXT label:
`Empty state · Input focused · @ mentions · Input filled · Comment left (default) · Hover state · Threaded comment input · Threaded comment left · Additional comments · Overflow threaded comments · Filter dropdown · Overflow menu · Resolved toast · Link copied success · Resolved comments filter · Resolved comments`. The last run built ~5 of these and stopped — quantifies the "happy-path then stop" failure. `enumerate-blocks.mjs` maps frame→label by proximity (validated: 16/16 matched).

**The alignment problem is solved — mostly structurally:**
1. **Geometry is solved by construction.** Every Figma frame is authored at **354px wide = the live `.hw-rail-inner` width exactly** (verified live: `hw-rail-inner` = 354px, `devicePixelRatio` = 2). Export the frame at @2x (→708px) and capture the sidebar at DPR 2 (→708px); they align 1:1 with **no scaling heuristics**. The earlier "off by 1px" width note confirms the same.
2. **The diff engine works** (`visual-diff.mjs` prototype, `pixelmatch` + region clustering): identity → **0.000% / 0 px**; `comment-left` vs `hover` → **0.032%, localized to 2 CSS bounding boxes** — the resolve+kebab actions (`276,132 48×24`) and the timestamp (`144,132 36×24`). The diff mask pinpointed *exactly* the "hover actions missing" bug class. **Region output ("what/where differs") is the capability the Judge lacked.**
3. **Two-tool division validated by accident:** the hover card's **bg tint** (`#fff`→`#f7f6f4`) fell *below* the perceptual threshold and wasn't flagged → confirms **`delta-compare` must stay the source of truth for exact color** (measures `background-color` directly) while **visual-diff catches structure** (the appearing actions) it's blind to. Lenient threshold (absorbs font AA) is safe *because* color is delta-compare's job.
4. **Content-matched regions need no seeding:** the header ("Comments") and composer placeholder ("Comment or tag others with @") are identical between design and live → those regions can be diffed directly; only the data-bearing card region needs §6 seeding.

**Frame-vs-LIVE measured end-to-end (the real test, not frame-vs-frame).** Captured a clean **708px device-res PNG** of the live sidebar (Playwright `element.screenshot()` at `deviceScaleFactor: 2`) and diffed against the `comment-left` frame:

| Region | Raw pixel diff | After masking text |
|---|---|---|
| Header + filter icon | **4.3%** | — |
| Composer chrome (border, avatar, send btn, icon) | 4–6% | **0.000% / 0 px** |

**The finding:** the chrome (borders, icons, avatars, layout, spacing) aligns **pixel-perfectly (0%)** — the 354px width-match delivers exact geometric alignment. The entire 3–5% residual is **text**: Figma's and Chrome's text renderers place glyphs a few sub-pixels apart, so text rows drift. This is **positional, not chromatic** — raising the pixelmatch color threshold (0.1→0.5) barely moved it (4.3%→2.4%), but **masking the text boxes dropped it to 0%.**

**Resolution (updates §6):** a raw pixel diff **cannot be a tight gate on text** (~4% irreducible floor), but it is **perfect on chrome**. So the architecture is now empirically pinned:
- **`visual-diff` runs with text regions masked** (their boxes come from `designSpec` deterministically) → catches missing/extra/misplaced elements, wrong icons, wrong borders/fills/layout at a **~0% floor**, so even a small real structural diff stands out (the hover-actions experiment proved the localization).
- **`delta-compare` owns everything text/color/size** — it reads `getComputedStyle`/`getBoundingClientRect`, which are **immune to font rendering**, so text fidelity is measured exactly there, not in pixels.
- **Capture must be a device-res PNG element screenshot** (Playwright/CDP at DPR 2), **not** the Chrome MCP `computer` screenshot (that returns a ~1× lossy JPEG). This is a concrete Phase-2 requirement.

The alignment risk (§13) is now **closed**: geometry solved by the width-match, text noise solved by masking + delegating text exactness to delta-compare, capture solved by a device-res element screenshot.

## 0c. Phase 1+2 BUILT (2026-06-26) — three working scripts, zero npm deps

All validated end-to-end against the real Figma file + the live app on `:3000`. Repo gates (`check-guide`, `validate`) still pass.

| Script | Does | Validated |
|---|---|---|
| `scripts/enumerate-blocks.mjs` | Figma REST → `blocks.json` (the completeness oracle) + exports each frame PNG. Maps every ~354px state frame to its label, classifies the state, emits drive/assert defaults. | **16/16 blocks** from node `1:3398`, frames exported. |
| `scripts/visual-diff.mjs` | Pure-node (zlib PNG codec + inlined YIQ delta) chrome diff: decode → mask text → diff → cluster regions with `changed`/`fill` density. | identity=0; `comment-left`↔`hover` localizes the resolve+kebab+timestamp boxes; decodes real Figma+Playwright PNGs. |
| `scripts/capture-block.mjs` | Reference capture adapter — Playwright (dynamic import, keeps repo dep-free) device-res element PNG at DPR 2; selects a harness user, opens the sidebar, runs the block's drive JS, asserts the state. | captured a clean **708px** live PNG; full `enumerate → capture → visual-diff` chain runs. **`--assert` is required** — without it the capture fires before comments load (blank). |
| `scripts/verdict-gate-blocks.mjs` | The MECHANICAL terminator — `blocks.json` + `block-report.json` → PASS / FAIL / INCOMPLETE by **exit code** (0/2/3). A run that built 5 of 16 blocks → INCOMPLETE (can't terminate): the structural M5 fix. | PASS→0, one real region→FAIL→2, 5-of-16→INCOMPLETE→3, all verified against the real `blocks.json`. |

**Phase 3 item 1 done — designSpec text-masking wired:** `visual-diff.mjs` now takes `--mask-text-from <designSpec.json>` (`textMasksFromSpec`: every `text` node's box × scale, dilated by `--mask-pad`). Validated: 8 exact masks derived from the real comment-left designSpec, applied automatically. Refinement noted: also mask avatar/icon *element* boxes (text mask covers the glyph, not the avatar circle).

**Operating characteristics learned (tuning, not feasibility):**
- Chrome aligns to ~0% via the 354px width-match. Text has a ~3–5% *positional* floor → **mask text boxes** (from designSpec / live DOM) and let `delta-compare` own text exactness.
- After masking, the residual is **1px element drift** (e.g. the composer border = a thin outline, `fill≈0.04`) vs **real diffs** (send-button glyph, filter icon, missing hover actions = compact, `fill≈0.09–0.11`). A **`--min-fill ~0.05`** filter separates drift from real structure; exact position stays `delta-compare`'s job (±2-3px). So visual-diff is a **gross-structure detector feeding localized regions**, not a sub-pixel gate — exactly the two-tool split.

**Phase 3 item 2 (fixture seeding) — INVESTIGATED; needs a host-integration decision (2026-06-26).** Probed the live app to seed a fresh single-comment doc. Findings:
- **Velt programmatic API:** `commentElement.addManualComment({context, location})` exists but creates an *empty* annotation (no text); the text-carrying path is the REST `POST api.velt.dev/v2/commentannotations/add` (needs the backend API key). `window.Velt.setDocument(id)` / `setDocuments(...)` switch documents.
- **Two walls hit with offline Playwright puppeteering (4 attempts):** (1) harvey-playground's `VeltInitializeDocument` **re-asserts `harvey-doc-7` through React**, so an externally-set fresh doc doesn't stick (old comments always reappear; overriding `window.Velt.setDocuments` to no-op didn't stop it); (2) the page-mode **composer submit isn't reliably triggerable from outside** — the text registers (send button goes active/dark) but the send-button `.click()` doesn't submit (shadow-DOM composer + a 0-size registry-template duplicate of the send button intercepts).
- **DECISION (user, 2026-06-26): (C) the runtime Judge seeds in-app.** Seeding is NOT an offline script — the Judge seeds at runtime inside the live app session (Chrome MCP), within whatever document the app loaded. This sidesteps both walls: (1) no doc-race (it never sets the document — it uses the app's), and (2) it clicks the **real rendered** composer + send button by screen coordinate (avoiding the 0-size registry-template duplicate that intercepted the offline click).
- **Validated in-app seeding recipe (the working knowledge for the Judge prompt):** the composer is in a **shadow DOM** — selectors must pierce it; type into `.hw-rail-inner [contenteditable='true']` (real keystrokes register — the send button goes active/dark); **click the VISIBLE send button by its on-screen box** (not a class selector — there's a 0-size template twin), or press Enter; then **wait for the thread card to render** (the block's `drive.assert`) before capturing. The block's `fixture` (canonical content from the frame) says *what* to seed; the Judge executes it. `capture-block.mjs --eval` is the offline test hook for the same drive JS.
**Item 4 DONE (2026-06-26) — agents/brief/guide/command rewired to the block loop.** Edits (gates green: check-guide + validate + golden + plugin validate):
- **velt-planner** → step 2b runs `enumerate-blocks.mjs`, annotates each block's `drive`/`fixture`/`assert`/`liveSelector`.
- **velt-builder** → block-by-block framing; retries address `visual-diff` regions + `delta-compare` rows.
- **velt-judge** → the per-block pipeline replaces the eyeball side-by-side: seed+drive in-app → `capture-block` → `visual-diff --mask-text-from` (region `fill≥0.05` ⇒ FAIL) → `delta-compare`+`LAYER_PROBE`+`CONTRACT_PROBE` → `block-report.json`; verdict by `verdict-gate-blocks.mjs` exit code.
- **velt-orchestrator** → owns the block queue (`owned-loop` now PRIMARY); Sequence 2 enumerates blocks, Sequence 5 iterates one block to PASS before advancing, Sequence 6 terminates on `verdict-gate-blocks` exit 0; `/goal` dependency removed throughout.
- **operating brief + build-methodology.md** → flow + the per-block micro-loop rewritten.
- **command** → orchestrator owns the loop in owned-loop mode; `/loop` optional cadence; `/goal` terminator gone.

**Redesign substrate COMPLETE.** Remaining = the live acceptance run (§12).

## 0d. Targeted E2E run (2026-06-26) — 3 blocks driven live (composer-default/expanded + options-menu)

Exercised the pipeline (drive → capture → visual-diff) against the live app on 3 blocks. **Core pipeline works against reality:**
- **State driving via the recipe WORKS with no comment-submission seeding** — composer-expanded reached by focus+type; options-menu by hover+click. The seeding wall (doc-race/submit) is avoided entirely for *interaction-driven* states (only data-dependent states like overflow/resolved need real seeding).
- **The pipeline catches the real bug** — composer-expanded correctly **FAILs** (diffPct 4.3%, regions at the composer body + the lower `60,192`/`84,228` area where the design's **Cancel + send row** belongs). The build genuinely lacks the Cancel/actions row (the user's "no expanded state" complaint), and visual-diff localizes it. Also flagged the composer mention rendering **purple** (Velt default) vs **teal** (design).
- **Popover capture WORKS — the predicted gap does NOT bite.** The options menu renders in a portal *outside* `.hw-rail-inner` (`.cdk-overlay-pane`/`.snippyly-menu`), BUT Playwright's element-clip `screenshot()` captures anything overlapping the element's box, so the menu IS in the capture. Toast/tooltip (positioned away from the sidebar) may still need a viewport capture — to check.

**Concrete refinements surfaced (the next gaps):**
1. **Per-block region scoping — DONE (2026-06-26).** `enumerate-blocks` now assigns a per-state `liveSelector` (composer→`.hw-panel-composer`, card→`velt-comment-dialog-internal`, header/filter→`.hw-panel-header`, toast/tooltip→their elements) + a `frameRegion` slot the Planner fills (the defining element's box from designSpec). `visual-diff` gained `--crop-ref` + `--crop-live` to scope both images to that region. **Validated:** composer-default scoped to its region drops the comment-below pollution — the composer border aligns (0 red), only the avatar circle (separate avatar-mask gap) + send glyph remain; the polluting card region is gone. Judge + Planner docs updated to crop the diff to `frameRegion`. (Caveat: the live composer wrapper `.hw-panel-composer` is a 0-size template, so for top-anchored blocks the Judge captures the rail + crops both to the region rather than capturing the sub-element.)
2. **State cleanup between blocks — DONE (2026-06-26).** `capture-block.mjs` now resets state before its `--eval` drive (Escape to close menus + collapse composer, clear composer text, blur); the Judge prompt mirrors it. So a prior block's open menu / typed composer no longer leaks into the next capture.
3. **Avatar-element masking — DONE (2026-06-26).** `textMasksFromSpec` now also masks nodes named `Avatar`/`Profile picture` (the user avatar = content), not just text — while leaving chrome icons (`iconButton`/`Icon`/`Vector`) unmasked so the diff still verifies them. **Validated:** composer-default scoped + avatar-masked dropped from 3 noisy regions to **0.038% / 1 region** (just the send-arrow glyph — a genuine small diff for the Builder, not noise). The diff signal is now precise.
4. **Size-mismatch is a correct (if noisy) FAIL** — when the live element is a different size than the frame element (composer taller, no Cancel), the whole-box outline lights up; delta-compare's box check (±2-3px) is the clean signal, visual-diff corroborates.

**Status: fixes #1 (region scoping), #b (state reset), #c (avatar mask) all DONE + validated.**

## 0e. FULL 16-block E2E (2026-06-26) — the redesign is PROVEN end-to-end

Drove all 16 block states live (focus/type/hover/click/resolve/filter), captured scoped + masked, diffed each vs its frame, assembled `block-report.json`, ran the gate.

**Headline: `verdict-gate-blocks` → exit 3 (INCOMPLETE) — the pipeline REFUSED to pass the broken build.** The exact opposite of the original failure (eyeball Judge passed it after 2 iters). The structural fix works mechanically.

| outcome | n | notes |
|---|---|---|
| FAIL (localized regions) | 10 | composer states flag the missing Cancel (`input-filled` region fill **0.609**) + mention-colour + layout; cards flag real diffs |
| "clean" | 3 | **suspect false-cleans** — high diffPct (3.2–3.6%) but 0 *compact* regions; likely the drive didn't fully reach the state (resolve/copy-link tooltip) or content-mismatch spread the diff |
| BLOCKED | 2 | `empty-state` (needs an empty doc), `overflow-threaded` (needs many replies) — honest, correct |
| error | 1 | `hover-state` diff errored (a card-capture edge case) |

**Honest caveats (the remaining work for a CLEAN run, not feasibility):**
- **Diff numbers are noisy because the live doc (`harvey-doc-7`) content ≠ the frames** (5 live comments vs the frame's 1, at different positions). The composer/header blocks (content-independent) are clean; card blocks need **content-matched seeding** to get crisp numbers — the (d) gap. State *driving* works; matching *content* is the residual.
- A few **false-cleans** (3.6% diffPct + 0 regions) need scrutiny — a clean verdict with high diffPct means the drive likely didn't reach the state. The Judge must trust `drive.assert`, not just "no compact region".
- `hover-state` card-capture diff error — a bug to fix.
- The block-report here used visual-diff alone; the real Judge also runs `delta-compare` (exact numbers) which would catch the composer's sub-element diffs deterministically.

**Bottom line: the system runs end-to-end on all 16 blocks and mechanically returns INCOMPLETE on the incomplete build — the original "stopped early + passed a broken surface" failure is structurally prevented.** Remaining polish: content-matched seeding for card blocks (clean numbers), the hover-state diff bug, and the false-clean assert-trust.

## 1. The core change: unit of work = a Figma *block*, perfected before advancing

Today the loop builds the **whole surface** in one shallow pass; the happy path "looks close"; the loop self-terminates (M5). The new loop's unit is a **block** — one Figma frame or state-variant — and a block is *finished to a true match before the next block starts*.

```
enumerate blocks from Figma  →  blocks.json  (reviewed once at the coverage gate)
for each block, in order (dialog/composer first):
    ┌─ build the block      (markup + props + scoped CSS, from the block's spec)
    │  drive the block      (reach its state in the live app: hover / expand / open / resolve)
    │  seed fixture         (so live content == the frame's content — see §6)
    │  measure the block    (delta-compare scoped to the block root  +  visual-diff vs frame)
    │  iterate              (feed diff regions + delta rows back; diff% must strictly drop)
    └─ until: visual-diff clean ∧ per-element deltas empty ∧ contract ok  → block PASS
    advance only on PASS (or BLOCKED/verified-gap)
terminate only when EVERY block in blocks.json is PASS   (verdict-gate, exit code)
```

No moving on with a half-done block. No all-at-once.

## 2. Why this fixes the observed failures

| Observed | Cause | Fixed by |
|---|---|---|
| Loop stopped after 2 iterations | `/loop`+`/goal` never set; agent self-stopped on a sampled pass | Harness-owned loop + verdict-gate **exit code** over `blocks.json`; no `/goal` opinion (§9) |
| No expanded composer / hover / scroll | states never built or driven; probe blind to state/gestalt | each is its **own block** with a driven screenshot + visual-diff; can't terminate while unbuilt (§1, §5) |
| Filter rendered as a box, name on wrong row | wrong-layer styling / spatial relations unmeasured | per-block **visual-diff** localizes the region; delta-compare relations scoped to the block |
| Judge "passed" a broken surface | gate read the Judge's self-authored JSON | harness persists probe + diff outputs itself; gate reads **files**, not claims (§4) |

## 3. Run directory & persisted artifacts (the audit trail that was missing)

Everything is written to a **gitignored run directory** outside committed code (never violates R18 scope):

```
<target-repo>/.velt-customize/run-<id>/        # gitignored; or OS scratch if repo write is undesired
  designSpec.json            # figma-extract (existing)
  blocks.json                # NEW — the block list = completeness oracle
  frames/<blockId>.png       # exported Figma frame per block (reference image)
  shots/<blockId>.png        # latest live screenshot per block
  diffs/<blockId>.png        # visual-diff mask per block
  block-report.json          # NEW — per-block disposition (build/drive/diff/delta/contract)
  journal.jsonl              # append-only run journal (per-block iteration events)
  verdict.json               # verdict-gate output
```

**Rule:** if an artifact isn't on disk, the step did not happen. The gate reads these files; the Judge never hand-authors the numbers. (This is the structural fix for the run that left *zero* artifacts.)

## 4. `blocks.json` — the contract

```jsonc
{
  "source": "figma:WYAWuEm8DrIkAyx03e8fG9",
  "blocks": [
    {
      "id": "composer-expanded",
      "name": "Composer / Expanded",
      "figmaNodeId": "1:4496",
      "framePng": "frames/composer-expanded.png",
      "surface": "sidebar",            // sidebar | dialog | popup
      "state": "expanded",             // default | hover | expanded | resolved | menu-open | autocomplete | empty | overflow
      "drive": {                       // how the Judge reaches this state (LLM-annotated, deterministic where possible)
        "steps": ["focus .velt-composer-input--message", "type 'Make sure to update the NDA'"],
        "assert": ".velt-composer-open"   // DOM proof the state is active (else the shot is the wrong state)
      },
      "liveSelector": ".hw-composer",  // block root → all measurement is block-relative
      "fixture": { "comments": [ /* canonical content from the frame — §6 */ ] },
      "elements": [ /* designSpec nodes scoped to this frame: cssDecls + box */ ],
      "mustSupply": [ /* slots in this block */ ],
      "contractParts": [ /* mount-map parts in this block */ ],
      "order": 2
    }
  ]
}
```

Enumeration is **hybrid**: a deterministic Figma frame-tree walk produces the block skeletons (id, node, frame export, scoped elements); the **planner (LLM) annotates** `state` / `drive` / `liveSelector` / `fixture` from the frame name + content. The full list is shown at the **one coverage gate** for the user to confirm/trim before it's frozen.

## 5. New & changed scripts

### NEW `scripts/enumerate-blocks.mjs`
- **In:** `designSpec.json` + Figma metadata (frame tree) + manifest.
- **Out:** `blocks.json` skeletons — one block per top-level frame and per state-variant frame (detected from frame-name taxonomy: `.../Default`, `.../Hover`, `.../Expanded`, `.../Resolved`, `.../Menu open`). Scopes each `designSpec` node to the frame that contains it.
- Replaces `build-checklist.mjs` as the top-level unit (checklist elements become *block* elements). `build-checklist`'s "distinct styled appearance" logic is reused **inside** a block.

### NEW `scripts/visual-diff.mjs`  (wraps `odiff` / `pixelmatch`)
- **In:** `frames/<id>.png`, `shots/<id>.png`, optional `{alignBox, maskRegions, mode:"perceptual", tol}`.
- **Out:** `{ diffPct, changedPixels, regions:[{x,y,w,h}], maskPath }`.
- **Perceptual mode** (tolerate font AA / subpixel). `regions` localize *what* differs → fed back to the Builder as "top-right region differs". `maskRegions` blanks inherently-dynamic bits (relative timestamps). See §6 for why this needs content-seeding to be meaningful.

### NEW (or guide-level) fixture seeding — `scripts/seed-plan.mjs` + Judge drive
- Derives canonical content from each frame (author names, message text, reply counts) so the **live render carries the same content as the frame** — otherwise a pixel diff just measures "real data ≠ mock data" (§6). Emitted into `blocks[].fixture`.
- **Seeding mechanism (decision #3): programmatic-first, UI-drive fallback.** The Judge first checks the **Velt docs / Velt Docs MCP** for a programmatic add/resolve-comment API (the SDK exposes comment-creation methods; confirm the current ones against the docs rather than guessing). If available → seed deterministically through the API. If not → drive the UI like a user (focus composer, type the text, submit; click resolve). Either way the result is asserted in the DOM before the screenshot.

### CHANGED `scripts/delta-compare.mjs`
- Already takes a `surfaceSelector`; we pass the **block's `liveSelector`** so every probe (`BROWSER_PROBE`, `LAYER_PROBE`, `CONTRACT_PROBE`) is block-scoped. No engine rewrite — the probes already return `{verdict, diffs}`; the harness now **persists that return value to `block-report.json` itself** (Judge no longer transcribes).

### CHANGED `scripts/verdict-gate.mjs` → block-level
- PASS iff **every block** in `blocks.json` has, in `block-report.json`: `built ∧ driven(assert matched) ∧ visualDiff.diffPct ≤ tol ∧ deltas==[] ∧ reconciliation.ok ∧ contract.ok`.
- Any block missing / not driven / no `shots/<id>.png` / no `diffs/<id>.png` ⇒ **INCOMPLETE** (cannot terminate). Measured-but-wrong ⇒ FAIL. The Figma-derived block list makes "happy-path only" return INCOMPLETE automatically.

## 6. The hard part — making screenshot-diff actually meaningful

A naive Figma-frame-vs-live pixel diff is **dominated by content noise**: the frame shows "Wilson Jones · 1m · Make sure to update the NDA"; the live app shows "Me · 17h · asdsad". The diff would scream even when styling is perfect. Three mitigations, in order of leverage:

1. **Seed the design's content (primary).** Before screenshotting a block, seed the live app with the frame's canonical data (author = "Wilson Jones" with initial "W", the exact message text, the exact reply count for "Show 13 replies"). Now frame and live share content; the diff measures *style/layout*, which is what we want. Seeding also *is* the state-driver for data-dependent states (overflow needs N replies; resolved needs a resolved comment).
2. **Mask ALL text regions, not just dynamic ones (empirically required — see §0b).** Figma vs Chrome glyph positioning gives text a ~3–5% irreducible, *positional* noise floor that thresholds can't remove; chrome (borders/icons/avatars/layout) diffs at **0%**. So `visual-diff` blanks every text element's box (boxes come from `designSpec`) and compares **chrome only**. Text fidelity is not measured in pixels at all — it's measured exactly by `delta-compare` (`getComputedStyle`, font-render-immune).
3. **Device-res PNG capture.** Capture the block as a PNG element-screenshot at DPR 2 (Playwright/CDP), not the MCP `computer` JPEG. The 354px width-match then makes chrome alignment exact.

**Division of labor (this is the key design principle):**
- **`delta-compare.mjs` (deterministic) stays the source of truth for exact numbers** on *known selectors* — color ΔE, ±1px, spacing, box, relations.
- **`visual-diff.mjs` covers what delta-compare is blind to** — *missing/extra/misplaced* elements, *whole-block gestalt*, and *region localization*. It is the mechanical replacement for the "mandatory visual side-by-side" the Judge kept skipping.
- A block PASSes only when **both** are clean. Neither replaces the other.

## 7. Agent responsibility changes

- **`agents/velt-planner.md`** — additionally **enumerates blocks** (runs `enumerate-blocks.mjs`, annotates `state`/`drive`/`liveSelector`/`fixture`). Output reviewed at the coverage gate.
- **`agents/velt-builder.md`** — works on **exactly one block**. Builds/styles only that block's elements; receives prior `visualDiff.regions` + `delta` rows as feedback. Forbidden from touching other blocks' CSS. Any "UNVERIFIED / can't / not built" admission ⇒ it must escalate, **not** ship a guess (the run's CSS comments showed silent guesses passing).
- **`agents/velt-judge.md`** — per block: seed fixture → drive state (`drive.steps`, assert `drive.assert`) → screenshot to `shots/<id>.png` → run `visual-diff` + scoped `delta-compare` → write `block-report.json[id]`. Fails on any diff. Never decides termination.
- **`agents/velt-orchestrator.md`** — owns the **block queue** + the **per-block iteration loop** + stuck-detection (diff% must strictly drop). Advances only on block PASS. Runs `verdict-gate` over `blocks.json`; terminates on all-PASS via exit code.

## 8. Command, brief, guide changes

- **`commands/velt-customize.md`** — drop the hard dependency on native `/loop`+`/goal` (they were never set and are unreliable). The orchestrator owns the loop (the former "owned-loop") as the **primary** path; `/loop` becomes an optional cadence wrapper only. Termination is the verdict-gate exit code.
- **`skills/velt-operating-brief/SKILL.md`** — the flow section is rewritten around blocks: *enumerate blocks → gate → per-block perfect-before-advance → all-blocks gate*. Keep the guardrails (R18 scope, one user question, never invent identifiers).
- **`guide/build-methodology.md`** — Step 2 becomes the per-block micro-loop verbatim. Add the visual-diff + fixture-seeding subsections.

## 9. Termination & control flow

- **Harness-owned, exit-code-gated.** The orchestrator persists block state in `journal.jsonl`; after each block iteration it runs `verdict-gate.mjs`; the run ends only when the gate exits 0 (all blocks PASS) or every remaining block is BLOCKED/verified-gap.
- **Per-block budget + stuck-detection:** accept an iteration only if `visualDiff.diffPct` (or `failingDiffCount`) strictly drops; abort a block to escalation/gap on no-progress/oscillation (reuse the existing stuck signals).
- **No agent self-declares done.** "Looks close" is not terminal.

## 10. Dependencies

- `odiff-bin` (preferred — fast native, perceptual mode) **or** `pixelmatch` + `pngjs` (pure JS, zero native). Pick `odiff-bin`; fall back to `pixelmatch` if install is a problem.
- **Not Chromatic** — it regresses Storybook component snapshots across commits, needs Storybook + an account + cloud upload, and does not compare live-render vs Figma-frame. Wrong tool for design-vs-live. The local diff is free, deterministic, in-harness.

## 11. Phasing (each phase shippable + gated by `check-guide` / `validate` / golden)

1. **Block enumeration** — `enumerate-blocks.mjs` + `blocks.json` schema + planner annotation + coverage-gate review of the block list.
2. **Visual diff** — `visual-diff.mjs` (odiff) + alignment/crop + masking + the fixture-seeding step; offline golden fixtures (a known-good and known-bad block pair) prove the diff catches real differences.
3. **Loop rewire** — orchestrator block queue + per-block micro-loop + `verdict-gate` over blocks + exit-code termination; drop `/goal` dependency.
4. **Agent rewrites** — builder/judge/planner/orchestrator prompts to the per-block contract; persist probe/diff outputs from the harness, not the agent.
5. **Brief/guide + E2E** — operating brief + `build-methodology.md`; run the full E2E on harvey-playground as acceptance.

## 12. Acceptance test (the bar)

Re-run on `harvey-playground` (Figma `WYAWuEm8DrIkAyx03e8fG9`). The run **cannot terminate** until every enumerated Figma block is PASS, including the exact items from the screenshots:

- `composer-default`, **`composer-expanded`** (the missing one), `composer-focus`
- `thread-card-default`, **`thread-card-hover`** (actions revealed — driven + diffed), `thread-card-resolved`
- `filter-menu-open` (renders as the design's menu, **not** a 210px box)
- `options-menu-open` (Edit / Copy link / Delete)
- `mention-autocomplete`, `empty-state`, **`sidebar-list-overflow`** (proves the list scrolls — driven with N>viewport comments)

Each block: live screenshot present, state-assert matched, `visualDiff.diffPct ≤ tol`, delta rows empty. A block that can't be made to match after the budget is reported as a **verified gap with evidence**, never silently dropped.

## 13. Risks / open questions

- *(Resolved — see §0b)* **Frame↔live alignment is CLOSED, measured end-to-end.** Chrome aligns at **0%** (354px width-match); text has a ~4% positional floor handled by **masking text + delegating text exactness to delta-compare**; capture must be a **device-res PNG element screenshot** (Playwright/CDP at DPR 2), not the MCP JPEG. Remaining work is integration (mask boxes from designSpec, wire the capture), not feasibility.
- *(Resolved — see §0a)* State frames exist ✅ · test comments allowed ✅ · seeding = programmatic-first via Velt docs/MCP, UI-drive fallback ✅ · scratch in git-ignored `.velt-customize/` in the target repo ✅.
- **Remaining open:** vertical drift across a *whole-sidebar* diff (elements at slightly different y) means visual-diff must run **per element/region aligned to each element's own box**, not one top-aligned whole-surface compare. Already implied by the block model; make it explicit in Phase 2.
```
