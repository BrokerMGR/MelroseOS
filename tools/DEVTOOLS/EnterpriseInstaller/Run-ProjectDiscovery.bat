@echo off
title MelroseOS Project Discovery

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0INSTALLER-01_ProjectDiscovery.ps1"

pause