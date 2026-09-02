$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "" 
Write-Host "=== AI Assistant setup ===" -ForegroundColor Cyan
Write-Host "This script links Supabase, saves the OpenAI key as a server-side secret, and deploys the Edge Function."
Write-Host ""

function Find-ProjectRef {
    $envFiles = @(".env", ".env.local", ".env.production")

    foreach ($file in $envFiles) {
        if (Test-Path $file) {
            $line = Get-Content $file | Where-Object { $_ -match '^VITE_SUPABASE_URL=' } | Select-Object -First 1
            if ($line) {
                $url = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
                if ($url -match '^https://([^.]+)\.supabase\.co') {
                    return $Matches[1]
                }
            }
        }
    }

    return $null
}

$projectRef = Find-ProjectRef
if (-not $projectRef) {
    $projectRef = Read-Host "Supabase project ref (the part before .supabase.co)"
}

if (-not $projectRef) {
    throw "Supabase project ref is required."
}

Write-Host "Using Supabase project: $projectRef" -ForegroundColor DarkCyan
Write-Host ""

Write-Host "If Supabase asks you to log in, complete the browser login and return here." -ForegroundColor Yellow
npx supabase login
if ($LASTEXITCODE -ne 0) { throw "Supabase login failed." }

npx supabase link --project-ref $projectRef
if ($LASTEXITCODE -ne 0) { throw "Supabase link failed." }

$secureKey = Read-Host "Paste the OpenAI API key (it will not be displayed)" -AsSecureString
$key = [System.Net.NetworkCredential]::new("", $secureKey).Password
if (-not $key) { throw "OpenAI API key is required." }

npx supabase secrets set "OPENAI_API_KEY=$key" --project-ref $projectRef
Remove-Variable key
Remove-Variable secureKey
if ($LASTEXITCODE -ne 0) { throw "Saving OPENAI_API_KEY failed." }

Write-Host "Deploying ai-assistant..." -ForegroundColor Cyan
npx supabase functions deploy ai-assistant --project-ref $projectRef
if ($LASTEXITCODE -ne 0) { throw "Edge Function deployment failed." }

Write-Host ""
Write-Host "AI Assistant deployed successfully!" -ForegroundColor Green
Write-Host "Open the app, sign in, and choose 'עוזר AI' from the navigation bar."
