# Reference · CSS classes (complete, per component, with conditions)

Every **stateful / conditional** `velt-*` class the SDK toggles — extracted per component, with the **condition** that applies it (the condition *is* the description: "applied when …"). Target these (override with `!important`, R9b) to style state without a wireframe or hook. Prefer the `velt-*` BEM class over the short legacy twin where both appear.

> Generated from source and exhaustive for **conditional** classes. Always‑on structural classes (e.g. `velt-…--container`) aren't toggled by a condition — find them by inspecting the element (`shadowDom={false}`). Conditions reference internal SDK state expressions; read them as "applied when <expr> is truthy".

## comment

**text-comment-toolbar-copywriter**

- `velt-text-comment-toolbar-copywriter--disabled` — applied when `componentConfig.data.selectedWordsCount < componentConfig.uiState.MIN_ALLOWED_WORDS_COUNT || componentConfig.data.selectedCharactersCount < componentConfig.uiState.MIN_ALLOWED_CHARACTERS_COUNT || componentConfig.data.selectedCharactersCount > componentConfig.uiState.MAX_ALLOWED_CHARACTERS_COUNT`

**text-comment-toolbar-generic**

- `velt-text-comment-toolbar-generic--disabled` — applied when `componentConfig.data.selectedWordsCount < componentConfig.uiState.MIN_ALLOWED_WORDS_COUNT || componentConfig.data.selectedCharactersCount < componentConfig.uiState.MIN_ALLOWED_CHARACTERS_COUNT || componentConfig.data.selectedCharactersCount > componentConfig.uiState.MAX_ALLOWED_CHARACTERS_COUNT`

**inline-comments-section**

- `dark` — applied when `config.uiState.darkMode`

**inline-comments-section-sorting-dropdown-content-item**

- `velt-inline-comments-section-sorting-dropdown-content-item--active` — applied when `isActive()`

**inline-comments-section-sorting-dropdown-trigger**

- `velt-inline-comments-section-sorting-dropdown-trigger-open` — applied when `config.uiState?.sortState?.sortingDropdownOpen`

**inline-comments-section-list**

- `multi-thread` — applied when `localUIStateSignal()?.multiThread`

**inline-comments-section-filter-dropdown-trigger-arrow**

- `velt-dropdown-arrow--open` — applied when `config.uiState?.filterState?.filterDropdownOpen`

**comments-stream-view**

- `selected` — applied when `componentConfig.selectedAnnotationsMap[entry?.annotation?.annotationId!]`

**comment-sidebar-filter-button**

- `velt-comments-sidebar-filter-button-open` — applied when `componentConfig.moreFiltersVisible`

**comments-sidebar-document-filter-dropdown-trigger**

- `velt-comment-sidebar-location-filter-dropdown-trigger-icon-flipped` — applied when `componentConfig.documentFilterDropdownOpen`
- `velt-comments-sidebar-document-filter-dropdown-trigger-open` — applied when `componentConfig.documentFilterDropdownOpen`

**comment-sidebar-filter-search-dropdown-icon**

- `velt-sidebar-filter--search-dropdown-icon-open` — applied when `dropdownOpen`

**comment-sidebar-filter-document**

- `velt-sidebar-filter--max-height` — applied when `maxHeight`

**comment-sidebar-filter-item**

- `velt-comment-sidebar-filter-item--Added` — applied when `value?.id === componentConfig?.user?.userId`
- `velt-comment-sidebar-filter-item--Me` — applied when `value?.id === componentConfig?.user?.userId`

**comment-sidebar-filter**

- `visible` — applied when `componentConfig.moreFiltersVisible`

**comment-sidebar-minimal-filter-dropdown-trigger**

- `velt-comment-sidebar-minimal-filter-dropdown-trigger--filter-selected` — applied when `componentConfig.selectedMinimalFilterDropdownOption.filter !== 'all'`
- `velt-comment-sidebar-minimal-filter-dropdown-trigger-open` — applied when `componentConfig.minimalFilterDropdownOpen`

**comment-sidebar-minimal-filter-dropdown-content-filter-reset**

- `velt-comment-sidebar-minimal-filter-content-item--selected` — applied when `componentConfig.selectedMinimalFilterDropdownOption.filter === 'reset'`

**comment-sidebar-minimal-filter-dropdown-content-filter-read**

- `velt-comment-sidebar-minimal-filter-content-item--selected` — applied when `componentConfig.selectedMinimalFilterDropdownOption.filter === 'read'`

**comment-sidebar-minimal-filter-dropdown-content-filter-resolved**

- `velt-comment-sidebar-minimal-filter-content-item--selected` — applied when `componentConfig.selectedMinimalFilterDropdownOption.filter === 'resolved'`

**comment-sidebar-minimal-filter-dropdown-content-sort-date**

- `velt-comment-sidebar-minimal-filter-content-item--selected` — applied when `componentConfig.selectedMinimalFilterDropdownOption.sorting === 'date'`

**comment-sidebar-minimal-filter-dropdown-content-filter-all**

- `velt-comment-sidebar-minimal-filter-content-item--selected` — applied when `componentConfig.selectedMinimalFilterDropdownOption.filter === 'all'`

**comment-sidebar-minimal-filter-dropdown-content-filter-open**

- `velt-comment-sidebar-minimal-filter-content-item--selected` — applied when `componentConfig.selectedMinimalFilterDropdownOption.filter === 'open'`

**comment-sidebar-minimal-filter-dropdown-content-filter-assigned-to-me**

- `velt-comment-sidebar-minimal-filter-content-item--selected` — applied when `componentConfig.selectedMinimalFilterDropdownOption.filter === 'assignedToMe'`

**comment-sidebar-minimal-filter-dropdown-content-sort-unread**

