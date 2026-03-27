# V1 Live Release QA

## Freeze Rules

- No new features.
- No structural refactors.
- Only release-blocking bug fixes are allowed.

## Goal

This checklist validates whether the packaged Windows app is usable by a live-stream MC in a real TikTok / OBS workflow.

This is not a dev-quality checklist. It is a release gate.

## Release Artifacts

- Portable build:
  - `release/Code X Soundboard-Portable-0.0.0-x64.exe`
- Installer build:
  - `release/Code X Soundboard-Setup-0.0.0-x64.exe`

## Pass / Fail Standard

### Must Pass

- App launches from packaged build.
- Managed library can import and replay real local audio files.
- Global hotkeys work while the app is unfocused.
- Playback can be triggered while switching between live tools.
- Output device selection behaves correctly on the target machine.
- Settings, cue edits, tags, hotkeys, and trim data persist after restart.
- Backup export and restore work on packaged build.
- No destructive action causes silent data loss.

### Release Blocker

- App cannot launch from packaged build.
- Global hotkeys fail in common live workflow windows.
- Imported cues fail to play reliably.
- Output routing is wrong or unstable.
- Restart loses library data or user settings.
- Restore corrupts or partially replaces the managed library.
- Deleting or undoing cues loses resources unexpectedly.

## Live MC Scenario Tests

### 1. Cold Launch

Steps:

1. Launch the portable build.
2. Close it fully.
3. Launch the installer build.

Expected:

- Both builds open without crash.
- Main board renders completely.
- No blank view, broken modal, or startup error blocks use.

### 2. First Import for a Real Session

Steps:

1. Drag a folder containing real stream sound effects into the app.
2. Include at least:
   - short stingers
   - longer voice clips
   - multiple formats
3. Wait for import to finish.

Expected:

- Scan and import progress are visible.
- Imported cues appear on the board in usable order.
- Duplicate source files do not create duplicate resources.
- Import report is readable and failures are actionable.

### 3. Cue Editing Before Going Live

Steps:

1. Rename several cues.
2. Add tags and tag colors.
3. Set hotkeys on multiple cues.
4. Adjust speed.
5. Trim one longer clip with waveform drag plus time input.

Expected:

- All edits apply immediately.
- Hotkey recorder behaves predictably.
- Trim preview matches the intended segment.
- Search and tag filtering still find the edited cues.

### 4. Foreground Triggering

Steps:

1. Keep the soundboard in focus.
2. Trigger several cues from the board.
3. Trigger several cues from configured hotkeys.

Expected:

- Playback starts immediately.
- Default interruption behavior is consistent.
- Output level and speed reflect cue settings.

### 5. Unfocused Global-Hotkey Use

Steps:

1. Focus another app such as OBS, TikTok Live Studio, browser chat, or a text editor.
2. Trigger multiple configured hotkeys without returning focus to the soundboard.

Expected:

- Global hotkeys still fire.
- The correct cue is played.
- Focus stays in the foreground app.
- No obvious registration drop happens after repeated use.

### 6. Live Switching Stress

Steps:

1. Rapidly switch between:
   - soundboard
   - OBS / live tool
   - chat window
2. Trigger cues during the switches.
3. Repeat with longer clips and trimmed clips.

Expected:

- No stuck playback.
- No UI freeze.
- No missed hotkey trigger pattern under normal use.

### 7. Output Device Reality Check

Steps:

1. Select the default output device.
2. Play a cue.
3. Change to another available device.
4. Play again.

Expected:

- Device switch takes effect on the next playback.
- If the selected device is unavailable, fallback behavior is visible and understandable.
- Diagnostics show output failures instead of failing silently.

### 8. Persistence After a Session

Steps:

1. Build a realistic library state:
   - imported cues
   - renamed cards
   - tags
   - hotkeys
   - trim
   - speed
2. Close the packaged app.
3. Reopen it.

Expected:

- Board state is preserved exactly.
- Global settings are preserved.
- Missing-file scan and hotkey diagnostics recalculate correctly.

### 9. Delete / Undo Under Pressure

Steps:

1. Delete one cue that is the only reference to its resource.
2. Undo it.
3. Delete one cue that shares a resource with another cue.
4. Undo it.

Expected:

- Unshared resource cleanup is safe and undoable.
- Shared resources are not accidentally removed.
- Undo restores the exact cue state.

### 10. Backup Before Stream

Steps:

1. Export a backup from packaged build.
2. Make visible library changes.
3. Import the backup.
4. Repeat once with password protection enabled.

Expected:

- Backup package is produced successfully.
- Restore preview is readable.
- Restore replaces the current library correctly.
- Protected backup requires the right password.

## Environment-Limited Items

The following checks require a human on the target Windows streaming setup and cannot be fully proven by local build/lint/test alone:

- Actual hotkey behavior while OBS / TikTok Live Studio / browser chat are foregrounded.
- Real audio routing correctness across the user's physical or virtual output devices.
- Subjective responsiveness during live switching.
- Operator usability under real stream pace.

## Current Status Snapshot

- Packaged portable build can be launched successfully in the current environment.
- Dev regression suite is green, but this does not replace live release QA.
- README and user-facing release instructions still need cleanup before public delivery.

## Decision Rule

Do not reopen feature work until this checklist has been run once on the packaged app and all release blockers are either fixed or explicitly deferred outside V1.
