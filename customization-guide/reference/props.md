# Reference · Props (every Velt component)

The complete prop list for **every** user-facing Velt component — name, type, default, and what it does / when to use it. This is the LLM/intern lookup for "which prop do I pass to get X." `<VeltComments>` (the largest surface, 129 props) is **Part 1**; **Part 2** covers all other components (sidebar, dialog, pin, notifications, presence, recorder, …). For *which features are off vs on by default* at a glance, see [`feature-flags.md`](./feature-flags.md); for the quick layout/mode reference + custom-data shapes see [`component-config.md`](./component-config.md). See also [`apis.md`](./apis.md) (feature methods) and [`events.md`](./events.md) (subscribable events).

**How defaults work:** React props have no defaults of their own — an **omitted** prop falls through to the SDK default (it is *not* `false`). Booleans serialize to `'true'`/`'false'` only when explicitly set. Array/object props (e.g. `allowedElementIds`, `customStatus`) are JSON‑serialized onto the element. A blank **Default** means the SDK sets it in a feature service rather than at the prop site. **Every prop is optional unless marked `(required)`.** Most components also accept standard HTML attributes (`className`, `style`, `id`, `children`, `ref`, `key`) — not re-listed per component.

> Generated verbatim from each component's props interface in `@veltdev/react`. Exhaustive.

---

# Part 1 — `<VeltComments>`

## Core feature toggles

| Prop | Type | Default | Description / when to use |
|---|---|---|---|
| `reactions` | boolean | `true` | Emoji reactions on comments. |
| `attachments` | boolean | `true` | File attachments on comments. |
| `attachmentDownload` | boolean | `true` | Download button on attachments. |
| `attachmentNameInMessage` | boolean | `false` | Show attachment filename inline in the message. |
| `allowedFileTypes` | string[] | `[]` (all) | Whitelist of attachment file types. |
| `customReactions` | `ReactionMap` | — | Override the reaction emoji set. |
| `recordings` | string | `'audio,video,screen'` | Allowed recording types. `"none"` disables; CSV like `"audio,screen"`. **Not a boolean.** |
| `recordingTranscription` | boolean | `true` | Transcription/summary for recordings. |
| `recordingCountdown` | boolean | — | Countdown before recording starts. |
| `screenshot` | boolean | `false` | Screenshot capture in the composer. |
| `status` | boolean | `true` | The status field. |
| `customStatus` | `{id,color,name,type:'default'\|'ongoing'\|'terminal',lightColor?,svg?,iconUrl?}[]` | — | Define custom statuses. |
| `priority` | boolean | `false` | The priority field. |
| `customPriority` | `{id,color,name,lightColor?}[]` | — | Define custom priorities. |
| `customCategory` | `{id,color,name}[]` | — | Define custom categories. |
| `autoCategorize` | boolean | `false` | Auto‑categorize comments. |
| `resolveButton` | boolean | `true` | The resolve button. |
| `resolveStatusAccessAdminOnly` | boolean | `false` | Restrict resolve to admins. |
| `visibilityOptions` | boolean | `false` | Per‑comment visibility (private/team) options. |
| `seenByUsers` | boolean | `true` | "Seen by" avatars. |
| `deviceInfo` | boolean | `false` | Capture/show device + screen‑size info. |
| `deviceIndicatorOnCommentPins` | boolean | `false` | Device‑type badge on pins. |
| `commentIndex` | boolean | `false` | Numeric index labels on pins. |
| `replyAvatars` | boolean | `false` | Reply‑author avatars on the thread. |
| `maxReplyAvatars` | number | `3` | Max reply avatars before "+N". |
| `sidebarButtonOnCommentDialog` | boolean | `false` | "Open sidebar" button inside the dialog. |
| `ghostComments` | boolean | `false` | Show comments whose target DOM was removed. |
| `ghostCommentsIndicator` | boolean | `true` | The ghost‑comment indicator/message. |
| `minimap` | boolean | `false` | Comments minimap. |
| `minimapPosition` | string | — | Minimap corner placement. |
| `hotkey` | boolean | `false` | Keyboard hotkey to add a comment. |
| `bubbleOnPin` | boolean | `false` | Bubble preview on the pin. |
| `bubbleOnPinHover` | boolean | `true` | Bubble preview on pin hover. |
| `pinDrag` | boolean | `true` | Allow dragging pins to reposition. |
| `pinCursorImage` | string | `''` | Custom cursor image while placing a comment. |
| `commentPinHighlighter` | boolean | — | Highlight the target element when a pin is active. |
| `formatOptions` | boolean | `false` | Rich‑text formatting toolbar. |
| `deleteOnBackspace` | boolean | `true` | Delete comment/attachment via Backspace. |
| `enterKeyToSubmit` | boolean | `false` | Enter submits (vs Cmd/Ctrl+Enter). |
| `forceCloseAllOnEsc` | boolean | `false` | Esc closes all open dialogs. |
| `scrollToComment` | boolean | `true` | Auto‑scroll to a selected comment. |
| `commentTool` | boolean | `true` | The floating add‑comment tool. |
| `deleteReplyConfirmation` | boolean | `false` | Confirm before deleting a reply. |
| `deleteThreadWithFirstComment` | boolean | `true` | Deleting first comment deletes the thread. |
| `draftMode` | boolean | `true` | Persist unsent composer text as a draft. |
| `collapsedComments` | boolean | `false` | Render comments collapsed initially. |
| `collapsedRepliesPreview` | boolean | `false` | Collapsed preview of replies. |
| `fullExpanded` | boolean | `false` | Render comments fully expanded. |
| `shortUserName` | boolean | `true` | Display shortened user names. |
| `svgAsImg` | boolean | `false` | Render SVGs as `<img>`. |
| `readOnly` | boolean | `false` | Read‑only (no add/edit). |
| `linkCallback` | boolean | `false` | Route link clicks through a callback instead of navigating. |

