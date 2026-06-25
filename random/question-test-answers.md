# Question Test Answers

These are the **confident, layered verdicts** the guide should produce for [`question-test.md`](./question-test.md) — each names the first layer that achieves the goal (default behavior → prop/config → wireframe → primitive → headless), and confirms feasibility against the data model before any "not supported" call. (This file doubles as a validation case: re-running the questions against the guide should reproduce these answers, with no hedging.)

1. **First + last reply visible, middle as "N more replies", expandable**
   - **Supported — props.** Set `collapsedComments` + `collapsedRepliesPreview` (both default `false`). The collapsed view renders strictly **first comment → "N more replies" divider → last comment**, and expands on click. Detail: [`reference/behaviors/dialog.md`](./reference/behaviors/dialog.md) + [`reference/behaviors.md`](./reference/behaviors.md) (the `collapsedComments × collapsedRepliesPreview` matrix).

2. **First + second + last reply visible, middle as "N more replies"**
   - **Not achievable by props** — the collapse logic is strictly `index === 0 || index === last` (first/last only); there is no first-N-plus-last prop. Achieve it by **wireframing the `Threads`/`ThreadCard` slots** (own the per-index render) or, for full control, **primitives**. Confident, not "maybe."

3. **Dialog default expanded (all comments, scrollable), composer shown on click**
   - **Supported — prop + default behavior.** `fullExpanded` renders the thread expanded; the dialog body is **scrollable by default**; and "composer hidden while the dialog is unselected, shown on select" **is the default** dialog behavior (`composerMode:'default'`) — you don't wire it. Detail: [`reference/behaviors.md`](./reference/behaviors.md) (default behaviors + state machine).

4. **Dialog-level filter dropdown (filter replies by user / by mentions-me)**
   - **Not a built-in dialog filter UI** — sidebar filtering exists, but per-reply filtering inside one dialog isn't a prop. **Achievable via primitives/headless** with your own filter control, and the **data supports it**: each reply carries `from.userId` (author) and `to[]` (mentions), and the thread carries `mentionedUserIds` / `involvedUserIds` ([`reference/data-models.md`](./reference/data-models.md)). So: build the dropdown yourself, filter the reply list client-side. Confident (data confirmed present).

5. **Edited badge hover → who edited and when**
   - **Partial — and the limit is a data absence, stated plainly.** The edited badge and **when** are supported: `isEdited` + `editedAt` exist (badge via the `ThreadCard.Edited` slot). But **"who edited" is not achievable client-side** — the data model stores only the original author (`from`); there is **no per-edit editor identity** ([`reference/data-models.md`](./reference/data-models.md) → Absences). Showing the editor would require a server-side audit trail (REST/webhook), not the client SDK.

6. **Custom emoji list in the reaction panel**
   - **Supported — prop/API.** Use `customReactions` (or `setCustomReactions(...)`).

7. **Newest reply first**
   - **Supported — props.** `sortBy="createdAt"` + `sortOrder="desc"`. See [`reference/behaviors.md`](./reference/behaviors.md) (`sortBy × sortOrder`).

8. **Custom "status" dropdown with values Bug / Feedback / Accessibility / Design (default Feedback)**
   - **Wrong tool — corrected.** The status dropdown is for **workflow status** (statuses carry `type: default | ongoing | terminal` semantics — e.g. `terminal` resolves the thread). Bug/Feedback/Accessibility/Design are **categories**, not workflow states. Two correct paths: (a) use **`customCategory`** (a separate axis built for exactly this); or (b) store the value in the thread **`context`** and render your own dropdown (primitives), reading/writing it via the comment data. Forcing these into `customStatus` mis-applies workflow semantics. See [`reference/component-definitions.md`](./reference/component-definitions.md) (status vs category intent) + [`reference/data-models.md`](./reference/data-models.md) (custom-data storage).
