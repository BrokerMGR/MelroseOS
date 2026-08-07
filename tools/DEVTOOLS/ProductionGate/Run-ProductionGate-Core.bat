@echo off
title MelroseOS Production Gate

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0PG-00_Core.ps1"

pause