@echo off
title Git ↔ Apps Script Validator

cd /d "%~dp0"

powershell ^
-ExecutionPolicy Bypass ^
-File "%~dp0Validate-GitAppsScriptSync.ps1"

echo.
pause