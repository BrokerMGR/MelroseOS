@echo off
title MelroseOS Trigger Repair

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0TRIGGER-06_RepairEngine.ps1"

pause