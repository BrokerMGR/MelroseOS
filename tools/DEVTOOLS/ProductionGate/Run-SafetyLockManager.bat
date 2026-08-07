@echo off
title MelroseOS Safety Lock Manager

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0PG-01_SafetyLockManager.ps1"

pause