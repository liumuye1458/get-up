# WinUI Drawer Header And Save State Freeze V1

## Scope

This round freezes only the drawer header and save-state behavior.
It does not change the existing field order inside the drawer body.

## Header Structure

- Header title is fixed to `Edit cue`
- Subtitle shows the currently edited cue
- `Save` stays at the top-right action position
- `Close` stays to the right of `Save`
- Header height is fixed to `76 px`
- Header remains fixed and never scrolls with the body

## Save State Expression

- No edits: `No changes`
- Valid unsaved edits: `Unsaved changes`
- Invalid unsaved edits: `Cannot save`
- Just saved: `Saved`

The state is shown as a header badge and is not hidden while the drawer is open.

## Save Button Rules

- `Save` is enabled only when unsaved changes exist and every validation rule is passing
- `Save` is disabled when there are no edits
- `Save` is disabled when any blocking rule is active:
  - invalid name
  - hotkey conflict
  - invalid trim range
- After successful save, `Save` returns to a disabled `Saved` state until new edits happen

## Close Behavior

- No edits: close immediately
- Unsaved edits: show discard confirmation
- Choosing discard closes the drawer and rolls back pending edits
- Choosing continue editing keeps the drawer open with the current preview state

## Preview Versus Formal Save Boundary

- Drawer fields may preview immediately
- Cue cards may also preview immediately for selected fields such as name, color, and hotkey
- Immediate preview does not count as formal commit
- Only `Save` turns the current preview into committed drawer state for the grid
- Closing with discard restores the last saved state

This keeps the user informed about whether they are seeing a preview or a committed change.
