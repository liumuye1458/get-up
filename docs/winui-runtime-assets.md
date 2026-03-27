# WinUI Runtime Assets

## Bundled .NET SDK Installer

- File: `vendor/dotnet/dotnet-sdk-8.0.419-win-x64.exe`
- Source: `https://builds.dotnet.microsoft.com/dotnet/Sdk/8.0.419/dotnet-sdk-8.0.419-win-x64.exe`
- SHA256: `EAD1FC7D7FE2C02201282715AE1923861796B7E02B08FD8FC47801A280405341`

This installer is kept locally so future Windows packaging work can bundle or reference the exact SDK version used to build the WinUI shell.

## Bundled Node Runtime

- File: `vendor/node/node.exe`
- Source: `C:\Program Files\nodejs\node.exe`
- SHA256: `E3BE0545990C90995D7BF3A7AF5D64AF1F2E0FC1BBD9B79C27F7ABC1E9676E50`

This local Node runtime is copied into WinUI publish outputs under `tools/node/node.exe` so the bridge worker no longer depends on a machine-global Node installation.

## Current WinUI Shell Verification Baseline

The current local verification baseline is:

- `dotnet build shell-winui/CodeXSoundboard.Shell.WinUI.csproj`
- launch `shell-winui/bin/Debug/net8.0-windows10.0.19041.0/win-x64/CodeXSoundboard.Shell.WinUI.exe`

Observed runtime signals:

- main WinUI shell process starts successfully
- `msedgewebview2` child process starts successfully
- `dist/index.html` is copied into the WinUI output folder
- `C:\Users\Admin\AppData\Local\Code X Soundboard\WinUIShell` is initialized
- `soundboard.db`, `library`, `waveforms`, and `trash` are created

This confirms the WinUI shell, WebView2 host, and minimum bridge-backed workspace startup path are wired together on the current machine.
