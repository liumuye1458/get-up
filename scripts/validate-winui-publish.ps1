param(
    [string]$PublishDir = "shell-winui\bin\Release\net8.0-windows10.0.19041.0\win-x64\publish",
    [int]$WaitSeconds = 10,
    [switch]$VerifyHotkeys
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$publishPath = Resolve-Path $PublishDir
$exePath = Join-Path $publishPath "CodeXSoundboard.Shell.WinUI.exe"
$logPath = Join-Path $env:LOCALAPPDATA "Code X Soundboard\WinUIShell\logs\winui-shell.log"
$dataRoot = Join-Path $env:LOCALAPPDATA "Code X Soundboard\NativeShell"
$requiredFiles = @(
    "App.xbf",
    "MainWindow.xbf",
    "FloatingControlWindow.xbf",
    "CodeXSoundboard.Shell.WinUI.pri"
)

foreach ($relative in $requiredFiles) {
    $candidate = Join-Path $publishPath $relative
    if (-not (Test-Path $candidate)) {
        throw "Missing required publish artifact: $relative"
    }
}

Get-Process "CodeXSoundboard.Shell.WinUI" -ErrorAction SilentlyContinue | Stop-Process -Force

if (Test-Path $logPath) {
    Set-Content -Path $logPath -Value ''
} else {
    New-Item -ItemType Directory -Force -Path (Split-Path $logPath -Parent) | Out-Null
    Set-Content -Path $logPath -Value ''
}

$process = Start-Process -FilePath $exePath -PassThru
Start-Sleep -Seconds $WaitSeconds

if ($process.HasExited) {
    throw "WinUI publish process exited early with code $($process.ExitCode)"
}

if ($VerifyHotkeys) {
    $wshell = New-Object -ComObject WScript.Shell
    $null = $wshell.AppActivate($process.Id)
    Start-Sleep -Milliseconds 400
    $wshell.SendKeys('+z')
    Start-Sleep -Seconds 1
}

$expectedDataEntries = @("soundboard.db", "library", "waveforms", "trash")
foreach ($entry in $expectedDataEntries) {
    $candidate = Join-Path $dataRoot $entry
    if (-not (Test-Path $candidate)) {
        throw "Missing WinUI data entry: $entry"
    }
}

$logText = if (Test-Path $logPath) { Get-Content $logPath -Raw } else { "" }

$summary = [pscustomobject]@{
    PublishDir = $publishPath.Path
    ProcessId = $process.Id
    MainWindowTitle = (Get-Process -Id $process.Id).MainWindowTitle
    DataRoot = $dataRoot
    LogLength = $logText.Length
    VerifiedMode = "native-winui"
}

$summary | Format-List

Stop-Process -Id $process.Id -Force