- `velt-comment-sidebar-minimal-filter-content-item--selected` — applied when `componentConfig.selectedMinimalFilterDropdownOption.sorting === 'unread'`

**comment-sidebar-minimal-filter-dropdown-content-filter-unread**

- `velt-comment-sidebar-minimal-filter-content-item--selected` — applied when `componentConfig.selectedMinimalFilterDropdownOption.filter === 'unread'`

**comment-sidebar-minimal-filter-dropdown-content-selected-icon**

- `velt-comment-sidebar-minimal-filter-content-item-selected-icon--selected` — applied when `isSelected`

**comment-sidebar-action-button**

- `velt-comment-sidebar-action-button-active` — applied when `componentConfig?.customActionsState?.[id]`

**comments-sidebar-status-dropdown-trigger**

- `velt-comments-sidebar-status-open` — applied when `componentConfig.isOpen`

**comments-sidebar-status-dropdown-trigger-arrow**

- `velt-dropdown-arrow--open` — applied when `componentConfig.isOpen`

**comments-sidebar**

- `dark` — applied when `componentConfig.darkMode`

**comment-sidebar-list-item-group-arrow**

- `velt-comment-sidebar-list--icon-expanded` — applied when `scrollData?.data?.isExpanded`

**comment-sidebar-location-filter-dropdown-trigger**

- `velt-comment-sidebar-location-filter-dropdown-trigger-open` — applied when `componentConfig.locationFilterDropdownOpen`

**comment-sidebar-panel**

- `velt-comment-sidebar-panel--more-filters-visible` — applied when `componentConfig.moreFiltersVisible`

**comment-sidebar-minimal-actions-dropdown-trigger**

- `velt-comment-sidebar-minimal-actions-dropdown-trigger-open` — applied when `componentConfig.minimalActionsDropdownOpen`

**comments-sidebar-wrapper**

- `embed` — applied when `componentConfig.embedMode`
- `floating` — applied when `componentConfig.floatingMode`
- `mobile` — applied when `componentConfig.isPhone`
- `page` — applied when `componentConfig.pageMode`
- `s-overflow-hidden` — applied when `componentConfig.moreFiltersVisible`
- `velt-comment-sidebar--read-only` — applied when `componentConfig.readOnly`
- `velt-sidebar--more-filters-visible` — applied when `componentConfig.moreFiltersVisible`
- `velt-sidebar-container--fullscreen` — applied when `componentConfig.fullScreen`
- `visible` — applied when `(componentConfig.sidebarVisible || componentConfig.embedMode || componentConfig.floatingMode)`

**comment-pin-number**

- `velt-comment-pin--number-3-digit` — applied when `componentConfig.data?.annotation?.annotationNumber?.toString()?.length === 3`

**comment-pin-triangle**

- `velt-display-none` — applied when `!coreService.globalConfigSignal().featureState.popoverTriangleComponent`

**comment-pin-index**

- `velt-comment-pin--index-3-digit` — applied when `componentConfig.data?.annotation?.annotationIndex?.toString()?.length === 3`

**comment-pin**

- `velt-comment-pin--agent` — applied when `isAgentComment()`
- `velt-comment-pin--different-device` — applied when `isDeviceIndicatorWithDifferentDevice()`
- `velt-comment-pin--ghost` — applied when `!!componentConfig.data.annotation?.ghostComment`
- `velt-comment-pin--marker-default` — applied when `!usingCustomCommentPin`
- `velt-comment-pin--marker-transparent` — applied when `usingCustomCommentPin`
- `velt-comment-pin--outside-viewport` — applied when `!componentConfig.uiState.annotationDragging && isOutsideViewport`
- `velt-comment-pin-open` — applied when `componentConfig.uiState.commentPinSelected && !componentConfig.uiState.annotationDragging`
- `velt-comment-pin-unread-comment` — applied when `isAuthenticatedUser() && componentConfig.data?.unreadCommentsMap?.[componentConfig.data.annotation?.annotationId!]`
- `velt-display-none` — applied when `localUIStateSignal().commentPinType !== 'bubble' && componentConfig.data.commentBubbleElementAnnotationId && componentConfig.data.commentBubbleElementAnnotationId !== componentConfig.data.annotation?.annotationId`

**sidebar-button**

- `dark` — applied when `darkMode`
- `velt-sidebar-button--visible` — applied when `coreService.globalConfigSignal().featureState.sidebarVisible`
- `velt-sidebar-tool-open` — applied when `coreService.globalConfigSignal().featureState.sidebarVisible`

**comments-tool**

- `active` — applied when `componentConfig.uiState.addCommentMode`
- `velt-tool--action-btn-disabled` — applied when `!componentConfig.uiState.commentToolEnabled`

**comment-inbox**

- `mobile` — applied when `componentConfig.isPhone`
- `visible` — applied when `!!componentConfig.commentAnnotation`

**comment-dialog**

