@echo off
title MelroseOS Trigger Dashboard

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0TRIGGER-07_Dashboard.ps1"

pause