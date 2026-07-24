# End-to-end build: builds the backend, exports the frontend, writes the
# MongoDB Atlas connection info the packaged app will use, generates the app
# icon, then produces the Windows installer.
#
# Run from anywhere:  ./app/desktop/scripts/build-all.ps1
# Output: app/desktop/dist/*.exe  (NSIS installer)

$ErrorActionPreference = "Stop"

$desktopRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Host "== 1/5: Backend =="
& (Join-Path $PSScriptRoot "build-backend.ps1")

Write-Host "== 2/5: Frontend =="
& (Join-Path $PSScriptRoot "build-frontend.ps1")

Write-Host "== 3/5: MongoDB Atlas connection info =="
& (Join-Path $PSScriptRoot "prepare-backend-env.ps1")

Push-Location $desktopRoot
try {
    Write-Host "== 4/5: Electron dependencies + icon =="
    npm install
    node scripts/make-icon.js

    Write-Host "== 5/5: Packaging installer =="
    npm run dist
} finally {
    Pop-Location
}

Write-Host "Done. Installer output under $desktopRoot\dist"
