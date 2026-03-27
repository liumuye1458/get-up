# WinUI Card And Drawer Link Freeze V1

## Scope

This round freezes only the state linkage between the cue card grid and the right editor drawer.
It does not change drawer field structure or card sizing.

## Opening And Switching

- Right-click binds the drawer to exactly one cue card
- The bound cue is also marked in the grid as the current editing target
- Switching to a different cue is allowed only when there are no unsaved edits
- If unsaved edits exist, switching requires the same discard confirmation used by drawer close
- Choosing discard rolls back the current draft and then binds the drawer to the new cue
- Choosing continue editing keeps the current cue bound

## Grid Preview Mapping Before Save

- Name preview may update the cue card title immediately
- Color preview may update the cue card accent immediately
- Hotkey preview may update the cue card hotkey immediately
- Tags do not render directly on the cue card in V1
- Playback parameter and trim edits do not create separate visible card content, but they still mark the edited card as having an unsaved draft

Immediate preview is for orientation only and does not count as formal commit.

## Playing Cue Priority

- Playing state has first priority in the card status badge
- Editing and unsaved-draft state use the card border and card emphasis as secondary state
- If the playing cue is also the active edited cue, the badge remains `Playing`
- If the edited cue has unsaved changes and is not currently playing, the badge shows `Draft`
- If the edited cue has no unsaved changes and is not currently playing, the badge shows `Editing`

## Save / Discard Pushback

- `Save` pushes the current drawer draft into the grid state immediately
- `Close` with discard removes all pending drawer preview from the grid immediately
- Closing the drawer after save removes the `Editing` marker from the grid
- The grid does not keep an `Editing` trace after the drawer is closed

## History Boundary

- In the normal edit flow, successful `Save` creates the committed edit history entry
- Discard does not enter history
- If a future undo action is applied, both the grid and an open drawer must refresh from the same restored cue state

This keeps the main path stable: card -> drawer -> edit -> save or discard -> grid.