## Mentions / autocomplete

| Prop | Type | Default | Description / when to use |
|---|---|---|---|
| `userMentions` | boolean | `true` | @‑mention autocomplete. |
| `customAutocompleteSearch` | boolean | `false` | Use your own search/data source for mentions (supply data via `ContactElement`/`AutocompleteElement`). |
| `paginatedContactList` | boolean | `false` | Paginate a large contact list. |
| `expandMentionGroups` | boolean | `false` | Expand groups into members. |
| `showMentionGroupsFirst` | boolean | `false` | Groups above individuals. |
| `showMentionGroupsOnly` | boolean | `false` | Only show groups. |
| `atHereEnabled` | boolean | — | Enable the `@here` mention. |
| `atHereLabel` / `atHereDescription` | string | — | Label/description for `@here`. |
| `customListDataOnAnnotation` | `CustomAnnotationDropdownData` | — | Custom dropdown data at the annotation level. |
| `customListDataOnComment` | `AutocompleteData` | — | Custom autocomplete data at the comment level. |
| `assignToType` | `AssignToType` | `'dropdown'` | Assignee picker UI type. |
| `autoCompleteScrollConfig` | object | (svc) | Scroll config for autocomplete lists. |
| `anonymousEmail` | boolean | `true` | Allow anonymous email mentions. |

## Layout / interaction modes

| Prop | Type | Default | Description / when to use |
|---|---|---|---|
| `textMode` | boolean | `true` | Text/inline‑selection commenting. |
| `inlineCommentMode` | boolean | `false` | Inline comment layout. |
| `popoverMode` | boolean | `false` | Dialog as a popover. |
| `popoverTriangleComponent` | boolean | `true` | Popover caret/triangle. |
| `floatingCommentDialog` | boolean | `true` | Floating (free‑positioned) dialog. |
| `dialogOnHover` | boolean | `true` | Open dialog on pin hover. |
| `dialogOnTargetElementClick` | boolean | `false` | Open dialog when the target element is clicked. |
| `inboxMode` | boolean | `false` | Inbox‑style listing. |
| `moderatorMode` | boolean | `false` | Moderator capabilities. |
| `streamMode` | boolean | `false` | Stream‑style mode (+ `streamViewContainerId`). |
| `suggestionMode` | boolean | `false` | Suggestion (edit‑proposal) mode. |
| `mobileMode` | boolean | `true` | Mobile‑optimized layout. |
| `privateCommentMode` | boolean | `false` | Private comments. |
| `persistentCommentMode` | boolean | `false` | Always‑open persistent composer. |
| `composerMode` | `'default'\|'expanded'` | `'default'` | Composer expansion. |
| `multiThread` | boolean | `false` | Multiple threads per location. |
| `groupMatchedComments` | boolean | `false` | Group comments on the same target. |
| `commentsOnDom` | boolean | `true` | Anchor comments to DOM elements. |
| `resolvedCommentsOnDom` | boolean | `false` | Also render resolved comments on the DOM. |
| `filterCommentsOnDom` | boolean | `false` | Apply active filters to DOM comments. |
| `areaComment` | boolean | `true` | Area (drag‑box) comments. |
| `unreadIndicatorMode` | `'minimal'\|'verbose'` | `'minimal'` | Unread‑indicator style. |
| `allowedElementIds` / `allowedElementClassNames` / `allowedElementQuerySelectors` | string[] | `[]` | Restrict where comments can be placed. |
| `commentToNearestAllowedElement` | boolean | `false` | Snap to the nearest allowed element. |
| `changeDetectionInCommentMode` | boolean | `false` | Extra change detection while in comment mode. |
| `signInButton` / `upgradeButton` | boolean | `false` | Gated‑commenting sign‑in / upgrade buttons. |

## Placeholders

| Prop | Type | Default |
|---|---|---|
| `commentPlaceholder` · `replyPlaceholder` · `editPlaceholder` · `editCommentPlaceholder` · `editReplyPlaceholder` | string | — |

## Shadow DOM & dark mode

| Prop | Type | Default | Note |
|---|---|---|---|
| `shadowDom` | boolean | — | Master shadow‑DOM wrap. **Set `false` to style with selector CSS** (R6). |
| `pinShadowDom` / `dialogShadowDom` / `textCommentToolShadowDom` / `textCommentToolbarShadowDom` | boolean | `true` | Per‑surface shadow‑DOM. |
| `persistentCommentShadowDom` | boolean | — | Shadow‑DOM the persistent composer. |
| `darkMode` | boolean | `false` | Master dark mode. |
| `dialogDarkMode` | boolean | — | Dialog dark mode. |
| `pinDarkMode` / `textCommentToolDarkMode` / `textCommentToolbarDarkMode` | boolean | `null` (inherit) | Per‑surface dark mode. |

## Callbacks

| Prop | Fires on | Note |
|---|---|---|
| `onSignIn` / `onUpgrade` | sign‑in / upgrade button click | |
| `onCommentAdd` / `onCommentUpdate` | comment added / updated | **legacy** — prefer the event hooks (`useAddCommentAnnotation`, …) |
| `onCommentAccept` / `onCommentReject` | suggestion accepted / rejected | |
| `onCopyLink` | comment link copied | |
| `onCustomPinInject` | inject a custom pin element | |
| `onSidebarButtonOnCommentDialogClick` | in‑dialog sidebar button click | pairs with `sidebarButtonOnCommentDialog` |
| `onCommentSelectionChange` | selected comment changes | |

## Deprecated (don't use)

`recordingSummary` → use `recordingTranscription`; `multiThreadMode` → `multiThread`; `groupMultipleMatch` → `groupMatchedComments`; `onCommentAdd`/`onCommentUpdate` → use the event hooks.

---