- `bottom-sheet` — applied when `componentConfig.uiState?.bottomSheetMode`
- `bottom-sheet` — applied when `componentConfigSignal()?.uiState?.bottomSheetMode`
- `dialog` — applied when `!isSidebarMode()`
- `dialog` — applied when `componentConfig.featureState?.dialogMode`
- `dialog` — applied when `componentConfigSignal()?.featureState?.dialogMode`
- `inbox` — applied when `componentConfig.featureState?.inboxMode`
- `inbox` — applied when `componentConfigSignal()?.featureState?.inboxMode`
- `inline-comment-mode` — applied when `componentConfig.featureState?.inlineCommentMode && !componentConfig.featureState?.isInsidePdfViewer`
- `inline-comment-mode` — applied when `componentConfig.featureState?.inlineCommentMode`
- `inline-comment-mode` — applied when `componentConfigSignal()?.featureState?.inlineCommentMode && !componentConfigSignal()?.featureState?.isInsidePdfViewer`
- `no-comments` — applied when `!componentConfig.data?.annotation?.comments?.length`
- `no-comments` — applied when `!componentConfigSignal()?.data?.annotation?.comments?.length`
- `private-comment` — applied when `componentConfig.uiState?.isPrivateComment`
- `private-comment` — applied when `componentConfigSignal()?.uiState?.isPrivateComment`
- `readonly` — applied when `(componentConfig.appState?.user?.isReadOnly || componentConfig.appState?.user?.isAnonymous)`
- `readonly` — applied when `(componentConfigSignal()?.appState?.user?.isReadOnly || componentConfigSignal()?.appState?.user?.isAnonymous)`
- `s-ghost-comment-annotation` — applied when `componentConfig.uiState?.showGhostCommentMessage`
- `s-ghost-comment-annotation` — applied when `componentConfigSignal()?.uiState?.showGhostCommentMessage`
- `screen-recording` — applied when `componentConfig.uiState?.recorderInitConfig?.type === 'screen'`
- `screen-recording` — applied when `componentConfigSignal()?.uiState?.recorderInitConfig?.type === 'screen'`
- `selected` — applied when `localUIStateSignal()?.commentDialogSelected`
- `selected` — applied when `localUIStateSignal().commentDialogSelected`
- `sidebar` — applied when `isSidebarMode()`
- `sidebar` — applied when `localUIStateSignal()?.sidebarMode`
- `sidebar` — applied when `localUIStateSignal().sidebarMode`
- `velt-comment-dialog--bottom-sheet` — applied when `componentConfig.uiState?.bottomSheetMode`
- `velt-comment-dialog--bottom-sheet` — applied when `componentConfigSignal()?.uiState?.bottomSheetMode`
- `velt-comment-dialog--comment-composer-mode` — applied when `componentConfig.uiState?.commentComposerMode`
- `velt-comment-dialog--comment-composer-mode` — applied when `componentConfigSignal()?.uiState?.commentComposerMode`
- `velt-comment-dialog--dialog-mode` — applied when `!isSidebarMode()`
- `velt-comment-dialog--dialog-mode` — applied when `componentConfig.featureState?.dialogMode`
- `velt-comment-dialog--dialog-mode` — applied when `componentConfigSignal()?.featureState?.dialogMode`
- `velt-comment-dialog--focused-thread-mode` — applied when `localUIStateSignal()?.focusedThreadMode`
- `velt-comment-dialog--ghost-comment-annotation` — applied when `componentConfig.uiState?.showGhostCommentMessage`
- `velt-comment-dialog--ghost-comment-annotation` — applied when `componentConfigSignal()?.uiState?.showGhostCommentMessage`
- `velt-comment-dialog--hide` — applied when `showDefault()`
- `velt-comment-dialog--inbox-mode` — applied when `componentConfig.featureState?.inboxMode`
- `velt-comment-dialog--inbox-mode` — applied when `componentConfigSignal()?.featureState?.inboxMode`
- `velt-comment-dialog--inline-comment-mode` — applied when `componentConfig.featureState?.inlineCommentMode && !componentConfig.featureState?.isInsidePdfViewer`
- `velt-comment-dialog--inline-comment-mode` — applied when `componentConfigSignal()?.featureState?.inlineCommentMode && !componentConfigSignal()?.featureState?.isInsidePdfViewer`
- `velt-comment-dialog--inline-comment-section-mode` — applied when `localUIStateSignal()?.inlineCommentSectionMode`
- `velt-comment-dialog--multi-thread-mode` — applied when `componentConfig.uiState?.multiThreadAnnotationId`
- `velt-comment-dialog--multi-thread-mode` — applied when `componentConfigSignal()?.uiState?.multiThreadAnnotationId`
- `velt-comment-dialog--no-comments` — applied when `!componentConfig.data?.annotation?.comments?.length`
- `velt-comment-dialog--no-comments` — applied when `!componentConfigSignal()?.data?.annotation?.comments?.length`
- `velt-comment-dialog--page-comment` — applied when `componentConfig.data?.annotation?.isPageAnnotation`
- `velt-comment-dialog--page-comment` — applied when `componentConfigSignal()?.data?.annotation?.isPageAnnotation`
- `velt-comment-dialog--page-mode-composer` — applied when `localUIStateSignal()?.pageModeComposer`
- `velt-comment-dialog--private-comment` — applied when `componentConfig.uiState?.isPrivateComment`
- `velt-comment-dialog--private-comment` — applied when `componentConfigSignal()?.uiState?.isPrivateComment`
- `velt-comment-dialog--read-only` — applied when `localUIStateSignal()?.readOnly`
- `velt-comment-dialog--readonly` — applied when `(componentConfig.appState?.user?.isReadOnly || componentConfig.appState?.user?.isAnonymous)`
- `velt-comment-dialog--readonly` — applied when `(componentConfigSignal()?.appState?.user?.isReadOnly || componentConfigSignal()?.appState?.user?.isAnonymous)`
- `velt-comment-dialog--screen-recording` — applied when `componentConfig.uiState?.recorderInitConfig?.type === 'screen'`
- `velt-comment-dialog--screen-recording` — applied when `componentConfigSignal()?.uiState?.recorderInitConfig?.type === 'screen'`
- `velt-comment-dialog--selected` — applied when `localUIStateSignal()?.commentDialogSelected`
- `velt-comment-dialog--selected` — applied when `localUIStateSignal().commentDialogSelected`
- `velt-comment-dialog--sidebar-mode` — applied when `isSidebarMode()`
- `velt-comment-dialog--sidebar-mode` — applied when `localUIStateSignal()?.sidebarMode`
- `velt-comment-dialog--sidebar-mode` — applied when `localUIStateSignal().sidebarMode`

