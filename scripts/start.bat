@echo off
echo Starting ISBAR Application...
echo.

echo Starting Backend Server...
start "Backend" cmd /k "cd /d "%~dp0..\backend" && npm run dev"

echo Waiting for backend to start...
timeout /t 3 /nobreak > nul

echo Starting Frontend Development Server...
start "Frontend" cmd /k "cd /d "%~dp0..\frontend" && npm run dev"

echo.
echo Both servers are starting...
echo Backend: http://localhost:4000
echo Frontend: http://localhost:5173
echo.
echo Press any key to exit...
pause > nul