> For `<VeltComments>` **wireframe slot props** (e.g. `Composer.ActionButton type`) see [`wireframe-components.md`](./wireframe-components.md) §6; for **custom-data shapes** (`customStatus`/`customPriority`/`customReactions`/…) see [`component-config.md`](./component-config.md).

---

# Part 2 — all other components

Prop names and types are verbatim from each component's props interface in `@veltdev/react`. Imported field types (e.g. `ContextOptions`, `CommentSidebarFilterConfig`, `ReactionMap`, `NotificationTabConfig`) come from `@veltdev/types`.

## Comments — containers & surfaces

### VeltCommentsSidebar (V1)

`IVeltCommentsSidebarProps`

| Prop | Type | Default | Description / when to use |
|---|---|---|---|
| embedMode | `boolean` |  | Render the sidebar inline inside your layout instead of as an overlay. |
| floatingMode | `boolean` |  | Float the sidebar over content. |
| enableUrlNavigation | `boolean` |  | **@deprecated — use `urlNavigation`.** |
| urlNavigation | `boolean` |  | Sync clicked comment into the URL / navigate on deep link. |
| queryParamsComments | `boolean` |  | Drive comment selection via query params. |
| pageMode | `boolean` |  | Page-level comments (no pins); composer at sidebar level. |
| currentLocationSuffix | `boolean` |  | Append current location to entries. |
| variant | `string` |  | Named wireframe variant for the sidebar. |
| pageModeComposerVariant | `string` |  | Wireframe variant for the page-mode composer. |
| dialogVariant | `string` |  | Wireframe variant for dialogs opened from the sidebar. |
| shadowDom | `boolean` |  | Render inside a shadow root (style isolation). |
| sortData | `'asc' \| 'desc' \| 'none'` |  | Sort comment list. |
| filterConfig | `CommentSidebarFilterConfig` |  | Configure which filter types appear (location/people/priority/category/commentType/status). |
| groupConfig | `CommentSidebarGroupConfig` |  | Group comments in the list. |
| filters | `CommentSidebarFilters` |  | Apply specific filter values programmatically. |
| excludeLocationIds | `string[]` |  | Hide comments belonging to these locations. |
| openSidebar | `Function` |  | **@deprecated — use `onSidebarOpen`.** |
| onSidebarOpen | `Function` |  | Callback when sidebar opens. |
| onSidebarCommentClick | `Function` |  | **@deprecated — use `onCommentClick`.** |
| onCommentClick | `Function` |  | Callback when a comment row is clicked. |
| onSidebarClose | `Function` |  | Callback when sidebar closes. |
| onCommentNavigationButtonClick | `Function` |  | Callback for the prev/next navigation buttons. |
| darkMode | `boolean` |  | Dark theme. |
| position | `"right" \| "left"` |  | Which side the sidebar anchors to. |
| filterPanelLayout | `'menu' \| 'bottomSheet'` |  | Filter panel presentation. |
| customActions | `boolean` |  | Enable custom action slots. |
| focusedThreadDialogVariant | `string` |  | Wireframe variant for the focused-thread dialog. |
| focusedThreadMode | `boolean` |  | Open threads in focused mode. |
| openAnnotationInFocusMode | `boolean` |  | Open the clicked annotation in focus mode. |
| searchPlaceholder | `string` |  | Placeholder for the search input. |
| filterOptionLayout | `'checkbox' \| 'dropdown'` |  | Filter option presentation. |
| filterCount | `boolean` |  | Show counts next to filters. |
| fullExpanded | `boolean` |  | Fully expand thread content. |
| systemFiltersOperator | `'and' \| 'or'` |  | Combine system filters with AND/OR. |
| sidebarButtonCountType | `'default' \| 'filter'` |  | What the sidebar button count reflects. |
| filterGhostCommentsInSidebar | `boolean` |  | Include ghost comments when filtering. |
| fullScreen | `boolean` |  | Render full screen. |
| readOnly | `boolean` |  | Disable mutations (view-only). |
| dialogSelection | `boolean` |  | Allow selecting dialogs. |
| expandOnSelection | `boolean` |  | Expand a thread when selected. |
| context | `{ [key: string]: any }` |  | Arbitrary context attached to created comments. |
| defaultMinimalFilter | `SidebarFilterCriteria` |  | Default minimal-filter criteria. |
| sortOrder | `SortOrder` |  | Sort order. |
| sortBy | `SortBy` |  | Sort field. |
| forceClose | `boolean` |  | Force the sidebar closed. |
| commentPlaceholder | `string` |  | Composer placeholder (new comment). |
| replyPlaceholder | `string` |  | Composer placeholder (reply). |
| editPlaceholder | `string` |  | Edit placeholder (generic). |
| editCommentPlaceholder | `string` |  | Edit placeholder (comment). |
| editReplyPlaceholder | `string` |  | Edit placeholder (reply). |
| pageModePlaceholder | `string` |  | Placeholder for the page-mode composer. |

### VeltCommentsSidebarV2

`IVeltCommentSidebarV2Props` (extends HTML attrs)

