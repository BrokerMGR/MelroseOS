@echo off
setlocal
title MelroseOS Builder v3
set "TARGET=%~1"
if "%TARGET%"=="" set "TARGET=CHANGED"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0BUILD.ps1" -Target "%TARGET%"
set "EC=%ERRORLEVEL%"
echo.
if not "%EC%"=="0" (
  echo [ERROR] Build failed.
  start "" notepad.exe "C:\MelroseOS\Logs\BuilderV3-Latest.log"
) else (
  echo [SUCCESS] Build completed.
  echo Web App deployment remains manual.
)
pause
exit /b %EC%
