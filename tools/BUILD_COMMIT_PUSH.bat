@echo off
setlocal
title MelroseOS Builder v3 - Commit Push Deploy Source
set "TARGET=%~1"
if "%TARGET%"=="" set "TARGET=CHANGED"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0BUILD.ps1" -Target "%TARGET%" -Commit -PushGit
set "EC=%ERRORLEVEL%"
echo.
if not "%EC%"=="0" (
  echo [ERROR] Build failed.
  start "" notepad.exe "C:\MelroseOS\Logs\BuilderV3-Latest.log"
) else (
  echo [SUCCESS] Git committed, pushed, and clasp source pushed.
)
pause
exit /b %EC%
