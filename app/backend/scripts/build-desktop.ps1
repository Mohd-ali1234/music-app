# Builds the backend into a standalone folder (no Python install required to
# run it) via PyInstaller, for bundling into the Electron desktop app.
#
# Usage (from anywhere):  ./app/backend/scripts/build-desktop.ps1
# Output: app/backend/dist/music-backend/  (copied by the desktop build into
#          app/desktop/resources/backend/)

$ErrorActionPreference = "Stop"

$backendRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $backendRoot

pip install -r requirements.txt
pip install pyinstaller

Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "build", "dist"

pyinstaller packaging/desktop.spec

Write-Host "Backend build complete: $backendRoot\dist\music-backend"
