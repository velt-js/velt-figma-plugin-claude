# Primitives — Children · Context · Data (SDK capability handoff)

> **What this is.** A knowledge/reference doc describing **three new capabilities** added to Velt
> **primitives**: putting your own markup inside a primitive (Children), automatic id inheritance for
> nested primitives (Context), and reading a component's live internal state (Data). It exists so the
> plugin's AI understands the exact syntax, coverage, rules, and hard limits before generating
> primitive code. **Source of truth for these three features** — every identifier, coverage number,
> and signature below is taken verbatim from the SDK feature docs and verified against SDK source. If a
> capability isn't stated here, don't assume it exists.
>
> **The plugin decides how to fold this into `guide/`.** This file changes nothing on its own.
>
> **⚠️ Availability is version-gated — read [§8](#8-availability--version-gating) first.** At the time
> of writing these land via **open PRs on feature branches**, not yet merged/published. Treat exact
> availability as gated on the customer's installed `@veltdev/*` version.

---

## 0. The three capabilities in one line each

| # | Capability | One line | Feature scope |
|---|---|---|---|
| **R1** | **Children slot** | Put your own markup **inside** a primitive tag; it replaces that primitive's default content, **moved not cloned** so handlers stay live. | **All** primitives (465/465) |
| **R2** | **Context inheritance** | Attributes on a parent primitive (`annotation-id`, `comment-id`, …) **flow down** to nested Velt children automatically. | comment-dialog + notifications |
| **R3** | **Data access** | Read a component's **live derived state** (annotation, user, flags, UI state) as an Observable / React hook. Read-only. | comment-dialog + notifications |

They compose: **R1 decides *where* your markup goes, R2 decides *what data* a nested Velt child sees, R3 lets you *read* that state.** Together they let a customer build a fully custom dialog by hand.

---

## 1. Corrections to two prior assumptions

These releases overturn two statements the current guide makes. State the new truth; the old text is now wrong.

1. **Leaf primitives CAN now be restructured with children.**
   The guide (`approaches/primitives.md`) says a *leaf* primitive "no children" can only be customized via that leaf's **wireframe**. **No longer true.** With R1 you put markup directly inside the leaf tag (`<VeltCommentDialogOptionsDropdownTrigger><MyIcon/></…>`) and it replaces the leaf's content while keeping Velt's behavior. Wireframes are still valid, but they are no longer the *only* way to customize a leaf.

2. **The `context-wrapper` is now optional, not required.**
   The guide (`reference/component-definitions.md`) presents `VeltCommentDialogContextWrapper` as the way to feed annotation context into nested dialog sub-components. **With R2, any primitive publishes context to its descendants**, so you put `annotationId`/`commentId` directly on a real primitive parent (e.g. `VeltCommentDialog`, `VeltCommentDialogThreadCard`) and nested children inherit it. The wrapper still works — it's now convenience sugar, not mandatory plumbing.

Also note: the guide's `approaches/primitives.md` "Option B" (customer-placed trigger inside a Velt dropdown, driving Velt's real behavior) **now genuinely works and is deterministic** — that pattern is exactly what R1's compound-trigger support delivers.

---

## 2. Release 1 — Children slot

