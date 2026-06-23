# Reference · Feature flags — what's hidden by default & how to enable it

If your design shows a component/feature that doesn't appear out of the box, **it's probably off by default**. Check here first — most features just need one prop (or an imperative `enable…()` call). Don't rebuild something Velt already has.

**How to read:**
- **Default** = the SDK's built‑in state before you touch anything.
- **Enable via** = the exact React prop (on which component) and/or the imperative element method.
- ⚠️ **React props have no defaults of their own** — a prop you *omit* falls through to the SDK default below. So "OFF by default" features need you to pass the prop (or call the method); "ON by default" features are turned **off** with `={false}`.

---

## The two you asked about

| Feature | Default | Enable via |
|---|---|---|
| **Reply avatars** (stacked reply‑author avatars on the dialog) | **OFF** | `replyAvatars` on `<VeltComments>` · or `commentElement.enableReplyAvatars()`. Cap with `maxReplyAvatars` / `setMaxReplyAvatars()`. |
| **Sidebar button on the comment dialog** | **OFF** | `sidebarButtonOnCommentDialog` on `<VeltComments>` · or `commentElement.enableSidebarButtonOnCommentDialog()`. Click event: `onSidebarButtonOnCommentDialogClick`. ⚠️ The prop is `sidebarButtonOnCommentDialog` — `sidebarButtonOnCommentDialogVisible` is the internal name, **not** a prop. |

---

## `<VeltComments>` — OFF by default (pass the prop / call enable to show)

| Feature | React prop | Imperative |
|---|---|---|
| Priority field | `priority` | `enablePriority()` (custom via `customPriority` / `setCustomPriority()`) |
| Visibility (private/team) options | `visibilityOptions` | `enableVisibilityOptions()` |
| Private comments | `privateCommentMode` *(deprecated)* | `enablePrivateMode(config)` |
| Reply avatars | `replyAvatars` | `enableReplyAvatars()` |
| Sidebar button on dialog | `sidebarButtonOnCommentDialog` | `enableSidebarButtonOnCommentDialog()` |
| Device info on pins | `deviceInfo` | `enableDeviceInfo()` (same flag as `enableDeviceIndicatorOnCommentPins()`) |
| Minimap | `minimap` (+ `minimapPosition`) | `enableMinimap()` |
| Ghost comments | `ghostComments` | `enableGhostComments()` *(≠ ghost‑comment **indicator**, which is ON)* |
| Collapsed comments | `collapsedComments` | `enableCollapsedComments()` |
| Collapsed replies preview | `collapsedRepliesPreview` | `enableCollapsedRepliesPreview()` |
| Persistent comment mode | `persistentCommentMode` | `enablePersistentCommentMode()` |
| Paginated contact list | `paginatedContactList` | `enablePaginatedContactList()` |
| Auto‑categorize | `autoCategorize` | `enableAutoCategorize()` |
| Moderator mode | `moderatorMode` | `enableModeratorMode()` |
| Format options (rich‑text toolbar) | `formatOptions` | `enableFormatOptions()` (config: `setFormatConfig()`) |
| Popover mode | `popoverMode` | `enablePopoverMode()` |
| Multi‑thread | `multiThread` | `enableMultiThread()` |
| Group matched comments | — | `enableGroupMatchedComments()` |
| Screenshot capture | `screenshot` | `enableScreenshot()` |
| Enter key to submit | `enterKeyToSubmit` | `enableEnterKeyToSubmit()` |
| Comment index numbering | `commentIndex` | `enableCommentIndex()` |
| Bubble on pin | `bubbleOnPin` | `enableBubbleOnPin()` *(bubble‑on‑pin‑**hover** is ON)* |
| Dialog on target‑element click | `dialogOnTargetElementClick` | `enableDialogOnTargetElementClick()` |
| Inbox mode | `inboxMode` | `enableInboxMode()` |
| Stream mode | `streamMode` | `enableStreamMode()` |
| Sign‑in button | `signInButton` | `enableSignInButton()` |
| Upgrade button | `upgradeButton` | `enableUpgradeButton()` |
| Hotkey | `hotkey` | `enableHotkey()` |
| Comment pin highlighter | `commentPinHighlighter` | `enableCommentPinHighlighter()` |
| Read‑only | `readOnly` | `enableReadOnly()` |
| Dark mode (container) | `darkMode` | `enableDarkMode()` (sub‑area: `dialogDarkMode`, `pinDarkMode`, …) |
| Context in page‑mode composer | `contextInPageModeComposer` *(on `<VeltCommentTool>`)* | `enableContextInPageModeComposer()` — see [`../context.md`](../context.md) |
| `@here` mention | `atHereEnabled` | `contactElement.enableAtHere()` (+ `setAtHereLabel`/`setAtHereDescription`) |

