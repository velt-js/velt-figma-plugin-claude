# Build gotchas — the traps you WILL hit (and the fix)

Discovered the hard way building a real customization. Each cost a cycle; knowing them saves you the cycle.

## Inspecting
- **Inspect the LIVE rendered node, not the registry template.** A wireframe is cloned: the `velt-*-wireframe` custom-element tags are the hidden registry copy (0-size, empty). `document.querySelector('.hw-x')` may hit that copy. Always pick the element with `getBoundingClientRect().width > 0` (the visible clone) and read *its* classes/computed styles. Measuring the wrong node is how you "verify" something that's actually broken.

## Wireframe clone behavior
- **Some slots OVERWRITE their inner markup with their own label.** `ToggleReply` replaced custom `<svg/> + <span>Reply</span>` with a plain "Reply" text node; `CopyLink` did the same. **Fix:** don't nest icons in those slots — inject the icon via CSS `::before` (a data-URI SVG on your `.hw-*` class), which survives the clone.
- **Adding a NEW wireframe to the registry needs a FULL page reload to register.** CSS edits hot-reload fine; a newly-added `<Velt…Wireframe>` does not — reload, re-auth, reopen.
- **Container slots drop undeclared children** — declare the full child tree you intend to use.

## Styling / scoping
- **Class CSS needs shadow off + `!important`** (R6/R9b). With `shadowDom={false}` the live classes are reachable; Velt's runtime CSS is high-specificity, so overrides need `!important`.
- **The page-mode composer renders the WHOLE dialog wireframe** (your `.hw-card` and all). It inherits the card chrome (border/shadow/resolve-icon) and crushes the input. **Fix:** scope the card chrome off in that context — `.velt-comment-dialog--page-mode-composer .hw-card { border:none; box-shadow:none; padding:0; background:transparent }` — leaving just the composer pill. (Alternatively give the page-mode composer its own variant via `pageModeComposerVariant`.)
- **Composer "active" state = the `.velt-composer-open` ancestor class** (focus/compose), not a "has-text" class (there is none). Style the send button: grey/disabled by default, dark/enabled under `.velt-composer-open`.
- **Avatar fill color is user-data-driven**, not CSS — "User 1" renders peach. To match a design that shows a flat dark avatar, override `.…s-user-avatar-initial-container { background }` + the initial color (this overrides per-user colors — a deliberate choice to flag).
- **The send-arrow indigo lives on an inner element** (`.velt-composer--input-button`), not the outer `.velt-composer--submit-button` — override the inner one.

## Dropdowns / selected state
- **The minimal-filter `SelectedIcon` slot renders as ONE standalone, full-width, `opacity:0` element** — it does NOT auto-place a tick per row. **Fix:** hide that slot and put a ✓ on the actually-selected row via CSS — `.…content-item--selected .hw-filter-item::after { content:"✓"; margin-left:auto }`. (Gating with `VeltIf {isSelected}` does NOT work in this V1 sort/filter context — it resolves falsy.)
- **A right-edge-anchored dropdown can overflow the viewport** (the trigger sits at the sidebar's right edge). The content's default `left/right` may push a wide menu off-screen, clipping the tick. **Fix:** shift the menu into view (e.g. `transform: translateX(-Npx)` on the menu, or right-anchor it) so it opens leftward.

## Interaction driving (when verifying in the browser)
- **Velt triggers need a real pointer click; `element.click()` (JS) often won't fire the Angular handler.** Use a real click at the element's coordinates.
- **The demo's Velt auth/`documentsReady` can stall after reloads** (`useCurrentUser` doesn't emit → nothing mounts, `velt-*` count 0). This is an ENVIRONMENT block, not a build failure — wait longer (10s+) for the mount, or recover with a fresh tab; re-auth via the user select. Triage app-vs-build before ever blaming the customization.
