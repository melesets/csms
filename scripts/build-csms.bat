@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0..\frontend"
npm run build:production
echo.
echo Build complete. Frontend dist ready at frontend\dist\
