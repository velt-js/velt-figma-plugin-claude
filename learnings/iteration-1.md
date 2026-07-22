You’re right. The **chevron and connector line were only partially covered under “Thread connector,”** while hover state, resolve/options actions, composer placeholder, and exact card treatment were not explicit enough.

## 1. Sidebar container

**Issue:** Sidebar width, border, padding, and bottom corner radius differ from Figma.

**Fix:** Use a 354px white panel with a `1px #F1EFEC` left border, no large bottom radius, `16px` horizontal padding, and `12px` top padding.

**How to avoid:** Start by matching the outer frame. Incorrect parent dimensions distort every child component and make the entire sidebar feel wrong.

---

## 2. Header

**Issue:** Header typography is oversized and the filter icon appears as a black dot.

**Fix:** Use Poppins Medium `16px/24px`. Render the correct 12px filter icon inside a 24px button.

**How to avoid:** Never approximate icons with dots or text characters. Match the exact asset, icon bounds, and clickable area.

---

## 3. Composer structure

**Issue:** The composer is too tall and contains an incorrect nested bordered box.

**Fix:** Use one `322 × 40px` composer with an 8px radius, subtle border/shadow, 20px avatar, placeholder, and 24px send button.

**How to avoid:** Inspect the Figma layer hierarchy before coding. A wrapper and its content frame should not accidentally become two visible input borders.

---

## 4. Composer placeholder

**Issue:** The placeholder is missing or lacks the correct spacing and styling, making the composer look empty or broken.

**Fix:** Display **“Comment or tag others with @”** in Poppins Regular `14px/20px`, muted `#848079`, vertically centred, 8px after the avatar.

**How to avoid:** Treat placeholder text as a required UI element, not optional dynamic content. Test the composer in its empty, focused, typed, and disabled states.

---

## 5. Composer send button

**Issue:** The send control has the wrong size, border, position, or visual state.

**Fix:** Use a 24px rounded button aligned to the right, with the 12px arrow centred. In the empty state, use the disabled background and 50% opacity shown in Figma.

**How to avoid:** Implement controls by state—enabled, disabled, hover, and focus—not as one static icon.

---

## 6. Section spacing

**Issue:** The header, composer, and comment list have excessive or inconsistent vertical gaps.

**Fix:** Use 24px between the header and composer, 24px between composer and list, and 16px between cards.

**How to avoid:** Read spacing from parent Auto Layout frames rather than assigning margins independently to each child.

---

## 7. Dialog/card border

**Issue:** Card borders are broken, clipped, overly faint, or split across multiple child containers.

**Fix:** Apply one continuous `1px #E4E1DD` border and 8px radius to the outer thread card. Use 12px internal padding.

**How to avoid:** The visual boundary should belong to one semantic component. Do not construct a card border from multiple child borders.

---

## 8. Dialog/card spacing

**Issue:** Content sits too close to card edges, and spacing between metadata, message, replies, and actions is inconsistent.

**Fix:** Use 12px outer padding, 4px between metadata and message, 16px between thread sections, and 8px before the Reply action where shown.

**How to avoid:** Define an internal spacing system for the card before styling individual elements. The card should feel like one organised conversation unit.

---

## 9. Thread grouping

**Issue:** Replies and actions are rendered as separate cards or detached elements.

**Fix:** Keep the parent comment, reply count, expanded replies, connector lines, and Reply action inside the same thread card.

**How to avoid:** Build the DOM from the user’s mental model: one card equals one conversation thread, not one card per visible text block.

---

## 10. Connector line

**Issue:** The vertical line is shifted right, passes through borders, extends too far, or appears detached from the avatars.

**Fix:** Use a 1px line aligned with the avatar centre. Keep each segment inside the thread card and stop it before reply-count and action rows where required.

**How to avoid:** Position the line relative to the thread content, not the page. Validate it against one reply, multiple replies, collapsed replies, and multiline messages.

---

## 11. Replies chevron

**Issue:** The chevron floats separately, uses the wrong icon, or is not aligned with the “Show replies” label.

**Fix:** Use the 12px vertical chevron/grabber icon, centred in a 20px avatar column, with the label beginning at the same 28px text offset as comment bodies.

**How to avoid:** Treat the chevron and label as one interactive row. Their icon, label, hit area, and connector alignment must be verified together.

---

## 12. Content alignment

**Issue:** Avatars, names, timestamps, messages, chevrons, and Reply actions do not share a consistent grid.

**Fix:** Use 20px avatars with an 8px gap. Align body text and actions at a consistent 28px offset from the card’s content origin.

**How to avoid:** Establish one alignment grid and reuse it everywhere. Independent margins create the staggered appearance seen in the current result.

---

## 13. Hover state

**Issue:** Hover actions are missing, always visible, oversized, or cause layout movement.

**Fix:** On card hover or keyboard focus, show the resolve and options controls in the top-right without changing card dimensions or shifting content.

**How to avoid:** Compare every Figma interaction state, not just the default screenshot. Test default, hover, selected, focused, and expanded states separately.

---

## 14. Resolve icon

**Issue:** A large standalone checkmark is used instead of the small resolve control from Figma.

**Fix:** Use the correct 16px outlined check-circle icon. Position it in the top-right action group without overlapping the message.

**How to avoid:** Match both the icon artwork and its container. A semantically similar icon is not visually equivalent.

---

## 15. Options icon

**Issue:** The kebab icon is oversized, too far from the resolve icon, or vertically misaligned.

**Fix:** Use a 16px vertical options icon, placed 8px after the resolve icon inside a 40px-wide action group.

**How to avoid:** Implement related actions as one fixed action cluster rather than positioning each icon independently.

---

## 16. Typography

**Issue:** Font family, weights, sizes, line heights, and timestamp colors differ from the design.

