@echo off
title MelroseOS Apps Script Push Engine

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0INSTALLER-03_AppsScriptPushEngine.ps1"

pause