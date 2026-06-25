# Step 1:Design Overview:

First I see figma design, okay if we consider same figma file. Below things I notice
- First which features are there, okay i can see comment sidebar, then there is pin dialog as well.
- In pin dialog, first there is no header, then we have thread card in thread card we have avatar, name, time, message and toggle reply. 
- In sidebar if i see, there is Header, a simple title and then filter button, then we have composer. So this represents a page mode composer, and then we have list.
- Here in list i noticed, there is one dialog with multiple replies, in this case ui is like, first commet then "13 more replies" and last reply. As i can see
this is still in collapsed state so user wants this UI as in default state. 
- In next frame i can see, we have empty placeholder state
- In next i can see it has page mode composer focused state with black border and cursor is in there
- Then in next frame user typed @ to autocomplete user mention panel dropdown opened. It has list of users and item is pretty simple just avatar and name.
Also as user started typing composer expanded earlier submit button was beside input in disabled state, but in expanded mode there is nothing beside input and in next row we have cancel button and enabled submit button. Here one thing i noticed there is something "cancel" button which we don't have in sdk as default. So we will need to figure out how we can achieve this. BUt for now I'll ignore this and pick this at last.
- Then in next frame i can see user has typed, And message went to next line so composer expanded further. So basically for long messages composer will expand still certain max-height and then we can add scroll. Also mentioned user has greenish blue color.
- In next frame, user submitted the comment and its visible in list
- In next frame, we can see hovered state for dialog, it has a bg color on hover and also on hover resolve button and three dot menu is visible. Means this buttons will be hidden normally and only visible on hover. Here i remembered one case where we have active class, means if lets see user clicks on three dot menu, it opens dropdown. And when we hover over dropdown, the buttons are still visible. Because we handle this case such that it either hovers or any of the button is under action.
- Then next frame has dialog selected state, here we can still see bg color, and in selected state composer is visible in active state, again in collapsed state by default once user starts typing it be expanded. 
- Next three frames are same just showcasing how dialog looks with different number of replies
- Next frame has filter dropdown, ohh this is ineresting here its not typical main filter. This dropdown just has 4 options, sort by date, sort by unread, filter resolved, filter by mentions. I think we can use minimal filter dropdown for this. Minimal filter has 3 of the options, but for 4th option which is mention, its not in minimal filter as well. So need to figure this out how we can achieve this. For now I'll ignore this and pick this at last.
- Next frame has options dropdown, it has 3 items, edit, delete and copy, All can be done for edit and delete we already have suitable options in dropdown. And for copy link, we have independent button so we can just add it in content.
- Next frame has toast in below which is shown when comment is resolved. We don't have any toast by default in sdk, but we might have some event like on resolved. We can use that and add custom toast
- Then we have link copied tooltip. For this as well we don't have any tooltip by default in sdk, but we might have some event like on copy link. We can use that and add custom tooltip.
- Next frame we have item selected state for minimal filter. Its simple tick
- Next frame we have ui for resolved dialog. it is grayed out and we have unresolve button.
- then below we have small 4 frames with different user mention dropdown suggestions. But we can ignore this because final one is already in main design.

So after carefully understanding the design, below are the things i noticed which are not supported by default in sdk. But apart from this we have everything else in default.
- We need to add cancel button in composer.
- We need to add minimal filter dropdown for filter dropdown.
- We need to add copy link button in options dropdown.
- We need to add toast for resolved comment.
- We need to add tooltip for link copied.
- We need to add mentions filter in minimal filter dropdown.


Step 2: Implementation:
1. Instead of picking everything at once, I'll pick one by one and see how we can achieve it.
2. Either we can start with dialog or sidebar
3. Usually I prefer to start with dialog first. 
4. So start with dialog wireframe, first all add body and composer slot.
5. Because we don't need header. Then I'll start with body. In body I'll add threads and toggle reply.
6. Then in threads I'll add thread card
7. Then in thread card I'll add avatar, name, time, resolve button, unresolve button, options, message, and more replies wireframe. Then will add topions dropdown trigger, content wireframe. In content will add edit, and delete option. In between will add copy link button.
8. Then in composer I'll add avatar, input, cancel button, submit button.
9. Okay so now we have all required elements for dialog.
10. Next step is to add styles for dialog.
11. Add custom styles to match figma pixel to pixel. I can see there is some default velt styling getting applied in dialog which is not matching the design. So I'll inspect, find which styles are not matching, find it classnames, and then override those default styles.
12. I'll do this until we have perfect matching design.
13. Then I'll handle interactive designs, Means dialog hover. Button hover states, resolve, unresolve, options buttons are hidden and visible on hover.
Also I'll see when options dropdown is opened, which is that active class using which we can keep resolve, unresolve, options buttons visible. Even when not hovered when any button is under action.
14. I can see there is some extra space in button, I'll inspect. On Unresolve button is empty but due to gap its taking space. So I'll add display none css on empty.
15. Then I'll handle composer collapsed/expanded state. Test different cases with long messages. 
16. Then I'll match the user dropdown css, I'll check every minute detail in it. Like box shadow, border, radius, padding, margin, colors for panel. Then item gap, etc. Will match pixel to pixel with design.
17. Then I'll test different cases n dialog, means is it behving correctly with different comment count. Are all states matching figma.
18. Then I'll match options dropdown css. 
19. Then will check scrolling cases, means composer scrolling, threads list scrolling. Make sure scroll bar is hidden by setting scrollbar-width to 0px.
20. Play with the dialog a little make sure its perfect. I'll test all the features in dialog, if its working as expected. Means edit, delete, copy link, adding replie, deleting main comment, deleting reply, resolving comment, unresolving comment, draft comment, edited badge. Ohh draft badge and edited badge was not in design, but lets keep it user might not know it and match it with design theme so it goes well with design. Then tagging users, tagging multiple users, basically I'll use the dialog as random user and make sure its 100% perfect functionally and design wise. Until this I'll keep improving it. 
21. Then I'll start with sidebar and follow same steps. Until  its perfect.
22. After this I'll pick the unsopprted things which we noticed.
- We need to add cancel button in composer - here one way is using js, when clicked find the input and clear it. But it might not be perfect and may feel hacky/patchy. So I'll document this approach and first confirm the implementation with user if its accepted.
- We need to add toast for resolved comment - here we will find resolved event and attach custom toast. This is okay and not feel hacky/patchy. Its clean.
- We need to add tooltip for link copied - here also if we have any copied event, we can use that and attach custom tooltip. This is okay and not feel hacky/patchy. Its clean. But make sure it doesn't interfere with hover tooltip which is default in sdk.
- We need to add mentions filter in minimal filter dropdown - Okay this we checked but find out currently there is no way to achieve this. So we will document this and tell it to user, and suggestion alternate option which they can use which is assigned or involved.