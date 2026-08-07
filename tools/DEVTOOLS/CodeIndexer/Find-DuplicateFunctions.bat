@echo off
title MelroseOS Duplicate Function Detector

cd /d "%~dp0"

powershell ^
  -ExecutionPolicy Bypass ^
  -File "%~dp0Find-DuplicateFunctions.ps1"

echo.
pause