#!/usr/bin/env pwsh
# LEGATRIXON Backend - Automated Fly.io Deployment Script
# Run this ONCE to deploy your backend to production

param(
    [switch]$SkipDependencies,
    [string]$AppName = "legatrixon-backend",
    [string]$Region = "mia"
)

$ErrorActionPreference = "Stop"
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "🚀 LEGATRIXON Backend - Fly.io Deployment" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green

# ============================================================================
# STEP 1: Check flyctl
# ============================================================================
Write-Host "`n1️⃣  Checking Fly CLI..." -ForegroundColor Cyan

try {
    $flyVersion = flyctl version
    Write-Host "✅ Fly CLI installed: $flyVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Fly CLI not found. Install with:" -ForegroundColor Red
    Write-Host "   choco install flyctl" -ForegroundColor Yellow
    exit 1
}

# ============================================================================
# STEP 2: Verify authentication
# ============================================================================
Write-Host "`n2️⃣  Verifying Fly.io authentication..." -ForegroundColor Cyan

try {
    $auth = flyctl auth whoami
    Write-Host "✅ Authenticated as: $auth" -ForegroundColor Green
} catch {
    Write-Host "❌ Not authenticated. Run:" -ForegroundColor Red
    Write-Host "   flyctl auth login" -ForegroundColor Yellow
    exit 1
}

# ============================================================================
# STEP 3: Build backend
# ============================================================================
Write-Host "`n3️⃣  Building backend..." -ForegroundColor Cyan

cd "$ScriptPath\server"
npm run build 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build successful" -ForegroundColor Green

# ============================================================================
# STEP 4: Create Fly.io app
# ============================================================================
Write-Host "`n4️⃣  Creating Fly.io app: $AppName in $Region..." -ForegroundColor Cyan

cd $ScriptPath

try {
    flyctl apps list | Select-String $AppName > $null
    Write-Host "✅ App '$AppName' already exists" -ForegroundColor Green
} catch {
    Write-Host "Creating new app..." -ForegroundColor Yellow
    flyctl launch --name $AppName --region $Region --no-deploy --generate-name 2>&1 | Out-Null
    Write-Host "✅ App created: $AppName" -ForegroundColor Green
}

# ============================================================================
# STEP 5: Collect secrets
# ============================================================================
Write-Host "`n5️⃣  Setting secrets..." -ForegroundColor Cyan
Write-Host "⚠️  You'll be asked for credentials. Have these ready:" -ForegroundColor Yellow
Write-Host "   • Supabase URL and keys"
Write-Host "   • Qdrant URL and API key"
Write-Host "   • Redis URL (or leave blank to use default)"
Write-Host "   • OpenRouter API key"

$secrets = @{
    NODE_ENV = "production"
}

# Function to prompt for secret
function Get-Secret {
    param([string]$Name, [bool]$IsRequired = $true)
    
    while ($true) {
        $value = Read-Host "Enter $Name $(if ($IsRequired) { '(required)' } else { '(optional - press Enter to skip)' })"
        
        if ([string]::IsNullOrWhiteSpace($value)) {
            if ($IsRequired) {
                Write-Host "  ⚠️  This is required" -ForegroundColor Yellow
                continue
            }
            return $null
        }
        return $value
    }
}

# Collect all secrets
$secrets["NEXT_PUBLIC_SUPABASE_URL"] = Get-Secret "NEXT_PUBLIC_SUPABASE_URL (e.g., https://xxxx.supabase.co)" $true
$secrets["NEXT_PUBLIC_SUPABASE_ANON_KEY"] = Get-Secret "NEXT_PUBLIC_SUPABASE_ANON_KEY" $true
$secrets["SUPABASE_SERVICE_ROLE_KEY"] = Get-Secret "SUPABASE_SERVICE_ROLE_KEY (secret)" $true
$secrets["QDRANT_URL"] = Get-Secret "QDRANT_URL (e.g., https://cluster.qdrant.io)" $true
$secrets["QDRANT_API_KEY"] = Get-Secret "QDRANT_API_KEY" $true
$secrets["REDIS_URL"] = Get-Secret "REDIS_URL (optional, will use default if blank)" $false
$secrets["OPENROUTER_API_KEY"] = Get-Secret "OPENROUTER_API_KEY" $true

# Optional secrets
$postgresUrl = Get-Secret "POSTGRES_URL (optional, Fly.io creates this) - skip for now" $false
if ($postgresUrl) {
    $secrets["POSTGRES_URL"] = $postgresUrl
}

# ============================================================================
# STEP 6: Set secrets in Fly.io
# ============================================================================
Write-Host "`n6️⃣  Uploading secrets to Fly.io..." -ForegroundColor Cyan

foreach ($key in $secrets.Keys) {
    if ([string]::IsNullOrWhiteSpace($secrets[$key])) {
        continue
    }
    
    Write-Host "  Setting $key..." -ForegroundColor Gray
    
    # Escape special characters for PowerShell
    $value = $secrets[$key] -replace '"', '\"'
    flyctl secrets set "$key=$value" --app $AppName 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✅ $key set" -ForegroundColor Green
    } else {
        Write-Host "    ❌ Failed to set $key" -ForegroundColor Red
        exit 1
    }
}

# ============================================================================
# STEP 7: Deploy
# ============================================================================
Write-Host "`n7️⃣  Deploying to Fly.io..." -ForegroundColor Cyan
Write-Host "⏳ This may take 2-3 minutes..." -ForegroundColor Yellow

flyctl deploy --app $AppName

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    exit 1
}

# ============================================================================
# STEP 8: Verify
# ============================================================================
Write-Host "`n8️⃣  Verifying deployment..." -ForegroundColor Cyan

$appUrl = "https://$AppName.fly.dev"
Write-Host "   Waiting 10 seconds for app to start..." -ForegroundColor Gray
Start-Sleep -Seconds 10

$healthCheck = Invoke-WebRequest -Uri "$appUrl/health" -ErrorAction SilentlyContinue

if ($healthCheck.StatusCode -eq 200) {
    Write-Host "✅ Health check passed!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Health check pending (can take a minute)" -ForegroundColor Yellow
}

# ============================================================================
# SUCCESS
# ============================================================================
Write-Host "`n" -ForegroundColor Green
Write-Host "🎉 DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host "`n📱 Your backend is now live at:" -ForegroundColor Cyan
Write-Host "   $appUrl" -ForegroundColor Yellow
Write-Host "`n🔗 Health check:" -ForegroundColor Cyan
Write-Host "   $appUrl/health" -ForegroundColor Yellow
Write-Host "`n📊 View logs:" -ForegroundColor Cyan
Write-Host "   flyctl logs --app $AppName -f" -ForegroundColor Yellow
Write-Host "`n🌐 Connect your frontend to:" -ForegroundColor Cyan
Write-Host "   $appUrl/api/v1" -ForegroundColor Yellow
Write-Host "`n"