**comment-dialog-thread-card-message**

- `velt-thread-card--draft` — applied when `comment()?.isDraft || hasEditDraft()`
- `velt-thread-card--edit-draft` — applied when `hasEditDraft()`
- `velt-thread-card--inline-mode` — applied when `componentConfig?.featureState?.inlineCommentSectionMode`
- `velt-thread-card--message-truncated` — applied when `isTruncationActive() && !isExpanded()`

**comment-dialog-thread-card-reactions**

- `s-emoji-block-no-margin` — applied when `hasAttachmentsOrRecorders()`

**comment-dialog-thread-card-device-type**

- `dark` — applied when `componentConfig?.uiState?.darkMode`

**comment-dialog-thread-card-edited**

- `velt-thread-card--edit-draft-badge` — applied when `hasEditDraft()`

**comment-dialog-thread-card**

- `velt-thread-card--edit-mode` — applied when `isInEditMode()`
- `velt-thread-card--show-actions` — applied when `showActions()`

**comment-dialog-thread-card-assign-button**

- `dark` — applied when `componentConfig?.uiState?.darkMode`

**comment-dialog-thread-card-seen-dropdown-trigger**

- `velt-comment-dialog-seen-dropdown--trigger-open` — applied when `isDropdownOpen()`

**comment-dialog-thread-card-seen-dropdown-content-item-name**

- `velt-comment-dialog-seen-dropdown--content-item-name-dark` — applied when `componentConfig?.uiState?.darkMode`

**comment-dialog-thread-card-seen-dropdown-content-item-time**

- `velt-comment-dialog-seen-dropdown--content-item-time-dark` — applied when `componentConfig?.uiState?.darkMode`

**comment-dialog-thread-card-seen-dropdown-content-title**

- `velt-comment-dialog-seen-dropdown--content-title-dark` — applied when `componentConfig?.uiState?.darkMode`

**comment-dialog-agent-suggestion**

- `velt-agent-suggestion--sidebar` — applied when `localUIStateSignal().sidebarMode`

**body**

- `velt-agent-suggestion-body__text--clamped` — applied when `isSidebar()`

**menu-content-item**

- `velt-agent-suggestion__menu-item--danger` — applied when `isDanger()`

**status-icon**

- `velt-agent-suggestion-banner__badge--accepted` — applied when `glyph() === 'check'`
- `velt-agent-suggestion-banner__badge--rejected` — applied when `glyph() === 'cross'`

**banner**

- `velt-agent-suggestion-banner--accepted` — applied when `isAccepted()`
- `velt-agent-suggestion-banner--has-visibility-banner` — applied when `hasVisibilityBanner()`
- `velt-agent-suggestion-banner--private-comment-mode` — applied when `isPrivateComment()`
- `velt-agent-suggestion-banner--rejected` — applied when `isRejected()`

**comment-dialog-assign-dropdown**

- `s-dark` — applied when `darkMode`
- `velt-assign-dropdown--checkbox-icon-selected` — applied when `isAssignedCheckbox`
- `velt-assign-dropdown--checkbox` — applied when `assignToType === 'checkbox'`
- `velt-assign-dropdown--item-dark` — applied when `darkMode`

**comment-dialog-assign-menu**

- `velt-assign-menu-inline-panel--dark` — applied when `!!componentConfigSignal()?.uiState?.darkMode`

**comment-dialog-custom-annotation-dropdown-trigger**

- `no-selected` — applied when `!hasSelection()`

**comment-dialog-custom-annotation-dropdown-trigger-list**

- `multi-selected` — applied when `customListItems.length > 1`

**comment-dialog-custom-annotation-dropdown-content-item-label**

- `velt-custom-annotation-dropdown--content-item-text-dark` — applied when `isDarkMode()`

**comment-dialog-custom-annotation-dropdown-content-item**

- `selected` — applied when `isSelected()`

**comment-dialog-composer**

- `velt-comment-dialog-composer--inline` — applied when `localUIStateSignal()?.inlineCommentSectionMode`
- `velt-comment-dialog-composer--no-comments` — applied when `!componentConfigSignal()?.data?.annotation?.comments?.length`
- `velt-comment-dialog-composer--recording` — applied when `isRecordingActive()`
- `velt-comment-dialog-composer--top` — applied when `componentConfigSignal()?.uiState?.composerPosition === 'top'`
- `velt-composer--comment-composer-mode` — applied when `componentConfig?.uiState?.commentComposerMode`
- `velt-composer--inline-comment-section-mode` — applied when `localUIStateSignal()?.inlineCommentSectionMode`
- `velt-composer--multi-thread-mode` — applied when `componentConfig?.uiState?.multiThreadAnnotationId`
- `velt-composer-edit-mode` — applied when `editMode()`
- `velt-composer-input-focused` — applied when `componentConfigSignal()?.uiState?.isInputFocused`
- `velt-composer-open` — applied when `localUIStateSignal()?.composerInOpenState`

**comment-dialog-composer-action-button**

- `velt-composer-action-button--selected` — applied when `componentConfig.uiState?.formatToolbarOpen`

**comment-dialog-composer-attachments-other**

- `velt-composer-attachment--loading` — applied when `isLoading()`

**comment-dialog-composer-attachments-image**

- `velt-composer-attachment--loading` — applied when `isLoading()`

**comment-dialog-body**

