# scripts/deploy-windows.ps1
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

function Invoke-NpmInstall {
  try {
    npm ci
  } catch {
    Write-Warning "npm ci failed; falling back to npm install"
    npm install
  }
}

# Resolve paths
$projectRoot  = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$frontendRoot = Join-Path $projectRoot "frontend"
$backendRoot  = Join-Path $projectRoot "backend"
$nginxExe     = Join-Path $NginxRoot "nginx.exe"

Write-Host "[1/6] Install deps and build frontend..." -ForegroundColor Cyan
Push-Location $frontendRoot
Invoke-NpmInstall
npm run build
Pop-Location

Write-Host "[2/6] Ensure dist is readable by Nginx (one-time)..." -ForegroundColor Cyan
$distPath = Join-Path $frontendRoot "dist"
icacls "$distPath" /grant "Users:(OI)(CI)(RX)" /T | Out-Null

Write-Host "[3/6] Validate Nginx config..." -ForegroundColor Cyan
& $nginxExe -p ("{0}\" -f $NginxRoot) -t

Write-Host "[4/6] Reload/Start Nginx..." -ForegroundColor Cyan
Ensure-Admin
try {
  & $nginxExe -p ("{0}\" -f $NginxRoot) -s reload
} catch {
  Write-Warning "Reload failed or Nginx not running. Starting fresh..."
  taskkill /F /IM nginx.exe 2>$null | Out-Null
  & $nginxExe -p ("{0}\" -f $NginxRoot) -c "conf\nginx.conf"
}

Write-Host "[5/6] Ensure PM2 and (re)start backend..." -ForegroundColor Cyan
if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
  npm i -g pm2
}
Push-Location $backendRoot
if (-not (Test-Path (Join-Path $backendRoot "node_modules"))) {
  Invoke-NpmInstall
}
if (pm2 list | Select-String -Quiet "isbar-server") {
  pm2 restart isbar-server --update-env
} else {
  pm2 start "$backendRoot\ecosystem.config.cjs" --update-env
}
pm2 save | Out-Null
Pop-Location

Write-Host "[6/6] Smoke tests..." -ForegroundColor Cyan
try {
  $root = iwr http://localhost/ -UseBasicParsing -Headers @{Accept="text/html"} -Method GET
  Write-Host "Root (/): $($root.StatusCode) (should be 200 with redirect shown in browser)" -ForegroundColor Green
} catch { Write-Warning "Root check failed: $($_.Exception.Message)" }

try {
  $spa = iwr http://localhost/isbar/ -UseBasicParsing -Headers @{Accept="text/html"} -Method GET
  Write-Host "/isbar/: $($spa.StatusCode)" -ForegroundColor Green
} catch { Write-Warning "/isbar/ check failed: $($_.Exception.Message)" }

try {
  $api = iwr http://localhost/api/departments -UseBasicParsing -Method GET
  Write-Host "/api/departments: $($api.StatusCode) -> $($api.Content)" -ForegroundColor Green
} catch { Write-Warning "/api/departments check failed: $($_.Exception.Message)" }

Write-Host "`nDeployment completed."
Write-Host "Open: http://localhost/isbar/"
Write-Host "API:  http://localhost/api/departments"
