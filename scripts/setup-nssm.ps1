# ===== Run as Administrator =====
# 1. Save this script as "setup-nssm.ps1"
# 2. Right-click -> "Run with PowerShell (Admin)"

# ===== Paths =====
$NssmPath = "C:\nssm-2.24\win64\nssm.exe"  # Adjust if using 32-bit
# Prefer running Node directly as a service (avoids pm2/wmic issues under LocalSystem)
# Auto-detect Node path; fall back to default install location
$NodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $NodeExe) { $NodeExe = "C:\Program Files\nodejs\node.exe" }
$ServerScriptRel = "src\index.js"
$AppDir = "C:\App file\ISBAR_4\server"
# Backend port (adjust as needed)
$BackendPort = 4000
$NginxExe = "C:\nginx-1.28.0\nginx.exe"
$NginxDir = "C:\nginx-1.28.0"

# Ensure log directories exist
New-Item -ItemType Directory -Path "$AppDir\logs" -Force | Out-Null
New-Item -ItemType Directory -Path "$NginxDir\logs" -Force | Out-Null

# ===== 1. Install ISBAR-API Service =====
Write-Host "`n[1/2] Setting up ISBAR-API service (Node)..." -ForegroundColor Cyan
# Remove any existing service to ensure a clean reset
& $NssmPath remove ISBAR-API confirm 2>$null | Out-Null
# Validate Node executable
if (!(Test-Path $NodeExe)) {
  Write-Error "Node not found at $NodeExe. Please install Node.js (https://nodejs.org/) or adjust NodeExe path."
  exit 1
}
# Install if missing, otherwise update settings
& $NssmPath install ISBAR-API $NodeExe | Out-Null
& $NssmPath set ISBAR-API AppDirectory $AppDir | Out-Null
# Use relative script path so spaces in 'C:\App file' do not break parameter parsing
& $NssmPath set ISBAR-API AppParameters "$ServerScriptRel" | Out-Null
& $NssmPath set ISBAR-API AppEnvironmentExtra "NODE_ENV=production","PORT=$BackendPort" | Out-Null
& $NssmPath set ISBAR-API Start SERVICE_AUTO_START | Out-Null
& $NssmPath set ISBAR-API AppThrottle 1500 | Out-Null
& $NssmPath set ISBAR-API AppRestartDelay 5000 | Out-Null
& $NssmPath set ISBAR-API AppStdout "$AppDir\logs\isbar-api-out.log" | Out-Null
& $NssmPath set ISBAR-API AppStderr "$AppDir\logs\isbar-api-err.log" | Out-Null
& $NssmPath set ISBAR-API AppStdoutCreationDisposition 2 | Out-Null
& $NssmPath set ISBAR-API AppStderrCreationDisposition 2 | Out-Null

# ===== 2. Install Nginx Service =====
Write-Host "`n[2/2] Setting up Nginx service..." -ForegroundColor Cyan
# Remove and re-install Nginx service to ensure parameters are applied
& $NssmPath remove Nginx confirm 2>$null | Out-Null
& $NssmPath install Nginx $NginxExe | Out-Null
& $NssmPath set Nginx AppDirectory $NginxDir | Out-Null
# Use absolute nginx.conf in workspace to keep config versioned and set prefix for logs/pid
& $NssmPath set Nginx AppParameters "-p `"$NginxDir`" -c `"C:\App file\nginx.conf\nginx.conf`"" | Out-Null
& $NssmPath set Nginx Start SERVICE_AUTO_START | Out-Null
& $NssmPath set Nginx AppThrottle 1500 | Out-Null
& $NssmPath set Nginx AppRestartDelay 3000 | Out-Null
& $NssmPath set Nginx AppStdout "$NginxDir\logs\nginx-out.log" | Out-Null
& $NssmPath set Nginx AppStderr "$NginxDir\logs\nginx-err.log" | Out-Null
& $NssmPath set Nginx AppStdoutCreationDisposition 2 | Out-Null
& $NssmPath set Nginx AppStderrCreationDisposition 2 | Out-Null

# ===== 3. Start Services =====
Write-Host "`nStarting services..." -ForegroundColor Green
Start-Service ISBAR-API -ErrorAction SilentlyContinue
Start-Service Nginx -ErrorAction SilentlyContinue

# ===== 4. Verify =====
Write-Host "`nService Status:" -ForegroundColor Yellow
Get-Service ISBAR-API, Nginx -ErrorAction SilentlyContinue | Select-Object Name, Status, StartType | Format-Table -AutoSize

Write-Host "`nVerifying endpoints..." -ForegroundColor Yellow
try {
    $healthDirect = Invoke-RestMethod "http://localhost:$BackendPort/api/health" -ErrorAction Stop -TimeoutSec 5
    Write-Host "✓ Direct API ($BackendPort) health: $($healthDirect | ConvertTo-Json -Compress)" -ForegroundColor Green
} catch {
    Write-Host "✗ Direct API health check failed: $_" -ForegroundColor Red
}

try {
    $healthViaNginx = Invoke-RestMethod "http://localhost:8080/isbar/api/health" -ErrorAction Stop -TimeoutSec 5
    Write-Host "✓ Via Nginx (:8080/isbar) health: $($healthViaNginx | ConvertTo-Json -Compress)" -ForegroundColor Green
} catch {
    Write-Host "✗ Nginx proxy health check failed: $_" -ForegroundColor Red
}

Write-Host "`nSetup complete! Access your application at: http://localhost/isbar/" -ForegroundColor Green
Write-Host "Logs:" -ForegroundColor Yellow
Write-Host "- Backend: $AppDir\logs\isbar-api-*.log"
Write-Host "- Nginx: $NginxDir\logs\nginx-*.log"

# Keep window open to see results
Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
