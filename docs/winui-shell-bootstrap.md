# WinUI Shell Bootstrap

The native desktop shell lives in:
- `/C:/Users/Admin/Documents/Playground/local-sfx-board/shell-winui`

## Product Assumption

This shell is the application.
It is not a host for an embedded web app.

## Native Layout Ownership

- Top title/search/status strip: native XAML
- Left navigation rail: native XAML
- Board workspace: native XAML
- Cue editor drawer: native XAML
- Bottom transport/output controls: native XAML
- Floating control window: native XAML

## Runtime Requirements

1. Visual Studio 2022
2. `.NET desktop development` workload
3. `Windows App SDK C# Templates`
4. .NET 8 SDK

## Project Entry Points

- Project file: `/C:/Users/Admin/Documents/Playground/local-sfx-board/shell-winui/CodeXSoundboard.Shell.WinUI.csproj`
- Main window: `/C:/Users/Admin/Documents/Playground/local-sfx-board/shell-winui/MainWindow.xaml`
- Main window logic: `/C:/Users/Admin/Documents/Playground/local-sfx-board/shell-winui/MainWindow.xaml.cs`

## Next Steps

1. Keep all fixed shell regions native.
2. Complete remaining module pages in native XAML/C#.
3. Route import, playback, persistence, and hotkeys through native desktop services only.