| Prop | Type | Default | Description / when to use |
|---|---|---|---|
| pageMode | `boolean` |  | Page-level comments. |
| focusedThreadMode | `boolean` |  | Open threads in focused mode. |
| readOnly | `boolean` |  | View-only. |
| embedMode | `string` |  | Embed mode (note: typed `string` in V2, not boolean). |
| floatingMode | `boolean` |  | Float over content. |
| position | `'right' \| 'left'` |  | Anchor side. |
| variant | `string` |  | Sidebar wireframe variant. |
| forceClose | `boolean` |  | Force closed. |
| darkMode | `boolean` |  | Dark theme. |
| defaultCondition | `boolean` |  | Default render condition (visibility gate). |
| filters | `any` |  | (V2 filtering) Apply filter values. |
| miniFilters | `any` |  | (V2) Mini filter set. |
| minimalFilters | `any` |  | (V2) Minimal filter set. |
| filterOperator | `'and' \| 'or'` |  | Combine filters. |
| filterPanelLayout | `'menu' \| 'bottomSheet'` |  | Filter panel layout. |
| filterOptionLayout | `'checkbox' \| 'dropdown'` |  | Filter option layout. |
| filterCount | `boolean` |  | Show filter counts. |
| filterGhostCommentsInSidebar | `boolean` |  | Include ghost comments. |
| systemFiltersOperator | `'and' \| 'or'` |  | System filter operator. |
| defaultMinimalFilter | `'all' \| 'read' \| 'unread' \| 'resolved' \| 'open' \| 'assignedToMe' \| 'reset' \| null` |  | Default minimal filter. |
| excludeLocationIds | `string[]` |  | Hide locations. |
| sortBy | `any` |  | (Sorting) Sort field. |
| sortOrder | `any` |  | Sort order. |
| sortData | `'asc' \| 'desc' \| 'none'` |  | Sort data. |
| customActions | `boolean` |  | (Actions/modes) Enable custom actions. |
| openAnnotationInFocusMode | `boolean` |  | Open annotation in focus mode. |
| enableUrlNavigation | `boolean` |  | **@deprecated — use `urlNavigation`.** |
| urlNavigation | `boolean` |  | URL navigation. |
| queryParamsComments | `boolean` |  | Query-param comment selection. |
| fullScreen | `boolean` |  | Full screen. |
| shadowDom | `boolean` |  | Shadow root isolation. |
| fullExpanded | `boolean` |  | Fully expanded. |
| dialogSelection | `boolean` |  | Allow dialog selection. |
| expandOnSelection | `boolean` |  | Expand on select. |
| currentLocationSuffix | `boolean` |  | Append current location. |
| sidebarButtonCountType | `'default' \| 'filter'` |  | Sidebar button count source. |
| dialogVariant | `string` |  | (Variants) Dialog wireframe variant. |
| focusedThreadDialogVariant | `string` |  | Focused-thread dialog variant. |
| pageModeComposerVariant | `string` |  | Page-mode composer variant. |
| pageModePlaceholder | `string` |  | (Placeholders) Page-mode composer placeholder. |
| searchPlaceholder | `string` |  | Search placeholder. |
| commentPlaceholder | `string` |  | New-comment placeholder. |
| replyPlaceholder | `string` |  | Reply placeholder. |
| editPlaceholder | `string` |  | Edit placeholder. |
| editCommentPlaceholder | `string` |  | Edit-comment placeholder. |
| editReplyPlaceholder | `string` |  | Edit-reply placeholder. |
| context | `{ [key: string]: any }` |  | (Misc/advanced) Context for new comments. |
| groupConfig | `any` |  | Grouping config. |
| measuredSize | `number` |  | Virtual-scroll measured row size hint. |
| minBufferPx | `number` |  | Virtual-scroll min buffer (px). |
| maxBufferPx | `number` |  | Virtual-scroll max buffer (px). |
| onSidebarOpen | `Function` |  | (Events) Sidebar opened. |
| openSidebar | `Function` |  | **@deprecated — use `onSidebarOpen`.** |
| onSidebarClose | `Function` |  | Sidebar closed. |
| onCommentClick | `Function` |  | Comment row clicked. |
| onSidebarCommentClick | `Function` |  | **@deprecated — use `onCommentClick`.** |
| onCommentNavigationButtonClick | `Function` |  | Prev/next navigation clicked. |
| onFullscreenClick | `Function` |  | Fullscreen toggle clicked. |

### VeltCommentDialog

`IVeltCommentDialogProps` (extends HTML attrs)

| Prop | Type | Default | Description / when to use |
|---|---|---|---|
| annotationId | `string` |  | Render the dialog for a specific annotation (standalone use). |
| multiThreadAnnotationId | `string` |  | Annotation id within a multi-thread pin. |
| defaultCondition | `boolean` |  | Visibility gate (skip the internal show/hide condition — you control it). |
| inlineCommentSectionMode | `boolean` |  | Render inside an inline comments section. |
| commentPinSelected | `boolean` |  | Whether the source pin is selected. |
| fullExpanded | `boolean` |  | Fully expand thread. |
| shadowDom | `boolean` |  | Shadow-DOM isolation. |
| darkMode | `boolean` |  | Dark theme. |
| readOnly | `boolean` |  | View-only. |
| sidebarMode | `boolean` |  | Render in sidebar context. |
| isFocusedThreadEnabled | `boolean` |  | Enable focused-thread behavior. |
| openAnnotationInFocusMode | `boolean` |  | Open in focus mode. |
| expandOnSelection | `boolean` |  | Expand when selected. |
| inlineCommentMode | `boolean` |  | Inline comment mode. |
| inboxMode | `boolean` |  | Inbox rendering mode. |
| isInsidePdfViewer | `boolean` |  | Adjust behavior inside a PDF viewer. |
| multiThread | `boolean` |  | Multi-thread dialog. |
| commentComposerMode | `boolean` |  | Composer-only mode. |
| dialogSelection | `boolean` |  | Allow dialog selection. |
| dialogMode | `boolean` |  | Dialog mode flag. |
| focusedThreadMode | `boolean` |  | Focused-thread mode. |
| pageModeComposer | `boolean` |  | Page-mode composer. |
| messageTruncation | `boolean` |  | Truncate long messages with show more/less. |
| initialEditCommentIndex | `number \| string \| null` |  | Open with a specific comment in edit mode. |
| messageTruncationLines | `number \| string` |  | Lines before truncation (with `messageTruncation`). |
| variant | `string` |  | Wireframe variant. |
| composerPosition | `string` |  | Composer placement. |
| sortBy | `string` |  | Sort field. |
| sortOrder | `string` |  | Sort order. |
| commentPinType | `'bubble' \| 'pin' \| 'chart' \| 'text'` |  | The pin type this dialog belongs to. |
| containerComponentId | `string` |  | Id of the container component. |
| targetElementId | `string` |  | Anchor element id. |
| targetComposerElementId | `string` |  | Composer anchor element id. |
| locationVersion | `string` |  | Location version. |
| locationDisplayName | `string` |  | Display name for the location. |
| context | `any` |  | Context for new comments. |
| placeholder | `string` |  | Generic placeholder. |
| commentPlaceholder | `string` |  | New-comment placeholder. |
| replyPlaceholder | `string` |  | Reply placeholder. |
| editPlaceholder | `string` |  | Edit placeholder. |
| editCommentPlaceholder | `string` |  | Edit-comment placeholder. |
| editReplyPlaceholder | `string` |  | Edit-reply placeholder. |
| anonymousEmail | `boolean` |  | Per-dialog override for anonymous email mentions in this annotation context. |

