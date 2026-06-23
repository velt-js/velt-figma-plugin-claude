# Reference · Headless hooks

The hooks you use to build custom UI ([`approaches/headless.md`](../approaches/headless.md)) or to add data‑driven extras alongside any approach. All from `@veltdev/react`. Types from `@veltdev/types`.

Grouped by purpose: **read** (data/state you render), **mutate** (actions you call), **events** (callbacks), **control** (init/scope/imperative). This lists the commonly‑used comment hooks plus a brief map of other features; the SDK exports many more hooks following the same naming, but everything you need for the patterns in this guide is here.

> **Don't invent hook names.** If it's not exported by `@veltdev/react`, it doesn't exist.

---

## Read — data & state

| Hook | Returns / use |
|---|---|
| `useCommentAnnotations()` | Reactive `CommentAnnotation[]` (or `null` before load) on the current document. The main data source. Use `useCommentAnnotations() ?? []`. |
| `useGetCommentAnnotations(query?)` | Reactive, filtered query → `GetCommentAnnotationsResponse` (`{ annotations, count, … }`), not a bare array. |
| `useCommentAnnotationById({ annotationId })` | One annotation by id. |
| `useGetComment()` | Reactive `Comment[]` (a list, not a single comment). |
| `useCommentAnnotationsCount(query?)` | `GetCommentAnnotationsCountResponse` (read its `count` field), not a bare number. |
| `useCommentModeState()` | Whether comment mode is active. |
| `useCommentSidebarData()` | Data backing the sidebar (filters/sorted list). |
| `useCurrentUser()` | The identified user. |
| `useCurrentUserPermissions()` | Current user's permissions. |
| `useUnreadCommentAnnotationCountOnCurrentDocument()` | Returns `UnreadCommentsCount` — an **object** `{ count } \| null`, not a number. Read `.count` (e.g. `data?.count ?? 0`). Great for badges. |
| `useUnreadCommentCountByAnnotationId()` / `useUnreadCommentCountByLocationId()` | Unread counts scoped to a thread / location. |
| `useUnreadCommentAnnotationCountByLocationId()` | Unread annotation count by location. |

> **Return shapes matter.** Several read hooks return wrapper objects, not bare values (`…Count*` → `{ count }`; `useGetCommentAnnotations` → a response object). Read the field, don't render the object. When unsure of a return shape, `console.log` the hook's value in your component to see it before rendering.

## Mutate — actions

| Hook | Action |
|---|---|
| `useAddCommentAnnotation()` | Create a new annotation (a new thread). |
| `useAddComment()` | Add a comment/reply to an annotation. |
| `useUpdateComment()` | Edit a comment. |
| `useDeleteComment()` | Delete a single comment. |
| `useDeleteCommentAnnotation()` | Delete a whole thread. |
| `useResolveCommentAnnotation()` | Resolve a thread. |
| `useApproveCommentAnnotation()` / `useRejectCommentAnnotation()` | Approval flows. |
| `useUpdateStatus()` | Set a thread's status. |
| `useUpdatePriority()` | Set priority. |
| `useAssignUser()` | Assign a user to a thread. |
| `useAddReaction()` / `useDeleteReaction()` / `useToggleReaction()` | Reactions. |
| `useAddAttachment()` / `useDeleteAttachment()` / `useGetAttachment()` | Attachments. |
| `useGetLink()` / `useCopyLink()` | Deep link to a comment. |

Most return an object with a function, e.g. `const { addComment } = useAddComment();` then `await addComment({ annotationId, comment })`.

## Events — callbacks

| Hook | Fires on |
|---|---|
| `useCommentEventCallback()` | Generic comment events. |
| `useCommentAddHandler()` / `useCommentUpdateHandler()` | A comment added / updated. |
| `useCommentSelectionChangeHandler()` | Selected thread changes. |
| `useCommentCopyLinkHandler()` | A copy‑link action. |
| `useVeltEventCallback(eventName)` | Custom events (e.g. `'veltButtonClick'` from a wireframe button). |

## Control — init, scope, imperative

| Hook | Use |
|---|---|
| `useVeltClient()` | The Velt client (`const { client } = useVeltClient()`); imperative API + `client.getCommentElement()`. (`useClient()` is a newer alias.) |
| `useIdentify()` | Returns `{ identify }`; call `identify(user)`. |
| `useSetDocuments()` / `useSetDocument()` | Return a setter: `const { setDocuments } = useSetDocuments();` then `setDocuments(documents, options)`. **Not** `useSetDocuments([...])`. |
| `useVeltInitState()` | Whether Velt finished initializing (gate rendering on this). |
| `useUiState()` / `useSetLiveStateData()` | Shared UI state between users. |
| `useSubscribeCommentAnnotation()` / `useUnsubscribeCommentAnnotation()` | Subscribe to a specific annotation. |

---

## Imperative API via the client

Some controls aren't hooks — call them on the comment element:

```tsx
const { client } = useVeltClient();
const commentElement = client.getCommentElement();
commentElement.openCommentSidebar();
commentElement.enableCommentMode();
commentElement.setCommentSidebarFilters({ status: ["open"], priority: ["high"] });
commentElement.setCustomStatus([{ id: "new", title: "New", color: "#FF5733" }]);
```

(These element APIs come from the typed comment element returned by `client.getCommentElement()`.)

---

## Other features (brief)

| Feature | Representative hooks |
|---|---|
| Presence | `usePresenceUsers`, `usePresenceData`, `usePresenceUtils` |
| Cursors | `useCursorUsers`, `useCursorUtils` |
| Notifications | `useNotificationsData`, `useUnreadNotificationsCount`, `useNotificationSettings`, `useNotificationUtils` |
| Reactions | `useAddReaction`, `useToggleReaction`, `useDeleteReaction` |
| Recorder | `useRecordings`, `useRecordingDataByRecorderId`, `useRecorderUtils`, `useRecorderEventCallback` |
| Tags | `useTagAnnotations`, `useTagUtils` |
| Views/Analytics | `useUniqueViewsByUser`, `useUniqueViewsByDate`, `useViewsUtils` |
| Live state sync | `useLiveState`, `useLiveStateData`, `useSetLiveStateData` |

See [`other-features.md`](../other-features.md) for how customization applies to these.
