# Code X Soundboard RC Delivery

Version: `1.0.0-rc.2`

## Included Packages

After packaging, deliver these files from [release](/C:/Users/Admin/Documents/Playground/local-sfx-board/release):

- `Code X Soundboard-Setup-1.0.0-rc.2-x64.exe`
- `Code X Soundboard-Portable-1.0.0-rc.2-x64.exe`

## RC Fixes In This Build

- Fixed a release-blocking preload failure that caused the packaged window to show only the background with no UI content.
- Kept the RC boundary unchanged: no new features, only packaging/runtime bug fixes.

## Intended Test Method

This RC should be tested in packaged form, not in dev mode.

Recommended order:

1. Test the portable build first.
2. Test the installer build second.
3. Run the live workflow checklist in [release-live-qa.md](/C:/Users/Admin/Documents/Playground/local-sfx-board/docs/release-live-qa.md).

## Portable Build Notes

- The portable executable stores its managed data in `data` next to the EXE.
- On first launch, the app should create:
  - `data/soundboard.db`
  - `data/library`
  - `data/waveforms`
  - `data/trash`

## Installer Build Notes

- The installer build stores managed data in the Electron user data directory.
- It should not depend on files placed next to the installed EXE.

## What To Verify Manually

- Import real stream sound effects
- Rename and tag cues
- Record and trigger global hotkeys
- Switch to OBS / TikTok Live Studio / chat and trigger cues while unfocused
- Change output device and confirm playback route
- Restart and verify persistence
- Export backup and restore from backup
- Delete and undo cues safely

## Reporting Format

When reporting RC issues, send each issue in this format:

1. Build used:
   - portable / installer
2. Step being tested:
3. Expected:
4. Actual:
5. Can reproduce:
   - always / sometimes / once
6. Blocking level:
   - blocker / major / minor

## Current RC Position

This RC is feature-frozen.

Allowed changes after handoff:

- release-blocking bug fixes
- packaging fixes
- persistence / restore fixes

Not allowed in RC:

- new features
- UI redesign
- architecture expansion
