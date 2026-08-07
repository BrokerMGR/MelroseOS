@echo off
title MelroseOS Unmapped Project Detector

cd /d "%~dp0"

powershell ^
  -ExecutionPolicy Bypass ^
  -File "%~dp0Find-UnmappedProjects.ps1"

echo.
pause