- `velt-comment-dialog-body--closed` — applied when `!isDialogSelected() && componentConfig.data?.annotation?.comments?.length`
- `velt-comment-dialog-body--focused-thread-mode` — applied when `localUIStateSignal()?.focusedThreadMode`
- `velt-comment-dialog-body--inline-comment-section-mode` — applied when `localUIStateSignal()?.inlineCommentSectionMode`
- `velt-comment-dialog-body--reply-avatars-inline-mode` — applied when `componentConfig.featureState?.inlineCommentSectionMode`

**comment-dialog-visibility-banner-dropdown**

- `velt-visibility-banner-clickable` — applied when `isSelectedPeopleVisibility()`

**comment-dialog-visibility-banner-dropdown-trigger**

- `velt-trigger-open` — applied when `isAnyDropdownOpen()`

**comment-dialog-visibility-banner-dropdown-trigger-icon**

- `velt-trigger-icon-open` — applied when `isAnyDropdownOpen()`

**comment-dialog-visibility-banner-dropdown-content-org-picker**

- `velt-org-picker-overlay--dark` — applied when `darkMode`

**comment-dialog-visibility-banner-dropdown-content-item**

- `selected` — applied when `isSelected()`

**comment-dialog-visibility-banner-dropdown-content-user-picker**

- `velt-user-picker-overlay--dark` — applied when `darkMode`
- `velt-user-picker-overlay--readonly` — applied when `isReadOnly()`

**comment-dialog-comment-suggestion-status**

- `velt-comment-suggestion-status--accepted` — applied when `effectiveStatus()?.id === componentConfig?.featureState?.commentAcceptedStatus?.id`
- `velt-comment-suggestion-status--rejected` — applied when `effectiveStatus()?.id === componentConfig?.featureState?.commentRejectedStatus?.id`

**comment-dialog-status-dropdown-content-item-name**

- `velt-status-dropdown-content-item--dark` — applied when `componentConfig?.uiState?.darkMode`

**comment-dialog-priority-dropdown-content-item-tick**

- `velt-priority-dropdown-content-item-tick--dark` — applied when `componentConfig?.uiState?.darkMode`

**comment-dialog-priority-dropdown-content-item-name**

- `velt-priority-dropdown-content-item-name--dark` — applied when `componentConfig?.uiState?.darkMode`

**comment-dialog-priority-dropdown-content-item**

- `selected` — applied when `isSelected()`

**comment-dialog-toggle-reply**

- `velt-toggle-reply--button-inline-mode` — applied when `componentConfig.featureState.inlineCommentSectionMode`
- `velt-toggle-reply--button-reply-avatars` — applied when `componentConfig?.featureState?.replyAvatars`
- `velt-toggle-reply--button` — applied when `!componentConfig.featureState.inlineCommentSectionMode`
- `velt-toggle-reply--readonly` — applied when `componentConfig?.uiState?.readOnly`

**comment-dialog-options-dropdown-content-delete**

- `velt-comment-dialog-options-dropdown-content-item--dark` — applied when `componentConfig?.uiState?.darkMode`

**comment-dialog-assignee-banner**

- `private-comment` — applied when `componentConfig.uiState?.isPrivateComment`
- `velt-assignee-banner--has-visibility-banner` — applied when `hasVisibilityBanner()`
- `velt-assignee-banner--private-comment-mode` — applied when `componentConfig.uiState?.isPrivateComment`

**comment-dialog-metadata**

- `has-assignee-banner` — applied when `componentConfig.data?.annotation?.assignedTo && !componentConfig.featureState?.inlineCommentMode`
- `private-comment` — applied when `componentConfig.uiState?.isPrivateComment`

**comments-minimap**

- `v-unread-comment` — applied when `!componentConfig.user?.isGuest && !componentConfig.user?.isAnonymous && componentConfig.unreadCommentsMap?.[data?.value?.annotation?.annotationId!]`
- `velt-comments-minimap-container--target-scrollable-element` — applied when `!!componentConfig.targetScrollableElementId`
- `velt-comments-minimap-position--left` — applied when `componentConfig.position === 'left'`

**chart-comment**

- `ghost-comment` — applied when `ghostComment`
- `selected` — applied when `!!selectedAnnotationsMap[commentAnnotations[0]?.annotationId!]`

**comment-bubble**

- `velt-comment-bubble-hover` — applied when `localUIStateSignal().commentBubbleTargetPinHover`
- `velt-comment-bubble-open` — applied when `!!componentConfig.uiState.selectedAnnotationsMap[componentConfig.data.annotation?.annotationId!]`

**comment-pin-portal**

- `pin-dragging` — applied when `componentConfig.annotationDragging`

**comment-text-portal**

- `agent-comment` — applied when `componentConfig.commentPinAnnotation?.sourceType === 'agent'`
- `index-3-digit` — applied when `componentConfig.commentPinAnnotation?.annotationNumber?.toString()?.length === 3`
- `inline-comment-mode` — applied when `(componentConfig.inlineCommentMode && !componentConfig.isInsidePdfViewer)`
- `selected` — applied when `componentConfig.commentPinHover || componentConfig.commentPinSelected`

**multi-thread-comment-dialog**

- `velt-multi-thread-comment-dialog-container--inbox-mode` — applied when `componentConfigSignal().uiState.inboxMode`

**multi-thread-comment-dialog-minimal-filter-dropdown-content-selected-icon**

- `velt-multi-thread-comment-dialog-minimal-filter-content-item-selected-icon--selected` — applied when `isSelected`

**multi-thread-comment-dialog-minimal-actions-dropdown-trigger**

- `velt-multi-thread-comment-dialog-minimal-actions-dropdown-trigger-open` — applied when `componentConfig.uiState.minimalActionsDropdownOpen`

**multi-thread-comment-dialog-minimal-filter-dropdown-trigger**

