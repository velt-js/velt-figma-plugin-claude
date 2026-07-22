# Judge #2 → builder work order (re-audit after strict fix)

Run: `2026-07-22-fresh-1`  
Stage end: `2026-07-22T13:22:00.895Z`  
Verdict: `FAIL` (gate exit 2)  
iconLint: `pass`  
Totals passed to builder: **6** rows (`builder-error` only; `comment.gap` on two blocks)

Smoke at handoff:

```json
{
  "fam-sidebar-header": {
    "ok": true,
    "failed": []
  },
  "fam-comment-thread-components": {
    "ok": false,
    "failed": ["every-dialog-context", "affordances-once"]
  },
  "flows": {
    "ok": true,
    "failed": []
  }
}
```

Cleared vs Judge #1 (do not re-fix): icon 12→24, send `iconbutton` opacity/bg, composer/filter/card click timeouts on header + flows.

Not passed to builder (plan-error — out of scope for this work order): avatar/initials probe-binding; `color-layer` `#1a1917` (reclassified plan-error — caret/probe misbind).

---

## Defect rows (`attribution: "builder-error"`)

```json
[
  {
    "block": "state-comment-thread-components-single-comment-dialog-hover",
    "element": ".vc-actions, .vc-resolve",
    "property": "interaction",
    "spec": "visible after card hover (smoke every-dialog-context)",
    "rendered": "timeout 30000ms — not visible",
    "delta": "hover-reveal CSS/hit-target does not expose thread actions for Playwright hover",
    "KIND": "hover",
    "attribution": "builder-error",
    "smokeStep": "every-dialog-context"
  },
  {
    "family": "fam-comment-thread-components",
    "element": ".vc-actions, .vc-resolve",
    "property": "interaction",
    "spec": "visible after hover",
    "rendered": "timeout 30000ms",
    "KIND": "hover",
    "attribution": "builder-error",
    "smokeStep": "every-dialog-context"
  },
  {
    "family": "fam-comment-thread-components",
    "element": ".vc-options-trigger",
    "property": "interaction",
    "spec": "click succeeds",
    "rendered": "timeout 30000ms — not considered visible",
    "KIND": "click",
    "attribution": "builder-error",
    "smokeStep": "affordances-once"
  },
  {
    "block": "state-comment-thread-components-single-comment-with-more-than-1-replies",
    "element": "chevrongrabbervertical / MoreReply collapse control",
    "property": "present",
    "spec": "rendered + supplied content",
    "rendered": "MISSING",
    "delta": "collapsed multi-reply affordance not visible in driven state",
    "KIND": "pixel",
    "attribution": "builder-error"
  },
  {
    "block": "state-comment-thread-components-multiple-comments",
    "element": "comment",
    "property": "gap",
    "spec": "8px",
    "rendered": "4px",
    "delta": "Δ -4px",
    "KIND": "pixel",
    "attribution": "builder-error",
    "pass": false
  },
  {
    "block": "flow",
    "element": "comment",
    "property": "gap",
    "spec": "8px",
    "rendered": "4px",
    "delta": "Δ -4px",
    "KIND": "pixel",
    "attribution": "builder-error",
    "pass": false
  }
]
```
