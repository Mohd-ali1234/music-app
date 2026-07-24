# Reads MONGODB_URL / MONGODB_DB (or their legacy MONGO_URL / DB_NAME
# spellings, same fallback order app/backend/app/core/config.py uses) out of
# your local app/backend/.env and writes them into resources/backend-env.json,
# which the packaged Electron app forwards to the backend on launch.
#
# This bakes your MongoDB Atlas connection string (credentials included) into
# the built app. That's fine for a personal, single-user install pointed at
# your own cluster -- do not distribute the resulting installer to other
# people, since every copy would share your Atlas cluster and credentials.

$ErrorActionPreference = "Stop"

$desktopRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$backendEnvPath = Resolve-Path (Join-Path $desktopRoot "..\backend\.env")
$destDir = Join-Path $desktopRoot "resources"
$destFile = Join-Path $destDir "backend-env.json"

function Get-EnvValue {
    param([string[]]$Names, [string]$Path)
    $lines = Get-Content $Path
    foreach ($name in $Names) {
        foreach ($line in $lines) {
            if ($line -match "^\s*$name\s*=\s*(.*)\s*$") {
                $value = $Matches[1].Trim()
                $value = $value.Trim('"').Trim("'")
                if ($value) { return $value }
            }
        }
    }
    return $null
}

$mongoUrl = Get-EnvValue -Names @("MONGODB_URL", "MONGO_URL") -Path $backendEnvPath
$mongoDb = Get-EnvValue -Names @("MONGODB_DB", "DB_NAME") -Path $backendEnvPath

if (-not $mongoUrl) {
    throw "MONGODB_URL (or MONGO_URL) not found in $backendEnvPath"
}
if (-not $mongoDb) { $mongoDb = "music_player" }

New-Item -ItemType Directory -Force -Path $destDir | Out-Null
$json = @{ MONGODB_URL = $mongoUrl; MONGODB_DB = $mongoDb } | ConvertTo-Json
# Windows PowerShell 5.1's "-Encoding utf8" always writes a UTF-8 BOM, which
# Node's JSON.parse chokes on. Write via .NET directly to avoid it.
[System.IO.File]::WriteAllText($destFile, $json, (New-Object System.Text.UTF8Encoding $false))

Write-Host "Wrote $destFile (MongoDB Atlas connection info; not printed here on purpose)"
