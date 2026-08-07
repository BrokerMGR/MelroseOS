@echo off
title MelroseOS Trigger Integration

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0INSTALLER-04_TriggerIntegration.ps1"

pause