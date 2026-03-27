# Code X Soundboard RC4 Delivery Note

Version: `1.0.0-rc.4`

## What Changed In RC4

- Fixed the Windows packaged startup crash caused by `better-sqlite3` being bundled with the wrong ABI.
- Added explicit runtime-aware native module syncing for `better-sqlite3`.
- Updated the Windows packaging pipeline so it:
  - restores the Node ABI for local tooling
  - runs `build`, `lint`, and `test:regression`
  - switches to the Electron ABI before packaging
  - restores the Node ABI again after packaging

## Packaging Command

Use:

```powershell
npm run dist:win
```

This command now performs the full safe packaging sequence automatically.

## Validation Completed

- `npm run build`
- `npm run lint`
- `npm run test:regression`
- `npm run dist:win`
- `release/win-unpacked/Code X Soundboard.exe` startup verified

## Release Artifacts

- [Code X Soundboard-Setup-1.0.0-rc.4-x64.exe](/C:/Users/Admin/Documents/Playground/local-sfx-board/release/Code%20X%20Soundboard-Setup-1.0.0-rc.4-x64.exe)
- [Code X Soundboard-Portable-1.0.0-rc.4-x64.exe](/C:/Users/Admin/Documents/Playground/local-sfx-board/release/Code%20X%20Soundboard-Portable-1.0.0-rc.4-x64.exe)

## Tester Note

Please install `rc.4` fresh instead of reusing `rc.3`. The previous installer was affected by the native module ABI mismatch.