**Fix:** Use Poppins throughout:

* Name: `14px/20px`, Medium
* Comment and placeholder: `14px/20px`, Regular
* Timestamp and reply count: `12px/16px`, Regular
* Reply action: `12px/16px`, Medium

**How to avoid:** Extract typography tokens before implementation instead of visually estimating each text element.

---

## 17. Overflow and dynamic content

**Issue:** Long messages clip, Reply actions disappear, cards overlap, and connector lines escape their containers.

**Fix:** Allow cards to grow naturally. Avoid fixed content heights and make only the sidebar list scroll.

**How to avoid:** Test realistic content permutations: short and long messages, long names, one or many replies, collapsed and expanded threads, and hover actions.

---

### Core lesson for the AI

Do not implement only what is visually obvious in one screenshot. First identify:

1. Component hierarchy
2. Exact dimensions and spacing
3. Default and interactive states
4. Dynamic-content behaviour
5. Shared alignment rules

Then compare each component against Figma in default, hover, selected, collapsed, expanded, empty, and overflow states before considering it complete.


After rechecking the individual Figma states, these items were still missing or needed correction:

### 18. Card visual variants

**Issue:** We previously treated every card as having the same `#E4E1DD` border, but Figma uses different treatments by state.

**Fix:**

* Standard thread with replies: strong `#E4E1DD` border
* Single/default card: subtle “border-only” elevation
* Hover/selected card: subtle `#F7F6F4` background with border-only elevation

**How to avoid:** Inspect each component variant separately. Do not derive hover, selected, and default styles from one screenshot.

---

### 19. Hover background

**Issue:** We mentioned hover actions but missed the card’s background change.

**Fix:** On hover, change the card background from white to `#F7F6F4` while keeping its size, padding, and border unchanged.

**How to avoid:** Compare the complete component state, not only the elements that appear or disappear.

---

### 20. Action visibility rules

**Issue:** Resolve and options icons may remain permanently visible instead of appearing only during interaction.

**Fix:** Hide them in the default state. Show them on card hover, keyboard focus, and selected state without shifting the metadata.

**How to avoid:** Define a state table before implementation: default, hover, focus, selected, collapsed, and expanded.

---

### 21. Action-row width and overlap

**Issue:** Resolve/options icons can overlap the username or force the timestamp onto another line.

**Fix:** Reserve a fixed 40px action area with two 16px icons and an 8px gap. Truncate long names while keeping the timestamp and actions visible.

**How to avoid:** Test metadata using long usernames, timestamps, and visible actions together—not separately.

---

### 22. Reply action alignment

**Issue:** The live Reply action is centred or detached, while Figma aligns it with the message column.

**Fix:** Use a 16px reply icon, 4px icon-label gap, and place the row at the same 28px left offset as the message body.

**How to avoid:** Treat actions as part of the shared content grid. Do not centre them inside the card.

---

### 23. Reply-count behaviour

**Issue:** The UI does not correctly distinguish between one reply and multiple replies.

**Fix:**

* Exactly one reply: show the reply directly—no “Show replies” row
* More than one reply: show “Show N replies…” followed by the reply preview

**How to avoid:** Review the Figma’s data-driven component variants, not just its visual styling.

---

### 24. Reply-count row interaction

**Issue:** The chevron and label can appear disconnected or have separate click areas.

**Fix:** Make the entire row clickable, with the exact 12px chevron aligned to the avatar centre and the label starting at the 28px content offset.

**How to avoid:** Build interactive rows as one semantic control, then position the icon and text inside it.

---

### 25. Connector-line segmentation

**Issue:** The thread line is implemented as one continuous line, causing it to pass through the reply-count row or card border.

**Fix:** Use separate line segments around the parent message and reply-count row. Stop each segment at the exact intended content boundary.

**How to avoid:** Do not represent a branched conversation connector with one full-height absolute element. Derive segments from the rendered thread sections.

---

### 26. Reply indentation

**Issue:** Replies may receive additional nesting or horizontal indentation.

**Fix:** Reply avatars align with the parent avatar. Only the reply message and Reply action use the 28px text offset.

**How to avoid:** Compare absolute alignment across parent and reply rows. Hierarchical meaning does not always require extra visual indentation.

---

### 27. Selected/replying state

**Issue:** Clicking Reply must not open a detached or oversized composer.

**Fix:** Change the card to its selected background and insert a 40px inline reply composer inside the same card, below the message.

**How to avoid:** Inspect what happens after every visible action. Matching the idle state alone is incomplete.

---

### 28. Inline reply placeholder

**Issue:** The reply composer requires a different placeholder from the main composer.

**Fix:** Use `Reply to {username}...`, Poppins Regular `14px/20px`, muted color, with avatar and disabled send button.

**How to avoid:** Treat the main composer and reply composer as separate variants with their own content contract.

---

### 29. Focused reply-composer border

**Issue:** The black interactive border is incorrectly used on the main empty composer or omitted from the selected reply composer.

**Fix:** Use the dark `#1A1917` border only for the focused inline reply composer. The main empty composer keeps its subtle border and shadow.

**How to avoid:** Map every border to a state. Do not copy the focused appearance into the default component.

---

### 30. Shared edge alignment

**Issue:** Header, composer, cards, and list content do not begin and end on the same horizontal edges.

**Fix:** All major sections must share the same 322px content width and align to the sidebar’s 16px horizontal inset.

**How to avoid:** Validate parent-level bounding boxes before inspecting details. Misaligned outer edges make correct child styling still appear wrong.

---

### Final validation rule

The implementation should not be approved from one static screenshot. Compare these states independently:

**Default card → Hover card → Selected/replying card → One reply → Multiple replies → Long content → Long username → Sidebar overflow.**
