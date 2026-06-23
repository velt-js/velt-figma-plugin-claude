# Reference · Events (all features)

Every event a Velt customer can subscribe to, grouped by feature. Event names are the verbatim string VALUES from the SDK (what you pass to `.on(...)`).

## Subscription pattern

Subscribe via the feature's element accessor on the Velt client, then `.on('<eventName>').subscribe(cb)`:

```js
const client = Velt; // or Snippyly
client.getCommentElement().on('addCommentAnnotation').subscribe((event) => { /* ... */ });
```

React equivalent: each feature exposes a `use<Feature>EventCallback` hook (e.g. `useCommentEventCallback('addCommentAnnotation')`) that returns the latest event payload — same string event names.

| Feature | Accessor |
|---|---|
| Comments | `client.getCommentElement()` |
| Recorder / Transcription | `client.getRecorderElement()` |
| Presence | `client.getPresenceElement()` |
| Notifications | `client.getNotificationElement()` |
| Live State Sync (single-editor / access) | `client.getLiveStateSyncElement()` |
| Rewriter (AI text) | `client.getRewriterElement()` |
| Suggestions | `client.getSuggestionElement()` |
| CRDT | `client.getCrdtElement()` |
| Core / resolvers / button | client-level |

---

## Comments — `client.getCommentElement().on(...)`

| Event name (string) | Payload type | Description |
|---|---|---|
| `addCommentAnnotation` | `AddCommentAnnotationEvent` | A new comment annotation is created. Payload includes `annotationId`, `commentAnnotation`, `metadata`, an `addContext(context)` callback to attach custom context, and optional `elementRef.xpath`. |
| `addCommentAnnotationDraft` | `AddCommentAnnotationDraftEvent` | A new annotation composer is opened but abandoned without sending the first comment (draft). Payload has `metadata` + `addContext(context)`. |
| `approveCommentAnnotation` | `ApproveCommentAnnotationEvent` | An annotation is approved. |
| `acceptCommentAnnotation` | `AcceptCommentAnnotationEvent` | An annotation suggestion is accepted; includes `actionUser` and optional `replaceContentHtml`/`replaceContentText`. |
| `rejectCommentAnnotation` | `RejectCommentAnnotationEvent` | An annotation suggestion is rejected; includes `actionUser` and optional replace content. |
| `subscribeCommentAnnotation` | `SubscribeCommentAnnotationEvent` | A user subscribes to an annotation thread. |
| `unsubscribeCommentAnnotation` | `UnsubscribeCommentAnnotationEvent` | A user unsubscribes from an annotation thread. |
| `deleteCommentAnnotation` | `DeleteCommentAnnotationEvent` | An entire annotation is deleted. |
| `assignUser` | `AssignUserEvent` | A user is assigned to an annotation; payload carries `assignedTo` (`UserContact`). |
| `updatePriority` | `UpdatePriorityEvent` | Annotation priority changes; payload has `newPriority`/`oldPriority` (`CustomPriority`). |
| `updateStatus` | `UpdateStatusEvent` | Annotation status changes; payload has `newStatus`/`oldStatus` (`CustomStatus`). |
| `updateAccess` | `UpdateAccessEvent` | Annotation access mode changes; `newAccessMode`/`oldAccessMode` (`CommentAccessMode`). |
| `resolveComment` | `ResolveCommentEvent` | An annotation is resolved. |
| `addComment` | `AddCommentEvent` | A comment (reply) is added to an annotation; payload has `commentId` + `comment`. |
| `addCommentDraft` | `AddCommentDraftEvent` | A reply composer on an existing annotation is abandoned without sending; `comment` is a draft snapshot of unsent content. |
| `updateComment` | `UpdateCommentEvent` | An existing comment is edited; payload has `commentId` + `comment`. |
| `deleteComment` | `DeleteCommentEvent` | A single comment is deleted. |
| `addAttachment` | `AddAttachmentEvent` | Attachment(s) added to a comment; `attachments` is `AddAttachmentResponse[]`. |
| `deleteAttachment` | `DeleteAttachmentEvent` | An attachment is removed from a comment. |
| `deleteRecording` | `DeleteRecordingEvent` | A recording attached to a comment is deleted; payload has `recording` (`RecordedData`). |
| `copyLink` | `CopyLinkEvent` | A user copies the deep link to a comment; payload has `link`. |
| `addReaction` | `AddReactionEvent` | A reaction is added to a comment; payload has `reaction` (`ReactionAnnotation`). |
| `deleteReaction` | `DeleteReactionEvent` | A reaction is removed from a comment. |
| `toggleReaction` | `ToggleReactionEvent` | A reaction is toggled on/off on a comment. |
| `commentSidebarDataInit` | `CommentSidebarDataInitEvent` | Comment sidebar data is first initialized. |
| `commentSidebarDataUpdate` | `CommentSidebarDataUpdateEvent` | Comment sidebar data updates. |
| `autocompleteSearch` | `AutocompleteSearchEvent` | User types in the mention/autocomplete field; payload has `searchText`, `type` (`'contact' \| 'custom' \| 'group'`), and the raw `event`. Use to drive custom autocomplete data sources. |
| `composerClicked` | `ComposerClickedEvent` | The comment composer is clicked/focused. |
| `composerTextChange` | `ComposerTextChangeEvent` | Composer text changes; payload has `text`, `annotation`, `targetComposerElementId`. |
| `linkClicked` | `LinkClickedEvent` | A link inside a comment is clicked; payload has `text`, `link`, `commentAnnotation`, `commentId`. |
| `commentPinClicked` | `CommentPinClickedEvent` | A comment pin is clicked. |
| `commentBubbleClicked` | `CommentBubbleClickedEvent` | A comment bubble is clicked. |
| `commentToolClick` | `CommentToolClickEvent` | The comment tool (add-comment mode) is clicked; payload has `context` + `targetElementId`. |
| `commentToolClicked` | `CommentToolClickedEvent` | Past-tense variant of `commentToolClick`. |
| `sidebarButtonClick` | `SidebarButtonClickEvent` | The sidebar toggle button is clicked. |
| `sidebarButtonClicked` | `SidebarButtonClickedEvent` | Past-tense variant of `sidebarButtonClick`. |
| `attachmentDownloadClicked` | `AttachmentDownloadClickedEvent` | A user clicks to download an attachment; payload has `attachment`. |
| `commentSaved` | `CommentSavedEvent` | A comment is persisted/saved. |
| `commentSaveTriggered` | `CommentSaveTriggeredEvent` | A comment save is triggered (before completion). |
| `visibilityOptionClicked` | `VisibilityOptionClickedEvent` | A visibility option is selected; payload has `visibility` (`CommentVisibilityOptionType`) + optional `users`. |
| `suggestionAccepted` | `SuggestionAcceptEvent` | An agent/comment suggestion is accepted; payload has `actionUser`. |
| `suggestionRejected` | `SuggestionRejectEvent` | An agent/comment suggestion is rejected; payload has `actionUser` + optional `rejectReason`. |

