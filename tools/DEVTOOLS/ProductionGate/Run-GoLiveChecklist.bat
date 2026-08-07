@echo off
title MelroseOS Go-Live Checklist

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0PG-04_GoLiveChecklist.ps1"

echo.
pause