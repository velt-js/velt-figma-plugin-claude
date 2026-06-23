# Reference · Component catalog

Maps each comment surface to its **primitive** component and its **wireframe** family — a quick orientation. Comments are covered in depth; other features are summarized at the end (see [`other-features.md`](../other-features.md)).

> **Companion references (use these for the complete data):**
> - [`wireframe-components.md`](./wireframe-components.md) — all **82** wireframe components + **full** slot trees + slot input props.
> - [`primitives.md`](./primitives.md) — all **421** primitive components (incl. every sub-component).
> - [`component-config.md`](./component-config.md) — layout/mode **props** (filter layout, embed mode, panel mode, …).
> - [`css-classes.md`](./css-classes.md) — structural + stateful **CSS classes**.
> - [`wireframe-variables.md`](./wireframe-variables.md) — the `{variable}` catalog.

The slot trees on this page are an orientation overview; the **complete** trees + slot props live in [`wireframe-components.md`](./wireframe-components.md). Don't invent names.

---

## Comments — primitives ↔ wireframes

| Surface | Primitive component | Wireframe component |
|---|---|---|
| Comments host (pins on page) | `VeltComments` | (uses dialog/pin/bubble wireframes) |
| Comment dialog (a thread) | `VeltCommentDialog` | `VeltCommentDialogWireframe` |
| Single thread (standalone) | `VeltCommentDialog` *(use this)* · ~~`VeltCommentThread`~~ **(deprecated)** | `VeltCommentDialogWireframe` |
| Comments sidebar | `VeltCommentsSidebar` | `VeltCommentsSidebarWireframe` |
| Comments sidebar (V2) | `VeltCommentsSidebarV2` | `VeltCommentsSidebarV2Wireframe` |
| Sidebar toggle button | `VeltSidebarButton` / `VeltCommentsSidebarButton` | `VeltSidebarButtonWireframe` / `VeltCommentsSidebarButtonWireframe` |
| Comment pin | `VeltCommentPin` | `VeltCommentPinWireframe` |
| Comment bubble | `VeltCommentBubble` | `VeltCommentBubbleWireframe` |
| Composer (standalone) | `VeltCommentComposer` | `VeltCommentComposerWireframe` |
| Multi‑thread dialog | `VeltMultiThreadCommentDialog` | `VeltMultiThreadCommentDialogWireframe` |
| Inline comments section | `VeltInlineCommentsSection` | `VeltInlineCommentsSectionWireframe` |
| Text comment | `VeltTextComment` | `VeltTextCommentToolbarWireframe` / `VeltTextCommentToolWireframe` |
| Generic action button (in wireframes) | — | `VeltButtonWireframe` |

Dialog dropdown sub‑wireframes also exist: `VeltCommentDialogOptionsDropdownTriggerWireframe` / `…ContentWireframe`, and the same for `Status` and `Priority` dropdowns.

---

## `VeltCommentDialogWireframe` slot tree

The slots are **static properties** on `VeltCommentDialogWireframe` (and its nested `.ThreadCard` / `.Composer` / `.AssigneeBanner` / options content). They're flat — *you* choose how to arrange them in your layout. Fill the ones you want; the rest fall back to defaults.

This is the **complete top‑level set** (the deeper tree is in [`wireframe-components.md`](./wireframe-components.md) §2):

```
VeltCommentDialogWireframe.*  (top-level slots)
  Header  Status  Priority  CopyLink  ResolveButton  UnresolveButton  Options
  CloseButton  NavigationButton  CommentIndex  CommentNumber  Approve  DeleteButton
  AssignMenu  VisibilityBanner  VisibilityDropdown  PrivateBanner  GhostBanner
  AssigneeBanner  Body  Threads  ThreadCard  Composer  ToggleReply  HideReply  MoreReply
  AllComment  ReplyAvatars  CommentCategory  CustomAnnotationDropdown  SignIn  Upgrade
  AgentSuggestion  SuggestionAction  CommentSuggestionStatus

VeltCommentDialogWireframe.ThreadCard.*
  Avatar  Name  Time  Edited  Draft  Unread  DeviceType  Message  Attachments
  Recordings  Reactions  ReactionTool  ReactionPin  Options  AssignButton
  SeenDropdown  Reply  EditComposer

VeltCommentDialogWireframe.AssigneeBanner.*
  UserAvatar  UserName  ResolveButton  UnresolveButton

VeltCommentDialogWireframe.Composer.*
  Avatar  Input  ActionButton   (ActionButton has a `type` prop — e.g. "submit",
                                 "attachments", "userMentions", and more; see source)

Options dropdown content (VeltCommentDialogOptionsDropdownContentWireframe).*
  Edit  Delete  Assign  MakePrivate  Notification  MarkAsRead
```

