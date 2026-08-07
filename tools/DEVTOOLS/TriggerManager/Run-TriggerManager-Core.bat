@echo off
setlocal EnableExtensions

title MelroseOS Trigger Manager

cd /d "%~dp0"

powershell ^
  -NoProfile ^
  -ExecutionPolicy Bypass ^
  -File "%~dp0TRIGGER-00_Core.ps1"

echo.
pause