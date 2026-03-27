# Native WinUI Distribution

## Build a distributable publish bundle

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dist-winui.ps1
```

This will:

1. publish `shell-winui`
2. assemble a folder bundle under `release-winui/`
3. create a `.zip` archive for distribution

Default output:

- `release-winui/Code X Soundboard-<version>-win-x64/`
- `release-winui/Code X Soundboard-<version>-win-x64.zip`

## Install a bundled build

From inside the extracted bundle:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-winui.ps1 -CreateDesktopShortcut
```

Default install location:

- `%LOCALAPPDATA%\Programs\Code X Soundboard`

The installer script copies the publish output and can create Start Menu / Desktop shortcuts.

## Notes

- This distribution path assumes a standalone native WinUI desktop app.
- It does not depend on WebView2-hosted workspace content.
- The repository also stores `vendor/dotnet/dotnet-sdk-8.0.419-win-x64.exe` for future installer pipeline integration on build machines.
- End users do **not** need the full SDK to run the WinUI publish build. The SDK asset is retained for packaging/build automation.
