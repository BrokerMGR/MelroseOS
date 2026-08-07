@echo off
title MelroseOS Dashboard Integration

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0INT-06_DashboardIntegration.ps1"

pause