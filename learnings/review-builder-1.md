After reading the builder prompt, the diagnosis is clearer:

> **Your builder is a strong work-order executor, but it is not currently a reliable visual-convergence agent.**

The Judge #1 → Judge #2 result shows that it fixes named defects well. However, it failed several responsibilities that its own instructions already assign to it.

## What the builder is doing correctly

In strict-fix mode, it is told to fix every named Judge defect, remeasure, and continue until clean or stopped by the controller. 

That is exactly what appears to have happened:

* Icon dimensions were fixed.
* Send-button state was fixed.
* Composer/filter/card interaction failures were cleared.
* Invalid caret defect was correctly moved out of the builder’s responsibility.

So as a **Judge-task executor**, the builder appears effective.

## What is wrong with the builder design

### 1. It failed its own placeholder check

The builder is explicitly instructed during style mode to verify that placeholders are visibly painted. 

Its final handoff gate repeats the same requirement:

> rendered text content is real, placeholders visible.



Yet the screenshot had no visible main-composer placeholder.

This means one of two things happened:

* The builder skipped or inadequately performed the check.
* The check passed mechanically against the wrong or hidden element.

This is a genuine **builder failure**, not only a Judge failure.

---

### 2. The visual appearance pass is not mechanically enforced

The builder is told to screenshot every block, compare it against the mock, visually inspect composed appearance, and fix visible defects. 

But the actual handoff gate only requires:

* Lint
* TypeScript
* Populated rendering
* Slot adoption
* Selector binding
* Content checks

It does not require persisted:

* Before/after screenshots
* Visual mismatch inventory
* Screenshot comparison result
* Evidence that every block was visually reviewed



Therefore, “look at every block” is a soft prose instruction. The builder can accidentally skip it or perform a superficial comparison and still return.

### Needed change

Require an artifact per block:

```json
{
  "block": "single-comment-with-replies",
  "mockScreenshot": "...",
  "liveScreenshot": "...",
  "visualRegionsReviewed": 8,
  "unresolvedAppearanceDefects": [],
  "status": "appearance-reviewed"
}
```

No artifact should mean an incomplete style build.

---

### 3. Hard components are intentionally underbuilt

For difficult comment-dialog/thread-card blocks, the builder is told to build only the “minimal correct structure” and leave convergence to the Judge and strict-fix stage. 

This creates a dangerous dependency:

1. Builder creates a minimal or imperfect structure.
2. Style mode cannot change structure.
3. Judge misses the structural issue.
4. Strict fix never receives it.
5. The broken structure ships.

This is directly relevant to:

* Replies becoming separate cards
* Reply actions appearing outside the thread
* Extra composer wrappers
* Incorrect card enclosure
* Wrong connector-line ownership

### Needed change

“Minimal structure” must still pass explicit structural invariants:

* One card per annotation/thread
* Replies contained inside the parent thread
* One Reply action per annotation
* Composer avatar, placeholder and send button inside one surface
* Correct order and cardinality of thread sections

---

### 4. Style mode is forbidden from correcting structural mistakes

The builder is explicitly prohibited from changing structure during style mode. If structure is wrong, it can only report it for a later stage. 

This is sensible for deterministic snapshots, but there is no guaranteed mechanism that stops the pipeline and forces structure replanning.

So the builder may visibly notice:

> “Replies are outside the card.”

But it is forbidden from fixing it, and if the Judge does not emit a structural defect, nothing happens.

### Needed change

A discovered structure mismatch during appearance review should immediately produce:

```text
BLOCKED_FOR_REPLAN
```

The pipeline should not proceed to the Judge with knowingly incorrect structure.

---

### 5. Strict-fix mode is closed to unlisted defects

The builder is told to patch the named differences it receives from the Judge. 

That is why it can correctly fix Judge #1 while leaving obviously broken UI untouched.

For example, while fixing icon dimensions, it may visibly notice:

* Header font is too large
* Composer is too tall
* Sidebar radius is wrong
* Placeholder is absent

But these are not named defect rows, so they are outside its work order.

This is good for preventing uncontrolled redesign, but bad for visual convergence.

### Needed change

Allow the builder to emit—not silently fix—additional discoveries:

```json
{
  "type": "builder-discovered-defect",
  "issue": "Main composer height differs materially from mock",
  "recommendedAttribution": "plan-error(style)",
  "evidence": "live/mock screenshots and measured boxes"
}
```

The orchestrator can then route it to the Judge or planner.

---

### 6. It certifies itself using the same incomplete measurement system

In strict-fix mode, the builder reruns `measure-block.mjs` and treats `diffCount: 0` as measured success. 

But that is the same sparse measurement system used by the Judge.

Therefore:

> If the measurement spec does not include composer height, the builder can get `diffCount: 0` while the composer is still visibly wrong.

The builder is not independently verifying visual correctness. It is only independently rerunning the same assertions.

### Needed change

Strict-fix completion should require both:

1. Named Judge rows are clean.
2. A fresh full-block screenshot comparison introduces no significant unexplained region or regression.

---

### 7. It trusts planner output too strongly

The builder is instructed to execute both structure and style plans verbatim and never redesign or invent values. 

This means that when a planner incorrectly specifies:

* Wrong component enclosure
* Wrong selector
* Wrong state ownership
* Missing placeholder slot
* Wrong card padding
* Missing hover state

the builder initially implements the error faithfully.

It can report a plan gap, but it cannot correct it unless the pipeline routes the report back properly.

---

### 8. A wrong mock can poison the complete pipeline

The builder creates a free-drawn mock that becomes the structure oracle and style comparison reference. The prompt itself acknowledges that a wrong mock poisons the style plan. 

This is high risk because the same builder:

1. Interprets Figma.
2. Draws the mock.
3. Translates the mock.
4. Later compares its implementation against its own mock.

If the builder misunderstands Figma at step 1, all later stages can consistently agree with the same incorrect interpretation.

### Needed change

The mock needs an independent approval gate against Figma before it becomes authoritative.

---

## Builder-specific verdict

### As a strict-fix executor: **Strong**

Judge #2 strongly suggests it fixed Judge #1’s valid work order correctly.

### As an initial structure builder: **Risky**

The “minimal hard-component structure” rule can introduce foundational errors that later stages cannot repair.

### As a style builder: **Incomplete enforcement**

The prompt asks for a good visual appearance pass, but does not mechanically prove that it occurred.

### As a self-auditor: **Weak**

It relies on the same sparse assertions as the Judge, so both agents can agree while the interface remains visibly wrong.

## Most important conclusion

The failure is not simply:

> “The Judge missed defects.”

It is:

> **The builder can see defects but is often forbidden from fixing them, is not forced to persist its visual review, and finally certifies itself using the same incomplete measurement coverage as the Judge.**

Judge #1 → Judge #2 proves the **fix loop works for known defects**. The problem is discovering, representing and routing the full set of defects into that loop.
