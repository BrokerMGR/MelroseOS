@echo off
title MelroseOS Trigger Diagnostics

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0TRIGGER-08_Diagnostics.ps1"

echo.
pause