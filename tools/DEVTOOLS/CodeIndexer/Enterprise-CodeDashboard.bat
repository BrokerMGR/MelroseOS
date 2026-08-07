@echo off
title MelroseOS Enterprise Code Dashboard

cd /d "%~dp0"

powershell ^
-ExecutionPolicy Bypass ^
-File "%~dp0Enterprise-CodeDashboard.ps1"

pause