> Common payload fields across these events: `annotationId`, `commentAnnotation` (`CommentAnnotation`), and `metadata` (`VeltEventMetadata`). Deprecated payloads (`CommentAddEventData`, `CommentEvent`, `CommentUpdateEventData`, `CommentSuggestionEventData`) are excluded — they are not in the active event map.

---

## Recorder / Transcription — `client.getRecorderElement().on(...)`

| Event name (string) | Payload type | Description |
|---|---|---|
| `transcriptionDone` | `TranscriptionDoneEvent` | Transcription of a recording completes. |
| `recordingDone` | `RecordingDoneEvent` | A recording is finished and uploaded/saved. |
| `recordingDoneLocal` | `RecordingDoneLocalEvent` | A recording is finished locally (before upload). |
| `recordingEditDone` | `RecordingEditDoneEvent` | Editing of an existing recording completes. |
| `deleteRecording` | `RecordingDeleteEvent` | A recording is deleted. |
| `recordingStarted` | `RecordingStartedEvent` (`{ type: 'audio'\|'video'\|'screen' }`) | Recording starts. |
| `recordingPaused` | `RecordingPausedEvent` | Recording is paused. |
| `recordingResumed` | `RecordingResumedEvent` | Recording resumes. |
| `recordingCancelled` | `RecordingCancelledEvent` | Recording is cancelled. |
| `recordingStopped` | `RecordingStoppedEvent` | Recording is stopped. |
| `recordingSaveInitiated` | `RecordingSaveInitiatedEvent` | Save of a recording begins; payload has `type` (`'edit'\|'record'`), `message`, optional `annotationId`. |
| `error` | `RecordingErrorEvent` | A recording error occurs; payload has `type`, `message`, optional `recorderId`/`url`. |

---

## Presence — `client.getPresenceElement().on(...)`

| Event name (string) | Payload type | Description |
|---|---|---|
| `multipleUsersOnline` | `PresenceMultipleUsersOnlineEvent` (`{ users: PresenceUser[] }`) | Fires when the set of online users changes; gives the full online user list. |
| `userStateChange` | `PresenceUserStateChangeEvent` (`{ user: PresenceUser; state: string }`) | A single user's presence state changes. |

---

## Notifications — `client.getNotificationElement().on(...)`

