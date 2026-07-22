# Judge #1 → builder work order

Run: `2026-07-22-fresh-1`  
Stage end: `2026-07-22T12:29:14.961Z`  
Verdict: `FAIL` (gate exit 2)  
iconLint: `pass`  
Totals passed to builder: **17** (`builder-error` only)

Smoke at handoff:

```json
{
  "fam-sidebar-header": {
    "ok": false,
    "failed": ["short-message", "max-length-message", "affordances-once"]
  },
  "fam-comment-thread-components": {
    "ok": false,
    "failed": ["short-message", "max-length-message", "every-dialog-context", "affordances-once"]
  },
  "flows": {
    "ok": false,
    "failed": ["short-message", "max-length-message", "every-dialog-context", "affordances-once"]
  }
}
```

Not passed to builder (plan-error — out of scope for this work order): avatar/initials probe-binding on 7 blocks.

---

## Defect rows (`attribution: "builder-error"`)

```json
[
  {
    "block": "state-sidebar-header-comments",
    "element": "icon",
    "property": "width",
    "spec": "12px",
    "rendered": "24px",
    "delta": "Δ -12px",
    "KIND": "pixel",
    "attribution": "builder-error",
    "pass": false
  },
  {
    "block": "state-sidebar-header-comments",
    "element": "icon",
    "property": "height",
    "spec": "12px",
    "rendered": "24px",
    "delta": "Δ -12px",
    "KIND": "pixel",
    "attribution": "builder-error",
    "pass": false
  },
  {
    "block": "state-sidebar-header-comments",
    "element": ".vc-composer [contenteditable], .velt-composer-input",
    "property": "interaction",
    "spec": "click/hover succeeds",
    "rendered": "timeout 30000ms",
    "delta": "Playwright visible click timed out — page-mode composer input not interactable",
    "KIND": "click",
    "attribution": "builder-error",
    "smokeStep": "short-message / max-length-message"
  },
  {
    "block": "state-sidebar-header-comments",
    "element": ".vc-filter-trigger",
    "property": "interaction",
    "spec": "click/hover succeeds",
    "rendered": "timeout 30000ms",
    "delta": "filter trigger resolved but click timed out (not considered visible/stable)",
    "KIND": "click",
    "attribution": "builder-error",
    "smokeStep": "affordances-once"
  },
  {
    "block": "state-comment-thread-components-single-comment-dialog",
    "element": ".vc-card",
    "property": "interaction",
    "spec": "click/hover succeeds",
    "rendered": "timeout 30000ms",
    "delta": "card resolves but click/hover timed out — likely covered or zero-opacity hit target",
    "KIND": "click",
    "attribution": "builder-error",
    "smokeStep": "short-message / hover / affordances"
  },
  {
    "block": "state-comment-thread-components-selected-state",
    "element": "color-layer",
    "property": "background",
    "spec": "#1a1917",
    "rendered": "rgba(0, 0, 0, 0)",
    "delta": "alpha/transparency differs",
    "KIND": "pixel",
    "attribution": "builder-error",
    "pass": false
  },
  {
    "block": "state-comment-thread-components-selected-state",
    "element": "icon",
    "property": "width",
    "spec": "12px",
    "rendered": "24px",
    "delta": "Δ -12px",
    "KIND": "pixel",
    "attribution": "builder-error",
    "pass": false
  },
  {
    "block": "state-comment-thread-components-selected-state",
    "element": "icon",
    "property": "height",
    "spec": "12px",
    "rendered": "24px",
    "delta": "Δ -12px",
    "KIND": "pixel",
    "attribution": "builder-error",
    "pass": false
  },
  {
    "block": "flow",
    "element": "iconbutton",
    "property": "opacity",
    "spec": "0.5",
    "rendered": "1",
    "delta": "",
    "KIND": "pixel",
    "attribution": "builder-error",
    "pass": false
  },
  {
    "block": "flow",
    "element": "iconbutton",
    "property": "background",
    "spec": "#f1efec",
    "rendered": "rgba(0, 0, 0, 0)",
    "delta": "alpha/transparency differs",
    "KIND": "pixel",
    "attribution": "builder-error",
    "pass": false
  },
  {
    "block": "flow",
    "element": "icon",
    "property": "width",
    "spec": "12px",
    "rendered": "24px",
    "delta": "Δ -12px",
    "KIND": "pixel",
    "attribution": "builder-error",
    "pass": false
  },
  {
    "block": "flow",
    "element": "icon",
    "property": "height",
    "spec": "12px",
    "rendered": "24px",
    "delta": "Δ -12px",
    "KIND": "pixel",
    "attribution": "builder-error",
    "pass": false
  },
  {
    "block": "flow",
    "element": "iconbutton",
    "property": "opacity",
    "spec": "0.5",
    "rendered": "1",
    "delta": "",
    "KIND": "pixel",
    "attribution": "builder-error",
    "pass": false
  },
  {
    "block": "flow",
    "element": "iconbutton",
    "property": "background",
    "spec": "#f1efec",
    "rendered": "rgba(0, 0, 0, 0)",
    "delta": "alpha/transparency differs",
    "KIND": "pixel",
    "attribution": "builder-error",
    "pass": false
  },
  {
    "block": "flow",
    "element": "icon",
    "property": "width",
    "spec": "12px",
    "rendered": "24px",
    "delta": "Δ -12px",
    "KIND": "pixel",
    "attribution": "builder-error",
    "pass": false
  },
  {
    "block": "flow",
    "element": "icon",
    "property": "height",
    "spec": "12px",
    "rendered": "24px",
    "delta": "Δ -12px",
    "KIND": "pixel",
    "attribution": "builder-error",
    "pass": false
  },
  {
    "block": "flow",
    "element": ".vc-composer input / .vc-list .vc-card / .vc-filter-trigger",
    "property": "interaction",
    "spec": "click/hover succeeds",
    "rendered": "timeout 30000ms",
    "delta": "same interactability failures as family smokes",
    "KIND": "click",
    "attribution": "builder-error",
    "smokeStep": "smoke flows"
  }
]
```
