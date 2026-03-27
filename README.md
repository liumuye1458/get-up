# Code X Soundboard

Windows native desktop soundboard for TikTok live / MC workflows.

Current delivery status: `1.0.0-rc.4`

Primary product direction: native WinUI desktop app with fixed shell layout.
Web-embedded delivery is no longer the default path.

WARNING: Electron is legacy reference only and must not be used for current product development.
Current execution phase: stability lockdown.
- No new features.
- No layout or page-structure changes.
- Only fix confirmed issues on the main path: click -> playback -> edit -> undo.

⚠️ Electron 为历史参考路径，不允许用于当前产品开发

## What It Does

- Import audio files or folders by drag and drop
- Copy imported audio into a managed local library
- Deduplicate files by content hash
- Create multiple cue cards from one audio resource
- Rename cues, assign tags, set colors, and record hotkeys
- Edit playback speed, volume, and trim range
- Use waveform drag + numeric trim input
- Trigger cues with global shortcuts while the app is unfocused
- Select an output device
- Save settings, cue data, history, and backup state
- Export and restore single-file backups

## Native Desktop Principles

- The main product is a standalone WinUI desktop application.
- Top bar, left navigation, workspace, inspector, and bottom transport stay in a fixed native layout.
- Audio import, playback, storage, hotkeys, and editing run through native desktop code paths.
- WebView2 / embedded web workspace is legacy transition material, not the shipping architecture.
- 🚫 DO NOT introduce WebView2 / React / Electron into runtime again.
- All UI must be native WinUI.

## Build Outputs

After running `npm run dist:win`, the native release artifacts are written to [release-winui](/C:/Users/Admin/Documents/Playground/local-sfx-board/release-winui):

- `Code X Soundboard-<version>-win-x64/`
- `Code X Soundboard-<version>-win-x64.zip`

Legacy Electron commands are blocked and retained only as archival markers:

- `npm run dev:legacy-electron`
- `npm run dist:legacy-electron`

## Storage Behavior

- Native installed build:
  - Uses `%LOCALAPPDATA%\\Code X Soundboard\\NativeShell`

Managed data includes:

- `soundboard.db`
- `library`
- `waveforms`
- `trash`

## Local Development

```powershell
npm install
npm run dev
```

Useful commands:

```powershell
npm run build
npm run lint
npm run test:regression
npm run dist:win
npm run dist:legacy-electron
```

Native desktop entry points:

- `npm run dev` starts the WinUI shell
- `npm run build` builds the WinUI shell
- `npm run dist:win` publishes the WinUI desktop bundle

## RC Scope

This RC is focused on:

- native desktop shell
- managed import and playback
- cue editing
- global hotkeys
- persistence
- backup / restore
- packaged Windows delivery

## Current Phase Rule

- This is a stability closing phase, not a feature expansion phase.
- Fixes are allowed only when they remove known friction or breakage.
- The highest-priority path is continuous use of click -> playback -> edit -> undo.
- See [stability-phase-rule.md](/C:/Users/Admin/Documents/Playground/local-sfx-board/docs/stability-phase-rule.md)

Out of scope for this RC:

- loop playback
- hold-to-play
- list view
- pinyin search
- online sound library

## Test Guidance

- Developer regression checklist: [qa-regression.md](/C:/Users/Admin/Documents/Playground/local-sfx-board/docs/qa-regression.md)
- Packaged live workflow checklist: [release-live-qa.md](/C:/Users/Admin/Documents/Playground/local-sfx-board/docs/release-live-qa.md)

## RC Handoff

See the delivery note: [delivery-rc4.md](/C:/Users/Admin/Documents/Playground/local-sfx-board/docs/delivery-rc4.md)
and native distribution notes: [winui-distribution.md](/C:/Users/Admin/Documents/Playground/local-sfx-board/docs/winui-distribution.md)
and the locked architecture rule: [architecture-rule.md](/C:/Users/Admin/Documents/Playground/local-sfx-board/docs/architecture-rule.md)
and the current phase rule: [stability-phase-rule.md](/C:/Users/Admin/Documents/Playground/local-sfx-board/docs/stability-phase-rule.md)