| Event name (string) | Payload type | Description |
|---|---|---|
| `settingsUpdated` | `SettingsUpdatedEvent` (`{ settings: NotificationSettingsConfig; isMutedAll: boolean }`) | A user updates their notification settings (e.g. mute-all toggled). |

---

## Live State Sync (single-editor mode / access requests) — `client.getLiveStateSyncElement().on(...)`

| Event name (string) | Payload type | Description |
|---|---|---|
| `accessRequested` | `AccessRequestEvent` | A viewer requests edit access. |
| `accessRequestCanceled` | `AccessRequestEvent` | An access request is cancelled. |
| `accessAccepted` | `AccessRequestEvent` | An access request is accepted. |
| `accessRejected` | `AccessRequestEvent` | An access request is rejected. |
| `editorAssigned` | `SEMEvent` | A user becomes the editor (single-editor mode). |
| `viewerAssigned` | `SEMEvent` | A user becomes a viewer. |
| `editorOnDifferentTabDetected` | `SEMEvent` | The editor is detected on a different tab. |

---

## Rewriter (AI text actions) — `client.getRewriterElement().on(...)`

| Event name (string) | Payload type | Description |
|---|---|---|
| `textSelected` | `TextSelectedEvent` (`{ selectionId; text; targetTextRange }`) | Text is selected for an AI rewrite/ask-AI action. |

---

## Suggestions — `client.getSuggestionElement().on(...)`

| Event name (string) | Payload type | Description |
|---|---|---|
| `suggestionCreated` | `SuggestionCreatedEvent` | A new suggestion is created. Actor on `suggestion.createdBy`. |
| `suggestionApproved` | `SuggestionApprovedEvent` | A suggestion is approved. Actor on `suggestion.resolvedBy`. |
| `suggestionRejected` | `SuggestionRejectedEvent` | A suggestion is rejected. |
| `suggestionStale` | `SuggestionStaleEvent` | A suggestion becomes stale (target content changed). |
| `targetEditStart` | `TargetEditStartEvent` | An edit of a suggestion's target begins. |
| `targetEditCommit` | `TargetEditCommitEvent` | A target edit is committed; payload has `details` + a pre-bound `commitSuggestion()` builder. |

---

## CRDT — `client.getCrdtElement().on(...)`

| Event name (string) | Payload type | Description |
|---|---|---|
| `updateData` | `CrdtUpdateDataEvent` | CRDT data updates; payload has `methodName`, `uniqueId`, `timestamp`, `source` (`'internal'\|'external'`), and `payload` (`id`, `data`, `lastUpdatedBy`, `sessionId`, `lastUpdate`). |

---

## Core (resolvers, button clicks, lifecycle)

Client-level core events (resolver hooks, init/user lifecycle, button clicks). Resolver events deliver a `BaseResolverEvent<…>` whose nested `event` field is itself a sub-event string union (request formed / triggered / result / error / result-from-cache).

| Event name (string) | Payload type | Description |
|---|---|---|
| `permissionProvider` | `PermissionProviderEvent` | Permission-provider resolver lifecycle. |
| `userResolver` | `UserResolverEvent` | User-resolution resolver lifecycle. |
| `commentResolver` | `CommentResolverEvent` | Comment-resolution + save/delete resolver lifecycle (self-hosting). |
| `attachmentResolver` | `AttachmentResolverEvent` | Attachment save/delete resolver lifecycle. |
| `reactionResolver` | `ReactionResolverEvent` | Reaction resolution + save/delete resolver lifecycle. |
| `recorderResolver` | `RecorderResolverEvent` | Recorder resolution + save/delete resolver lifecycle. |
| `notificationResolver` | `NotificationResolverEvent` | Notification resolution + delete resolver lifecycle. |
| `activityResolver` | `ActivityResolverEvent` | Activity resolution + save resolver lifecycle. |
| `veltButtonClick` | `VeltButtonClickEvent` | A `<velt-button>` (custom Velt UI button) is clicked. Returns `buttonContext.clickedButtonId`. |
| `userUpdate` | `UserUpdateEvent` (`User \| null`) | The identified user is updated (or cleared). |
| `initUpdate` | `InitUpdateEvent` | Document/location init lifecycle; `methodName` ∈ `setDocuments`/`setDocumentId`/`setLocation`/`addLocation`/`removeLocation`/… |
| `documentInit` | `DocumentInitEvent` (`boolean \| undefined`) | Fires when the document is initialized. |
| `error` | `ErrorEvent` | A core SDK error; payload has `event`, `sourceMethod`, `documentIds`, `userId`, `error`, `code`, `message`, `source`. |

---

*Event-name strings above are the exact values you pass to `.on(...)` (or to the `use<Feature>EventCallback` hook). Generated from the SDK's event enums + payload maps; exhaustive per feature.*
