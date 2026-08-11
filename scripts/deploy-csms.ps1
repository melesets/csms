# scripts/deploy-csms.ps1
# Deploys CSMS alongside existing ISBAR. Does NOT touch ISBAR.
param(
  [string]$NginxRoot = "C:\nginx-1.28.0"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p  = New-Object Security.Principal.WindowsPrincipal($id)
  if (-not $p.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
    Write-Warning "Tip: Run PowerShell as Administrator to avoid 'Access denied' when reloading Nginx."
  }
}

# Resolve paths
$projectRoot  = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$frontendRoot = Join-Path $projectRoot "frontend"
$backendRoot  = Join-Path $projectRoot "backend"
$nginxExe     = Join-Path $NginxRoot "nginx.exe"
$MainConf     = "C:\App file\nginx.conf\nginx.conf"

Write-Host "[1/5] Build frontend (production)..." -ForegroundColor Cyan
Push-Location $frontendRoot
npm run build:production
Pop-Location

Write-Host "[2/5] Ensure dist is readable (one-time)..." -ForegroundColor Cyan
$distPath = Join-Path $frontendRoot "dist"
icacls "$distPath" /grant "Users:(OI)(CI)(RX)" /T 2>$null | Out-Null

Write-Host "[3/5] Inject CSMS nginx block if missing..." -ForegroundColor Cyan
if (Test-Path $MainConf) {
    $content = Get-Content $MainConf -Raw
    if ($content -notmatch "# === CSMS") {
        $csmsLocations = @"

    # ── CSMS (added by deploy script) ─────────────────────────
    location /csms/ {
        proxy_pass http://127.0.0.1:3777/csms/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
"@
        $content = $content -replace '(\s*\}\s*)$', "$csmsLocations`n`$1"
        Set-Content $MainConf -Value $content -NoNewline
        Write-Host "  Added CSMS block to nginx.conf" -ForegroundColor Green
    } else {
        Write-Host "  CSMS block already exists" -ForegroundColor Yellow
    }
} else {
    Write-Warning "Main nginx.conf not found at $MainConf"
}

Write-Host "[4/5] Validate & reload Nginx..." -ForegroundColor Cyan
Ensure-Admin
& $nginxExe -p "$NginxRoot\" -t
try {
    & $nginxExe -p "$NginxRoot\" -s reload
} catch {
    Write-Warning "Reload failed. Starting fresh..."
    & $nginxExe -p "$NginxRoot\" -s stop 2>$null
    Start-Sleep -Seconds 1
    & $nginxExe -p "$NginxRoot\"
}

Write-Host "[5/5] Start/restart CSMS backend..." -ForegroundColor Cyan
if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    npm i -g pm2
}
Push-Location $backendRoot
if (-not (Test-Path (Join-Path $backendRoot "node_modules"))) {
    npm ci
}
if (pm2 list 2>$null | Select-String -Quiet "csms") {
    pm2 restart csms --update-env
} else {
    pm2 start "$backendRoot\ecosystem.config.cjs" --update-env
}
pm2 save | Out-Null
Pop-Location

Write-Host "`nSmoke tests..." -ForegroundColor Yellow
try {
    $csms = Invoke-RestMethod "http://localhost/csms/api/health" -ErrorAction Stop -TimeoutSec 5
    Write-Host "  /csms/ via Nginx: $($csms.status)" -ForegroundColor Green
} catch { Write-Warning "  /csms/ check failed: $($_.Exception.Message)" }

try {
    $direct = Invoke-RestMethod "http://localhost:3777/api/health" -ErrorAction Stop -TimeoutSec 5
    Write-Host "  Direct API (:3777): $($direct.status)" -ForegroundColor Green
} catch { Write-Warning "  Direct API check failed: $($_.Exception.Message)" }

Write-Host "`n=== CSMS Deployment Complete ===" -ForegroundColor Green
Write-Host "  App: http://192.168.1.250/csms/"
Write-Host "  API: http://192.168.1.250/csms/api/"
Write-Host "  ISBAR unchanged: http://192.168.1.250/isbar/"
