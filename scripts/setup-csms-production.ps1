# ===== Run as Administrator =====
# Adds CSMS service alongside existing ISBAR. Does NOT touch ISBAR.
# Right-click -> "Run with PowerShell (Admin)"

# ===== Paths =====
$NssmPath = "C:\nssm-2.24\win64\nssm.exe"
$NodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $NodeExe) { $NodeExe = "C:\Program Files\nodejs\node.exe" }
$CsmsAppDir = "C:\new\csms\backend"
$CsmsPort = 3777
$NginxExe = "C:\nginx-1.28.0\nginx.exe"
$NginxDir = "C:\nginx-1.28.0"
$NginxConf = "C:\new\csms\nginx\nginx-csms.conf"

# Ensure log directories exist
New-Item -ItemType Directory -Path "$CsmsAppDir\logs" -Force | Out-Null
New-Item -ItemType Directory -Path "$NginxDir\logs" -Force | Out-Null

# ===== 1. Install CSMS-API Service =====
Write-Host "`n[1/2] Setting up CSMS-API service..." -ForegroundColor Cyan
& $NssmPath remove CSMS-API confirm 2>$null | Out-Null

if (!(Test-Path $NodeExe)) {
  Write-Error "Node not found at $NodeExe. Install Node.js or adjust path."
  exit 1
}

& $NssmPath install CSMS-API $NodeExe | Out-Null
& $NssmPath set CSMS-API AppDirectory $CsmsAppDir | Out-Null
& $NssmPath set CSMS-API AppParameters "src\index.js" | Out-Null
& $NssmPath set CSMS-API AppEnvironmentExtra "NODE_ENV=production","PORT=$CsmsPort" | Out-Null
& $NssmPath set CSMS-API Start SERVICE_AUTO_START | Out-Null
& $NssmPath set CSMS-API AppThrottle 1500 | Out-Null
& $NssmPath set CSMS-API AppRestartDelay 5000 | Out-Null
& $NssmPath set CSMS-API AppStdout "$CsmsAppDir\logs\csms-api-out.log" | Out-Null
& $NssmPath set CSMS-API AppStderr "$CsmsAppDir\logs\csms-api-err.log" | Out-Null
& $NssmPath set CSMS-API AppStdoutCreationDisposition 2 | Out-Null
& $NssmPath set CSMS-API AppStderrCreationDisposition 2 | Out-Null

# ===== 2. Merge CSMS location into Nginx config =====
Write-Host "`n[2/2] Updating Nginx config with CSMS block..." -ForegroundColor Cyan

# Check if CSMS block already exists in main nginx.conf
$MainConf = "C:\App file\nginx.conf\nginx.conf"
$CsmsMarker = "# === CSMS"

if (Test-Path $MainConf) {
    $content = Get-Content $MainConf -Raw
    if ($content -notmatch [regex]::Escape($CsmsMarker)) {
        # Read the CSMS server block content
        $csmsBlock = Get-Content $NginxConf -Raw
        
        # Append CSMS locations into the existing server block
        $csmsLocations = @"

    # ── CSMS (added by setup script) ─────────────────────────
    location /csms/ {
        proxy_pass http://127.0.0.1:3777/csms/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
    }
"@
        # Insert before the last closing brace of the server block
        $content = $content -replace '(\s*\}\s*)$', "$csmsLocations`n`$1"
        Set-Content $MainConf -Value $content -NoNewline
        Write-Host "  Added CSMS location block to $MainConf" -ForegroundColor Green
    } else {
        Write-Host "  CSMS block already exists in nginx.conf" -ForegroundColor Yellow
    }
} else {
    Write-Host "  Main nginx.conf not found at $MainConf. Using standalone CSMS config." -ForegroundColor Yellow
    Write-Host "  Copy nginx-csms.conf contents into your main nginx.conf inside the server {} block." -ForegroundColor Yellow
}

# ===== 3. Start CSMS Service =====
Write-Host "`nStarting CSMS-API service..." -ForegroundColor Green
Start-Service CSMS-API -ErrorAction SilentlyContinue

# ===== 4. Reload Nginx =====
Write-Host "Reloading Nginx..." -ForegroundColor Green
try {
    & $NginxExe -p "$NginxDir\" -t
    & $NginxExe -p "$NginxDir\" -s reload
} catch {
    Write-Warning "Nginx reload failed. Restarting..."
    & $NginxExe -p "$NginxDir\" -s stop 2>$null
    Start-Sleep -Seconds 1
    & $NginxExe -p "$NginxDir\"
}

# ===== 5. Verify =====
Write-Host "`nService Status:" -ForegroundColor Yellow
Write-Host "  ISBAR-API (unchanged):" -ForegroundColor Gray
Get-Service ISBAR-API -ErrorAction SilentlyContinue | Select-Object Name, Status, StartType | Format-Table -AutoSize
Write-Host "  CSMS-API (new):" -ForegroundColor Cyan
Get-Service CSMS-API -ErrorAction SilentlyContinue | Select-Object Name, Status, StartType | Format-Table -AutoSize

Write-Host "`nVerifying CSMS endpoints..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod "http://localhost:$CsmsPort/api/health" -ErrorAction Stop -TimeoutSec 5
    Write-Host "  Direct API (:$CsmsPort) health: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "  Direct API health check failed: $_" -ForegroundColor Red
}

try {
    $csms = Invoke-RestMethod "http://localhost/csms/api/health" -ErrorAction Stop -TimeoutSec 5
    Write-Host "  Via Nginx (/csms/) health: $($csms.status)" -ForegroundColor Green
} catch {
    Write-Host "  Nginx proxy health check failed: $_" -ForegroundColor Red
}

Write-Host "`n=== CSMS Production Setup Complete ===" -ForegroundColor Green
Write-Host "  App URL:     http://192.168.1.250/csms/"
Write-Host "  API:         http://192.168.1.250/csms/api/"
Write-Host "  ISBAR (old): http://192.168.1.250/isbar/  (unchanged)"
Write-Host ""
Write-Host "Logs:"
Write-Host "  CSMS API: $CsmsAppDir\logs\csms-api-*.log"
Write-Host "  Nginx:    $NginxDir\logs\nginx-*.log"
