@echo off
title MelroseOS Orphan Code Detector

cd /d "%~dp0"

powershell ^
-ExecutionPolicy Bypass ^
-File "%~dp0Find-OrphanedCode.ps1"

echo.
pause