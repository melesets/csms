# ===== Run as Administrator =====
# 1. Save this script as "setup-nssm.ps1"
# 2. Right-click -> "Run with PowerShell (Admin)"

# ===== Paths =====
$NssmPath = "C:\nssm-2.24\win64\nssm.exe"  # Adjust if using 32-bit
$PM2Runtime = "$env:APPDATA\npm\pm2-runtime.cmd"
$Ecosystem = "C:\ISBAR_4\ISBAR_4\server\ecosystem.config.cjs"
$AppDir = "C:\ISBAR_4\ISBAR_4\server"
$NginxExe = "C:\nginx-1.28.0\nginx.exe"
$NginxDir = "C:\nginx-1.28.0"

# ===== 1. Install ISBAR-API Service =====
Write-Host "`n[1/2] Setting up ISBAR-API service..." -ForegroundColor Cyan
& $NssmPath install ISBAR-API $PM2Runtime $Ecosystem | Out-Null
& $NssmPath set ISBAR-API AppDirectory $AppDir | Out-Null
& $NssmPath set ISBAR-API Start SERVICE_AUTO_START | Out-Null
& $NssmPath set ISBAR-API AppThrottle 1500 | Out-Null
& $NssmPath set ISBAR-API AppRestartDelay 5000 | Out-Null
& $NssmPath set ISBAR-API AppStdout "$AppDir\logs\isbar-api-out.log" | Out-Null
& $NssmPath set ISBAR-API AppStderr "$AppDir\logs\isbar-api-err.log" | Out-Null
& $NssmPath set ISBAR-API AppStdoutCreationDisposition 2 | Out-Null
& $NssmPath set ISBAR-API AppStderrCreationDisposition 2 | Out-Null

# ===== 2. Install Nginx Service =====
Write-Host "`n[2/2] Setting up Nginx service..." -ForegroundColor Cyan
& $NssmPath install Nginx $NginxExe | Out-Null
& $NssmPath set Nginx AppDirectory $NginxDir | Out-Null
& $NssmPath set Nginx AppParameters "-p `"$NginxDir`" -c `"conf\nginx.conf`"" | Out-Null
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
    $depts = Invoke-RestMethod "http://localhost/api/departments" -ErrorAction Stop
    Write-Host "✓ API is running: $($depts -join ', ')" -ForegroundColor Green
} catch {
    Write-Host "✗ API check failed: $_" -ForegroundColor Red
}

Write-Host "`nSetup complete! Access your application at: http://localhost/isbar/" -ForegroundColor Green
Write-Host "Logs:" -ForegroundColor Yellow
Write-Host "- Backend: $AppDir\logs\isbar-api-*.log"
Write-Host "- Nginx: $NginxDir\logs\nginx-*.log"

# Keep window open to see results
Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
