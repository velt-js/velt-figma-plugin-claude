Since Iteration 2 did **not** receive the Iteration 1 issue list, the iteration labels below are only a visual comparison—not a judgement that the AI ignored previous feedback.

## Iteration 2 summary

* **Open UI issues:** 15
* **Carried forward unchanged from Iteration 1:** 13
* **Improved but still incomplete:** 2
* **Correct in Iteration 1 but broken in Iteration 2:** 0
* **New issues introduced in Iteration 2:** 0
* **Fully resolved issues:** 0

---

### 1. Sidebar shape and boundary

**Iteration status:** Carried forward from Iteration 1

**Issue:** The sidebar still has a large rounded bottom-right corner. The Figma sidebar is a rectangular panel with only a subtle left boundary.

**Fix:** Remove the large corner radius. Use a white 354px panel with a `1px #F1EFEC` left border.

**How to avoid:** Match the outermost Figma frame before implementing internal components. Parent shape errors affect the appearance of the entire UI.

---

### 2. Header typography

**Iteration status:** Carried forward from Iteration 1

**Issue:** “Comments” remains substantially larger than the Figma design.

**Fix:** Use Poppins Medium, `16px/24px`, color `#1A1917`.

**How to avoid:** Extract typography values directly from the text layer instead of estimating them from the screenshot.

---

### 3. Header filter icon

**Iteration status:** Carried forward from Iteration 1

**Issue:** The filter control is still rendered as a black dot.

**Fix:** Use the correct 12px filter icon centred inside a 24px icon button.

**How to avoid:** Never substitute icons with visually approximate shapes. Confirm the actual icon asset and its bounding box.

---

### 4. Composer width and send-button position

**Iteration status:** Improved but incomplete

**Issue:** The input now stretches across the available width and the send button is correctly placed on the right, which is an improvement. However, the component is still far too tall and structurally different from Figma.

**Fix:** Make the complete composer exactly 40px high, with the avatar, placeholder, and send button in one horizontal row.

**How to avoid:** Validate width, height, and internal alignment together. Fixing only horizontal positioning does not complete the component.

---

### 5. Extra composer wrapper

**Iteration status:** Carried forward from Iteration 1

**Issue:** A large outer rounded container still surrounds the actual composer. Figma contains only the compact composer with a subtle shadow.

**Fix:** Remove the oversized outer wrapper or make it visually transparent with no independent height, border, or padding.

**How to avoid:** Inspect which Figma layers are structural Auto Layout frames and which layers create visible surfaces. Not every frame should become a styled box.

---

### 6. Composer border state

**Iteration status:** Carried forward from Iteration 1

**Issue:** The composer has a strong black border in the default empty state. This border belongs only to the focused inline reply composer.

**Fix:** Use a subtle `#F1EFEC` border and low elevation for the main composer. Apply `#1A1917` only during the focused reply state.

**How to avoid:** Map styling to interaction states before coding: default, hover, focus, disabled, and selected.

---

### 7. Composer placeholder

**Iteration status:** Carried forward from Iteration 1

**Issue:** The placeholder remains completely missing, making the composer appear unfinished.

**Fix:** Display “Comment or tag others with @” using Poppins Regular `14px/20px`, muted `#848079`, positioned 8px after the avatar.

**How to avoid:** Test every input in its empty state. Placeholder content is part of the required UI, not dynamic comment data.

---

### 8. Composer avatar and control sizing

**Iteration status:** Improved but incomplete

**Issue:** The avatar and send button are now positioned more logically, but the avatar is oversized and the row has excessive vertical padding.

**Fix:** Use a 20px avatar and a 24px send button inside a 40px-high composer with 10px horizontal and 8px vertical padding.

**How to avoid:** Compare the actual control dimensions, not only their relative placement.

---

### 9. Vertical section spacing

**Iteration status:** Carried forward from Iteration 1

**Issue:** The composer and comment list still have excessive vertical space.

**Fix:** Use 24px between the header and composer, 24px between the composer and list, and 16px between thread cards.

