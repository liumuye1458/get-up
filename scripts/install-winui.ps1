param(
    [string]$SourceDir = (Split-Path -Parent $MyInvocation.MyCommand.Path),
    [string]$InstallDir = "$env:LOCALAPPDATA\Programs\Code X Soundboard Shell",
    [switch]$CreateDesktopShortcut,
    [switch]$CreateStartMenuShortcut = $true
)

$ErrorActionPreference = "Stop"

$exeName = "CodeXSoundboard.Shell.WinUI.exe"
$targetExe = Join-Path $InstallDir $exeName

Get-Process "CodeXSoundboard.Shell.WinUI" -ErrorAction SilentlyContinue | Stop-Process -Force

New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
Copy-Item (Join-Path $SourceDir "*") $InstallDir -Recurse -Force

$wsh = New-Object -ComObject WScript.Shell

if ($CreateDesktopShortcut) {
    $desktopShortcut = $wsh.CreateShortcut((Join-Path ([Environment]::GetFolderPath("Desktop")) "Code X Soundboard Shell.lnk"))
    $desktopShortcut.TargetPath = $targetExe
    $desktopShortcut.WorkingDirectory = $InstallDir
    $desktopShortcut.Save()
}

if ($CreateStartMenuShortcut) {
    $startMenuDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Code X Soundboard Shell"
    New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null
    $startMenuShortcut = $wsh.CreateShortcut((Join-Path $startMenuDir "Code X Soundboard Shell.lnk"))
    $startMenuShortcut.TargetPath = $targetExe
    $startMenuShortcut.WorkingDirectory = $InstallDir
    $startMenuShortcut.Save()
}

Write-Host "Installed to $InstallDir"
Write-Host "Launch with: $targetExe"
