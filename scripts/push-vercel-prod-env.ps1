# Push production secrets to Vercel (ionexflow) without printing values.
# 1) Copy .env.vercel.production.example → .env.vercel.production
# 2) Fill real values
# 3) powershell -File scripts/push-vercel-prod-env.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env.vercel.production"
$scope = "alejandro-polanco-andrades-projects"

if (-not (Test-Path $envFile)) {
  Write-Host "Missing $envFile"
  Write-Host "Copy .env.vercel.production.example and fill Supabase + Stripe keys."
  exit 1
}

$keys = @(
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_GOOGLE_AUTH_ENABLED",
  "STRIPE_SECRET_KEY",
  "STRIPE_PRICE_ID",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "OPENAI_API_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM",
  "CRON_SECRET",
  "EMAIL_INBOUND_SECRET",
  "EMAIL_CREDENTIALS_ENCRYPTION_KEY"
)

$map = @{}
Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return }
  $i = $line.IndexOf("=")
  if ($i -lt 1) { return }
  $k = $line.Substring(0, $i).Trim()
  $v = $line.Substring($i + 1).Trim()
  if ($v.StartsWith('"') -and $v.EndsWith('"')) {
    $v = $v.Substring(1, $v.Length - 2)
  }
  $map[$k] = $v
}

$pushed = 0
foreach ($k in $keys) {
  if (-not $map.ContainsKey($k)) { continue }
  $v = $map[$k]
  if (-not $v -or $v -match "YOUR_REF|your-|sk_test_\.\.\.|pk_test_\.\.\.") {
    Write-Host "skip $k (empty or placeholder)"
    continue
  }
  Write-Host "Setting $k (production)…"
  $v | npx vercel env add $k production --scope $scope --force --yes 2>$null
  if ($LASTEXITCODE -eq 0) { $pushed++ } else {
    # retry without --force for first-time add
    $v | npx vercel env add $k production --scope $scope --yes
    if ($LASTEXITCODE -eq 0) { $pushed++ }
  }
}

Write-Host "Done. Vars touched: $pushed"
Write-Host "Redeploy: npx vercel --prod --yes --scope $scope"
Write-Host "Then: npx supabase link + npx supabase db push (with your project ref)"