**How to avoid:** Read gaps from the parent Figma Auto Layout instead of creating margins independently.

---

### 10. Comment-card dimensions and borders

**Iteration status:** Carried forward from Iteration 1

**Issue:** Cards are much taller and wider in visual proportion than Figma. Their borders appear fragmented and partially disappear at the sides.

**Fix:** Use one continuous outer card surface with an 8px radius, correct border/elevation variant, 12px padding, and natural content height.

**How to avoid:** Apply the card boundary to one outer semantic container. Do not distribute borders across separate header, body, and action elements.

---

### 11. Thread grouping

**Iteration status:** Carried forward from Iteration 1

**Issue:** Replies and Reply actions are still displayed as separate floating cards or sections rather than one conversation thread.

**Fix:** Keep the parent comment, reply-count row, reply preview, connector lines, and Reply action inside one card.

**How to avoid:** Build the DOM according to the user’s mental model: one card represents one complete conversation thread.

---

### 12. Reply action alignment

**Iteration status:** Carried forward from Iteration 1

**Issue:** Reply controls remain horizontally centred and detached from their associated comment.

**Fix:** Align the 16px reply icon and label to the message column using the same 28px left offset, with a 4px icon-label gap.

**How to avoid:** Place actions within the comment’s content grid rather than positioning them relative to the entire card width.

---

### 13. Reply-count row and chevron

**Iteration status:** Carried forward from Iteration 1

**Issue:** The chevron remains detached from the label and the row does not align with the Figma content grid.

**Fix:** Treat the chevron and “Show N replies” text as one interactive row. Centre the 12px chevron under the avatar and start the label at the 28px text offset.

**How to avoid:** Implement icon and label as one control with one hit area, rather than independent positioned elements.

---

### 14. Connector-line structure

**Iteration status:** Carried forward from Iteration 1

**Issue:** Connector lines are too long, shifted right, and extend through unrelated sections.

**Fix:** Align each 1px segment with the avatar centre. Use separate segments for the parent message, reply-count row, and reply content.

**How to avoid:** Do not create one full-height absolute line for a dynamic thread. Generate line segments from the actual thread sections.

---

### 15. Content alignment

**Iteration status:** Carried forward from Iteration 1

**Issue:** Names, timestamps, messages, connector lines, reply counts, and actions do not share a consistent alignment grid.

**Fix:** Use a 20px avatar, 8px avatar-content gap, and a consistent 28px content offset across all thread elements.

**How to avoid:** Define shared layout primitives for metadata, message body, reply row, and action row instead of assigning separate margins.

---

### 16. Typography inside cards

**Iteration status:** Carried forward from Iteration 1

**Issue:** Names, comments, timestamps, reply labels, and reply counts remain significantly larger than Figma.

**Fix:** Use:

* Name: `14px/20px`, Medium
* Comment: `14px/20px`, Regular
* Timestamp: `12px/16px`, Regular
* Reply count: `12px/16px`, Medium/Regular per state
* Reply action: `12px/16px`, Medium

**How to avoid:** Create reusable typography tokens and apply them consistently across all comment variants.

---

### 17. Overflow and clipping

**Iteration status:** Carried forward from Iteration 1

**Issue:** The Reply action near the bottom is clipped and content continues underneath the rounded sidebar edge.

**Fix:** Let every card grow naturally, remove fixed heights, and make only the comment-list viewport scroll. Add sufficient bottom scroll padding.

**How to avoid:** Test with several comments, multiline messages, expanded replies, and the final list item—not only the first visible card.

---

## States not verifiable from this screenshot

The current screenshot only shows the default list state. These still require separate screenshots before they can be marked correct:

* Card hover background
* Resolve icon
* Options icon
* Selected/replying state
* Inline reply composer
* Focus border and caret
* Expanded thread behaviour
* Long username with hover actions

**Core diagnosis:** Iteration 2 improved the composer’s horizontal layout, but the implementation still appears to be styling the existing component hierarchy rather than rebuilding it to match the Figma structure. The next attempt should correct the DOM grouping and sizing first, then apply visual styling.
