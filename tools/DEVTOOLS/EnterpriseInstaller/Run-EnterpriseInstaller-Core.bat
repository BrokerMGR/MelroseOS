@echo off
setlocal EnableExtensions

title MelroseOS Enterprise Installer

cd /d "%~dp0"

powershell ^
  -NoProfile ^
  -ExecutionPolicy Bypass ^
  -File "%~dp0INSTALLER-00_Core.ps1"

echo.
pause