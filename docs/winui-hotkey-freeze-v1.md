# WinUI Hotkey Freeze V1

## Scope

This round freezes only the hotkey section inside the right editor drawer.
It does not change drawer structure, playback controls, or basic info fields.

## Recording Entry

- Recording starts only from the explicit `Record hotkey` button
- Entering recording mode changes the button label to `Cancel recording`
- The hotkey field changes to `Listening for shortcut...`
- A status line inside the hotkey section shows `Recording` guidance

### Exit Recording

- Capture of one valid shortcut exits recording mode
- Pressing `Esc` exits recording mode without changing the assigned shortcut
- Clicking `Cancel recording` exits recording mode without changing the assigned shortcut

## Combination Rules

- Supported modifiers: `Ctrl`, `Alt`, `Shift`
- At least one modifier is required
- Single-key shortcuts are not allowed
- Allowed primary keys:
  - `A-Z`
  - `0-9`
  - `F1-F12`
- Modifier-only shortcuts are not allowed

## Display Format

- Display order is fixed: `Ctrl + Alt + Shift + Key`
- Only active modifiers appear, but the order never changes
- Examples:
  - `Ctrl + C`
  - `Ctrl + Shift + 7`
  - `Alt + F4`

## Conflict Rules

- Conflict is checked immediately when a shortcut is captured
- The conflicting shortcut may remain visible in the drawer as a pending edit
- Conflict shows an inline message naming the other cue
- Conflict disables `Save`

This means conflict is visible during recording, not deferred to save time.

## Clear And Empty State

- The hotkey section keeps a dedicated `Clear` action
- Clearing sets the drawer display to `Not assigned`
- Clearing is treated as a pending edit
- Global registration is not rebuilt until `Save`

## Save And Activation Rule

- Captured or cleared hotkeys update the drawer display immediately
- Captured or cleared hotkeys update the cue card display immediately while the drawer is open
- Closing the drawer without `Save` discards the pending hotkey edit
- `Save` is the only action that commits the hotkey and rebuilds global registration

## Playback Boundary

- Hotkey edits do not affect the currently playing cue
- Hotkey edits only affect future trigger attempts after `Save`
- The drawer hotkey display and cue card hotkey display must remain consistent during editing
