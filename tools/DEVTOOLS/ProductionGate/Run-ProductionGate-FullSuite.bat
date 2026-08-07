@echo off
title MelroseOS Production Gate Full Suite

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0PG-05_MasterGate.ps1"

pause