### VeltMultiThreadCommentDialog

`IVeltMultiThreadCommentDialogProps` (extends HTML attrs)

| Prop | Type | Default | Description / when to use |
|---|---|---|---|
| annotationId | `string` |  | Annotation id. |
| multiThreadAnnotationId | `string` |  | Thread id within the multi-thread pin. |
| annotation | `any` |  | Pass the annotation object directly. |
| user | `any` |  | Pass the user object directly. |
| commentPinSelected | `boolean` |  | Whether the source pin is selected. |
| commentPinType | `string` |  | Pin type. |
| dialogVariant | `string` |  | Dialog wireframe variant. |
| variant | `string` |  | Wireframe variant. |
| inboxMode | `boolean` |  | Inbox rendering. |
| containerComponentId | `string` |  | Container component id. |
| context | `any` |  | Context for new comments. |
| readOnly | `boolean` |  | View-only. |
| defaultCondition | `boolean` |  | Visibility gate. |
| onSaveComment | `Function` |  | Callback fired when a comment is saved. |

### VeltCommentText

`IVeltCommentTextProps` (extends HTML attrs)

| Prop | Type | Default | Description / when to use |
|---|---|---|---|
| annotationId | `string` |  | Annotation whose comment text to render. |
| multiThreadAnnotationId | `string` |  | Thread id within a multi-thread pin. |

> `VeltCommentThread` (`IVeltCommentThreadProps`: `annotationId`, `annotation`, `onCommentClick`, `darkMode`, `variant`, `dialogVariant`, `shadowDom`, `fullExpanded`) is **deprecated** — use **`VeltCommentDialog`** (above) instead. `VeltCommentComposer` (`IVeltCommentComposerProps`: `darkMode`, `variant`, `dialogVariant`, `shadowDom`, `context`, `locationId`, `documentId`, `folderId`, `targetComposerElementId`, `placeholder`, `readOnly`) renders a standalone composer.

## Comments — pins, bubbles, tools

### VeltCommentBubble

`IVeltCommentBubbleProps` (extends HTML attrs)

| Prop | Type | Default | Description / when to use |
|---|---|---|---|
| targetCommentElementId | `string` |  | **@deprecated — use `targetElementId`.** |
| targetElementId | `string` |  | Element the bubble attaches to. |
| showAvatar | `boolean` |  | **@deprecated — use `avatar`.** |
| avatar | `boolean` |  | Show commenter avatar on the bubble. |
| commentBubbleTargetPinHover | `boolean` |  | Highlight target pin on bubble hover. |
| shadowDom | `boolean` |  | Shadow-DOM isolation. |
| variant | `string` |  | Bubble wireframe variant. |
| darkMode | `boolean` |  | Dark theme. |
| readOnly | `boolean` |  | View-only. |
| commentCountType | `'total' \| 'unread'` |  | Count shown on the bubble. |
| context | `{ [key: string]: any }` |  | Context for new comments. |
| contextOptions | `ContextOptions` |  | Context resolution options. |
| locationId | `string` |  | Scope to a location. |
| documentId | `string` |  | Scope to a document. |
| folderId | `string` |  | Scope to a folder. |
| annotationId | `string` |  | Bind to a specific annotation. |
| openDialog | `boolean` |  | Open the dialog on render. |

### VeltCommentPin

`IVeltCommentPinProps` (extends HTML attrs)

| Prop | Type | Default | Description / when to use |
|---|---|---|---|
| annotationId | `string` |  | Annotation the pin represents. |
| multiThreadAnnotationId | `string` |  | Thread id within a multi-thread pin. |
| variant | `string` |  | Pin wireframe variant. |
| context | `{ [key: string]: any }` |  | Context for new comments. |
| contextOptions | `ContextOptions` |  | Context resolution options. |
| locationId | `string` |  | Scope to a location. |
| documentId | `string` |  | Scope to a document. |
| folderId | `string` |  | Scope to a folder. |
| defaultCondition | `boolean` |  | Visibility gate. |

### VeltCommentTool

`IVeltCommentToolProps` (extends HTML attrs)

| Prop | Type | Default | Description / when to use |
|---|---|---|---|
| targetCommentElementId | `string` |  | **@deprecated — use `targetElementId`.** |
| targetElementId | `string` |  | Element to attach the new comment to. |
| onCommentModeChange | `Function` |  | Fires when comment mode toggles on/off. |
| sourceId | `string` |  | Source identifier. |
| darkMode | `boolean` |  | Dark theme. |
| disabled | `boolean` |  | Disable the tool. |
| variant | `string` |  | Tool wireframe variant. |
| shadowDom | `boolean` |  | Shadow-DOM isolation. |
| context | `{ [key: string]: any }` |  | Context for new comments. |
| contextOptions | `ContextOptions` |  | Context resolution options. |
| locationId | `string` |  | Scope to a location. |
| documentId | `string` |  | Scope to a document. |
| folderId | `string` |  | Scope to a folder. |
| contextInPageModeComposer | `boolean` |  | Apply context inside the page-mode composer. |

### VeltSidebarButton