> **Status: shipped to PR (not yet merged/published — see [§8](#8-availability--version-gating)).**

### 2.1 What it does

A primitive renders two things: **chrome** (click handler, tooltip, dropdown wiring, a11y) and **content** (the visible icon/text). Previously the only way to change the *content* was a **wireframe** — a separate block declared elsewhere, which Velt clones as inert `innerHTML`, so any `onClick`, React component, or ref inside it is **dead on arrival**.

Now: whatever you place **inside a primitive tag** replaces its default content, at the same spot a wireframe would fill, and your nodes are **moved (not cloned)** — so they stay fully interactive. This is the thing wireframes cannot do.

### 2.2 Syntax

**Swap an icon (React):**

```tsx
<VeltCommentDialogOptionsDropdownTrigger annotationId="A1">
  <MoreVerticalIcon />
</VeltCommentDialogOptionsDropdownTrigger>
```

**Same, HTML:**

```html
<velt-comment-dialog-options-dropdown-trigger annotation-id="A1">
  <svg><!-- vertical dots --></svg>
</velt-comment-dialog-options-dropdown-trigger>
```

**Compose a dropdown with your own trigger — the menu still opens** (this is R1's compound-trigger support):

```tsx
<VeltCommentDialogOptionsDropdown annotationId="A1">
  <VeltCommentDialogOptionsDropdownTrigger>
    <MoreVerticalIcon />
  </VeltCommentDialogOptionsDropdownTrigger>
</VeltCommentDialogOptionsDropdown>
```

**Interactive children stay alive** (impossible with a wireframe):

```tsx
<VeltCommentDialogThreadCardName>
  <span onClick={() => openProfile()}>Custom name</span>
</VeltCommentDialogThreadCardName>
```

### 2.3 Precedence

When more than one content source exists for the same spot:

```
children  →  template input  →  registered wireframe  →  Velt's default
```

Mental model (CSS): the wireframe is a global stylesheet rule; children are an inline style. The more specific one wins — so a customer can migrate off wireframes **one spot at a time**, and a passed child overrides any global wireframe for that instance.

### 2.4 Coverage — all primitives

The SDK gate (`validate:children-slot`, run in pre-push + CI) reports:

```
Registered public Velt custom elements: 518
  ✅ children supported (anchor)          : 433
  ✅ children via Angular <ng-content>    : 25
  ✅ children via compound trigger        : 7
  ➖ not a primitive (feature root / mount): 53
  ❌ PRIMITIVE with no children support   : 0
→ CONSISTENT — all 465 primitives support children.
```

- **465 / 465 primitives** accept children — across every feature family (comment dialog, sidebar, notifications, autocomplete, activity-log, recorder, reactions, tools, etc.).
- The **53 excluded are NOT primitives** — feature roots / mount points (`velt-root`, `velt-comments`, `velt-cursor`, and the V1 tools). Children are meaningless there; a runtime warning fires if you try.

**The 7 dropdown-shaped primitives** run one shared compound-trigger mechanism, so a customer-placed trigger drives the real dropdown: `options`, `status`, `priority`, `custom-annotation`, `visibility`(-banner), `seen`, `suggestion-menu`.

### 2.5 Rules, limits, and warnings

| Rule / limit | Detail |
|---|---|
| **Moved, not cloned** | Your DOM node is the same object; on teardown it is handed back to its host, never destroyed. |
| **Wrap text in an element** | Plain-text children are **not supported** — use `<span>text</span>`, not bare text. A dev warning fires (see below). |
| **React: pass one stable root element** | Because nodes are moved, don't swap the top-level child on every render. Wrap variable content in a stable `<span>`/`<div>`. The React wrapper adds this automatically. |
| **Repeating containers render children once** | Children on a repeater (e.g. a threads list) render **once**, not per item. Warns, and the recipe is to loop in your own code (`items.map(...)` — see [§4.6](#46-loop-in-your-own-code)). |
| **`<velt-data>` / `<velt-if>` work inside children** | Velt still upgrades those inside a children subtree; plain customer DOM is untouched. |

**Not covered by R1:**

| Gap | Why |
|---|---|
| The 3 dialog **hosts** — `velt-comment-dialog`, `velt-comment-dialog-composer`, `velt-comment-dialog-thread` | They render `velt-comment-dialog-internal` via a different mechanism (host + shadow DOM + render modes). A design decision, not shipped. |
| Dropdown **CONTENT** slot | The menu content view is created/destroyed on each open/close, so a customer-owned node there would be torn down. (Individual content **items** do accept children.) |
| Reaching a primitive **Velt** renders for you | Children only work on a tag *you* write. To skin something deep inside the default dialog, wireframes remain the tool. |
| V1 "custom-button" tools (denylisted) | `user-request-tool`, `sidebar-button`, `comment-tool`, `area-tool`, `tags-tool`, `autocomplete-tool` — these use an older child mechanism; children on them belong to that path. |

**Dev-console warnings (fire once each, in dev mode):**

```
[Velt] <velt-comment-dialog-options-dropdown> does not support children, so the markup you put
inside it was not rendered. This primitive renders its own child primitives instead — place your
markup inside one of those, or use a wireframe for this element.

[Velt] <velt-comment-dialog-close-button> was given plain text as its content, which is not
supported. Wrap it in an element — for example <span>your text</span>.
```

---

## 3. Release 2 — Context inheritance

> **Status: BUILT** (comment-dialog core + deterministic moved-child fix + notifications extension), tested, browser-verified. On a feature branch — see [§8](#8-availability--version-gating).

### 3.1 What it does

A nested Velt child needs to know **which annotation/comment (or notification) it belongs to**. Previously that meant wrapping everything in `context-wrapper` rings (prop drilling). Now **any primitive publishes its context to descendants**: any inheritable attribute on a parent flows down to every nested Velt child. **A child's own attribute always wins** over an inherited one.

### 3.2 Syntax

**Before (prop drilling — still works, now unnecessary):**

```html
<velt-comment-dialog-context-wrapper annotation-id="A1">
  <velt-comment-dialog-context-wrapper comment-id="1">
    <velt-comment-dialog-thread-card-name></velt-comment-dialog-thread-card-name>
  </velt-comment-dialog-context-wrapper>
</velt-comment-dialog-context-wrapper>
```

**Now (React):**

```tsx
<VeltCommentDialog annotationId="A1">
  <VeltCommentDialogThreadCard commentId={1}>
    <VeltCommentDialogThreadCardAvatar />
    <VeltCommentDialogThreadCardName />
    <VeltCommentDialogThreadCardMessage />
  </VeltCommentDialogThreadCard>
</VeltCommentDialog>
```

**Now (HTML):**

```html
<velt-comment-dialog annotation-id="A1">
  <velt-comment-dialog-thread-card comment-id="1">
    <velt-comment-dialog-thread-card-avatar></velt-comment-dialog-thread-card-avatar>
    <velt-comment-dialog-thread-card-name></velt-comment-dialog-thread-card-name>
  </velt-comment-dialog-thread-card>
</velt-comment-dialog>
```

**Notifications** (verified tag names) — a wrapping list-item feeds nested leaves by inheriting `notification-index`:

```html
<velt-notifications-panel-content-all-list-item notification-index="0">
  <velt-notifications-panel-content-list-item-avatar></velt-notifications-panel-content-list-item-avatar>
  <velt-notifications-panel-content-list-item-headline></velt-notifications-panel-content-list-item-headline>
</velt-notifications-panel-content-all-list-item>
```

```tsx
<VeltNotificationsPanelContentAllListItem notificationIndex={0}>
  <VeltNotificationsPanelContentListItemAvatar />
  <VeltNotificationsPanelContentListItemHeadline />
</VeltNotificationsPanelContentAllListItem>
```

### 3.3 Inheritable attributes (verified in source)

| Feature | Attributes that flow down |
|---|---|
| Comment dialog | `annotation-id`, `comment-id`, `comment-index`, `attachment-id`, `recording-id`, **+ your own custom kebab-case attributes** |
| Notifications — list-item | `notification-index` |
| Notifications — All tab | `date` (+ `notification-index`) |
| Notifications — People tab | `email`, `user-id` (+ `notification-index`) |
| Notifications — Documents tab | `document-id` (+ `notification-index`) |

**Reserved attributes that never inherit** (so a parent's a11y identity can't leak onto a child): `class`, `style`, `id`, `role`, `tabindex`, `title`, `slot`, `hidden`, and anything matching `aria-*` / `data-*` / `ng-*`. Custom kebab-case attributes DO inherit.

### 3.4 Rules

- **Own attribute beats inherited** — explicit input > own attribute > inherited from nearest ancestor.
- **Walks up the DOM** — a child finds the nearest ancestor carrying context, crossing custom-element boundaries where React/Angular context can't reach.
- **Zero-cost when idle** — publishing is skipped entirely when there's nothing to inherit.
- **Deterministic for moved children** — when R1 moves a child into place, its context is re-resolved **on placement** (notify-on-placement, idempotent, **no polling**), so nesting "just works" with no wrong-context flash. (Customer-invisible; stated so you can trust nesting.)

### 3.5 Coverage

- **Full consumption:** **comment-dialog** (rich, per-annotation) and **notifications** (panel + tool + list-items, including leaf children inheriting their row).
- The generic publish mechanism is also present on other V2 primitive bases (autocomplete, activity-log, and 6 comment sub-features). Don't over-claim deep leaf consumption outside comment-dialog + notifications.

---

## 4. Release 3 — Data access

> **Status: BUILT on the SDK side** (`getCommentDialogConfig` + notification config getters are runtime-live; `ComponentConfig` types marked `@experimental`; React `useCommentDialogConfig` hook written). **Blocked on a coordinated `@veltdev/types` publish** — see [§8](#8-availability--version-gating).

### 4.1 What it does

Wireframes can read Velt's internal state (via `velt-data`/`velt-if`); primitives couldn't. R3 exposes a component's **live derived state** — annotation, current user, permissions, feature flags, UI state — as an Observable / React hook, so a primitive can react to state (badge when unread, color an icon by status). **Read-only** — mutations still go through the existing action APIs (`updateStatus`, `assignUser`, …).

### 4.2 Comment dialog

**HTML:**

```js
Velt.getCommentElement()
  .getCommentDialogConfig({ annotationId: 'A1' })   // → Observable<ComponentConfig | null>
  .subscribe(config => {
    console.log(config.data.annotation.status);
    console.log(config.uiState.darkMode);
  });
```

**React — convenience hook** (in `sdk-react` source; not in the published package until the types publish lands — see §8):

```tsx
const config = useCommentDialogConfig({ annotationId });   // ComponentConfig | null | undefined

function StatusDot({ annotationId }) {
  const config = useCommentDialogConfig({ annotationId });
  return <span style={{ background: config?.data?.annotation?.status?.color }} />;
}
```

**React — manual, via the existing element hook** (works today wherever the SDK method exists):

```tsx
const commentElement = useCommentUtils();   // = Velt.getCommentElement()
useEffect(() => {
  const sub = commentElement?.getCommentDialogConfig({ annotationId })?.subscribe(setConfig);
  return () => sub?.unsubscribe();
}, [commentElement, annotationId]);
```

### 4.3 Notifications

Both methods are **zero-argument** (notifications use a single shared config, no id):

```js
Velt.getNotificationElement()
  .getNotificationsPanelConfig()   // → Observable<NotificationsPanelComponentConfig | null>
  .subscribe(config => { console.log(config.data, config.uiState.selectedTab); });

Velt.getNotificationElement()
  .getNotificationsToolConfig()    // → Observable<NotificationsToolDataConfig | null>
  .subscribe(config => { console.log(config.data.unreadNotificationsForYou, config.uiState.notificationsPanelVisible); });
```

**There is NO dedicated React hook for notification config.** Go through the element:

```tsx
const notificationElement = useNotificationUtils();
useEffect(() => {
  const sub = notificationElement?.getNotificationsPanelConfig()?.subscribe(setPanelConfig);
  return () => sub?.unsubscribe();
}, [notificationElement]);
```

### 4.4 Return shapes

**`ComponentConfig`** (comment dialog) — four buckets:

```ts
config.data.annotation           // CommentAnnotation
config.data.annotation.comments  // Comment[]
config.appState.user             // current user
config.appState.isUserAdmin      // boolean
config.featureState.enableResolve, .canResolveAnnotation, .statusOptions   // + many flags
config.uiState.darkMode, .showReplies, .variant, .unread                   // + many more
```

**`NotificationsPanelComponentConfig`** = `NotificationsPanelDataConfig & NotificationsPanelFunctions` — `data` (e.g. `notificationsInSession`, `notificationsByDate`, `settingsConfig`), `uiState` (e.g. `selectedTab`, `tabConfig`, `darkMode`), `featureState` (`settingsEnabled`), `appState` (`user`), plus bound callbacks.

**`NotificationsToolDataConfig`** — `data` (`unreadNotificationsForYou`, `tabConfig`), `uiState` (`notificationsPanelVisible`, `darkMode`, `variant`, `isPhone`, …).

### 4.5 The vanilla-HTML alternative (`velt-data` / `velt-if`)

Still valid, and now usable **inside R1 children** — the stringly-typed HTML answer (no TS/autocomplete, so not the React answer):

```html
<velt-data field="commentObj.from.name"></velt-data>
<velt-if condition="{annotation.status.id} === 'OPEN'"> … </velt-if>
```

### 4.6 Loop in your own code

R1 containers render children once. The React recipe (no new API) — you own the loop, R2 feeds each row:

```tsx
const config = useCommentDialogConfig({ annotationId });
config?.data.annotation.comments.map(c => (
  <VeltCommentDialogThreadCard key={c.commentId} commentId={c.commentId}>
    <MyCustomRow />
  </VeltCommentDialogThreadCard>
));
```

### 4.7 Limits

| Limit | Detail |
|---|---|
| **Read-only** | Change state through existing action APIs, not the config. |
| **Raw, unstable, `@experimental`** | You get Velt's internal `ComponentConfig` — it holds DOM refs, `EventEmitter`s, transient `pending*` flags, and is refactored across releases. **Do not treat the shape as stable.** |
| **Comment dialog needs `annotationId`** | Until R2 context supplies it, a nested component must be passed the id (prop drilling). This is why R2 ships before R3. Notification config methods take no id. |
| **No data API for other features** | Only comment-dialog + notifications. There is **no** cursor/presence/recorder/reaction/autocomplete/activity-log config getter. |
| **`data-velt-*` state attributes are NOT built** | Designed/adopted-in-principle only — **not available**. Do not emit `[data-velt-*]` selectors expecting them to work. |

---

## 5. Cross-cutting summary

| Release | Capability | HTML API | React API | Key rule |
|---|---|---|---|---|
| **R1 Children** | Put your markup inside a primitive | `<velt-…-trigger><svg/></…>` | `{children}` on the wrapper (no SDK change) | `children → template → wireframe → default` |
| **R2 Context** | Parent attributes flow to descendants | `annotation-id`/`comment-id`/… on a parent | attributes auto-forwarded (no SDK change) | child's own attribute beats inherited |
| **R3 Data** | Read live derived state (read-only) | `Velt.getCommentElement().getCommentDialogConfig({annotationId}).subscribe(...)` | `useCommentDialogConfig({annotationId})` | raw `@experimental` `ComponentConfig` |

Notifications R3: `Velt.getNotificationElement().getNotificationsPanelConfig()` / `.getNotificationsToolConfig()` (zero-arg) — **no React hook**, use `useNotificationUtils()`.

---

## 6. What is NOT built / out of scope

- **Children on the 3 dialog hosts** (`velt-comment-dialog` / `-composer` / `-thread`) — not shipped.
- **Dropdown CONTENT slot** — not supported (view torn down per open); items do accept children.
- **`data-velt-*` state attributes** — designed, **not built**.
- **Notification React config hooks** — none; use the element method via `useNotificationUtils()`.
- **R2/R3 beyond comment-dialog + notifications** — not implemented (no cursor/presence/recorder/etc. context consumption or data API).
- **`asChild`** (render *no* Velt wrapper, merge behavior onto your element) — deferred, not built.
- **Render props / controlled-props** patterns — rejected; use children + hooks.

---

## 7. Feature-scope matrix (quick reference)

| Feature | R1 Children | R2 Context | R3 Data |
|---|---|---|---|
| Comment dialog + sub-components | ✅ | ✅ (full) | ✅ `getCommentDialogConfig` / `useCommentDialogConfig` |
| Notifications (panel + tool + list-items) | ✅ | ✅ (full) | ✅ `getNotificationsPanelConfig` / `getNotificationsToolConfig` (no React hook) |
| Autocomplete, activity-log | ✅ | publish mechanism present | ❌ |
| Sidebar V2, comment pin/bubble/text, multi-thread, tools | ✅ | publish mechanism present | ❌ |
| Cursor, presence, recorder, reactions, huddle, tags/arrows/areas | ✅ (where a primitive exists) | ❌ | ❌ |

---

## 8. Availability & version-gating

**Read before emitting R2/R3 code.** At the time of writing, all three land via **open PRs on feature branches — not yet merged or published to npm:**

| Release | Repo | PR |
|---|---|---|
| R1 Children | SDK | `#4485` |
| R2 Context | SDK | `#4487` |
| R3 Data (SDK) | SDK | `#4488` |
| R3 Data (React) | `sdk-react` | `#2075` (blocked on a coordinated `@veltdev/types` publish) |

Consequences to encode as version-gated knowledge (mirror the plugin's `veltVersion`-keyed `knowledge/` convention — verify against the customer's **installed `@veltdev/*` version** before relying on any of this):

- **R3 React hook + types are not in the published packages yet.** `useCommentDialogConfig` and the exported `ComponentConfig` / `AppState` / `FeatureState` / `DataState` / `UIState` types exist in `sdk-react`/SDK source but publish only after `#2075` + the `@veltdev/types` publish land. Until then the published element `.d.ts` types the method as `Observable<any>`, and the hook reports the 2 expected "not yet in types" errors.
- **The manual `useCommentUtils()` / element-method route** (`getCommentDialogConfig`, `getNotificationsPanelConfig`, `getNotificationsToolConfig`) is the more portable form once the SDK build ships those methods.
- **Nothing here is on `main`/published yet** — so a plugin targeting the currently-published SDK should treat R1/R2/R3 as *forthcoming* and gate generation on version detection, not assume presence.

---

## 9. Provenance

Derived from the Velt SDK feature docs (`primitives-children.md`, `primitives-context.md`, `primitives-data.md`), the SDK's `CLAUDE.md` change log (2026-08-03 / 2026-08-04 rows, incl. the notifications extension not present in the feature docs), and verified against SDK source (element facades, notification bases, tag constants). React component names match `guide/reference/primitives.md`. Where the SDK docs and the change log disagreed, the change log + committed source won (e.g. R2 status = BUILT, not "not started").
