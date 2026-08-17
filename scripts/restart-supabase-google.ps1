# Restarts local Supabase with Google OAuth vars from repo-root .env (gitignored).
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$envFile = Join-Path $root ".env"
if (-not (Test-Path $envFile)) {
  Write-Error "Missing .env with GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET"
}

Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*GOOGLE_OAUTH_CLIENT_ID=(.*)$') {
    $env:GOOGLE_OAUTH_CLIENT_ID = $matches[1].Trim()
  }
  elseif ($_ -match '^\s*GOOGLE_OAUTH_CLIENT_SECRET=(.*)$') {
    $env:GOOGLE_OAUTH_CLIENT_SECRET = $matches[1].Trim()
  }
}

if (-not $env:GOOGLE_OAUTH_CLIENT_ID -or -not $env:GOOGLE_OAUTH_CLIENT_SECRET) {
  Write-Error "GOOGLE_OAUTH_* missing in .env"
}

Write-Host "Restarting Supabase with Google OAuth configured..."
npx supabase stop
npx supabase start

$id = docker exec supabase_auth_ionexflow printenv GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID 2>$null
$enabled = docker exec supabase_auth_ionexflow printenv GOTRUE_EXTERNAL_GOOGLE_ENABLED 2>$null
$redirect = docker exec supabase_auth_ionexflow printenv GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI 2>$null

if ($id -like "env(*") {
  Write-Host "FAIL: Google client id was not substituted"
  exit 1
}
if ($id -like "*.apps.googleusercontent.com") {
  Write-Host "OK: Google OAuth client loaded (…$($id.Substring($id.Length-20)))"
} else {
  Write-Host "FAIL: unexpected client id format"
  exit 1
}
Write-Host "OK: enabled=$enabled"
Write-Host "OK: redirect=$redirect"