`IVeltSidebarButtonProps` (extends HTML attrs)

| Prop | Type | Default | Description / when to use |
|---|---|---|---|
| tooltipText | `string` |  | Button tooltip. |
| darkMode | `boolean` |  | Dark theme. |
| shadowDom | `boolean` |  | Shadow-DOM isolation. |
| floatingMode | `boolean` |  | Float the opened sidebar. |
| variant | `string` |  | Button wireframe variant. |
| pageMode | `boolean` |  | (Sidebar props) Page-level comments. |
| sortData | `'asc' \| 'desc' \| 'none'` |  | Sort comment list. |
| urlNavigation | `boolean` |  | URL navigation. |
| currentLocationSuffix | `boolean` |  | Append current location. |
| filterConfig | `CommentSidebarFilterConfig` |  | Configure filter types. |
| groupConfig | `CommentSidebarGroupConfig` |  | Grouping config. |
| filters | `CommentSidebarFilters` |  | Apply filter values. |
| excludeLocationIds | `string[]` |  | Hide locations. |
| dialogVariant | `string` |  | Dialog wireframe variant. |
| pageModeComposerVariant | `string` |  | Page-mode composer variant. |
| sidebarShadowDom | `boolean` |  | Shadow-DOM for the opened sidebar. |
| sidebarVariant | `string` |  | Sidebar wireframe variant. |
| position | `"right" \| "left"` |  | Sidebar anchor side. |
| filterPanelLayout | `'menu' \| 'bottomSheet'` |  | Filter panel layout. |
| sidebarButtonCountType | `'default' \| 'filter'` |  | Count source. |
| filterGhostCommentsInSidebar | `boolean` |  | Include ghost comments. |
| onCommentClick | `Function` |  | Comment clicked in sidebar. |
| onSidebarOpen | `Function` |  | Sidebar opened. |
| commentCountType | `'total' \| 'unread'` |  | Count type on the button. |
| defaultCondition | `boolean` |  | Visibility gate. |

> `VeltCommentsSidebarButton` is a leaner variant of `VeltSidebarButton` (same props minus `variant`, `sidebarButtonCountType`, `filterGhostCommentsInSidebar`, `commentCountType`, `defaultCondition`). `VeltCommentsMinimap` (`IVeltCommentsMinimapProps`): `position`, `targetScrollableElementId`.

## Inline / section components

### VeltInlineCommentsSection

`IVeltInlineCommentsSectionProps` (extends HTML attrs)

| Prop | Type | Default | Description / when to use |
|---|---|---|---|
| config | `{ id: string; name?: string }` |  | Section identity (id + optional name). |
| targetInlineCommentElementId | `string` |  | **@deprecated — use `targetElementId`.** |
| targetCommentElementId | `string` |  | **@deprecated — use `targetElementId`.** |
| targetElementId | `string` |  | Element the section attaches to. |
| darkMode | `boolean` |  | Dark theme. |
| variant | `string` |  | Section wireframe variant. |
| dialogVariant | `string` |  | Dialog wireframe variant. |
| composerVariant | `string` |  | Composer wireframe variant. |
| shadowDom | `boolean` |  | Shadow-DOM isolation. |
| multiThread | `boolean` |  | Multi-thread mode. |
| sortData | `'asc' \| 'desc' \| 'none'` |  | **@deprecated — use `sortBy` and `sortOrder`.** |
| composerPosition | `'top' \| 'bottom'` |  | Composer placement. |
| sortBy | `'createdAt' \| 'lastUpdated'` |  | Sort field. |
| sortOrder | `'asc' \| 'desc'` |  | Sort order. |
| fullExpanded | `boolean` |  | Fully expand threads. |
| context | `{ [key: string]: any }` |  | Context for new comments. |
| contextOptions | `ContextOptions` |  | Context resolution options. |
| locationId | `string` |  | Scope to a location. |
| documentId | `string` |  | Scope to a document. |
| folderId | `string` |  | Scope to a folder. |
| commentPlaceholder | `string` |  | New-comment placeholder. |
| replyPlaceholder | `string` |  | Reply placeholder. |
| composerPlaceholder | `string` |  | Composer placeholder. |
| editPlaceholder | `string` |  | Edit placeholder. |
| editCommentPlaceholder | `string` |  | Edit-comment placeholder. |
| editReplyPlaceholder | `string` |  | Edit-reply placeholder. |
| readOnly | `boolean` |  | View-only. |
| anonymousEmail | `boolean` |  | Per-section override for anonymous email mentions. |
| messageTruncation | `boolean` | `false` (off) | Truncate long messages with show more/less. |
| messageTruncationLines | `number` | `4` | Lines before truncating (with `messageTruncation`). |
| defaultCondition | `boolean` |  | Visibility gate. |

### VeltInlineReactionsSection

`IVeltInlineReactionsSectionProps` (extends HTML attrs)

| Prop | Type | Default | Description / when to use |
|---|---|---|---|
| targetReactionElementId | `string` |  | Element the reactions section attaches to. |
| darkMode | `boolean` |  | Dark theme. |
| variant | `string` |  | Section wireframe variant. |
| shadowDom | `boolean` |  | Shadow-DOM isolation. |
| customReactions | `ReactionMap` |  | Custom emoji/reaction set. |

## Notifications

### VeltNotificationsPanel

`IVeltNotificationsPanelProps`

