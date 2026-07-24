# Exports the Expo app as a static web build and copies it into
# resources/frontend/ for the Electron shell to serve locally.

$ErrorActionPreference = "Stop"

$desktopRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$frontendRoot = Resolve-Path (Join-Path $desktopRoot "..\frontend")
$destDir = Join-Path $desktopRoot "resources\frontend"

$localEnvPath = Join-Path $frontendRoot ".env.local"
$hadLocalEnv = Test-Path $localEnvPath

Push-Location $frontendRoot
try {
    npm install
    # Force the local backend URL regardless of app/frontend/.env (which may
    # point at a LAN IP left over from on-device testing) -- the desktop
    # build must always talk to the backend Electron spawns on 127.0.0.1.
    # .env.local has the highest precedence in Expo's env loading, so this
    # wins over .env without editing your real dev config. A plain shell env
    # var does NOT reliably win here -- Expo's own .env loader overrides it.
    if ($hadLocalEnv) {
        Copy-Item $localEnvPath "$localEnvPath.bak" -Force
    }
    "EXPO_PUBLIC_API_URL=http://127.0.0.1:8000/api" | Set-Content -Path $localEnvPath -Encoding ascii
    # --clear busts Metro's transform cache, which otherwise can keep serving
    # a bundle built under a previous EXPO_PUBLIC_API_URL value.
    npx expo export --platform web --clear
} finally {
    if ($hadLocalEnv) {
        Move-Item "$localEnvPath.bak" $localEnvPath -Force
    } else {
        Remove-Item $localEnvPath -ErrorAction SilentlyContinue
    }
    Pop-Location
}

Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $destDir
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
Copy-Item (Join-Path $frontendRoot "dist\*") $destDir -Recurse -Force

Write-Host "Frontend export ready at $destDir"
