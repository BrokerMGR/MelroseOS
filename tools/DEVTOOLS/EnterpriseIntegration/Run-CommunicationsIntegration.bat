@echo off
title MelroseOS Communications Integration

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0INT-04_CommunicationsIntegration.ps1"

pause