| Prop | Type | Default | Description / when to use |
|---|---|---|---|
| darkMode | `boolean` |  | Dark theme. |
| onNotificationClick | `Function` |  | Callback when a notification is clicked. |
| shadowDom | `boolean` |  | Shadow-DOM isolation. |
| variant | `string` |  | Panel wireframe variant. |
| tabConfig | `NotificationTabConfig` |  | Configure tabs (`forYou` / `documents` / `all` / `people`), each `{ name?, enable? }`. |
| readNotificationsOnForYouTab | `boolean` |  | Mark read when viewing the For You tab. |
| panelOpenMode | `NotificationPanelMode` |  | How the panel opens. |
| settings | `boolean` |  | Show settings UI. |
| selfNotifications | `boolean` |  | Include the current user's own notifications. |
| pageSize | `number` |  | Notifications per page. |
| settingsLayout | `NotificationSettingsLayout` |  | Settings layout. |
| enableSettingsAtOrganizationLevel | `boolean` |  | Org-level settings. |
| defaultCondition | `boolean` |  | Visibility gate. |
| enableCrossOrganization | `boolean \| string \| CrossOrganizationConfig` |  | Cross-org notifications. |

### VeltNotificationsTool

`IVeltNotificationsToolProps` (extends HTML attrs)

| Prop | Type | Default | Description / when to use |
|---|---|---|---|
| darkMode | `boolean` |  | Dark theme. |
| onNotificationClick | `Function` |  | Notification clicked callback. |
| shadowDom | `boolean` |  | Shadow-DOM isolation (tool). |
| panelShadowDom | `boolean` |  | Shadow-DOM for the opened panel. |
| variant | `string` |  | Tool wireframe variant. |
| tabConfig | `NotificationTabConfig` |  | Tab configuration. |
| panelOpenMode | `'popover' \| 'sidebar'` |  | How the panel opens. |
| panelVariant | `string` |  | Panel wireframe variant. |
| maxDays | `number` |  | Max age (days) of notifications to show. |
| readNotificationsOnForYouTab | `boolean` |  | Mark read on For You tab. |
| settings | `boolean` |  | Show settings. |
| selfNotifications | `boolean` |  | Include own notifications. |
| considerAllNotifications | `boolean` |  | Consider all notifications for the unread count. |
| pageSize | `number` |  | Notifications per page. |
| settingsLayout | `NotificationSettingsLayout` |  | Settings layout. |
| enableSettingsAtOrganizationLevel | `boolean` |  | Org-level settings. |
| defaultCondition | `boolean` |  | Visibility gate. |
| enableCrossOrganization | `boolean \| string \| CrossOrganizationConfig` |  | Cross-org notifications. |

> `VeltNotificationsHistoryPanel` (`IVeltNotificationsHistoryPanelProps`): `embedMode`, `onNotificationClick`, `darkMode`.

## Presence & cursors

### VeltPresence

`IVeltPresenceProps`

| Prop | Type | Default | Description / when to use |
|---|---|---|---|
| maxUsers | `number` |  | Max avatars to display before overflow. |
| inactivityTime | `number` |  | Ms of inactivity before a user is marked inactive. |
| offlineInactivityTime | `number` |  | Ms before marking a user offline. |
| documentParams | `any` |  | Document params for scoping presence. |
| location | `any` |  | Location object for scoping presence. |
| locationId | `string` |  | Location id for scoping presence. |
| onUsersChanged | `Function` |  | **@deprecated — use `onPresenceUserChange`.** |
| onPresenceUserChange | `Function` |  | Fires when the presence user list changes. |
| flockMode | `boolean` |  | Enable flock (follow) mode. |
| disableFlockNavigation | `boolean` |  | **@deprecated — use `defaultFlockNavigation`.** |
| defaultFlockNavigation | `boolean` |  | Default flock navigation behavior. |
| self | `boolean` |  | Include the current user in the list. |
| shadowDom | `boolean` |  | Shadow-DOM isolation. |
| onNavigate | `(pageInfo: { path: string, url: string, baseUrl: string }) => void` |  | Navigation callback during flock. |
| onPresenceUserClick | `(presenceUser: any) => any` |  | Fires when a presence avatar is clicked. |

### VeltCursor

`IVeltCursorProps` (extends HTML attrs)

| Prop | Type | Default | Description / when to use |
|---|---|---|---|
| avatarMode | `boolean` |  | Show user avatars on cursors. |
| inactivityTime | `number` |  | Ms before hiding an inactive cursor. |
| allowedElementIds | `string` |  | JSON-stringified array of element ids to constrain cursors to. (Stringify your array before passing.) |
| onCursorUsersChanged | `Function` |  | **@deprecated — use `onCursorUserChange`.** |
| onCursorUserChange | `Function` |  | Fires when the cursor user list changes. |

## Reactions

### VeltReactionTool

`IVeltReactionToolProps`

| Prop | Type | Default | Description / when to use |
|---|---|---|---|
| videoPlayerId | `string` |  | Bind the reaction tool to a specific video player. |
| onReactionToolClick | `Function` |  | Fires when the reaction tool is clicked. |

> There is **no** `VeltReactionsToolbar` component — reactions are exposed via `VeltReactionTool` and `VeltInlineReactionsSection`.

## Recorder

### VeltRecorderControlPanel

`IVeltRecorderControlPanelProps`

| Prop | Type | Default | Description / when to use |
|---|---|---|---|
| mode | `RecorderLayoutMode` |  | Layout mode of the control panel. |
| panelId | `string` |  | Bind to a specific recorder panel instance. |
| onRecordedData | `(data: RecordedData) => void` |  | Callback with recorded data when recording completes. |
| recordingCountdown | `boolean` |  | Show a countdown before recording. |
| recordingTranscription | `boolean` |  | Enable transcription. |
| videoEditor | `boolean` |  | Enable the video editor. |
| settingsEmbedded | `boolean` |  | Embed settings in the panel. |
| autoOpenVideoEditor | `boolean` |  | Auto-open the editor after recording. |
| playVideoInFullScreen | `boolean` |  | Play preview full screen. |
| retakeOnVideoEditor | `boolean` |  | Allow retake from the editor. |
| pictureInPicture | `boolean` |  | Enable PiP. |
| maxLength | `number` |  | Max recording length. |
| videoEditorTimelinePreview | `boolean` |  | Timeline preview in the editor. |

### VeltRecorderPlayer