- `velt-multi-thread-comment-dialog-minimal-filter-dropdown-trigger--filter-selected` — applied when `componentConfig.uiState.selectedMinimalFilterDropdownOption.filter !== 'all' && componentConfig.uiState.selectedMinimalFilterDropdownOption.filter !== null`
- `velt-multi-thread-comment-dialog-minimal-filter-dropdown-trigger-open` — applied when `componentConfig.uiState.minimalFilterDropdownOpen`

**comment-sidebar-v2**

- `dark` — applied when `config.uiState.darkMode`
- `embed` — applied when `localUIStateSignal().embedMode`
- `floating` — applied when `localUIStateSignal().floatingMode`
- `page` — applied when `localUIStateSignal().pageMode`
- `velt-comment-sidebar--read-only` — applied when `localUIStateSignal().readOnly`
- `velt-sidebar-container--fullscreen` — applied when `config.uiState.fullScreen`
- `visible` — applied when `!defaultCondition() || config.uiState.sidebarVisible || localUIStateSignal().embedMode || localUIStateSignal().floatingMode`

**comment-sidebar-filter-container-v2**

- `velt-sidebar-filter-panel--bottom-sheet` — applied when `panelLayout() !== 'menu'`
- `velt-sidebar-filter-panel--menu` — applied when `panelLayout() === 'menu'`
- `velt-sidebar-filter-panel-overlay--menu` — applied when `panelLayout() === 'menu'`

**control**

- `velt-filter-select-control--open` — applied when `expanded`

**chevron**

- `velt-filter-select-chevron--up` — applied when `up()`

**comment-sidebar-filter-dropdown-content-list-item-v2**

- `velt-sidebar-filter-list-item--selected` — applied when `isSelected()`

**comment-sidebar-filter-dropdown-trigger-v2**

- `velt-sidebar-filter-trigger--filter-selected` — applied when `isActive()`

**comment-sidebar-panel-v2**

- `velt-comment-sidebar-panel--more-filters-visible` — applied when `componentConfig.uiState.moreFiltersVisible`

**comment-sidebar-filter-button-v2**

- `velt-sidebar-main-filter-button--filter-selected` — applied when `isFilterActive()`

**chevron**

- `velt-sidebar-group-chevron--collapsed` — applied when `!group()?.isExpanded`

**persistent-comment-mode**

- `private-comment-mode` — applied when `componentConfig.privateCommentModeEnabled`

## reaction

**reaction-pin**

- `active` — applied when `componentConfig?.isReactionSelectedByCurrentUser`
- `velt-reaction-pin--default` — applied when `!template`
- `velt-reaction-pin--no-reactions` — applied when `!componentConfig?.annotation?.reactions?.length`

**reactions-panel**

- `dark` — applied when `darkMode`
- `velt-reactions-panel--default` — applied when `!template`
- `velt-reactions-panel--inline-section-mode` — applied when `isInlineSectionMode`

**reaction-tool**

- `active` — applied when `tooltipVisible`
- `no-padding` — applied when `noPadding`
- `velt-reaction-btn-container--inline-section-mode` — applied when `isInlineSectionMode`

## notification

**notifications-tool**

- `active` — applied when `componentConfig.uiState.notificationsPanelVisible`
- `velt-notification-tool-open` — applied when `componentConfig.uiState.notificationsPanelVisible`

**notifications-panel**

- `bottom-sheet` — applied when `bottomSheetMode`
- `velt-notifications-panel--sidebar-panel` — applied when `componentConfig.uiState.panelOpenMode === 'sidebar'`

**notifications-panel-header-tab-people**

- `selected` — applied when `componentConfig.uiState.selectedTab === componentConfig.uiState.TABS.People`
- `velt-notifications-panel--tab-selected` — applied when `componentConfig.uiState.selectedTab === componentConfig.uiState.TABS.People`

**notifications-panel-header-tab-all**

- `selected` — applied when `componentConfig.uiState.selectedTab === componentConfig.uiState.TABS.All`
- `velt-notifications-panel--tab-selected` — applied when `componentConfig.uiState.selectedTab === componentConfig.uiState.TABS.All`

**notifications-panel-header-tab-for-you**

- `selected` — applied when `componentConfig.uiState.selectedTab === componentConfig.uiState.TABS.ForYou`
- `velt-notifications-panel--tab-selected` — applied when `componentConfig.uiState.selectedTab === componentConfig.uiState.TABS.ForYou`

**notifications-panel-header-tab-documents**

- `selected` — applied when `componentConfig.uiState.selectedTab === componentConfig.uiState.TABS.Documents`
- `velt-notifications-panel--tab-selected` — applied when `componentConfig.uiState.selectedTab === componentConfig.uiState.TABS.Documents`

**notifications-panel-settings-mute-all-toggle**

- `velt-notification-panel--settings-mute-all-toggle-container-muted` — applied when `componentConfig.uiState.settingsMutedAll`

**notifications-panel-settings-accordion-content-item-label**

- `velt-notification-panel--settings-accordion-content-item-label-container-selected` — applied when `componentConfig.data.settingsSelectedOption[resolvedAccordionConfig()?.id]?.id === resolvedOption()?.id`

**notifications-panel-settings-accordion-content-item**

- `velt-notification-panel--settings-accordion-content-item-container-selected` — applied when `componentConfig.data.settingsSelectedOption[resolvedAccordionConfig()?.id]?.id === resolvedOption()?.id`

**notifications-panel-settings-accordion-content-item-icon**

- `velt-notification-panel--settings-accordion-content-item-icon-container-selected` — applied when `componentConfig.data.settingsSelectedOption[resolvedAccordionConfig()?.id]?.id === resolvedOption()?.id`

**notifications-panel-settings-accordion-trigger**

- `velt-notification-panel--settings-accordion-open` — applied when `componentConfig.uiState.settingsAccordionExpanded[resolvedAccordionConfig()?.id]`

