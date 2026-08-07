@echo off
title MelroseOS Routing Integration

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0INT-05_RoutingIntegration.ps1"

pause