`IVeltRecorderPlayerProps`

| Prop | Type | Default | Description / when to use |
|---|---|---|---|
| recorderId | `string` |  | Bind to a specific recording. |
| onDelete | `Function` |  | Fires when the recording is deleted. |
| showSummary | `boolean` |  | **@deprecated — use `summary`.** |
| summary | `boolean` |  | Show the recording summary. |
| shadowDom | `boolean` |  | Shadow-DOM isolation. |
| videoEditor | `boolean` |  | Enable the video editor. |
| playVideoInFullScreen | `boolean` |  | Play full screen. |
| retakeOnVideoEditor | `boolean` |  | Allow retake from the editor. |
| playbackOnPreviewClick | `boolean` |  | Start playback on preview click. |

> `VeltRecorderTool` (`type`, `panelId`, `buttonLabel`, `darkMode`, `shadowDom`, `recordingCountdown`, `variant`, `retakeOnVideoEditor`, `pictureInPicture`, `maxLength`) and `VeltRecorderNotes` (`shadowDom`, `videoEditor`, `recordingCountdown`, `recordingTranscription`, `playVideoInFullScreen`, `videoEditorTimelinePreview`) round out the recorder family.

## Media

### VeltVideoPlayer

`IVeltVideoPlayerProps`

| Prop | Type | Default | Description / when to use |
|---|---|---|---|
| src | `string` | — | **(required)** Video source URL. |
| darkMode | `boolean` |  | Dark theme. |
| sync | `boolean` |  | Sync playback across collaborators. |
| commentTool | `boolean` |  | Enable the in-player comment tool. |
| shadowDom | `boolean` |  | Shadow-DOM isolation. |

> `VeltCommentPlayerTimeline` (`totalMediaLength`, `offset`, `shadowDom`, `videoPlayerId`, `onCommentClick`, `onReactionClick`) overlays comment/reaction markers on a media timeline. `VeltCanvasComment` (`IVeltCanvasCommentProps`): **`canvasId` (required)**, **`position` (required)**.

## Huddle

### VeltHuddle

`IVeltHuddleProps`

| Prop | Type | Default | Description / when to use |
|---|---|---|---|
| chat | `boolean` |  | Enable in-huddle chat. |
| flockModeOnAvatarClick | `boolean` |  | Enter flock mode when an avatar is clicked. |
| serverFallback | `boolean` |  | Use server fallback for the huddle. |

> `VeltHuddleTool` (`IVeltHuddleToolProps`): `type`, `darkMode`.

## Tags & arrows

| Component | Props |
|---|---|
| `VeltTags` | `pinHighlighterClass` (CSS class for the pin highlighter). |
| `VeltTagTool` | `targetTagElementId` (element the tag tool attaches to). |
| `VeltArrows` | *no props* (`React.FC<any>`, renders `<velt-arrows>`). |
| `VeltArrowTool` | `darkMode`. |

## Users / access

### VeltUserInviteTool

`IVeltUserInviteToolProps` (extends HTML attrs)

| Prop | Type | Default | Description / when to use |
|---|---|---|---|
| type | `string` |  | Invite tool type. |
| source | `string` |  | Source identifier. |
| title | `string` |  | Dialog title. |
| placeholder | `string` |  | Input placeholder. |
| inviteUrl | `string` |  | Invite URL to share. |
| accessControlDropdown | `boolean` |  | Show the access-control dropdown. |
| documentUserAccessList | `boolean` |  | Show the document's user access list. |
| darkMode | `boolean` |  | Dark theme. |

> `VeltUserRequestTool` (`IVeltUserRequestToolProps`): `type` — default `'feedback'`; allowed `'feedback'` / `'reportBug'` / `'contactUs'`.

## Analytics & utilities

| Component | Props |
|---|---|
| `VeltViewAnalytics` | `type` (`'document' \| 'location'`), `locationId`. |
| `VeltActivityLog` | `darkMode`, `shadowDom`, `useDummyData`, `variant`. |
| `VeltSingleEditorModePanel` | `shadowDom`, `variant`, `darkMode`. |
| `VeltAutocomplete` | **`hotkey` (required)** (key that triggers it, e.g. `@`), **`listData` (required)** (`AutocompleteItem[]`). |

---

## Deprecated / legacy prop index

| Component | Prop | Replacement |
|---|---|---|
| VeltComments | onCommentAdd / onCommentUpdate | the event hooks (`useAddCommentAnnotation`, …) |
| VeltComments | recordingSummary | recordingTranscription |
| VeltComments | multiThreadMode | multiThread |
| VeltComments | groupMultipleMatch | groupMatchedComments |
| VeltCommentThread (component) | — | use `VeltCommentDialog` |
| VeltCommentsSidebar (V1) | enableUrlNavigation | urlNavigation |
| VeltCommentsSidebar (V1) | openSidebar | onSidebarOpen |
| VeltCommentsSidebar (V1) | onSidebarCommentClick | onCommentClick |
| VeltCommentsSidebarV2 | enableUrlNavigation | urlNavigation |
| VeltCommentsSidebarV2 | openSidebar | onSidebarOpen |
| VeltCommentsSidebarV2 | onSidebarCommentClick | onCommentClick |
| VeltCommentBubble | targetCommentElementId | targetElementId |
| VeltCommentBubble | showAvatar | avatar |
| VeltCommentTool | targetCommentElementId | targetElementId |
| VeltInlineCommentsSection | targetInlineCommentElementId | targetElementId |
| VeltInlineCommentsSection | targetCommentElementId | targetElementId |
| VeltInlineCommentsSection | sortData | sortBy + sortOrder |
| VeltPresence | onUsersChanged | onPresenceUserChange |
| VeltPresence | disableFlockNavigation | defaultFlockNavigation |
| VeltCursor | onCursorUsersChanged | onCursorUserChange |
| VeltRecorderPlayer | showSummary | summary |