**notifications-panel-settings-accordion**

- `velt-notification-panel--settings-accordion-container-expanded` — applied when `componentConfig.uiState.settingsAccordionExpanded[resolvedAccordionConfig()?.id]`

**notifications-panel-content-documents-list-item**

- `velt-notifications-panel--documents-accordion-expanded` — applied when `componentConfig.uiState.documentExpanded[document?.documentId!]`

**notifications-panel-content-documents-list-item-content**

- `velt-notifications-panel-content--sidebar-panel` — applied when `componentConfig.uiState.panelOpenMode === 'sidebar'`

**notifications-panel-content-documents-list-item-unread**

- `velt-notifications-panel--unread-is-default` — applied when `isDefault`

**notifications-panel-content-list-item-unread**

- `velt-notifications-panel--unread-is-default` — applied when `isDefault`

**notifications-panel-content-list-item**

- `unread` — applied when `resolvedNotification()?.isUnread`

**notifications-panel-content-for-you**

- `velt-notifications-panel-content--sidebar-panel` — applied when `componentConfig.uiState.panelOpenMode === 'sidebar'`

**notifications-panel-content-people-list-item-content**

- `velt-notifications-panel-content--sidebar-panel` — applied when `componentConfig.uiState.panelOpenMode === 'sidebar'`

**notifications-panel-content-people-list-item**

- `velt-notifications-panel--people-accordion-expanded` — applied when `componentConfig.uiState.usersExpanded[data?.key!]`

## presence

**presence-tooltip-avatar**

- `away` — applied when `componentConfig.presenceUser.onlineStatus === constants.PRESENCE_STATUS_AWAY`
- `velt-presence-avatar--away` — applied when `componentConfig.presenceUser.onlineStatus === constants.PRESENCE_STATUS_AWAY`

**presence-avatar-list-item**

- `away` — applied when `presenceUser.onlineStatus === constants.PRESENCE_STATUS_AWAY`
- `velt-presence-avatar--away` — applied when `presenceUser.onlineStatus === constants.PRESENCE_STATUS_AWAY`

## cursor

**cursor-pointer-avatar**

- `user-presence-text-container-comment-border` — applied when `componentConfig.cursorUser?.comment`
- `velt-cursor-pointer-avatar-container-comment-border` — applied when `componentConfig.cursorUser?.comment`

**cursor-pointer**

- `no-transition` — applied when `componentConfig.selfCursorPointer`

**cursor-pointer-video-huddle**

- `flip` — applied when `componentConfig.selfCursorPointer`

**cursor-pointer-default**

- `user-presence-text-container-comment-border` — applied when `componentConfig.cursorUser?.comment`
- `velt-cursor-pointer-default-container-comment-border` — applied when `componentConfig.cursorUser?.comment`

## huddle

**screen-sharing-huddle**

- `selected` — applied when `componentConfig.viewportSize === 'large'`
- `selected` — applied when `componentConfig.viewportSize === 'medium'`
- `selected` — applied when `componentConfig.viewportSize === 'small'`

**huddle-tool**

- `active` — applied when `allMenuTrigger?.menuOpen`

**video-huddle-user**

- `flip` — applied when `!componentConfig.isRemoteStream`
- `local-stream` — applied when `!componentConfig.isRemoteStream`
- `selected` — applied when `selected`
- `speaking` — applied when `componentConfig.audioState`
- `video-off` — applied when `!componentConfig.videoState`

**huddle-messages-panel**

- `mobile` — applied when `componentConfig.isPhone`
- `visible` — applied when `componentConfig.messagesPanelVisible`

**huddle-menu-panel**

- `s-current-user` — applied when `componentConfig.user?.userSnippylyId === attendee?.userSnippylyId`

## recorder

**recorder-player-video-container**

- `velt-recorder-player-video--embed-mode` — applied when `componentConfig?.variant === 'embed'`
- `velt-recorder-player-video--thread-mode` — applied when `componentConfig.mode === 'thread'`

**recorder-player-full-screen-button**

- `velt-recorder-player--full-screen-button-hovered` — applied when `componentConfig.videoContainerHovered`

**recorder-player-subtitles-button**

- `active` — applied when `componentConfig.showSubtitles`

**recorder-player-time**

- `velt-recorder-player--time` — applied when `componentConfig.recordingType === componentConfig.recorderModes.AUDIO`

**recorder-player-audio-container**

- `velt-recorder-player-audio--embed-mode` — applied when `componentConfig?.variant === 'embed'`
- `velt-recorder-player-audio--thread-mode` — applied when `componentConfig.mode === 'thread'`

**recorder-player-timeline**

- `velt-recorder-player--hovered` — applied when `componentConfig.videoContainerHovered`

**recorder-player-video**

- `flip` — applied when `componentConfig.recordingType === componentConfig.recorderModes.VIDEO`

**recorder-player-name**

- `velt-recorder-player--name-embed-mode` — applied when `componentConfig?.variant === 'embed'`

**recorder-player-expanded-controls-transcription-button**

- `disabled` — applied when `!componentConfig.annotation?.transcription?.transcriptedText`

**recorder-player-expanded-controls-subtitle-button**

- `disabled` — applied when `!componentConfig.annotation?.transcription?.transcriptedText`

**recorder-player-expanded-controls-settings-button**

- `active` — applied when `value === componentConfig.activeSpeed`

**recorder-player-expanded-display**

- `flip` — applied when `componentConfig.annotation?.recordingType === 'video'`

**recorder-player-expanded-subtitles**

- `hide` — applied when `subtitlesRef?.componentConfigSignal()?.highlightedTextIndex! < 0`

**recorder-pin-portal**

