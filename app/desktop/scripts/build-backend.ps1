# Builds the backend into a standalone PyInstaller folder and copies it into
# resources/backend/ for the Electron shell to spawn.

$ErrorActionPreference = "Stop"

$desktopRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$backendRoot = Resolve-Path (Join-Path $desktopRoot "..\backend")
$destDir = Join-Path $desktopRoot "resources\backend"

& (Join-Path $backendRoot "scripts\build-desktop.ps1")

Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $destDir
New-Item -ItemType Directory -Force -Path (Split-Path $destDir) | Out-Null
Copy-Item (Join-Path $backendRoot "dist\music-backend") $destDir -Recurse -Force

Write-Host "Backend build ready at $destDir"
