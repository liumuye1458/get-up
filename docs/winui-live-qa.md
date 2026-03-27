# WinUI Live QA

This checklist is for the WinUI publish build, not the legacy Electron shell.

## Startup

- Launch the publish build from the distribution bundle.
- Confirm the main window appears and stays open.
- Confirm `WebView2` content is visible in the center workspace.
- Confirm the WinUI data root is created under `%LOCALAPPDATA%\Code X Soundboard\WinUIShell`.

## Fixed shell validation

- Top bar stays fixed while the center workspace scrolls.
- Left navigation stays fixed while switching workspace sections.
- Bottom dock stays fixed and remains visible during scrolling.

## Command linkage

- Type in the top search box and confirm the workspace search updates.
- Click each left navigation entry and confirm the center workspace section changes.
- Change the output device from the bottom combo box and confirm the workspace reflects the new selection.
- Click the hotkey toggle and confirm global shortcut state changes.
- Click playback toggle and confirm playback state changes.
- Click stop all and confirm all playback stops.
- Move the volume slider and confirm the workspace/global volume updates.

## Global hotkeys

- Press `Shift+Z` and confirm the global hotkey state toggles.
- Press `Shift+Space` and confirm playback pause/resume toggles.
- Trigger at least one cue hotkey while the app is not focused.

## Import and library

- Drag audio files into the workspace and confirm import progress events update.
- Confirm new cues appear in the library view.
- Confirm the import writes history entries.
- Undo the latest import from the history section.

## Diagnostics and maintenance

- Open diagnostics from the left navigation and confirm real counts load.
- Open resources and confirm managed library statistics load.
- Trigger a cleanup preview/action and confirm it completes without breaking the shell.

## Floating control

- Click `Open Floating` from the bottom dock.
- Confirm the floating window opens.
- Confirm the main window can be re-focused.
