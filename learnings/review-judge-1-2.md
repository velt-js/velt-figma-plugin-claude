These two runs confirm the judge is **working as instructed**, but the instruction and measurement system are too narrow to perform a true visual audit.

## What the judge did well

It successfully caught several real issues:

* Incorrect icon dimensions
* Disabled send-button opacity/background
* Composer, filter and card interaction failures
* Missing hover actions
* Options button not being clickable
* Missing multi-reply chevron
* Incorrect comment gap

Judge #2 also correctly verified that several Judge #1 defects were fixed rather than repeatedly sending them back.

So the judge is not completely blind. It works well when the expected property is already encoded in a probe.

## What these runs expose

### 1. The defect count is inflated

Judge #1 reports **17 defects**, but these represent roughly 7–9 actual root issues.

Examples:

* Icon width and height are reported as separate defects.
* The same icon problem is repeated under state and flow blocks.
* Send-button opacity/background appears multiple times.
* One interaction problem is repeated at family and flow levels.

Judge #2 has the same problem:

* Hover reveal is reported at both block and family level.
* Comment gap is reported at both state and flow level.

The builder receives duplicated symptoms instead of grouped root causes.

### Required improvement

Each defect needs a stable identity:

```text
issueKey: comment-card.hover-actions.visibility
affectedBlocks:
  - single-comment-hover
  - family-comment-thread
```

One fix order should reference every affected block instead of creating duplicate work.

---

### 2. It only detects issues that already have assertions

The prompt makes `deltaCompare` authoritative and treats the screenshot diff as advisory. 

That explains why it caught exact values such as:

* `12px` versus `24px`
* `8px` versus `4px`
* `opacity: 0.5` versus `1`

But it missed obvious visual problems such as:

* Oversized composer
* Extra composer wrapper
* Missing composer placeholder
* Incorrect header typography
* Incorrect sidebar radius
* Broken card borders
* Wrong thread grouping
* Floating Reply actions
* Incorrect connector-line placement
* Excessive vertical spacing
* Overall cumulative layout drift

Those properties were probably absent from the generated measurement spec.

The judge is therefore validating **the completeness of the existing assertions**, not independently auditing the UI.

---

### 3. Missing placeholder is especially concerning

The judge instructions explicitly require checking whether visible text such as placeholders is actually rendered. 

The main composer placeholder was visibly absent, yet neither judge reported it.

That means one of these is broken:

* The placeholder was not included in the spec.
* The selector mapped to the wrong element.
* The visible-content probe did not run.
* The probe considered an invisible or unrelated placeholder sufficient.
* The state was not driven correctly.

This is a concrete example where the written rule exists but the mechanical coverage does not enforce it.

---

### 4. `iconLint: pass` gives false confidence

The rendered header still appeared as a black dot, yet both reports say:

```text
iconLint: pass
```

The judge only reported the icon’s dimensions, not its final visual identity.

This suggests `icon-lint` may be validating:

* Source asset existence
* Exported SVG paths
* An icon file in isolation

But not necessarily:

* Correct asset assigned to the correct slot
* Final browser-rendered shape
* CSS turning the icon into a solid painted circle
* Duplicate or masked glyphs
* Incorrect container paint

The prompt says icon presence alone is insufficient and final identity must be checked.  The actual output does not demonstrate that this happened successfully.

---

### 5. Interaction failures are too vague

Examples include:

```text
timeout 30000ms
likely covered or zero-opacity hit target
not considered visible/stable
```

These are not sufficiently diagnosed builder instructions.

A timeout could mean:

* Element covered by another layer
* Zero-size element
* Wrong selector
* Off-screen element
* Disabled pointer events
* State not opened
* Animation never stabilised
* Browser or environment problem

The builder is being told the symptom, not the measurable cause.

### Required improvement

Before emitting an interaction defect, capture:

```text
bounding box
computed visibility
opacity
pointer-events
topmost element at click point
scroll position
disabled state
matched selector count
screenshot at failure
```

Then report something actionable:

```text
Options button is covered by .vc-card-overlay.
elementFromPoint resolves to overlay instead of button.
```

---

### 6. Judge #2 may be validating only the previous work order

Judge #2 cleared the defects found by Judge #1 and discovered a few additional issues. But it still did not discover most of the obvious layout problems.

This suggests re-audit may be biased toward:

* Rechecking prior rows
* Running the same sparse specs
* Checking newly reachable states after interaction fixes

It does not appear to perform a genuinely fresh visual inventory after every fix.

That creates a major regression risk: something unrelated could break while fixing an earlier issue, and the judge would not report it unless that property already had an assertion.

---

### 7. The “one card” principle is hiding structural variants

The judge is instructed to validate one repeating card rather than the whole list. 

But the design contains multiple structurally distinct card types:

* Simple comment
* One visible reply
* Multiple collapsed replies
* Expanded replies
* Hover card
* Selected card
* Reply-composer card

These are not one repeated template.

The judge caught a missing multi-reply chevron only because that specific state apparently had a contract row. It still missed the broader fact that comments, replies and actions were enclosed incorrectly.

---

### 8. Plan errors are blocking coverage

Both reports mention:

> avatar/initials probe-binding on 7 blocks

That is a serious signal, not a minor excluded item.

Seven blocks have unreliable mapping between the design expectation and the live DOM. Any measurements depending on those mappings may be incomplete or incorrect.

Because these rows are excluded from the builder work order, the builder cannot resolve them. Unless the planner is immediately rerun and those bindings are repaired, the loop can continue auditing with known blind spots.

---

## Current diagnosis

The judge is strongest at:

* Exact numeric property comparison
* Known interaction probes
* Previously defined state contracts

It is weak at:

* Discovering missing assertions
* Surface-level visual composition
* DOM containment and hierarchy
* Variant completeness
* Final rendered icon identity
* Root-cause grouping
* Cross-iteration regression detection

The most important evidence is this:

> A human can identify approximately 15 visible UI discrepancies, while two judge passes mostly find icon sizes, interactions, one chevron and one gap.

That is not a model intelligence failure. It is a **measurement coverage and authority failure**.

For the next iteration, keep the fresh screenshot and both judge reports. We should track whether the same categories remain invisible even when the implementation changes.
