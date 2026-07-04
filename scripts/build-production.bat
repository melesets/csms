@echo off
set PATH=C:\Program Files\nodejs;%PATH%
set VITE_API_URL=https://backend.melesets.com/api
cd /d "%~dp0..\frontend"
npm run build:production
