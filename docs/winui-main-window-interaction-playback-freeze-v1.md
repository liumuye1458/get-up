# WinUI Main Window Interaction Playback Freeze V1

## Scope

This round freezes the full interaction playback for the main window.
It links the previously frozen grid, drawer, save-state, danger-zone, and history rules into one regression baseline.

## 1. Main Path Playback

### Open App

1. App opens into the fixed three-column shell.
2. Cue grid shows imported cards plus placeholder cards when no search is active.
3. Initial card state is `Ready` unless playback is already active in the current session.

### Search And Tag Filter

1. User types in the top search box.
2. Grid filters by title, hotkey, and tags.
3. User may additionally click one left tag filter.
4. Search and tag filter combine.
5. Clearing the tag filter returns to `All cue cards` while keeping search text.
6. Clearing search restores the unfiltered imported grid and placeholder cards.

### Left Click Play

1. User left-clicks an interactive card.
2. That cue becomes the current playback target.
3. Card badge becomes `Playing`.
4. Card visual emphasis updates immediately.

### Bottom Playback Controls

1. `Play / Pause` toggles session playback state.
2. `Volume` updates the master playback level.
3. `Repeat playback` toggles repeat behavior.
4. Status text updates after every playback control action.

### Main Path End State

- Selected playing cue ends in `Playing`
- Non-playing cues remain `Ready`
- Search and tag filter state persist until explicitly changed

## 2. Secondary Path Playback

### Open Drawer

1. User right-clicks one interactive card.
2. Drawer binds to exactly that cue.
3. Grid marks that cue as the current editing target.
4. If no unsaved edits exist, the drawer opens immediately.
5. If unsaved edits exist on another cue, discard confirmation appears first.

### Edit In Drawer

1. User edits basic info, hotkey, playback parameters, or trim.
2. Drawer header state moves to `Unsaved changes` when the first valid draft change appears.
3. Name, color, and hotkey may preview immediately on the grid card.
4. Tags preview inside the drawer and affect filtering/search data, but do not render directly on the card.
5. Playback parameters and trim do not add new card content, but the edited card becomes `Draft` if it has unsaved changes.

### Save / Close / Discard

1. `Save` is enabled only when unsaved changes exist and all blocking validation passes.
2. `Close` with no unsaved changes closes immediately.
3. `Close` with unsaved changes opens discard confirmation.
4. `Discard` rolls the grid and drawer back to the last committed state.

### Secondary Path End State

- Drawer open with no unsaved edits: edited card is `Editing`
- Drawer open with unsaved edits: edited card is `Draft`
- Save with drawer still open: header state becomes `Saved`, card returns to `Editing`
- Close after save: card returns to `Ready` or `Playing`
- Close with discard: card returns to last committed `Ready` or `Playing`

## 3. Danger Path Playback

### Duplicate As New Cue

1. User presses `Duplicate as new cue`.
2. If the current drawer has unsaved changes, discard confirmation appears first.
3. Duplicate is created from the last committed state of the source cue.
4. Duplicate clears hotkey assignment.
5. Duplicate copies title, tags, and color, and adds a copy suffix to the title.
6. Grid refreshes immediately.
7. New cue becomes the selected editing target and the drawer rebinds to it.
8. Duplicate enters history immediately.

### Delete Cue

1. User presses `Delete cue`.
2. Delete confirmation always appears.
3. If confirmed, the cue is removed from the grid immediately.
4. Drawer closes immediately after successful delete.
5. Delete enters history immediately.

### Delete While Playing

1. User confirms delete on the currently playing cue.
2. Playback stops immediately.
3. Active playback state clears before the grid refresh.
4. Deleted cue disappears from the grid.
5. Drawer closes.

### Danger Path End State

- Duplicate result: new cue ends in `Editing`
- Delete result: deleted cue is removed, remaining cues return to `Ready` or `Playing`
- Delete on active playback clears `Playing`

## 4. History Path Playback

### History Entry Rules

- Normal field edits enter history only after successful `Save`
- `Duplicate` enters history immediately after execution
- `Delete` enters history immediately after execution
- `Discard` never enters history

### Undo Refresh Rule

1. Future undo restores one committed historical state.
2. Grid refreshes from the restored cue state.
3. If a drawer is open for the affected cue, the drawer must refresh to the same restored state.
4. Playback state must also refresh if the restored state changes the current active cue availability.

### History Path End State

- After save-based history commit: cue remains `Editing` if drawer stays open, otherwise `Ready`
- After duplicate/delete history commit: grid reflects the committed action immediately
- After future undo: grid, drawer, and playback state all align to one restored source of truth

## 5. Edge Path Playback

### Open Drawer During Search

1. User searches and filters the grid.
2. User right-clicks a visible filtered card.
3. Drawer opens for that card.
4. Search/filter remain active in the background.
5. Save or discard updates only the currently visible filtered result set plus the underlying full grid state.

### Delete Current Card During Tag Filter

1. User applies a tag filter.
2. User opens one matching cue.
3. User confirms delete.
4. Grid refreshes under the same tag filter.
5. If that deletion removes the last matching card, filtered empty state appears.

### Edit And Save While Playing

1. User opens the currently playing cue.
2. User edits and saves.
3. Name/color/hotkey commit immediately to grid state.
4. Hotkey registration rebuilds for future triggers.
5. Trim keeps the existing playback instance unchanged and applies on the next trigger.

### Edit Then Close/Discard While Playing

1. User opens the currently playing cue.
2. User changes fields but discards.
3. Current playback continues with the old committed state.
4. Grid preview rolls back immediately.

### Switch Cards With Unsaved Changes

1. User edits cue A and creates unsaved draft state.
2. User right-clicks cue B.
3. Discard confirmation appears.
4. Confirming discard rolls cue A back, then opens cue B.
5. Cancelling keeps cue A bound and leaves cue B unopened.

## 6. End State Matrix

### `Ready`

- Non-playing card
- No open drawer bound to it
- No unsaved draft preview on it

### `Playing`

- Playback badge takes priority over editing badges
- Persists until playback is paused, stopped, or the active playing cue is deleted

### `Draft`

- Drawer is bound to this cue
- Unsaved edits exist
- Card keeps preview emphasis until save or discard

### `Editing`

- Drawer is bound to this cue
- No unsaved changes currently exist
- Appears after opening a card or after saving while the drawer remains open

## Cleanup Rules

- Save clears draft flags and leaves the drawer bound
- Discard clears draft flags and restores the last committed grid state
- Closing the drawer clears the `Editing` marker
- Deleting the current playing cue clears playback state
- Search and tag filter are not cleared by drawer actions

This document is the hand-test and regression baseline for the full main-window interaction chain.