- `pin-dragging` — applied when `componentConfig.annotationDragging`

**recorder-all-tool**

- `velt-recorder-all-tool-container--active` — applied when `allMenuTrigger?.menuOpen`
- `velt-recorder-all-tool-container--disabled` — applied when `componentConfig.recordingInProgress`

**recorder-screen-tool**

- `disabled` — applied when `componentConfig.recordingInProgress`

**recorder-audio-tool**

- `disabled` — applied when `componentConfig.recordingInProgress`

**recorder-video-tool**

- `disabled` — applied when `componentConfig.recordingInProgress`

**recorder-control-panel-internal**

- `pin-dragging` — applied when `componentConfig.annotationDraging && componentConfig.dragAnnotation?.annotationId === recorder?.annotationId`

**recorder-control-panel-floating-mode-container**

- `velt-recorder-control-panel-floating--container-collapsed` — applied when `componentConfig.collapsedMode`
- `velt-recorder-control-panel-floating--video` — applied when `componentConfig.recorderInitData?.type === 'video'`

**recorder-control-panel-floating-mode**

- `pin-dragging` — applied when `componentConfig.annotationDraging`
- `velt-recorder-control-panel-floating-screen` — applied when `componentConfig.recorderInitData?.type === 'screen'`
- `velt-recorder-saving` — applied when `componentConfig.loading`

**recorder-control-panel-screen-mini-container**

- `with-pip` — applied when `isPipEnabled`

**recorder-control-panel-video**

- `velt-video-screen` — applied when `componentConfig.recorderInitData?.type === 'screen'`

**recorder-control-panel-action-bar-pip**

- `velt-recorder-control-panel-action-bar-pip-button-active` — applied when `isPipActive`

**recorder-control-panel-action-bar**

- `is-floating` — applied when `componentConfig.mode !== 'thread'`
- `velt-recorder-control-panel-action-bar--screen` — applied when `componentConfig.recorderInitData.type === 'screen'`

**recorder-control-panel-thread-mode**

- `pin-dragging` — applied when `componentConfig.annotationDraging`

## transcription

**subtitles-dialog**

- `disabled` — applied when `transcription && !transcription?.transcriptedText`

**transcription-content-item-time**

- `velt-transcription-content--item-time-selected` — applied when `selected`

**transcription-content-item**

- `velt-transcription-content-item--selected` — applied when `componentConfig.highlightedTextIndex === index`

**transcription-button**

- `velt-transcription-button--disabled` — applied when `componentConfig.transcription && !componentConfig.transcription?.transcriptedText`

**transcription-panel**

- `velt-transcription-floating-mode` — applied when `componentConfig.mode === 'floating'`

**transcription-summary-text**

- `summary-mode` — applied when `componentConfig.mode === 'summaryMode'`
- `velt-transcription-summary-mode` — applied when `componentConfig.mode === 'summaryMode'`

**transcription-summary-expand-toggle**

- `summary-mode` — applied when `componentConfig.mode === 'summaryMode'`
- `velt-transcription-summary-mode` — applied when `componentConfig.mode === 'summaryMode'`

**subtitles-button**

- `velt-subtitles-button--disabled` — applied when `componentConfig.transcription && !componentConfig.transcription?.transcriptedText`

## activity-log

**activity-log-header-filter-content-item**

- `velt-activity-log-header-filter-content-item--active` — applied when `isActive`

## tag

**tag-dialog**

- `edit-mode` — applied when `editMode`

**tag-pin-portal**

- `pin-dragging` — applied when `annotationDraging`

## arrow

**arrow-pin-portal**

- `pin-dragging` — applied when `componentConfig.annotationDragging`

**arrows-tool**

- `active` — applied when `addArrowMode`

**arrow-pin**

- `s-arrow-annotation-draggable` — applied when `isEditable`
- `s-arrow-annotation-handle-dragging` — applied when `isResizing`
- `s-arrow-annotation-selected` — applied when `arrowPinSelected`

## area

**area-tool**

- `active` — applied when `addAreaMode`

**area-pin-portal**

- `drag-disabled` — applied when `!componentConfig.pinDragEnabled || componentConfig.areaPinAnnotation?.from?.userId !== user?.userId`

## autocomplete

**autocomplete-panel**

- `s-comment-autocomplete-panel-dark` — applied when `darkMode`
- `velt-autocomplete-inline-option--disabled` — applied when `item?.disabled`
- `velt-group-member-option` — applied when `item.isGroupMember`
- `velt-group-option` — applied when `item.isGroupHeader`

**autocomplete-option-description**

- `velt-autocomplete-option-description--secondary` — applied when `userContact.name?.length! > 0`

**autocomplete-option**

- `velt-autocomplete-option--multi-select` — applied when `multiSelect`
- `velt-autocomplete-option--selected` — applied when `isSelected`

**autocomplete-chip**

- `current-user-chip` — applied when `componentConfig?.user?.userId && componentConfig?.contact?.userId === componentConfig?.user?.userId`
- `velt-autocomplete--contact-chip-current-user` — applied when `componentConfig?.user?.userId && componentConfig?.contact?.userId === componentConfig?.user?.userId`

## view

**view-analytics**

- `active` — applied when `componentConfig.treadsVisible`

**view-analytics-dialog**

- `bottom-sheet` — applied when `componentConfig.bottomSheetMode`

## rewriter

**rewriter-dialog**

- `bottom-sheet` — applied when `componentConfig.bottomSheetMode`
- `disabled` — applied when `!prompt?.length`
- `disabled` — applied when `componentConfig.loading || componentConfig.searchCount >= 3`
- `disabled` — applied when `componentConfig.selectedOptionIndex < 0`
- `s-selected` — applied when `componentConfig.selectedOptionIndex === index`
