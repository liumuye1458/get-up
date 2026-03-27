# WinUI Danger Zone Freeze V1

## Scope

This round freezes only the bottom danger zone inside the editor drawer.
It does not change the upper edit sections.

## Position And Scroll Rule

- The danger zone always remains the last section in the drawer body
- It is visually separated from normal editing by stronger color contrast and a divider
- It follows the drawer body scroll and is not pinned to the viewport bottom

This keeps one scroll surface for the whole drawer and avoids splitting the edit path.

## Duplicate Clip

- `Duplicate as new cue` is the first action inside the danger zone
- It is presented as a lower-risk action inside the same section, above delete
- It does not use a dedicated confirmation layer when there are no unsaved edits
- If unsaved edits exist, the same discard confirmation used by close/switch applies first

### Duplicate Result

- A new cue is created from the last committed state of the source cue
- The duplicate clears hotkey assignment by default
- The duplicate copies title, tags, and color, then appends a copy suffix to the title
- After execution, the new cue becomes the selected card and the drawer rebinds to it
- The action enters history immediately

## Delete Cue

- `Delete cue` remains the last action in the danger zone
- It stays visually stronger than duplicate and visually farther from `Save` and normal edit controls
- It must never appear in the header or above duplicate

## Confirmation Rule

### Duplicate

- No dedicated duplicate confirmation
- Unsaved edits trigger the standard discard confirmation before duplication proceeds

### Delete

- Delete always requires confirmation
- Dialog title: `Delete cue?`
- Dialog body explains that the cue will be removed and cannot stay in the current drawer session
- Button order: destructive action first, cancel second
- Default focus stays on cancel

## Post-Action Feedback

### Duplicate

- Card grid refreshes immediately
- Drawer stays open but rebinds to the new duplicate
- The duplicate receives the editing marker
- History records the duplication action

### Delete

- Card grid refreshes immediately with the deleted cue removed
- Drawer closes immediately after successful delete
- History records the delete action

## Playback Boundary

- Duplicating a currently playing cue is allowed
- The duplicate is created as an idle cue and does not affect the current playback session
- Deleting the currently playing cue is allowed only after delete confirmation
- Successful delete of the currently playing cue stops playback immediately and clears playback state before grid refresh

This keeps dangerous actions explicit and prevents them from competing with the main edit path.
