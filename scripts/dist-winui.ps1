param(
    [string]$Configuration = "Release",
    [string]$RuntimeIdentifier = "win-x64",
    [switch]$SkipZip
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "Enforcing native architecture guard..."
node .\scripts\enforce-native-architecture.mjs

$packageJson = Get-Content (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
$version = $packageJson.version
$productName = "Code X Soundboard"
$publishDir = Join-Path $repoRoot "shell-winui\bin\$Configuration\net8.0-windows10.0.19041.0\$RuntimeIdentifier\publish"
$releaseRoot = Join-Path $repoRoot "release-winui"
$bundleName = "$productName-$version-$RuntimeIdentifier"
$bundleDir = Join-Path $releaseRoot $bundleName
$zipPath = Join-Path $releaseRoot "$bundleName.zip"

Write-Host "Publishing native WinUI shell..."
dotnet publish shell-winui/CodeXSoundboard.Shell.WinUI.csproj -c $Configuration -r $RuntimeIdentifier --self-contained false

if (Test-Path $bundleDir) {
    Remove-Item $bundleDir -Recurse -Force
}

New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
Copy-Item $publishDir $bundleDir -Recurse -Force

$installerScript = Join-Path $repoRoot "scripts\install-winui.ps1"
if (Test-Path $installerScript) {
    Copy-Item $installerScript (Join-Path $bundleDir "install-winui.ps1") -Force
}

if (-not $SkipZip) {
    if (Test-Path $zipPath) {
        Remove-Item $zipPath -Force
    }

    Compress-Archive -Path (Join-Path $bundleDir "*") -DestinationPath $zipPath -CompressionLevel Optimal
}

Write-Host "Native desktop distribution bundle ready:"
Write-Host "  Folder: $bundleDir"
if (-not $SkipZip) {
    Write-Host "  Zip:    $zipPath"
}