> Deeper nesting and each slot's props are in [`wireframe-components.md`](./wireframe-components.md) (§2 and §6). Use that for the exact prop on a given slot.

Behavior lives in these slots (resolve, delete, submit, etc.) — your markup goes *inside* a slot as its appearance (see the interactivity rule in [`approaches/wireframes.md`](../approaches/wireframes.md) §6).

---

## Sidebar slot trees

**`VeltCommentsSidebarWireframe`** — commonly‑used slots (the complete set is in [`wireframe-components.md`](./wireframe-components.md) §3):

```
VeltCommentsSidebarWireframe
├── .Skeleton                         (loading state markup)
└── .Panel
    ├── .MinimalFilterDropdown
    │   ├── .Trigger
    │   └── .Content → .SortDate  .SortUnread  .FilterResolved  .FilterAssignedToMe
    ├── .PageModeComposer             (page-mode composer)
    ├── .EmptyPlaceholder             (often gated with velt-if="{noCommentsFound}")
    └── .List                         (the rendered comment list)
```

**`VeltCommentsSidebarV2Wireframe`** — complete top‑level slots:

```
VeltCommentsSidebarV2Wireframe.*
  Skeleton  Panel  Header  List  EmptyPlaceholder  PageModeComposer
  FilterButton  FilterContainer  FilterDropdown  FocusedThread  Search
  FullscreenButton  CloseButton
```

> The full sidebar slot trees (V1 and V2, including composer attachments image/other → delete/download/loading, thread‑card assign‑button, reply‑avatars, comment‑bubble comments‑count, …) are in [`wireframe-components.md`](./wireframe-components.md) §3–§4.

---

## How to find the complete slot list for a feature

1. **[`wireframe-components.md`](./wireframe-components.md)** — the full slot tree + slot props for every wireframe.
2. **[`wireframe-variables.md`](./wireframe-variables.md)** — every `{…}` variable, grouped by feature.
3. To confirm what a specific element renders as, **inspect it** in DevTools (`shadowDom={false}`) and look for `velt-*-wireframe` tags.

---

## Other features (brief)

Each has a primitive + (usually) a wireframe family; see [`other-features.md`](../other-features.md):

| Feature | Primitive(s) | Wireframe(s) |
|---|---|---|
| Notifications | `VeltNotificationsTool`, `VeltNotificationsPanel` | `VeltNotificationsToolWireframe`, `VeltNotificationsPanelWireframe` |
| Reactions | `VeltReactionTool` | `VeltReactionToolWireframe`, `VeltReactionPinWireframe` |
| Presence | `VeltPresence` | `VeltPresenceWireframe` |
| Cursors | `VeltCursor` | `VeltCursorPointerWireframe` |
| Recorder | `VeltRecorderControlPanel`, `VeltRecorderPlayer`, `VeltRecorderTool` | `VeltRecorderControlPanelWireframe`, `VeltRecorderPlayerWireframe`, `VeltRecorderAudioToolWireframe`, `VeltRecorderVideoToolWireframe`, `VeltRecorderScreenToolWireframe` |
| Autocomplete (@mentions) | `VeltAutocomplete` | `VeltAutocompleteOptionWireframe`, `VeltAutocompleteGroupOptionWireframe`, `VeltAutocompleteEmptyWireframe` |
| Arrows / Tags | `VeltArrows` / `VeltTags` (+ `VeltArrowTool` / `VeltTagTool`) | limited / no wireframe slots (CSS + props) |
| Areas | `velt-areas` / `velt-area-tool` (custom elements; no `Velt*` React wrapper) | none (CSS + props) |