## `<VeltComments>` — ON by default (turn **off** with `={false}`)

`reactions`, `attachments`, `attachmentDownload`, `status`, `userMentions`, `seenByUsers`, resolve button (`enableResolve`), `scrollToComment`, `dialogOnHover`, `floatingCommentDialog`, `commentTool`, `textComments`, `deleteOnBackspace`, `areaComment`, `bubbleOnPinHover`, `pinDrag`, ghost‑comment **indicator**, and the shadow‑DOM flags (`pinShadowDom`/`dialogShadowDom`/`sidebarShadowDom`).

> ⚠️ **`recordings` is a CSV string, not a boolean.** Default = all on (`audio,video,screen`); set `recordings="none"` to disable, or e.g. `recordings="audio,screen"`. (Also `setRecordings()`.)

---

## Other components

**`<VeltPresence>`** — `self` is **ON** (disable with `self={false}`). Flock/follow mode is **OFF** → `flockMode` / `presenceElement.enableFlockMode()`.
**`<VeltCursor>`** — avatar‑mode cursors **OFF** → `avatarMode` (no imperative pair).
**Notifications** (`<VeltNotificationsTool>`/`Panel`): settings UI **OFF** → `settings` / `enableSettings()`; org‑level settings **OFF** → `enableSettingsAtOrganizationLevel`; self notifications **OFF** → `selfNotifications`; read‑on‑ForYou **OFF** → `readNotificationsOnForYouTab`; cross‑org feed **OFF** → `enableCrossOrganization`.

## Imperative‑only gates (no React prop — call `element.enable…()`)

- **Huddle:** `huddleElement.enableCursorMode()`, `enableFlockModeOnAvatarClick()`; chat is **ON** (`disableChat()` to turn off).
- **Selection:** live selection **OFF** → `selectionElement.enableLiveSelection()`.
- **Recorder:** video editor **OFF** → `recorderElement.enableVideoEditor()`; also `enableOnboardingTooltip()`, `enableRetakeOnVideoEditor()`, `enablePictureInPicture()`. Countdown/transcription/playback‑on‑preview are **ON**. (Recorder dark mode + mic are **tri‑state `null`** — neither on nor off until set.)
- **Rewriter:** feature **OFF** → `rewriterElement.enableRewriter()` (default‑UI‑on‑selection is ON).
- **Notifications:** current‑document‑only scope → `enableCurrentDocumentOnly()`.
- **Area:** area comment is **ON** → `areaElement.disableAreaComment()` to turn off.

---

## How to use this when matching a design

1. The design shows something not visible by default (priority chip, reply avatars, minimap, @here, device badge, …)? **Find it above** → pass the prop / call enable.
2. The design *omits* something Velt shows by default (reactions, status, attachments)? **Turn it off** with `={false}` — don't `display:none` it (R7).
3. Then style/restructure it with CSS / wireframes / primitives as usual.

> Defaults verified against the SDK's feature services. A few advanced `enable…()` methods exist whose default we couldn't pin to a line — if a feature isn't listed, try the matching `enable<Feature>()` on the relevant element and confirm by testing.
