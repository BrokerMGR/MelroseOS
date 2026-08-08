@echo off
title MelroseOS Historical Lead Migration

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0LM-00_Core.ps1"

pause