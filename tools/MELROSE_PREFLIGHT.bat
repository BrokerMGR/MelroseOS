@echo off
setlocal
title MelroseOS Guided Git Preflight

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass ^
  -File "%~dp0MELROSE_PREFLIGHT.ps1"

set "EC=%ERRORLEVEL%"

echo.
if "%EC%"=="0" (
  echo [READY] Repository is clean or the verified stage was committed successfully.
) else (
  echo [NOTICE] Preflight exited with code %EC%.
)

echo.
pause
exit /b %EC%
