# Approach · Headless

**What it is:** Velt gives you the **data and the actions** through React hooks. **You build 100% of the UI** with your own components. Velt renders nothing.

**Use it when:** the design needs your **own interactive components** inside the collaboration UI, a layout wireframe slots can't express, or you're rendering comments into a surface Velt can't draw into (a PDF/canvas/video timeline). (Decision tree Q4.)

**Don't use it when:** a wireframe could express the layout — headless means you own (and maintain) everything, including parity with Velt's built‑in behavior. It's the most powerful and the most expensive layer.

> Headless is the most powerful and most expensive layer — reach for it only when no other layer fits.

---

## The model

Three kinds of hooks (full list grouped in [`reference/hooks.md`](../reference/hooks.md)):

- **Read (data/state):** `useCommentAnnotations`, `useCommentAnnotationById`, `useUnreadCommentAnnotationCountOnCurrentDocument`, `useCommentModeState`, … → reactive data you render.
- **Mutate (actions):** `useAddCommentAnnotation`, `useAddComment`, `useUpdateComment`, `useDeleteComment`, `useDeleteCommentAnnotation`, `useResolveCommentAnnotation`, `useUpdateStatus`, `useToggleReaction`, `useGetLink`, … → call these from your own buttons.
- **Control:** `useVeltClient`, `useSetDocuments`, `useIdentify`, `useVeltInitState`, … → init/scope/imperative control.

You wire your UI's events to the mutate hooks and render the read hooks' data. Velt still handles storage, sync, mentions, permissions — you're only replacing the **view**.

## Step 1 — Render data from a read hook

```tsx
import { useCommentAnnotations } from "@veltdev/react";
import type { CommentAnnotation } from "@veltdev/types";

function CommentsPanel() {
  const annotations: CommentAnnotation[] = useCommentAnnotations() ?? [];
  return (
    <div className="my-panel">
      {annotations.map((a) => (
        <MyThreadCard key={a.annotationId} annotation={a} />
      ))}
    </div>
  );
}
```

`useCommentAnnotations()` is reactive — it re‑renders when comments change anywhere (including other users in real time). You never poll.

## Step 2 — Wire your buttons to action hooks

Your components are fully interactive (unlike wireframes). Call the action hooks from your own handlers:

```tsx
import {
  useAddComment, useResolveCommentAnnotation, useCurrentUser,
} from "@veltdev/react";
import type { CommentAnnotation, User } from "@veltdev/types";

function MyThreadCard({ annotation }: { annotation: CommentAnnotation }) {
  const currentUser = useCurrentUser();            // the identified user
  const { addComment } = useAddComment();
  const { resolveCommentAnnotation } = useResolveCommentAnnotation();

  const reply = async (text: string, html: string) => {
    if (!currentUser) return;
    const comment = buildComment(currentUser, text, html);   // buildComment is defined in Step 3
    await addComment({ annotationId: annotation.annotationId, comment });
  };

  return (
    <article>
      {/* your fully custom, interactive UI */}
      <button onClick={() => resolveCommentAnnotation({ annotationId: annotation.annotationId })}>
        Resolve
      </button>
    </article>
  );
}
```

## Step 3 — Build objects to the SDK data model

Mutations expect objects shaped like Velt's types (from `@veltdev/types`). You construct them yourself. Example `Comment` builder:

```tsx
import type { Comment, User } from "@veltdev/types";

function buildComment(currentUser: User, text: string, html: string): Comment {
  return {
    commentId: Date.now(),
    type: "text",
    from: currentUser,
    status: "added",
    commentText: text,
    commentHtml: html,
    taggedUserContacts: [],
    attachments: [],
    reactionAnnotationIds: [],
    customList: [],
  } as unknown as Comment;   // cast: fill every field your action needs; cast bridges optional fields you omit (R13)
}
```

> Because you hand‑build these, **read the type** (`Comment`, `CommentAnnotation`, `User` in `@veltdev/types`) and fill every field the action needs. Missing fields are the most common headless bug.

---

## The cost (be honest about this)

Going headless means **you re‑implement and maintain** everything Velt's UI gave you for free:

- Thread layout, replies, collapsing, edit‑in‑place, resolved state.
- The composer: @mentions UI, attachments, reactions, formatting.
- Filtering/sorting (compute client‑side over `useCommentAnnotations()`).
- Empty/loading states, accessibility, dark mode.
- **Upgrade burden:** new Velt features won't appear in your UI automatically.

If a [wireframe](./wireframes.md) can express the layout, prefer it — you keep Velt's behavior for free and only restyle.

---

## When headless is the *right* call

- Comments rendered onto a non‑DOM surface (PDF, canvas, a video timeline) where Velt can't draw.
- A panel built entirely from your own interactive design‑system components.
- Behavior that no slot offers (custom inline workflows, bespoke filtering UIs) — drive Velt via hooks + the client API.

---

## Checklist

- [ ] Using real hook names from [`reference/hooks.md`](../reference/hooks.md).
- [ ] Objects passed to mutations match `@veltdev/types` (all required fields).
- [ ] Reactive data comes from read hooks (no manual polling).
- [ ] You've confirmed a wireframe genuinely *can't* do it (headless is the costly last resort).
