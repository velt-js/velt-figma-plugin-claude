# Feature · Other comment surfaces (Text, Inline, Multi‑thread)

Three comment *variants* beyond the standard dialog/sidebar. They reuse the comment data model and hooks (so the comment hooks in [`../reference/hooks.md`](../reference/hooks.md) apply), and each is **wireframed**.

---

## Text Comment (selection‑anchored)

A toolbar that appears on text selection to comment on / rewrite the selected text.

- **Primitives:** `VeltTextComment`, `VeltTextCommentTool`, `VeltTextCommentToolbar` (sub‑accessors `.CommentAnnotation` / `.Copywriter` / `.Generic` / `.Divider`).
- **Wireframes:** `VeltTextCommentToolWireframe`; `VeltTextCommentToolbar` wireframe → `.CommentAnnotation`, `.Copywriter` (shown when AI rewriter enabled), `.Generic`, `.Divider`.
- **Key tokens** (use full paths where they collide): `{showAdder}`, `{commentToolEnabled}`, `{isUserAllowed}`, `{enableTextComments}`, `{rewriterEnabled}`, `{selectedWordsCount}`, `{selectedCharactersCount}`, `{position.top}`/`{position.left}`, `{uiState.disabled}`.
- **Hooks:** none dedicated — drive via the comment element (`useCommentUtils`) and AI rewriter (`useAIRewriterUtils`).
- **Limitation:** thinner slot set (the four toolbar buttons); no dedicated hooks.

---

## Inline Comments Section (Substack‑style)

A comment thread anchored to a target element, with its own composer, list, filter, and sort. **Very rich** — renders comment‑dialog primitives internally (so nested comment‑dialog wireframes/variables resolve here too).

- **Primitive:** `VeltInlineCommentsSection` — many props: `targetElementId`, `composerPosition` (`'top'|'bottom'`), `sortBy` (`'createdAt'|'lastUpdated'`), `sortOrder` (`'asc'|'desc'`), `multiThread`, `dialogVariant`/`composerVariant`, `fullExpanded`, `readOnly`, all the `*Placeholder` props, `context`/`contextOptions`, `messageTruncation(Lines)`, `darkMode`/`shadowDom`/`variant`.
- **Wireframe slot tree** (`VeltInlineCommentsSectionWireframe`):
  ```
  .Skeleton · .Panel · .List · .ComposerContainer · .CommentCount
  .FilterDropdown → .Trigger(.Name/.Arrow) / .Content(.ApplyButton, .List→.Item→.Label/.Checkbox)
  .SortingDropdown → .Trigger(.Icon/.Name) / .Content→.Item(.Icon/.Name/.Tick)
  ```
- **Key tokens:** `{skeletonLoading}`, `{annotations}`, `{filterState.filterDropdownOpen}`, `{sortState.sortingDropdownOpen}`, `{isResolvedCommentsOnDomFilterSelected}`; per‑item `{filter.isSelected}`, `{sortOption}`, `{isActive}`, `{isAscending}`.
- **Hooks:** the shared comment hooks (no section‑specific hook).

---

## Multi‑Thread Comment Dialog

Multiple threads in one dialog/panel (e.g. all comments on a region), with a minimal filter + bulk actions. Also renders comment‑dialog primitives internally.

- **Primitive:** `VeltMultiThreadCommentDialog` — props `annotationId`, `multiThreadAnnotationId`, `commentPinSelected`, `commentPinType`, `dialogVariant`, `inboxMode`, `readOnly`, `context`.
- **Wireframe slot tree** (`VeltMultiThreadCommentDialogWireframe`):
  ```
  .CommentCount · .ComposerContainer · .List · .CloseButton · .NewThreadButton
  .ResetFilterButton · .EmptyPlaceholder
  .MinimalFilterDropdown → .Trigger / .Content(.FilterAll/.FilterUnread/.FilterRead/.FilterResolved/.SelectedIcon/.SortDate/.SortUnread)
  .MinimalActionsDropdown → .Trigger / .Content(.MarkAllRead/.MarkAllResolved)
  ```
- **Key tokens:** `{filteredAnnotations}`, `{nonDraftCommentsCount}`, `{minimalFilter}` (`'all'|'read'|'unread'|'resolved'`), `{noCommentsFound}`, `{noCommentsFoundForAppliedFilters}`, `{hideMultiThreadAnnotationComposer}`; per minimal‑filter item `{isSelected}`.
- **Hooks:** the shared comment hooks.

> All three follow the same rules as the comment dialog — the interactivity rule (R4), scoping (nest vs root), and `shadowDom`/CSS guidance all apply. The visible "panel" is the container; fill the slots inside it.
